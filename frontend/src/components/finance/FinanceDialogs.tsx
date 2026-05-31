import { FormEvent, useState, useEffect } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import Modal from "../Modal";
import { accountsApi, type Account } from "../../lib/financeApi";
import { useLookup } from "../../hooks/useLookup";

// ── Shared helpers ────────────────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
      <AlertCircle size={14} />{msg}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "input-field w-full px-3 py-2 rounded text-sm disabled:opacity-50";
const selectCls = inputCls;

function DialogFooter({ onClose, loading, submitLabel }: { onClose: () => void; loading?: boolean; submitLabel?: string }) {
  return (
    <div className="flex gap-2 pt-4">
      <button type="submit" disabled={loading} className="flex-1 btn-primary py-2 text-sm disabled:opacity-50">
        {loading ? "Saving..." : (submitLabel || "Save")}
      </button>
      <button type="button" onClick={onClose} disabled={loading}
        className="flex-1 px-3 py-2 text-sm border border-secondary rounded text-muted hover:bg-secondary/50 disabled:opacity-50">
        Cancel
      </button>
    </div>
  );
}

// ── Create Account ────────────────────────────────────────────────────────────

interface CreateAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function CreateAccountDialog({ isOpen, onClose, onSubmit, isLoading }: CreateAccountDialogProps) {
  const { options: ACCOUNT_TYPE_OPTS } = useLookup('account_type');
  const [code, setCode]     = useState("");
  const [name, setName]     = useState("");
  const [type, setType]     = useState("Asset");
  const [parentId, setParentId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (isOpen) accountsApi.list().then(setAccounts).catch(() => {});
  }, [isOpen]);

  const reset = () => { setCode(""); setName(""); setType("Asset"); setParentId(""); setError(""); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim() || !name.trim()) { setError("Code and name are required"); return; }
    try {
      await accountsApi.create({ code: code.trim(), name: name.trim(), account_type: type, parent_id: parentId ? Number(parentId) : null });
      reset(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to create account");
    }
  };

  return (
    <Modal open={isOpen} onClose={() => { reset(); onClose(); }} title="Create Account">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner msg={error} />}
        <Field label="Account Code">
          <input className={inputCls} value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. 1000" disabled={isLoading} />
        </Field>
        <Field label="Account Name">
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cash on Hand" disabled={isLoading} />
        </Field>
        <Field label="Account Type">
          <select className={selectCls} value={type} onChange={e => setType(e.target.value)} disabled={isLoading}>
            {ACCOUNT_TYPE_OPTS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </Field>
        <Field label="Parent Account (Optional)">
          <select className={selectCls} value={parentId} onChange={e => setParentId(e.target.value)} disabled={isLoading}>
            <option value="">None</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </Field>
        <DialogFooter onClose={() => { reset(); onClose(); }} loading={isLoading} submitLabel="Create Account" />
      </form>
    </Modal>
  );
}

// ── Create Invoice ────────────────────────────────────────────────────────────

interface CreateInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function CreateInvoiceDialog({ isOpen, onClose, onSubmit, isLoading }: CreateInvoiceDialogProps) {
  const [tenantId,    setTenantId]    = useState("");
  const [propertyId,  setPropertyId]  = useState("");
  const [unitId,      setUnitId]      = useState("");
  const [amount,      setAmount]      = useState("");
  const [dueDate,     setDueDate]     = useState("");
  const [description, setDescription] = useState("");
  const [error,       setError]       = useState("");

  const reset = () => { setTenantId(""); setPropertyId(""); setUnitId(""); setAmount(""); setDueDate(""); setDescription(""); setError(""); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!tenantId || !propertyId || !amount || !dueDate) { setError("Tenant, property, amount and due date are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    try {
      await onSubmit({ tenant_id: Number(tenantId), property_id: Number(propertyId), unit_id: unitId ? Number(unitId) : undefined, amount: Number(amount), due_date: new Date(dueDate).toISOString(), description: description || undefined });
      reset(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to create invoice");
    }
  };

  return (
    <Modal open={isOpen} onClose={() => { reset(); onClose(); }} title="Create Invoice">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner msg={error} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tenant ID">
            <input className={inputCls} type="number" value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant ID" disabled={isLoading} />
          </Field>
          <Field label="Property ID">
            <input className={inputCls} type="number" value={propertyId} onChange={e => setPropertyId(e.target.value)} placeholder="Property ID" disabled={isLoading} />
          </Field>
        </div>
        <Field label="Unit ID (Optional)">
          <input className={inputCls} type="number" value={unitId} onChange={e => setUnitId(e.target.value)} placeholder="Unit ID" disabled={isLoading} />
        </Field>
        <Field label="Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
        </Field>
        <Field label="Due Date">
          <input className={inputCls} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isLoading} />
        </Field>
        <Field label="Description (Optional)">
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Monthly rent - April" disabled={isLoading} />
        </Field>
        <DialogFooter onClose={() => { reset(); onClose(); }} loading={isLoading} submitLabel="Create Invoice" />
      </form>
    </Modal>
  );
}

