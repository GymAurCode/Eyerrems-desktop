import { api } from "./api";

export async function generateReport(reportKey: string, params?: Record<string, unknown>): Promise<unknown> {
  const { data } = await api.post(`/reports/${reportKey}`, params);
  return data;
}

export async function exportReport(reportKey: string, params?: Record<string, unknown>): Promise<Blob> {
  const { data } = await api.post(`/reports/${reportKey}/export`, params, {
    responseType: "blob",
  });
  return data;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
