import { api } from "./api";

export interface BackupRecord {
  id: number;
  filename: string;
  file_size: number;
  checksum: string;
  backup_version: string;
  app_version: string;
  backup_type: "manual" | "automatic" | "uploaded" | "pre_restore";
  status: "completed" | "failed" | "creating" | "restoring";
  created_by_name: string | null;
  is_encrypted: boolean;
  notes: string | null;
  restored_at: string | null;
  restore_count: number;
  created_at: string;
}

export interface BackupStats {
  total_backups: number;
  failed_backups: number;
  storage_used_bytes: number;
  last_backup_id: number | null;
  last_backup_filename: string | null;
  last_backup_created_at: string | null;
  last_backup_status: string | null;
  last_restore_id: number | null;
  last_restore_filename: string | null;
  last_restore_at: string | null;
  backup_dir: string;
}

export interface BackupSettings {
  auto_backup_enabled: boolean;
  schedule_interval: string;
  retention_mode: string;
  retention_count: number;
  retention_days: number;
  next_scheduled_run: string | null;
  last_scheduled_run: string | null;
}

interface BackupStatusResponse {
  stats: BackupStats;
  settings: BackupSettings;
}

export async function fetchBackups(limit = 100, offset = 0): Promise<{ backups: BackupRecord[]; total: number }> {
  const { data } = await api.get("/backup/list", { params: { limit, offset } });
  return data;
}

export async function fetchBackup(id: number): Promise<{ backup: BackupRecord }> {
  const { data } = await api.get(`/backup/${id}`);
  return data;
}

export async function fetchBackupStatus(): Promise<BackupStatusResponse> {
  const { data } = await api.get("/backup/status");
  return data;
}

export async function createBackup(notes?: string, password?: string): Promise<{ success: boolean; backup: BackupRecord }> {
  const { data } = await api.post("/backup/create", { notes, password });
  return data;
}

export async function downloadBackup(id: number): Promise<void> {
  const response = await api.get(`/backup/${id}/download`, { responseType: "blob" });
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match?.[1] || `REMS_Backup_${id}.remsbak`;
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function uploadBackup(file: File, password?: string): Promise<{ success: boolean; backup: BackupRecord }> {
  const formData = new FormData();
  formData.append("file", file);
  if (password) formData.append("password", password);
  const { data } = await api.post("/backup/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function restoreBackup(id: number, password?: string): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  if (password) formData.append("password", password);
  const { data } = await api.post(`/backup/restore/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteBackup(id: number): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/backup/${id}`);
  return data;
}

export async function restoreBackupFromUpload(file: File, password?: string): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (password) formData.append("password", password);
  const { data } = await api.post("/backup/restore", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function verifyBackup(id: number, password?: string): Promise<any> {
  const { data } = await api.get(`/backup/${id}/verify`, { params: { password } });
  return data;
}

export async function fetchBackupHistory(limit = 100, offset = 0): Promise<{ history: BackupRecord[]; total: number }> {
  const { data } = await api.get("/backup/history", { params: { limit, offset } });
  return data;
}

export async function updateBackupSettings(settings: Partial<BackupSettings>): Promise<{ success: boolean; settings: BackupSettings }> {
  const { data } = await api.patch("/backup/settings", settings);
  return data;
}

export async function updateBackupDir(backup_dir: string): Promise<{ success: boolean; backup_dir: string }> {
  const { data } = await api.patch("/backup/backup-dir", { backup_dir });
  return data;
}

// ── Clear System Data ───────────────────────────────────────────────────────

export interface PreClearBackupInfo {
  id: number;
  filename: string;
  file_size: number;
  checksum: string;
  backup_version: string;
  app_version: string;
  backup_type: string;
  status: string;
  created_by_name: string | null;
  created_at: string | null;
  filepath: string;
  backup_dir: string;
}

export interface ClearDataResult {
  success: boolean;
  message: string;
  cleared_at: string;
  details: {
    tables_cleared: number;
    total_rows_removed: number;
    failed_tables: string[];
  };
  audit: {
    action: string;
    cleared_by: string;
    cleared_by_role: string;
    cleared_at: string;
    ip_address: string;
    browser: string;
    tables_cleared: string[];
    tables_failed: string[];
    rows_removed: number;
  };
}

export async function verifyClearDataPassword(password: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post("/backup/clear-data/verify-password", { password });
  return data;
}

export async function prepareClearData(password: string): Promise<{ success: boolean; message: string; backup: PreClearBackupInfo }> {
  const { data } = await api.post("/backup/clear-data/prepare", { password });
  return data;
}

export async function executeClearData(password: string): Promise<ClearDataResult> {
  const { data } = await api.post("/backup/clear-data/execute", { password });
  return data;
}

export async function downloadBackupByPath(backupId: number, filename: string): Promise<void> {
  const response = await api.get(`/backup/${backupId}/download`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
