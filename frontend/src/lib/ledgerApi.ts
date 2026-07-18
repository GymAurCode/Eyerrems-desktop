import { api } from "./api";

export interface LedgerEntry {
  id: number;
  property_id?: number;
  client_id?: number;
  dealer_id?: number;
  type: string;
  category: string;
  amount: number;
  description?: string;
  date: string;
  created_at: string;
}

export interface LedgerSummary {
  total_debit: number;
  total_credit: number;
  balance: number;
  entries: LedgerEntry[];
}

export interface DealerLedgerListItem { id: number; name: string; [key: string]: any; }
export interface DealerLedgerEntry extends LedgerEntry { dealer_id: number; }
export interface DealerLedgerResponse { entries: DealerLedgerEntry[]; summary: LedgerSummary; }
export interface DealerLedgerEntryCreate { dealer_id: number; amount: number; type: string; [key: string]: any; }
export interface ClientLedgerListItem { id: number; name: string; [key: string]: any; }
export interface ClientLedgerEntry extends LedgerEntry { client_id: number; }
export interface ClientLedgerResponse { entries: ClientLedgerEntry[]; summary: LedgerSummary; }
export interface ClientLedgerEntryCreate { client_id: number; amount: number; type: string; [key: string]: any; }
export interface PropertyLedgerListItem { id: number; name: string; [key: string]: any; }
export interface PropertyLedgerEntry extends LedgerEntry { property_id: number; }
export interface PropertyLedgerResponse { entries: PropertyLedgerEntry[]; summary: LedgerSummary; }
export interface PropertyLedgerEntryCreate { property_id: number; amount: number; type: string; [key: string]: any; }

export const ledgerApi = {
  getPropertyLedger: (propertyId: number, params?: Record<string, unknown>) =>
    api.get(`/api/ledger/property/${propertyId}`, { params }).then((r) => r.data),

  getClientLedger: (clientId: number, params?: Record<string, unknown>) =>
    api.get(`/api/ledger/client/${clientId}`, { params }).then((r) => r.data),

  getDealerLedger: (dealerId: number, params?: Record<string, unknown>) =>
    api.get(`/api/ledger/dealer/${dealerId}`, { params }).then((r) => r.data),

  createEntry: (data: Partial<LedgerEntry>) =>
    api.post("/api/ledger/entries", data).then((r) => r.data),

  updateEntry: (id: number, data: Partial<LedgerEntry>) =>
    api.put(`/api/ledger/entries/${id}`, data).then((r) => r.data),

  deleteEntry: (id: number) =>
    api.delete(`/api/ledger/entries/${id}`).then((r) => r.data),

  getCategories: () =>
    api.get("/api/ledger/categories").then((r) => r.data),
};

export default ledgerApi;