// ── Make Payment ──────────────────────────────────────────────────────────────

interface MakePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  invoices: any[];
  preselectedInvoiceId?: number;
  isLoading?: boolean;
}

export function MakePaymentDialog({ isOpen, onClose, onSubmit, invoices, preselectedInvoiceId, isLoading }: MakePaymentDialogProps) {
  const { options: PAYMENT_METHOD_OPTS } = useLookup('payment_method');
  const [invoiceId, setInvoiceId] = useState(preselectedInvoiceId ? String(preselectedInvoiceId) : "");
  const [method,    setMethod]    = useState("bank");
  const [amount,    setAmount]    = useState("");
  const [date,      setDate]      = useState("");
  const [refNum,    setRefNum]    = useState("");
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (preselectedInvoiceId) setInvoiceId(String(preselectedInvoiceId));
  }, [preselectedInvoiceId]);

  const selectedInvoice = invoices.find(i => i.id === Number(invoiceId));

  const reset = () => { setInvoiceId(""); setMethod("bank"); setAmount(""); setDate(""); setRefNum(""); setError(""); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!invoiceId || !amount) { setError("Invoice and amount are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    if (selectedInvoice && Number(amount) > selectedInvoice.amount) {
      setError("Payment cannot exceed invoice amount");
      return;
    }
    try {
      await onSubmit({ invoice_id: Number(invoiceId), method, amount: Number(amount), date: date ? new Date(date).toISOString() : undefined, reference_number: refNum || undefined });
      reset(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to record payment");
    }
  };

  return (
    <Modal open={isOpen} onClose={() => { reset(); onClose(); }} title="Record Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner msg={error} />}
        <Field label="Invoice">
          <select className={selectCls} value={invoiceId} onChange={e => setInvoiceId(e.target.value)} disabled={isLoading}>
            <option value="">Select invoice...</option>
            {invoices.map(inv => (
              <option key={inv.id} value={inv.id}>#{inv.id} — {inv.amount} ({inv.status})</option>
            ))}
          </select>
        </Field>
        {selectedInvoice && (
          <div className="p-3 bg-secondary/50 rounded text-xs text-muted">
            Invoice amount: <span className="text-primary font-medium">{selectedInvoice.amount}</span> | Status: <span className="text-primary">{selectedInvoice.status}</span>
          </div>
        )}
        <Field label="Payment Method">
          <select className={selectCls} value={method} onChange={e => setMethod(e.target.value)} disabled={isLoading}>
            {PAYMENT_METHOD_OPTS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date (Optional)">
            <input className={inputCls} type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
          </Field>
          <Field label="Reference No. (Optional)">
            <input className={inputCls} value={refNum} onChange={e => setRefNum(e.target.value)} placeholder="e.g. CHQ-001" disabled={isLoading} />
          </Field>
        </div>
        <DialogFooter onClose={() => { reset(); onClose(); }} loading={isLoading} submitLabel="Record Payment" />
      </form>
    </Modal>
  );
}

// ── Add Expense ───────────────────────────────────────────────────────────────

interface AddExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  accounts: Account[];
  isLoading?: boolean;
}

export function AddExpenseDialog({ isOpen, onClose, onSubmit, accounts, isLoading }: AddExpenseDialogProps) {
  const [accountId,   setAccountId]   = useState("");
  const [paidFrom,    setPaidFrom]    = useState("bank");
  const [amount,      setAmount]      = useState("");
  const [date,        setDate]        = useState("");
  const [description, setDescription] = useState("");
  const [reference,   setReference]   = useState("");
  const [error,       setError]       = useState("");

  const reset = () => { setAccountId(""); setPaidFrom("bank"); setAmount(""); setDate(""); setDescription(""); setReference(""); setError(""); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!accountId || !amount || !description) { setError("Account, amount and description are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    try {
      await onSubmit({ account_id: Number(accountId), paid_from: paidFrom, amount: Number(amount), date: date ? new Date(date).toISOString() : undefined, description, reference: reference || undefined });
      reset(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to add expense");
    }
  };

  return (
    <Modal open={isOpen} onClose={() => { reset(); onClose(); }} title="Add Expense">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner msg={error} />}
        <Field label="Expense Account">
          <select className={selectCls} value={accountId} onChange={e => setAccountId(e.target.value)} disabled={isLoading}>
            <option value="">Select expense account...</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </Field>
        <Field label="Paid From">
          <select className={selectCls} value={paidFrom} onChange={e => setPaidFrom(e.target.value)} disabled={isLoading}>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </Field>
        <Field label="Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
        </Field>
        <Field label="Description">
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Office supplies" disabled={isLoading} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date (Optional)">
            <input className={inputCls} type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
          </Field>
          <Field label="Reference (Optional)">
            <input className={inputCls} value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. INV-001" disabled={isLoading} />
          </Field>
        </div>
        <DialogFooter onClose={() => { reset(); onClose(); }} loading={isLoading} submitLabel="Add Expense" />
      </form>
    </Modal>
  );
}

