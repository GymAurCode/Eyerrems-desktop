import { api } from "./api";

export interface Contract {
  id: number; contract_id: string; booking_id: number; client_id: number; deal_id?: number;
  agreement_doc_url?: string; signed_date?: string; effective_date?: string; expiry_date?: string;
  total_amount: number; down_payment_amount: number; installment_count?: number; installment_freq?: string;
  status: string; terms_text?: string; notes?: string; signed_by?: string; witness?: string;
  created_at: string;
  [key: string]: any;
}
export interface ReceiptVoucher {
  id: number; voucher_no: string; voucher_type: string; client_id?: number; booking_id?: number;
  installment_id?: number; deal_id?: number; journal_id?: number; amount: number;
  payment_mode: string; payment_date: string; reference_no?: string; description?: string;
  receipt_type: string; posted_to_ledger: boolean; posted_to_subsidiary: boolean; created_at: string;
  [key: string]: any;
}
export interface Transfer {
  id: number; transfer_id: string; booking_id: number; from_client_id: number; to_client_id: number;
  transfer_fee: number; transfer_date: string; reason?: string; status: string; created_at: string;
  [key: string]: any;
}
export interface Handover {
  id: number; handover_id: string; booking_id: number; client_id: number; unit_id?: number;
  possession_date: string; snag_list_status: string; snag_list_notes?: string; handover_notes?: string;
  doc_url?: string; status: string; completed_at?: string; created_at: string;
  [key: string]: any;
}
export interface AfterSalesTicket {
  id: number; ticket_id: string; client_id: number; unit_id?: number; booking_id?: number;
  ticket_type: string; description: string; priority: string; status: string;
  chargeable: boolean; charge_amount?: number; assigned_to_id?: number;
  resolved_at?: string; resolution_notes?: string; created_at: string; updated_at: string;
  [key: string]: any;
}
export interface ClientPipelineSummary {
  client_id: number;
  bookings: any[];
  contracts: Contract[];
  receipts: ReceiptVoucher[];
  transfers: Transfer[];
  handovers: Handover[];
  tickets: AfterSalesTicket[];
}

export const pipelineApi = {
  // ── Contracts ──
  listContracts: async (params?: { booking_id?: number; client_id?: number }): Promise<Contract[]> => {
    const { data } = await api.get("/crm/pipeline/contracts", { params });
    return Array.isArray(data) ? data : [];
  },
  getContract: async (id: number): Promise<Contract> => {
    const { data } = await api.get(`/crm/pipeline/contracts/${id}`);
    return data;
  },
  createContract: async (payload: Partial<Contract>): Promise<Contract> => {
    const { data } = await api.post("/crm/pipeline/contracts", payload);
    return data;
  },
  updateContract: async (id: number, updates: Partial<Contract>): Promise<Contract> => {
    const { data } = await api.patch(`/crm/pipeline/contracts/${id}`, updates);
    return data;
  },

  // ── Receipt Vouchers ──
  listReceipts: async (params?: { client_id?: number; booking_id?: number }): Promise<ReceiptVoucher[]> => {
    const { data } = await api.get("/crm/pipeline/receipts", { params });
    return Array.isArray(data) ? data : [];
  },
  getReceipt: async (id: number): Promise<ReceiptVoucher> => {
    const { data } = await api.get(`/crm/pipeline/receipts/${id}`);
    return data;
  },

  // ── Transfers ──
  listTransfers: async (params?: { booking_id?: number }): Promise<Transfer[]> => {
    const { data } = await api.get("/crm/pipeline/transfers", { params });
    return Array.isArray(data) ? data : [];
  },
  createTransfer: async (payload: Partial<Transfer>): Promise<Transfer> => {
    const { data } = await api.post("/crm/pipeline/transfers", payload);
    return data;
  },
  updateTransfer: async (id: number, updates: Partial<Transfer>): Promise<Transfer> => {
    const { data } = await api.patch(`/crm/pipeline/transfers/${id}`, updates);
    return data;
  },

  // ── Handovers ──
  listHandovers: async (params?: { booking_id?: number; client_id?: number }): Promise<Handover[]> => {
    const { data } = await api.get("/crm/pipeline/handovers", { params });
    return Array.isArray(data) ? data : [];
  },
  createHandover: async (payload: Partial<Handover>): Promise<Handover> => {
    const { data } = await api.post("/crm/pipeline/handovers", payload);
    return data;
  },
  updateHandover: async (id: number, updates: Partial<Handover>): Promise<Handover> => {
    const { data } = await api.patch(`/crm/pipeline/handovers/${id}`, updates);
    return data;
  },

  // ── After-Sales Tickets ──
  listTickets: async (params?: { client_id?: number; unit_id?: number; status?: string }): Promise<AfterSalesTicket[]> => {
    const { data } = await api.get("/crm/pipeline/tickets", { params });
    return Array.isArray(data) ? data : [];
  },
  createTicket: async (payload: Partial<AfterSalesTicket>): Promise<AfterSalesTicket> => {
    const { data } = await api.post("/crm/pipeline/tickets", payload);
    return data;
  },
  updateTicket: async (id: number, updates: Partial<AfterSalesTicket>): Promise<AfterSalesTicket> => {
    const { data } = await api.patch(`/crm/pipeline/tickets/${id}`, updates);
    return data;
  },

  // ── Client Pipeline Summary ──
  getClientSummary: async (clientId: number): Promise<ClientPipelineSummary> => {
    const { data } = await api.get(`/crm/pipeline/clients/${clientId}/summary`);
    return data;
  },
};
