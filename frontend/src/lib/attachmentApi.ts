import { api, getAuthToken } from "./api";

export interface AttachmentItem { id: number; filename: string; module: string; record_id: number; [key: string]: any; }

export const attachmentApi = {
  upload: async (module: string, recordId: number, file: File, description: string, status: string): Promise<any> => {
    const formData = new FormData();
    formData.append("module", module);
    formData.append("record_id", String(recordId));
    formData.append("file", file);
    formData.append("description", description);
    formData.append("document_status", status);
    const { data } = await api.post("/attachments/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  list: async (module: string, recordId: number, params?: any): Promise<any[]> => {
    const { data } = await api.get(`/attachments/${module}/${recordId}`, { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  update: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/attachments/${id}`, payload);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/attachments/${id}`);
  },
  bulkDelete: async (ids: number[]): Promise<void> => {
    await api.post("/attachments/bulk-delete", { ids });
  },
  downloadUrl: (id: number): string => {
    const base = api.defaults.baseURL || "";
    const token = getAuthToken();
    return `${base}/attachments/${id}/download?token=${encodeURIComponent(token || "")}`;
  },
};
