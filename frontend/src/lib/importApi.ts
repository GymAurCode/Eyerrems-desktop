import { api } from "./api";

export type DuplicateMode = "skip" | "update" | "error";

export interface ImportModule {
  key: string;
  name: string;
  [key: string]: any;
}

export interface ImportRowPreview {
  row_number: number;
  status: string;
  [key: string]: any;
}

export interface ImportValidateResult {
  batch_id: string;
  rows: ImportRowPreview[];
  [key: string]: any;
}

export interface ImportExecuteResult {
  batch_id: string;
  imported: number;
  failed: number;
  errors?: any[];
  [key: string]: any;
}

export const importApi = {
  listModules: async (): Promise<ImportModule[]> => {
    const { data } = await api.get("/import/modules");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  downloadTemplate: async (moduleKey: string, format: string): Promise<void> => {
    const { data } = await api.get(`/import/${moduleKey}/template`, {
      params: { format },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${moduleKey}_template.${format}`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
  downloadCombinedTemplate: async (): Promise<void> => {
    const { data } = await api.get("/import/template/combined", { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "combined_template.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  },
  validate: async (moduleKey: string, file: File, duplicateMode: DuplicateMode): Promise<ImportValidateResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("duplicate_mode", duplicateMode);
    const { data } = await api.post(`/import/${moduleKey}/validate`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  execute: async (params: {
    module_key: string;
    duplicate_mode: DuplicateMode;
    batch_id: string;
    row_numbers: number[];
  }): Promise<ImportExecuteResult> => {
    const { data } = await api.post("/import/execute", params);
    return data;
  },
  downloadErrors: async (batchId: string): Promise<void> => {
    const resp = await api.get(`/import/${batchId}/errors`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([resp.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `import_errors_${batchId}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
