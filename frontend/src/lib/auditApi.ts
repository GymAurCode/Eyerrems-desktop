import { api } from "./api";

export interface AuditLogEntry {
  id: string;
  module: string;
  action: string;
  record_id: string | null;
  record_label: string | null;
  changed_by: string;
  changed_by_role: string | null;
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  role: string | null;
  department: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  diff: { field: string; old_value: any; new_value: any }[] | Record<string, { from: any; to: any }> | null;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  request_method: string | null;
  api_endpoint: string | null;
  status: string | null;
  created_at: string;
}

export interface AuditLogsResponse {
  total: number;
  page: number;
  per_page: number;
  logs: AuditLogEntry[];
}

export interface AuditStats {
  total_today: number;
  total_week: number;
  total_month: number;
  total_year: number;
  total_all: number;
  by_module: Record<string, number>;
  by_action: Record<string, number>;
  by_user: { user: string; count: number }[];
}

export const auditApi = {
  getLogs: async (params?: any): Promise<AuditLogsResponse> => {
    const { data } = await api.get("/audit/logs", { params });
    return data;
  },
  getStats: async (): Promise<AuditStats> => {
    const { data } = await api.get("/audit/stats");
    return data;
  },
  getRecordHistory: async (recordId: string): Promise<AuditLogEntry[]> => {
    const { data } = await api.get(`/audit/logs/${recordId}`);
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
};