// ── Create Commission ─────────────────────────────────────────────────────────

interface CreateCommissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function CreateCommissionDialog({ isOpen, onClose, onSubmit, isLoading }: CreateCommissionDialogProps) {
  const [agentId,     setAgentId]     = useState("");
  const [propertyId,  setPropertyId]  = useState("");
  const [amount,      setAmount]      = useState("");
  const [type,        setType]        = useState("earned");
  const [date,        setDate]        = useState("");
  const [reference,   setReference]   = useState("");
  const [description, setDescription] = useState("");
  const [error,       setError]       = useState("");

  const reset = () => { setAgentId(""); setPropertyId(""); setAmount(""); setType("earned"); setDate(""); setReference(""); setDescription(""); setError(""); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agentId || !propertyId || !amount) { setError("Agent, property and amount are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    try {
      await onSubmit({ agent_id: Number(agentId), property_id: Number(propertyId), amount: Number(amount), type, date: date ? new Date(date).toISOString() : undefined, reference: reference || undefined, description: description || undefined });
      reset(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to record commission");
    }
  };

  return (
    <Modal open={isOpen} onClose={() => { reset(); onClose(); }} title="Record Commission">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner msg={error} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agent ID">
            <input className={inputCls} type="number" value={agentId} onChange={e => setAgentId(e.target.value)} placeholder="Agent ID" disabled={isLoading} />
          </Field>
          <Field label="Property ID">
            <input className={inputCls} type="number" value={propertyId} onChange={e => setPropertyId(e.target.value)} placeholder="Property ID" disabled={isLoading} />
          </Field>
        </div>
        <Field label="Type">
          <select className={selectCls} value={type} onChange={e => setType(e.target.value)} disabled={isLoading}>
            <option value="earned">Earned (DR: Commission Receivable, CR: Commission Income)</option>
            <option value="paid">Paid (DR: Commission Expense, CR: Bank)</option>
          </select>
        </Field>
        <Field label="Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date (Optional)">
            <input className={inputCls} type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
          </Field>
          <Field label="Reference (Optional)">
            <input className={inputCls} value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. DEAL-001" disabled={isLoading} />
          </Field>
        </div>
        <Field label="Description (Optional)">
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes..." disabled={isLoading} />
        </Field>
        <DialogFooter onClose={() => { reset(); onClose(); }} loading={isLoading} submitLabel="Record Commission" />
      </form>
    </Modal>
  );
}

// ── Manual Journal Entry ──────────────────────────────────────────────────────

interface ManualJournalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  accounts: Account[];
  isLoading?: boolean;
}

interface JournalLine {
  account_id: string;
  debit: string;
  credit: string;
  description: string;
}

