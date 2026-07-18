import { api } from "./api";

export interface AuditLogEntry {
  id: number;
  action: string;
  module: string;
  record_id: string;
  changes: any;
  timestamp: string;
  user_id: number;
  user_name?: string;
  [key: string]: any;
}

export interface AuditLogsResponse {
  items: AuditLogEntry[];
  total: number;
  [key: string]: any;
}

export interface AuditStats {
  total_logs: number;
  by_action: Record<string, number>;
  by_module: Record<string, number>;
  [key: string]: any;
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
    const { data } = await api.get(`/audit/${recordId}`);
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
};
