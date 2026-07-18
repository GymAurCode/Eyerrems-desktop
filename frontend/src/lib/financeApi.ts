import { api } from "./api";

export interface Account { id: number; [key: string]: any; }

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  amount: number;
}

export interface PaymentAllocation {
  id: number;
  payment_id: number;
  invoice_id: number;
  allocated_amount: number;
  invoice_number?: string;
}

export interface PaymentAttachment {
  id: number;
  payment_id: number;
  file_path: string;
  file_name: string;
  file_type?: string;
  uploaded_at: string;
}

export interface PaymentAllocationCreate {
  invoice_id: number;
  allocated_amount: number;
}

export interface Invoice {
  id: number;
  invoice_number?: string;
  invoice_date?: string;
  due_date: string;
  status: string;
  invoice_type?: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  adjustment: number;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  items?: InvoiceLineItem[];
  allocations?: PaymentAllocation[];
  party_type?: string;
  party_id?: number;
  client_id?: number;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_cnic?: string;
  client_ntn?: string;
  client_address?: string;
  reference?: string;
  reference_type?: string;
  reference_id?: number;
  deal_id?: number;
  booking_id?: number;
  lease_id?: number;
  property_id?: number;
  unit_id?: number;
  maintenance_ticket_id?: number;
  construction_project_id?: number;
  purchase_order_id?: number;
  contract_id?: number;
  payment_terms?: string;
  internal_notes?: string;
  customer_notes?: string;
  terms_conditions?: string;
  late_payment_policy?: string;
  footer_message?: string;
  auto_generated: boolean;
  source_module?: string;
  source_record_id?: number;
  sent_at?: string;
  viewed_at?: string;
  cancelled_at?: string;
  voided_at?: string;
  tenant_id?: number;
  description?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export interface InvoiceCreate {
  invoice_date?: string;
  due_date: string;
  invoice_type?: string;
  currency?: string;
  line_items: InvoiceLineItem[];
  party_type?: string;
  party_id?: number;
  client_id?: number;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_cnic?: string;
  client_ntn?: string;
  client_address?: string;
  reference?: string;
  reference_type?: string;
  reference_id?: number;
  deal_id?: number;
  booking_id?: number;
  lease_id?: number;
  property_id?: number;
  unit_id?: number;
  maintenance_ticket_id?: number;
  construction_project_id?: number;
  purchase_order_id?: number;
  contract_id?: number;
  payment_terms?: string;
  internal_notes?: string;
  customer_notes?: string;
  terms_conditions?: string;
  late_payment_policy?: string;
  footer_message?: string;
  auto_generated?: boolean;
  source_module?: string;
  source_record_id?: number;
  tenant_id?: number;
}

export interface AutoGenerateInvoice {
  source_module: string;
  source_id: number;
  party_type?: string;
  party_id?: number;
  due_date?: string;
  notes?: string;
}
export interface PaymentMethodFields {
  bank_name?: string;
  branch_code?: string;
  account_number?: string;
  account_title?: string;
  cheque_number?: string;
  cheque_date?: string;
  cheque_type?: string;
  iban?: string;
  swift_code?: string;
  card_type?: string;
  card_last4?: string;
  card_holder?: string;
  card_expiry?: string;
  auth_code?: string;
  terminal_id?: string;
  transaction_id?: string;
  gateway?: string;
  gateway_fee?: number;
  gateway_fee_paid_by?: string;
  mobile_account?: string;
  payment_proof?: string;
  cash_denominations?: string;
  cash_received?: number;
  cash_change?: number;
  cashier_name?: string;
  counter?: string;
}

export interface PaymentCreate {
  method: string;
  amount: number;
  date?: string;
  payment_type?: string;
  reference_number?: string;
  external_transaction_id?: string;
  received_by?: string;
  party_type?: string;
  party_id?: number | null;
  party_name?: string;
  party_phone?: string;
  party_email?: string;
  source?: string;
  source_id?: number | null;
  branch?: string;
  cash_counter?: string;
  cash_register?: string;
  method_fields?: PaymentMethodFields;
  internal_notes?: string;
  allocations?: PaymentAllocationCreate[];
  account_id?: number;
}

export interface Payment {
  id: number;
  payment_number?: string;
  receipt_number?: string;
  status: string;
  payment_type: string;
  method: string;
  amount: number;
  method_fields?: PaymentMethodFields | any;
  date: string;
  reference_number?: string;
  external_transaction_id?: string;
  received_by?: string;
  party_type?: string;
  party_id?: number | null;
  party_name?: string;
  party_phone?: string;
  party_email?: string;
  party_cnic?: string;
  party_address?: string;
  source?: string;
  source_id?: number | null;
  branch?: string;
  cash_counter?: string;
  cash_register?: string;
  posted_to_finance: boolean;
  finance_journal_id?: number | null;
  internal_notes?: string;
  allocations?: PaymentAllocation[];
  attachments?: PaymentAttachment[];
  completed_at?: string | null;
  reversed_at?: string | null;
  refunded_at?: string | null;
  cancelled_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id?: number | null;
  [key: string]: any;
}

export interface PaymentSearchInvoice {
  id: number;
  invoice_number?: string;
  client_name?: string;
  client_phone?: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  due_date: string;
  invoice_date?: string;
  invoice_type?: string;
}
export interface Commission { id: number; [key: string]: any; }
export interface ExpenseLineItem {
  description: string;
  category?: string;
  quantity: number;
  unit?: string;
  unit_cost: number;
  discount_pct: number;
  tax_pct: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  sort_order?: number;
}

export interface ExpenseCreate {
  expense_date?: string;
  expense_type?: string;
  currency?: string;
  expense_source?: string;
  source_id?: number | null;
  source_reference?: string;
  vendor_id?: number | null;
  vendor_name?: string;
  vendor_phone?: string;
  vendor_email?: string;
  vendor_address?: string;
  vendor_ntn?: string;
  vendor_strn?: string;
  invoice_bill_no?: string;
  vendor_invoice_date?: string;
  construction_project_id?: number | null;
  property_id?: number | null;
  building?: string;
  floor?: string;
  unit_id?: number | null;
  maintenance_ticket_id?: number | null;
  purchase_order_id?: number | null;
  department?: string;
  line_items: ExpenseLineItem[];
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  adjustment?: number;
  amount?: number;
  account_id?: number | null;
  paid_from?: string;
  payment_method?: string;
  payment_status?: string;
  paid_from_account_id?: number | null;
  bank_account?: string;
  transaction_reference?: string;
  payment_date?: string;
  cheque_number?: string;
  is_recurring?: boolean;
  recurring_frequency?: string;
  next_due_date?: string;
  recurring_end_date?: string;
  internal_notes?: string;
  vendor_notes?: string;
  remarks?: string;
}

export interface Expense {
  id: number;
  expense_number?: string;
  expense_date: string;
  expense_type: string;
  status: string;
  currency: string;
  expense_source?: string;
  source_id?: number | null;
  source_reference?: string;
  vendor_id?: number | null;
  vendor_name?: string;
  vendor_phone?: string;
  vendor_email?: string;
  vendor_address?: string;
  vendor_ntn?: string;
  vendor_strn?: string;
  vendor_outstanding?: number;
  invoice_bill_no?: string;
  vendor_invoice_date?: string;
  construction_project_id?: number | null;
  property_id?: number | null;
  building?: string;
  floor?: string;
  unit_id?: number | null;
  maintenance_ticket_id?: number | null;
  purchase_order_id?: number | null;
  department?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  adjustment: number;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  line_items: ExpenseLineItem[];
  account_id?: number | null;
  account_name?: string;
  account_code?: string;
  paid_from?: string;
  payment_method?: string;
  payment_status?: string;
  paid_from_account_id?: number | null;
  bank_account?: string;
  transaction_reference?: string;
  payment_date?: string;
  cheque_number?: string;
  approval_status?: string;
  approval_level?: number | null;
  approved_by?: number | null;
  approved_at?: string | null;
  rejected_by?: number | null;
  rejected_at?: string | null;
  rejection_reason?: string;
  submitted_by?: number | null;
  submitted_at?: string | null;
  is_recurring: boolean;
  recurring_frequency?: string;
  next_due_date?: string;
  recurring_end_date?: string;
  internal_notes?: string;
  vendor_notes?: string;
  remarks?: string;
  receipt_path?: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id?: number | null;
  [key: string]: any;
}

export interface ExpenseListResponse {
  id: number;
  expense_number?: string;
  expense_date: string;
  expense_type: string;
  status: string;
  vendor_name?: string;
  vendor_id?: number | null;
  invoice_bill_no?: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status?: string;
  approval_status?: string;
  department?: string;
  expense_source?: string;
  created_at: string;
  created_by_user_id?: number | null;
}
export interface JournalEntryLine {
  account_id: number;
  debit: number;
  credit: number;
  narration?: string;
  description?: string;
  cost_center?: string;
  department?: string;
  project_id?: number | null;
  property_id?: number | null;
  building?: string;
  floor?: string;
  unit_id?: number | null;
  customer_id?: number | null;
  vendor_id?: number | null;
  employee_id?: number | null;
  tax_code?: string;
  tax_amount?: number;
  reference?: string;
  memo?: string;
  sort_order?: number;
}

export interface JournalEntry {
  id: number;
  journal_id: number;
  account_id: number;
  debit: number;
  credit: number;
  narration?: string;
  description?: string;
  cost_center?: string;
  department?: string;
  project_id?: number | null;
  property_id?: number | null;
  building?: string;
  floor?: string;
  unit_id?: number | null;
  customer_id?: number | null;
  vendor_id?: number | null;
  employee_id?: number | null;
  tax_code?: string;
  tax_amount?: number;
  reference?: string;
  memo?: string;
  sort_order: number;
  account_code?: string;
  account_name?: string;
}

export interface Journal {
  id: number;
  journal_number?: string;
  date: string;
  reference_type: string;
  reference_id?: string;
  description?: string;
  source?: string;
  source_module?: string;
  source_document_id?: number | null;
  source_document_number?: string;
  source_document_status?: string;
  source_document_date?: string;
  status: string;
  is_editable: boolean;
  is_reversal: boolean;
  reversal_of?: number | null;
  reversal_reason?: string;
  approved_by?: number | null;
  approved_at?: string;
  posted_by?: number | null;
  posted_at?: string;
  submitted_by?: number | null;
  submitted_at?: string;
  rejected_by?: number | null;
  rejected_at?: string;
  rejection_reason?: string;
  internal_notes?: string;
  remarks?: string;
  approved_budget?: number;
  budget_exceeded: boolean;
  created_at: string;
  updated_at?: string;
  created_by_user_id?: number;
  company_id?: number;
  entries: JournalEntry[];
  dr_total: number;
  cr_total: number;
  balanced: boolean;
}

export interface JournalCreatePayload {
  reference_type?: string;
  reference_id?: string;
  description?: string;
  date?: string;
  source?: string;
  source_module?: string;
  source_document_id?: number | null;
  source_document_number?: string;
  source_document_status?: string;
  source_document_date?: string;
  internal_notes?: string;
  remarks?: string;
  approved_budget?: number;
  budget_used?: number;
  budget_remaining?: number;
  budget_exceeded?: boolean;
  lines: JournalEntryLine[];
}

export interface JournalUpdatePayload {
  description?: string;
  date?: string;
  reference_type?: string;
  reference_id?: string;
  internal_notes?: string;
  remarks?: string;
  lines?: JournalEntryLine[];
}

export interface JournalReversePayload {
  reason: string;
  date?: string;
  internal_notes?: string;
}

export interface JournalActionPayload {
  internal_notes?: string;
}

export interface JournalRejectPayload {
  reason: string;
  internal_notes?: string;
}

export interface TrialBalance { [key: string]: any; }
export interface ProfitLoss { [key: string]: any; }
export interface DashboardResponse { [key: string]: any; }
export interface AccountTreeNode { id: number; [key: string]: any; }
export interface SyncStatus { [key: string]: any; }
export interface LedgerResponse { entries: any[]; opening_balance?: number; closing_balance?: number; }

export interface AccountUpdate extends Partial<Account> { id: number; }
export interface FinanceOperation {
  id: number;
  type: string;
  amount: number;
  date: string;
  description?: string;
  status?: string;
  reference?: string;
  [key: string]: any;
}
export interface DealerCommissionContext {
  dealerId: number;
  dealerName: string;
  dealAmount: number;
  commissionRate: number;
  [key: string]: any;
}
export interface CommissionCalculateResult {
  commissionAmount: number;
  taxAmount?: number;
  netAmount: number;
  [key: string]: any;
}

export const operationsApi = {
  list: async (params?: any): Promise<FinanceOperation[]> => {
    const { data } = await api.get("/finance/operations", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  create: async (payload: any): Promise<FinanceOperation> => {
    const { data } = await api.post("/finance/operations", payload);
    return data;
  },
  get: async (id: number): Promise<FinanceOperation> => {
    const { data } = await api.get(`/finance/operations/${id}`);
    return data;
  },
};

export const accountsApi = {
  list: async (): Promise<Account[]> => {
    const { data } = await api.get("/finance/accounts");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  get: async (id: number): Promise<Account> => {
    const { data } = await api.get(`/finance/accounts/${id}`);
    return data;
  },
  create: async (payload: Partial<Account>): Promise<Account> => {
    const { data } = await api.post("/finance/accounts", payload);
    return data;
  },
  update: async (id: number, updates: Partial<Account>): Promise<void> => {
    await api.patch(`/finance/accounts/${id}`, updates);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/finance/accounts/${id}`);
  },
};

export const journalsApi = {
  list: async (params?: any): Promise<Journal[]> => {
    const { data } = await api.get("/finance/journals", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  get: async (id: number): Promise<Journal> => {
    const { data } = await api.get(`/finance/journals/${id}`);
    return data;
  },
  create: async (payload: JournalCreatePayload): Promise<Journal> => {
    const { data } = await api.post("/finance/journals", payload);
    return data;
  },
  update: async (id: number, payload: JournalUpdatePayload): Promise<Journal> => {
    const { data } = await api.patch(`/finance/journals/${id}`, payload);
    return data;
  },
  submit: async (id: number, payload?: JournalActionPayload): Promise<Journal> => {
    const { data } = await api.post(`/finance/journals/${id}/submit`, payload || {});
    return data;
  },
  approve: async (id: number, payload?: JournalActionPayload): Promise<Journal> => {
    const { data } = await api.post(`/finance/journals/${id}/approve`, payload || {});
    return data;
  },
  reject: async (id: number, payload: JournalRejectPayload): Promise<Journal> => {
    const { data } = await api.post(`/finance/journals/${id}/reject`, payload);
    return data;
  },
  post: async (id: number, payload?: JournalActionPayload): Promise<Journal> => {
    const { data } = await api.post(`/finance/journals/${id}/post`, payload || {});
    return data;
  },
  reverse: async (id: number, payload: JournalReversePayload): Promise<Journal> => {
    const { data } = await api.post(`/finance/journals/${id}/reverse`, payload);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/finance/journals/${id}`);
  },
  ledger: async (accountId: number, params?: any): Promise<any> => {
    const { data } = await api.get(`/finance/journals/ledger/${accountId}`, { params });
    return data;
  },
  trialBalance: async (): Promise<TrialBalance> => {
    const { data } = await api.get("/finance/journals/reports/trial-balance");
    return data;
  },
  profitLoss: async (params?: any): Promise<ProfitLoss> => {
    const { data } = await api.get("/finance/journals/reports/profit-loss", { params });
    return data;
  },
  balanceSheet: async (): Promise<any> => {
    const { data } = await api.get("/finance/journals/reports/balance-sheet");
    return data;
  },
  cashFlow: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/journals/reports/cash-flow", { params });
    return data;
  },
  receivablesAging: async (): Promise<any> => {
    const { data } = await api.get("/finance/journals/reports/receivables-aging");
    return data;
  },
  propertyIncome: async (): Promise<any> => {
    const { data } = await api.get("/finance/journals/reports/property-income");
    return data;
  },
  dealerCommission: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/journals/reports/dealer-commission", { params });
    return data;
  },
  dayBook: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/journals/reports/day-book", { params });
    return data;
  },
  cashBook: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/journals/reports/cash-book", { params });
    return data;
  },
  bankBook: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/journals/reports/bank-book", { params });
    return data;
  },
};

