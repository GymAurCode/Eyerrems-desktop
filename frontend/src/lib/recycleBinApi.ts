import { api } from "./api";

export interface UserInfo {
  id: number;
  full_name: string;
  email: string;
  role_name: string;
  avatar: string;
}

export interface RecycleBinRecord {
  module: string;
  module_label: string;
  record_id: number;
  original_id: string;
  record_name: string;
  status: string;
  deleted_by: number | null;
  deleted_by_user: UserInfo | null;
  deleted_at: string | null;
  restored_at: string | null;
  restored_by: number | null;
  restored_by_user: UserInfo | null;
  original_business_number: string | null;
  restore_count: number;
  created_at: string | null;
  updated_at?: string | null;
  current_business_number?: string | null;
  company_id?: number | null;
}

export interface RecycleBinDetail extends RecycleBinRecord {
  current_business_number: string | null;
  updated_at: string | null;
  company_id: number | null;
  audit_logs: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: number;
  action: string;
  module?: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  actor_name?: string;
  actor_email?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface RecycleBinStats {
  deleted_today: number;
  deleted_this_week: number;
  deleted_this_month: number;
  total_deleted: number;
  recently_restored: number;
}

export interface RecycleBinResponse {
  records: RecycleBinRecord[];
  total: number;
}

export interface ModuleOption {
  key: string;
  label: string;
}

export async function fetchRecycleBin(params: {
  module?: string;
  search?: string;
  deleted_by?: number;
  date_from?: string;
  date_to?: string;
  restore_status?: string;
  limit?: number;
  offset?: number;
}): Promise<RecycleBinResponse> {
  const { data } = await api.get("/recycle-bin", { params });
  return data;
}

export async function fetchRecycleBinStats(): Promise<RecycleBinStats> {
  const { data } = await api.get("/recycle-bin/statistics");
  return data;
}

export async function fetchModules(): Promise<ModuleOption[]> {
  const { data } = await api.get("/recycle-bin/modules");
  return data.modules ?? [];
}

export async function fetchDetail(moduleKey: string, recordId: number): Promise<RecycleBinDetail> {
  const { data } = await api.get(`/recycle-bin/detail/${moduleKey}/${recordId}`);
  return data;
}

export async function restoreRecord(moduleKey: string, recordId: number): Promise<{ success: boolean; old_number?: string; new_number?: string; renumber_reason?: string }> {
  const { data } = await api.post(`/recycle-bin/restore/${moduleKey}/${recordId}`);
  return data;
}

export async function permanentDelete(moduleKey: string, recordId: number): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/recycle-bin/${moduleKey}/${recordId}`);
  return data;
}
