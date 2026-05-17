import { useState, useCallback, useEffect } from "react";
import { api } from "../lib/api";

export interface Account {
  id: number;
  code: string;
  name: string;
  account_type: string;
  parent_id: number | null;
  is_active: boolean;
}

export interface AccountTreeNode {
  id: number;
  code: string;
  name: string;
  type: string;
  children: AccountTreeNode[];
}

export interface JournalEntry {
  id: number;
  journal_id: number;
  account_id: number;
  debit: string;
  credit: string;
  description: string | null;
}

export interface Journal {
  id: number;
  date: string;
  reference_type: string;
  reference_id: string | null;
  description: string | null;
  created_at: string;
  entries: JournalEntry[];
}

export interface Invoice {
  id: number;
  tenant_id: number;
  property_id: number;
  unit_id: number | null;
  amount: string;
  status: string;
  due_date: string;
  created_at: string;
}

export interface Payment {
  id: number;
  invoice_id: number;
  method: string;
  amount: string;
  date: string;
  reference_number: string | null;
  created_at: string;
}

export interface Commission {
  id: number;
  agent_id: number;
  property_id: number;
  amount: string;
  type: string;
  date: string;
  reference: string | null;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  date: string;
  reference_type: string;
  reference_id: string | null;
  description: string | null;
  debit: string;
  credit: string;
  balance: string;
}

export interface TrialBalanceRow {
  account_id: number;
  code: string;
  name: string;
  type: string;
  debit: string;
  credit: string;
}

export interface ProfitLossRow {
  account_id: number;
  code: string;
  name: string;
  amount: string;
}

/**
 * React hook for finance operations
 * Handles all API calls for accounting system
 */
export function useFinance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==================== ACCOUNTS ====================

  const createAccount = useCallback(
    async (data: {
      code: string;
      name: string;
      account_type: string;
      parent_id?: number | null;
    }): Promise<Account> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post<Account>("/finance/accounts", data);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to create account";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const listAccounts = useCallback(async (): Promise<Account[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Account[]>("/finance/accounts");
      return response.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to list accounts";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const getAccountTree = useCallback(async (): Promise<AccountTreeNode[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<AccountTreeNode[]>("/finance/accounts/tree");
      return response.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to get account tree";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const getAccount = useCallback(
    async (accountId: number): Promise<Account> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Account>(`/finance/accounts/${accountId}`);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to get account";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateAccount = useCallback(
    async (
      accountId: number,
      data: { name?: string; parent_id?: number | null; is_active?: boolean }
    ): Promise<Account> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.patch<Account>(`/finance/accounts/${accountId}`, data);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to update account";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteAccount = useCallback(
    async (accountId: number): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await api.delete(`/finance/accounts/${accountId}`);
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to delete account";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ==================== JOURNALS ====================

  const createJournal = useCallback(
    async (data: {
      reference_type: string;
      reference_id?: string | null;
      description?: string | null;
      date?: string | null;
      lines: Array<{
        account_id: number;
        debit: string | number;
        credit: string | number;
        description?: string | null;
      }>;
    }): Promise<Journal> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post<Journal>("/finance/journals", data);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to create journal";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const listJournals = useCallback(
    async (skip = 0, limit = 100, referenceType?: string): Promise<Journal[]> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Journal[]>("/finance/journals", {
          params: { skip, limit, reference_type: referenceType },
        });
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to list journals";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getJournal = useCallback(
    async (journalId: number): Promise<Journal> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Journal>(`/finance/journals/${journalId}`);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to get journal";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ==================== INVOICES ====================

  const createInvoice = useCallback(
    async (data: {
      tenant_id: number;
      property_id: number;
      unit_id?: number | null;
      amount: string | number;
      due_date: string;
    }): Promise<Invoice> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post<Invoice>("/finance/invoices", data);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to create invoice";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const listInvoices = useCallback(
    async (
      skip = 0,
      limit = 100,
      status?: string,
      tenantId?: number
    ): Promise<Invoice[]> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Invoice[]>("/finance/invoices", {
          params: { skip, limit, status, tenant_id: tenantId },
        });
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to list invoices";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getInvoice = useCallback(
    async (invoiceId: number): Promise<Invoice> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Invoice>(`/finance/invoices/${invoiceId}`);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to get invoice";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateInvoice = useCallback(
    async (
      invoiceId: number,
      data: { amount?: string | number; due_date?: string; status?: string }
    ): Promise<Invoice> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.patch<Invoice>(`/finance/invoices/${invoiceId}`, data);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to update invoice";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ==================== PAYMENTS ====================

  const createPayment = useCallback(
    async (data: {
      invoice_id: number;
      method: string;
      amount: string | number;
      date?: string | null;
      reference_number?: string | null;
    }): Promise<Payment> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post<Payment>("/finance/payments", data);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to create payment";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const listPayments = useCallback(
    async (skip = 0, limit = 100, invoiceId?: number): Promise<Payment[]> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Payment[]>("/finance/payments", {
          params: { skip, limit, invoice_id: invoiceId },
        });
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to list payments";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ==================== COMMISSIONS ====================

  const createCommission = useCallback(
    async (data: {
      agent_id: number;
      property_id: number;
      amount: string | number;
      type: string;
      date?: string | null;
      reference?: string | null;
    }): Promise<Commission> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post<Commission>("/finance/commissions", data);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to create commission";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const listCommissions = useCallback(
    async (
      skip = 0,
      limit = 100,
      agentId?: number,
      type?: string
    ): Promise<Commission[]> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Commission[]>("/finance/commissions", {
          params: { skip, limit, agent_id: agentId, type },
        });
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to list commissions";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ==================== LEDGER ====================

  const getGeneralLedger = useCallback(
    async (
      accountId: number,
      startDate?: string,
      endDate?: string
    ): Promise<{
      account_id: number;
      code: string;
      name: string;
      entries: LedgerEntry[];
      opening_balance: string;
      closing_balance: string;
    }> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/finance/journals/ledger/${accountId}`, {
          params: { start_date: startDate, end_date: endDate },
        });
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to get ledger";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ==================== REPORTS ====================

  const getTrialBalance = useCallback(
    async (asOfDate?: string): Promise<{
      rows: TrialBalanceRow[];
      total_debit: string;
      total_credit: string;
    }> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get("/finance/journals/reports/trial-balance", {
          params: { as_of_date: asOfDate },
        });
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to get trial balance";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getProfitLoss = useCallback(
    async (startDate?: string, endDate?: string): Promise<{
      income: ProfitLossRow[];
      expenses: ProfitLossRow[];
      total_income: string;
      total_expenses: string;
      net_profit: string;
    }> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get("/finance/journals/reports/profit-loss", {
          params: { start_date: startDate, end_date: endDate },
        });
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || "Failed to get profit & loss";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    createAccount,
    listAccounts,
    getAccountTree,
    getAccount,
    updateAccount,
    deleteAccount,
    createJournal,
    listJournals,
    getJournal,
    createInvoice,
    listInvoices,
    getInvoice,
    updateInvoice,
    createPayment,
    listPayments,
    createCommission,
    listCommissions,
    getGeneralLedger,
    getTrialBalance,
    getProfitLoss,
  };
}