export const invoicesApi = {
  list: async (params?: any): Promise<Invoice[]> => {
    const { data } = await api.get("/finance/invoices", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  get: async (id: number): Promise<Invoice> => {
    const { data } = await api.get(`/finance/invoices/${id}`);
    return data;
  },
  create: async (payload: InvoiceCreate): Promise<Invoice> => {
    const { data } = await api.post("/finance/invoices", payload);
    return data;
  },
  update: async (id: number, updates: Partial<InvoiceCreate>): Promise<Invoice> => {
    const { data } = await api.patch(`/finance/invoices/${id}`, updates);
    return data;
  },
  send: async (id: number): Promise<Invoice> => {
    const { data } = await api.post(`/finance/invoices/${id}/send`);
    return data;
  },
  cancel: async (id: number): Promise<Invoice> => {
    const { data } = await api.post(`/finance/invoices/${id}/cancel`);
    return data;
  },
  void: async (id: number): Promise<Invoice> => {
    const { data } = await api.post(`/finance/invoices/${id}/void`);
    return data;
  },
  autoGenerate: async (payload: AutoGenerateInvoice): Promise<Invoice> => {
    const { data } = await api.post("/finance/invoices/auto-generate", payload);
    return data;
  },
  outstandingReport: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/reports/invoices/outstanding", { params });
    return data;
  },
  agingReport: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/reports/invoices/aging", { params });
    return data;
  },
  monthlyRevenueReport: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/reports/invoices/monthly-revenue", { params });
    return data;
  },
};

