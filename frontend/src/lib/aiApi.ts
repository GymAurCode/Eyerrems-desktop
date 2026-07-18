import { api } from "./api";

export interface AIDashboardStats { [key: string]: any; }
export interface AIAnomaly { id: number; [key: string]: any; }
export interface AIAlert { id: number; [key: string]: any; }
export interface AIRiskScore { id: number; [key: string]: any; }
export interface AIDuplicateMatch { id: number; [key: string]: any; }
export interface AIInsight { id: number; [key: string]: any; }
export interface AIQueryLog { id: number; [key: string]: any; }
export interface NLQueryResult { [key: string]: any; }
export interface AuditMonitorResult { [key: string]: any; }

export const aiApi = {
  getDashboard: async (): Promise<AIDashboardStats> => {
    const { data } = await api.get("/ai/dashboard");
    return data;
  },
  runScan: async (scanType: string): Promise<any> => {
    const { data } = await api.post("/ai/scan", { scan_type: scanType });
    return data;
  },
  getAnomalies: async (params?: any): Promise<AIAnomaly[]> => {
    const { data } = await api.get("/ai/anomalies", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  resolveAnomaly: async (id: number, resolved: boolean): Promise<void> => {
    await api.patch(`/ai/anomalies/${id}`, { is_resolved: resolved });
  },
  getAlerts: async (params?: any): Promise<AIAlert[]> => {
    const { data } = await api.get("/ai/alerts", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  updateAlert: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/ai/alerts/${id}`, payload);
  },
  dismissAllAlerts: async (): Promise<void> => {
    await api.post("/ai/alerts/dismiss-all");
  },
  getRiskScores: async (params?: any): Promise<AIRiskScore[]> => {
    const { data } = await api.get("/ai/risk-scores", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  recomputeRisks: async (): Promise<void> => {
    await api.post("/ai/risk-scores/recompute");
  },
  getDuplicates: async (params?: any): Promise<AIDuplicateMatch[]> => {
    const { data } = await api.get("/ai/duplicates", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  reviewDuplicate: async (id: number, status: string): Promise<void> => {
    await api.patch(`/ai/duplicates/${id}`, { status });
  },
  getAuditMonitor: async (params?: any): Promise<AuditMonitorResult> => {
    const { data } = await api.get("/ai/audit-monitor", { params });
    return data;
  },
  getQueryLogs: async (params?: any): Promise<AIQueryLog[]> => {
    const { data } = await api.get("/ai/queries", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  query: async (query: string): Promise<NLQueryResult> => {
    const { data } = await api.post("/ai/query", { query });
    return data;
  },
  getInsights: async (params?: any): Promise<AIInsight[]> => {
    const { data } = await api.get("/ai/insights", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  generateInsight: async (period: string): Promise<void> => {
    await api.post("/ai/insights/generate", { period_type: period });
  },
};
