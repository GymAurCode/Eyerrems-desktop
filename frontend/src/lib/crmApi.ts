import { api } from "./api";

export interface Lead {
  id: number;
  [key: string]: any;
}

export interface Client {
  id: number;
  [key: string]: any;
}

export interface Dealer {
  id: number;
  [key: string]: any;
}

export interface Deal {
  id: number;
  [key: string]: any;
}

export interface CrmDashboardData {
  [key: string]: any;
}
export interface Activity { id: number; type: string; description: string; [key: string]: any; }
export type ActivityType = "call" | "meeting" | "email" | "note" | "visit";
export interface Communication { id: number; entity_type: string; entity_id: number; [key: string]: any; }
export interface Installment { id: number; deal_id: number; amount: number; due_date: string; [key: string]: any; }
export interface Payment { id: number; deal_id: number; amount: number; date: string; [key: string]: any; }
export interface TimelineEntry { id: number; type: string; date: string; description: string; [key: string]: any; }
export interface DealLedger { deal: Deal; total_value: number; amount_paid: number; remaining_balance: number; surcharges_penalties: number; }
export interface InstallmentPlan { id: number; deal_id: number; installments: Installment[]; [key: string]: any; }
export interface FollowUp { id: number; lead_id: number; date: string; [key: string]: any; }
export interface DealerPerformance { dealer_id: number; total_deals: number; total_commission: number; [key: string]: any; }
export interface RecentActivityItem { id: number; type: string; description: string; timestamp: string; [key: string]: any; }
export interface LeadStats {
  total_assigned: number; new: number; contacted: number; follow_up: number;
  negotiation: number; site_visit: number; booked: number; won: number;
  lost: number; cancelled: number; expired: number;
  conversion_rate: number; win_rate: number; lost_rate: number;
}

export interface LeadCostSummary {
  cost_per_lead: number; total_charged_leads: number; total_lead_cost: number;
  avg_cost_per_won_lead: number; avg_cost_per_closed_deal: number; cost_recovery_pct: number;
}

export interface CommissionSummary {
  total_deals_closed: number; total_commission: number; avg_commission: number;
  highest_commission: number; lowest_commission: number;
  commission_this_month: number; commission_last_month: number;
}

export interface FinancialSummary {
  total_commission_earned: number; total_lead_cost: number; net_balance: number;
  amount_payable_to_dealer: number; amount_receivable_from_dealer: number;
  payments_received: number; pending_balance: number;
  current_month_commission: number; current_month_lead_cost: number;
}

export interface RecentAssignedLead {
  id: number; lead_id: string; name: string; phone: string | null;
  property_name: string | null; assigned_date: string; current_stage: string;
  lead_cost: number | null; expected_commission: number | null; status: string;
}

export interface DealerDetail {
  dealer: Dealer;
  financial_summary: FinancialSummary;
  lead_stats: LeadStats;
  lead_cost_summary: LeadCostSummary;
  commission_summary: CommissionSummary;
  recent_leads: RecentAssignedLead[];
  recent_ledger_entries: DealerLedgerEntry[];
  assigned_clients: any[];
  active_deals: any[];
  total_sales_value?: number;
  total_commission_earned?: number;
  [key: string]: any;
}
export interface PaymentLedgerEntry { id: number; deal_id: number; amount: number; type: string; [key: string]: any; }
export interface SiteVisit { id: number; lead_id: number; date: string; [key: string]: any; }

export interface DealerLedgerEntry {
  id: number; tid: string; dealer_id: number; deal_id: number | null; lead_id: number | null;
  entry_date: string; description: string; reference_no: string | null; entry_type: string;
  commission_rate: number | null; gross_commission: number | null;
  debit: number; credit: number; running_balance: number; status: string;
  notes: string | null; created_at: string; lead_name: string | null; dealer_name: string | null;
}

export interface DealerBalance {
  current_balance: number; total_lead_costs: number; total_payouts: number; total_commission_earned: number;
}