export const paymentsApi = {
  list: async (params?: any): Promise<Payment[]> => {
    const { data } = await api.get("/finance/payments", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  get: async (id: number): Promise<Payment> => {
    const { data } = await api.get(`/finance/payments/${id}`);
    return data;
  },
  create: async (payload: PaymentCreate): Promise<Payment> => {
    const { data } = await api.post("/finance/payments", payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<Payment> => {
    const { data } = await api.patch(`/finance/payments/${id}`, payload);
    return data;
  },
  reverse: async (id: number, payload: { reason: string; internal_notes?: string }): Promise<any> => {
    const { data } = await api.post(`/finance/payments/${id}/reverse`, payload);
    return data;
  },
  refund: async (id: number, payload: { refund_amount?: number; reason?: string; method?: string; reference_number?: string; internal_notes?: string }): Promise<any> => {
    const { data } = await api.post(`/finance/payments/${id}/refund`, payload);
    return data;
  },
  cancel: async (id: number): Promise<any> => {
    const { data } = await api.post(`/finance/payments/${id}/cancel`);
    return data;
  },
  delete: async (id: number): Promise<any> => {
    const { data } = await api.delete(`/finance/payments/${id}`);
    return data;
  },
  postToFinance: async (id: number, payload: { debit_account_id?: number; credit_account_id?: number }): Promise<Payment> => {
    const { data } = await api.patch(`/finance/payments/${id}/post`, payload);
    return data;
  },
  searchInvoices: async (params?: { q?: string; status?: string }): Promise<PaymentSearchInvoice[]> => {
    const { data } = await api.get("/finance/payments/search-invoices", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
};

export const commissionsApi = {
  list: async (params?: any): Promise<Commission[]> => {
    const { data } = await api.get("/finance/commissions", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  markPaid: async (id: number): Promise<void> => {
    await api.patch(`/finance/commissions/${id}/paid`);
  },
};

export const expensesApi = {
  list: async (params?: any): Promise<Expense[]> => {
    const { data } = await api.get("/finance/expenses", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  get: async (id: number): Promise<Expense> => {
    const { data } = await api.get(`/finance/expenses/${id}`);
    return data;
  },
  create: async (payload: ExpenseCreate): Promise<Expense> => {
    const { data } = await api.post("/finance/expenses", payload);
    return data;
  },
  update: async (id: number, updates: any): Promise<Expense> => {
    const { data } = await api.patch(`/finance/expenses/${id}`, updates);
    return data;
  },
  delete: async (id: number): Promise<any> => {
    const { data } = await api.delete(`/finance/expenses/${id}`);
    return data;
  },
  submit: async (id: number, payload?: { notes?: string }): Promise<any> => {
    const { data } = await api.post(`/finance/expenses/${id}/submit`, payload || {});
    return data;
  },
  approve: async (id: number, payload?: { notes?: string; approval_level?: number }): Promise<any> => {
    const { data } = await api.post(`/finance/expenses/${id}/approve`, payload || {});
    return data;
  },
  reject: async (id: number, payload: { reason: string; notes?: string }): Promise<any> => {
    const { data } = await api.post(`/finance/expenses/${id}/reject`, payload);
    return data;
  },
  recordPayment: async (id: number, payload: {
    amount: number; payment_method?: string; paid_from?: string;
    paid_from_account_id?: number; bank_account?: string;
    transaction_reference?: string; payment_date?: string;
    cheque_number?: string; notes?: string;
  }): Promise<Expense> => {
    const { data } = await api.post(`/finance/expenses/${id}/pay`, payload);
    return data;
  },
  cancel: async (id: number): Promise<any> => {
    const { data } = await api.post(`/finance/expenses/${id}/cancel`);
    return data;
  },
  reportByCategory: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/expenses/reports/by-category", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  reportByVendor: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/expenses/reports/by-vendor", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  reportAging: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/expenses/reports/accounts-payable-aging", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  reportBudgetVsActual: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/expenses/reports/budget-vs-actual", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
};

export const bankCashApi = {
  bankTransactions: async (): Promise<any[]> => {
    const { data } = await api.get("/finance/bank/transactions");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  cashTransactions: async (): Promise<any[]> => {
    const { data } = await api.get("/finance/cash/transactions");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  bankPayment: async (payload: any): Promise<any> => {
    const { data } = await api.post("/finance/bank/payment", payload);
    return data;
  },
  bankReceipt: async (payload: any): Promise<any> => {
    const { data } = await api.post("/finance/bank/receipt", payload);
    return data;
  },
  cashPayment: async (payload: any): Promise<any> => {
    const { data } = await api.post("/finance/cash/payment", payload);
    return data;
  },
  cashReceipt: async (payload: any): Promise<any> => {
    const { data } = await api.post("/finance/cash/receipt", payload);
    return data;
  },
};

export const dashboardApi = {
  get: async (): Promise<DashboardResponse> => {
    const { data } = await api.get("/finance/dashboard");
    return data;
  },
  monthlyIncomeExpense: async (months: number): Promise<any> => {
    const { data } = await api.get("/finance/dashboard/monthly-income-expense", { params: { months } });
    return data;
  },
  cashFlow: async (days: number): Promise<any> => {
    const { data } = await api.get("/finance/dashboard/cash-flow", { params: { days } });
    return data;
  },
  invoiceStatus: async (): Promise<any> => {
    const { data } = await api.get("/finance/dashboard/invoice-status");
    return data;
  },
  bankCashPositions: async (): Promise<any> => {
    const { data } = await api.get("/finance/dashboard/bank-cash-positions");
    return data;
  },
};

export const syncApi = {
  bookingToken: async (payload: any): Promise<void> => {
    await api.post("/finance/sync/booking-token", payload);
  },
  maintenance: async (payload: any): Promise<void> => {
    await api.post("/finance/sync/property/maintenance", payload);
  },
  downPayment: async (payload: any): Promise<void> => {
    await api.post("/finance/sync/down-payment", payload);
  },
  installment: async (payload: any): Promise<void> => {
    await api.post("/finance/sync/installment", payload);
  },
  commissionPaid: async (payload: any): Promise<void> => {
    await api.post("/finance/sync/commission-paid", payload);
  },
  rentPayment: async (payload: any): Promise<void> => {
    await api.post("/finance/sync/rent-payment", payload);
  },
};

export const ledgerApi = {
  propertyList: async (): Promise<any[]> => {
    const { data } = await api.get("/finance/ledger/property/list");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  propertyLedger: async (propertyId: number, params?: any): Promise<any> => {
    const { data } = await api.get(`/finance/ledger/property/${propertyId}`, { params });
    return data;
  },
  createPropertyEntry: async (payload: any): Promise<any> => {
    const { data } = await api.post("/finance/ledger/property", payload);
    return data;
  },
  dealerList: async (): Promise<any[]> => {
    const { data } = await api.get("/finance/ledger/dealer/list");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  dealerLedger: async (dealerId: number, params?: any): Promise<any> => {
    const { data } = await api.get(`/finance/ledger/dealer/${dealerId}`, { params });
    return data;
  },
  createDealerEntry: async (payload: any): Promise<any> => {
    const { data } = await api.post("/finance/ledger/dealer", payload);
    return data;
  },
  clientList: async (): Promise<any[]> => {
    const { data } = await api.get("/finance/ledger/client/list");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  clientLedger: async (clientId: number, params?: any): Promise<any> => {
    const { data } = await api.get(`/finance/ledger/client/${clientId}`, { params });
    return data;
  },
  createClientEntry: async (payload: any): Promise<any> => {
    const { data } = await api.post("/finance/ledger/client", payload);
    return data;
  },
};

export interface GeneralLedgerEntry {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  ref?: string;
}

export function mapLedgerEntriesForGeneralLedger(entries: any[]): GeneralLedgerEntry[] {
  if (!entries) return [];
  return entries.map((e: any) => ({
    id: e.id ?? 0,
    date: e.date ?? e.created_at ?? "",
    description: e.description ?? e.narration ?? "",
    debit: Number(e.debit ?? e.debit_amount ?? 0),
    credit: Number(e.credit ?? e.credit_amount ?? 0),
    balance: Number(e.balance ?? e.running_balance ?? 0),
    ref: e.reference ?? e.ref ?? "",
  }));
}

export const auditApi = {
  getLogs: async (params?: any): Promise<any> => {
    const { data } = await api.get("/finance/audit/logs", { params });
    return data;
  },
  getStats: async (): Promise<any> => {
    const { data } = await api.get("/finance/audit/stats");
    return data;
  },
  getRecordHistory: async (recordId: string): Promise<any[]> => {
    const { data } = await api.get(`/audit/${recordId}`);
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
};