export function ManualJournalDialog({ isOpen, onClose, onSubmit, accounts, isLoading }: ManualJournalDialogProps) {
  const [description, setDescription] = useState("");
  const [date,        setDate]        = useState("");
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: "", debit: "", credit: "", description: "" },
    { account_id: "", debit: "", credit: "", description: "" },
  ]);
  const [error, setError] = useState("");

  const reset = () => {
    setDescription(""); setDate(""); setError("");
    setLines([{ account_id: "", debit: "", credit: "", description: "" }, { account_id: "", debit: "", credit: "", description: "" }]);
  };

  const updateLine = (idx: number, field: keyof JournalLine, value: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const addLine = () => setLines(prev => [...prev, { account_id: "", debit: "", credit: "", description: "" }]);
  const removeLine = (idx: number) => { if (lines.length > 2) setLines(prev => prev.filter((_, i) => i !== idx)); };

  const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.001;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!balanced) { setError(`Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})`); return; }
    const validLines = lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { setError("At least 2 valid lines required"); return; }
    try {
      await onSubmit({
        reference_type: "manual",
        description: description || undefined,
        date: date ? new Date(date).toISOString() : undefined,
        lines: validLines.map(l => ({
          account_id: Number(l.account_id),
          debit:  Number(l.debit)  || 0,
          credit: Number(l.credit) || 0,
          description: l.description || undefined,
        })),
      });
      reset(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to post journal");
    }
  };

  return (
    <Modal open={isOpen} onClose={() => { reset(); onClose(); }} title="Manual Journal Entry" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner msg={error} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Description (Optional)">
            <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Journal description" disabled={isLoading} />
          </Field>
          <Field label="Date (Optional)">
            <input className={inputCls} type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
          </Field>
        </div>

        {/* Lines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted">Journal Lines</label>
            <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              <Plus size={12}/> Add Line
            </button>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1 text-[10px] text-muted px-1">
              <span className="col-span-4">Account</span>
              <span className="col-span-2 text-right">Debit</span>
              <span className="col-span-2 text-right">Credit</span>
              <span className="col-span-3">Description</span>
              <span className="col-span-1"></span>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                <div className="col-span-4">
                  <select className={selectCls + " text-xs py-1.5"} value={line.account_id} onChange={e => updateLine(idx, "account_id", e.target.value)} disabled={isLoading}>
                    <option value="">Account...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input className={inputCls + " text-xs py-1.5 text-right"} type="number" step="0.01" min="0" value={line.debit} onChange={e => updateLine(idx, "debit", e.target.value)} placeholder="0.00" disabled={isLoading} />
                </div>
                <div className="col-span-2">
                  <input className={inputCls + " text-xs py-1.5 text-right"} type="number" step="0.01" min="0" value={line.credit} onChange={e => updateLine(idx, "credit", e.target.value)} placeholder="0.00" disabled={isLoading} />
                </div>
                <div className="col-span-3">
                  <input className={inputCls + " text-xs py-1.5"} value={line.description} onChange={e => updateLine(idx, "description", e.target.value)} placeholder="Note..." disabled={isLoading} />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 2} className="p-1 hover:bg-red-500/20 rounded text-red-400 disabled:opacity-30">
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-3 p-3 bg-secondary/50 rounded flex justify-between text-xs">
            <span className="text-muted">Totals</span>
            <div className="flex gap-6">
              <span>DR: <span className="text-blue-400 font-medium">{totalDebit.toFixed(2)}</span></span>
              <span>CR: <span className="text-blue-400 font-medium">{totalCredit.toFixed(2)}</span></span>
              <span className={balanced ? "text-green-400" : "text-red-400"}>{balanced ? "✓ Balanced" : "✗ Unbalanced"}</span>
            </div>
          </div>
        </div>

        <DialogFooter onClose={() => { reset(); onClose(); }} loading={isLoading} submitLabel="Post Journal" />
      </form>
    </Modal>
  );
}

// ── Bank / Cash Dialog ────────────────────────────────────────────────────────

interface BankCashDialogProps {
  isOpen: boolean;
  type: "bank_payment" | "bank_receipt" | "cash_payment" | "cash_receipt" | null;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  accounts: Account[];
  isLoading?: boolean;
}

export function BankCashDialog({ isOpen, type, onClose, onSubmit, accounts, isLoading }: BankCashDialogProps) {
  const [accountId,   setAccountId]   = useState("");
  const [amount,      setAmount]      = useState("");
  const [date,        setDate]        = useState("");
  const [description, setDescription] = useState("");
  const [reference,   setReference]   = useState("");
  const [error,       setError]       = useState("");

  const reset = () => { setAccountId(""); setAmount(""); setDate(""); setDescription(""); setReference(""); setError(""); };

  const titles: Record<string, string> = {
    bank_payment: "Bank Payment",
    bank_receipt: "Bank Receipt",
    cash_payment: "Cash Payment",
    cash_receipt: "Cash Receipt",
  };

  const hints: Record<string, string> = {
    bank_payment: "DR: Counter Account | CR: Bank",
    bank_receipt: "DR: Bank | CR: Counter Account",
    cash_payment: "DR: Counter Account | CR: Cash",
    cash_receipt: "DR: Cash | CR: Counter Account",
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!accountId || !amount || !description) { setError("Account, amount and description are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    try {
      await onSubmit({ account_id: Number(accountId), amount: Number(amount), description, date: date ? new Date(date).toISOString() : undefined, reference: reference || undefined });
      reset(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to record transaction");
    }
  };

  if (!type) return null;

  return (
    <Modal open={isOpen} onClose={() => { reset(); onClose(); }} title={titles[type] || "Transaction"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner msg={error} />}
        <div className="p-3 bg-secondary/50 rounded text-xs text-muted">{hints[type]}</div>
        <Field label="Counter Account">
          <select className={selectCls} value={accountId} onChange={e => setAccountId(e.target.value)} disabled={isLoading}>
            <option value="">Select account...</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.account_type})</option>)}
          </select>
        </Field>
        <Field label="Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
        </Field>
        <Field label="Description">
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Transaction description" disabled={isLoading} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date (Optional)">
            <input className={inputCls} type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
          </Field>
          <Field label="Reference (Optional)">
            <input className={inputCls} value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. TXN-001" disabled={isLoading} />
          </Field>
        </div>
        <DialogFooter onClose={() => { reset(); onClose(); }} loading={isLoading} submitLabel={titles[type]} />
      </form>
    </Modal>
  );
}