export const crmApi = {
  getLeads: async (): Promise<Lead[]> => {
    const { data } = await api.get("/crm/leads");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  getClients: async (): Promise<Client[]> => {
    const { data } = await api.get("/crm/clients");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  getDealers: async (): Promise<Dealer[]> => {
    const { data } = await api.get("/crm/dealers");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  getDeals: async (): Promise<Deal[]> => {
    const { data } = await api.get("/crm/deals");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  getFollowUps: async (params?: any): Promise<{ items: any[]; total: number }> => {
    const { data } = await api.get("/crm/followups", { params });
    return typeof data === "object" && data !== null ? data : { items: Array.isArray(data) ? data : [], total: 0 };
  },
  createFollowUp: async (payload: any): Promise<any> => {
    const { data } = await api.post("/crm/followups", payload);
    return data;
  },
  completeFollowUp: async (id: number): Promise<any> => {
    const { data } = await api.post(`/crm/followups/${id}/complete`);
    return data;
  },
  updateFollowUp: async (id: number, updates: any): Promise<any> => {
    const { data } = await api.patch(`/crm/followups/${id}`, updates);
    return data;
  },
  getSiteVisits: async (params?: any): Promise<{ items: any[]; total: number }> => {
    const { data } = await api.get("/crm/site-visits", { params });
    return typeof data === "object" && data !== null ? data : { items: Array.isArray(data) ? data : [], total: 0 };
  },
  createSiteVisit: async (payload: any): Promise<any> => {
    const { data } = await api.post("/crm/site-visits", payload);
    return data;
  },
  updateSiteVisit: async (id: number, updates: any): Promise<any> => {
    const { data } = await api.patch(`/crm/site-visits/${id}`, updates);
    return data;
  },
  createLead: async (payload: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.post("/crm/leads", payload);
    return data;
  },
  updateLead: async (id: number, updates: Partial<Lead>): Promise<void> => {
    await api.patch(`/crm/leads/${id}`, updates);
  },
  deleteLead: async (id: number): Promise<void> => {
    await api.delete(`/crm/leads/${id}`);
  },
  createClient: async (payload: Partial<Client>): Promise<Client> => {
    const { data } = await api.post("/crm/clients", payload);
    return data;
  },
  updateClient: async (id: number, updates: Partial<Client>): Promise<void> => {
    await api.patch(`/crm/clients/${id}`, updates);
  },
  deleteClient: async (id: number): Promise<void> => {
    await api.delete(`/crm/clients/${id}`);
  },
  createDealer: async (payload: Partial<Dealer>): Promise<Dealer> => {
    const { data } = await api.post("/crm/dealers", payload);
    return data;
  },
  updateDealer: async (id: number, updates: Partial<Dealer>): Promise<void> => {
    await api.patch(`/crm/dealers/${id}`, updates);
  },
  deleteDealer: async (id: number, force?: boolean): Promise<void> => {
    await api.delete(`/crm/dealers/${id}`, { params: { force: force ? "true" : undefined } });
  },
  createDeal: async (payload: Partial<Deal>): Promise<Deal> => {
    const { data } = await api.post("/crm/deals", payload);
    return data;
  },
  updateDeal: async (id: number, updates: Partial<Deal>): Promise<void> => {
    await api.patch(`/crm/deals/${id}`, updates);
  },
  deleteDeal: async (id: number): Promise<void> => {
    await api.delete(`/crm/deals/${id}`);
  },
  getDashboard: async (): Promise<CrmDashboardData> => {
    const { data } = await api.get("/crm/dashboard");
    return data;
  },
  getActivities: async (entityType: string, entityId: number): Promise<any[]> => {
    const { data } = await api.get(`/crm/activities`, { params: { entity_type: entityType, entity_id: entityId } });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  createActivity: async (payload: any): Promise<any> => {
    const { data } = await api.post("/crm/activities", payload);
    return data;
  },
  updateActivity: async (id: number, payload: any): Promise<any> => {
    const { data } = await api.patch(`/crm/activities/${id}`, payload);
    return data;
  },
  deleteActivity: async (id: number): Promise<void> => {
    await api.delete(`/crm/activities/${id}`);
  },
  getClient: async (clientId: string): Promise<Client> => {
    const { data } = await api.get(`/crm/clients/${clientId}`);
    return data;
  },
  getLead: async (leadId: string): Promise<Lead> => {
    const { data } = await api.get(`/crm/leads/${leadId}`);
    return data;
  },
  getDeal: async (dealId: string): Promise<Deal> => {
    const { data } = await api.get(`/crm/deals/${dealId}`);
    return data;
  },
  getDealLedger: async (dealId: string | number): Promise<DealLedger> => {
    const { data } = await api.get(`/crm/deals/${dealId}/ledger`);
    return data;
  },
  getInstallmentPlan: async (dealId: number): Promise<InstallmentPlan> => {
    const { data } = await api.get(`/crm/deals/${dealId}/installment-plan`);
    return data;
  },
  createInstallmentPlan: async (dealId: number, payload: any): Promise<InstallmentPlan> => {
    const { data } = await api.post(`/crm/deals/${dealId}/installment-plan`, payload);
    return data;
  },
  payInstallment: async (instId: number, payload: any): Promise<any> => {
    const { data } = await api.post(`/crm/installments/${instId}/pay`, payload);
    return data;
  },
  createPayment: async (payload: any): Promise<any> => {
    const { data } = await api.post("/crm/payments", payload);
    return data;
  },
  getInstallmentSchedule: async (dealId: number): Promise<Installment[]> => {
    const { data } = await api.get(`/crm/installments/${dealId}`);
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  getCommunications: async (trackingId: string): Promise<Communication[]> => {
    const { data } = await api.get("/crm/communications", { params: { tracking_id: trackingId } });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  getTimeline: async (entityType: string, entityId: number, limit?: number): Promise<TimelineEntry[]> => {
    const { data } = await api.get("/crm/timeline", { params: { entity_type: entityType, entity_id: entityId, limit } });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  getPayments: async (params?: any): Promise<{ items: Payment[]; total?: number }> => {
    const { data } = await api.get("/crm/payments", { params });
    return typeof data === "object" && data !== null ? data : { items: Array.isArray(data) ? data : [] };
  },
  createCommunication: async (payload: any): Promise<any> => {
    const { data } = await api.post("/crm/communications", payload);
    return data;
  },
  searchClients: async (q: string): Promise<any[]> => {
    if (!q || q.trim().length === 0) return [];
    const { data } = await api.get("/crm/clients/search", { params: { q, limit: 20 } });
    return Array.isArray(data) ? data : [];
  },
  getDealerDetail: async (dealerId: string): Promise<any> => {
    const { data } = await api.get(`/crm/dealers/${dealerId}/detail`);
    return data;
  },
  getDealerLedger: async (dealerId: number, params?: any): Promise<DealerLedgerEntry[]> => {
    const { data } = await api.get(`/crm/dealers/${dealerId}/ledger`, { params });
    return Array.isArray(data) ? data : [];
  },
  getDealerBalance: async (dealerId: number): Promise<DealerBalance> => {
    const { data } = await api.get(`/crm/dealers/${dealerId}/ledger/balance`);
    return data;
  },
  createDealerLedgerEntry: async (payload: any): Promise<any> => {
    const { data } = await api.post("/crm/dealers/ledger", payload);
    return data;
  },
  createDealerPayout: async (payload: any): Promise<any> => {
    const { data } = await api.post("/crm/dealers/payments", payload);
    return data;
  },
  convertLead: async (leadId: number, payload: any): Promise<Client> => {
    const { data } = await api.post(`/crm/leads/${leadId}/convert`, payload);
    return data;
  },
};
