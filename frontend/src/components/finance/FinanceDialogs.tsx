import { useState, useEffect } from "react";
import { AlertCircle, Plus, Trash2, FileText, DollarSign, CreditCard, Receipt, TrendingUp, BookOpen, Landmark } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { FormSection, FormRow, FormField } from "../ui/DialogForm";
import { DialogCancelButton, DialogSubmitButton } from "../ui/DialogButtons";
import AttachmentPanel from "../attachments/AttachmentPanel";
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

  const handleSubmit = async () => {
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
    <AppDialog
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title="Create Account"
      subtitle="Add a new account to the chart of accounts"
      size="md"
      icon={<FileText size={18} />}
      footer={
        <>
          <AppDialogCancelButton onClick={() => { reset(); onClose(); }} />
          <AppDialogSubmitButton onClick={handleSubmit} label="Create Account" loading={isLoading} />
        </>
      }
    >
      {error && <ErrorBanner msg={error} />}
      <FormRow cols={2}>
        <FormField label="Account Code" required>
          <input className="dialog-input" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. 1000" disabled={isLoading} />
        </FormField>
        <FormField label="Account Name" required>
          <input className="dialog-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cash on Hand" disabled={isLoading} />
        </FormField>
      </FormRow>
      <FormRow cols={2}>
        <FormField label="Account Type" required>
          <select className="dialog-select" value={type} onChange={e => setType(e.target.value)} disabled={isLoading}>
            {ACCOUNT_TYPE_OPTS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </FormField>
        <FormField label="Parent Account" hint="Optional">
          <select className="dialog-select" value={parentId} onChange={e => setParentId(e.target.value)} disabled={isLoading}>
            <option value="">None</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </FormField>
      </FormRow>
    </AppDialog>
  );
}

// ── Create Invoice ────────────────────────────────────────────────────────────

interface CreateInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<number>;
  isLoading?: boolean;
}

export function CreateInvoiceDialog({ isOpen, onClose, onSubmit, isLoading }: CreateInvoiceDialogProps) {
  const [tenantId,       setTenantId]       = useState("");
  const [propertyId,     setPropertyId]     = useState("");
  const [unitId,         setUnitId]         = useState("");
  const [amount,         setAmount]         = useState("");
  const [dueDate,        setDueDate]        = useState("");
  const [description,    setDescription]    = useState("");
  const [error,          setError]          = useState("");
  const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null);

  const reset = () => {
    setTenantId(""); setPropertyId(""); setUnitId(""); setAmount("");
    setDueDate(""); setDescription(""); setError(""); setCreatedInvoiceId(null);
  };

  const handleSubmit = async () => {
    setError("");
    if (!tenantId || !propertyId || !amount || !dueDate) { setError("Tenant, property, amount and due date are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    try {
      const invoiceId = await onSubmit({
        tenant_id: Number(tenantId), property_id: Number(propertyId),
        unit_id: unitId ? Number(unitId) : undefined,
        amount: Number(amount), due_date: new Date(dueDate).toISOString(),
        description: description || undefined,
      });
      setCreatedInvoiceId(invoiceId);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to create invoice");
    }
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={createdInvoiceId ? "Invoice Created" : "Create Invoice"}
      subtitle={createdInvoiceId ? "Invoice has been generated successfully" : "Generate a new invoice for a tenant or property"}
      size="lg"
      icon={<DollarSign size={18} />}
      footer={
        createdInvoiceId ? (
          <AppDialogCancelButton onClick={() => { reset(); onClose(); }} label="Done" />
        ) : (
          <>
            <AppDialogCancelButton onClick={() => { reset(); onClose(); }} />
            <AppDialogSubmitButton onClick={handleSubmit} label="Create Invoice" loading={isLoading} />
          </>
        )
      }
    >
      {createdInvoiceId ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
            <p className="text-sm font-semibold text-emerald-400">Invoice #{createdInvoiceId} created successfully</p>
            <p className="text-xs text-muted mt-1">You can now attach files below</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdInvoiceId} title="Attachments" />
        </div>
      ) : (
        <>
          {error && <ErrorBanner msg={error} />}
          <FormRow cols={2}>
            <FormField label="Tenant ID" required>
              <input className="dialog-input" type="number" value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant ID" disabled={isLoading} />
            </FormField>
            <FormField label="Property ID" required>
              <input className="dialog-input" type="number" value={propertyId} onChange={e => setPropertyId(e.target.value)} placeholder="Property ID" disabled={isLoading} />
            </FormField>
          </FormRow>
          <FormField label="Unit ID" hint="Optional">
            <input className="dialog-input" type="number" value={unitId} onChange={e => setUnitId(e.target.value)} placeholder="Unit ID" disabled={isLoading} />
          </FormField>
          <FormRow cols={2}>
            <FormField label="Amount" required>
              <input className="dialog-input" type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
            </FormField>
            <FormField label="Due Date" required>
              <input className="dialog-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isLoading} />
            </FormField>
          </FormRow>
          <FormField label="Description" hint="Optional">
            <input className="dialog-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Monthly rent - April" disabled={isLoading} />
          </FormField>
        </>
      )}
    </AppDialog>
  );
}

// ── Make Payment ──────────────────────────────────────────────────────────────

interface MakePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<number>;
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
  const [createdPaymentId, setCreatedPaymentId] = useState<number | null>(null);

  useEffect(() => {
    if (preselectedInvoiceId) setInvoiceId(String(preselectedInvoiceId));
  }, [preselectedInvoiceId]);

  const selectedInvoice = invoices.find(i => i.id === Number(invoiceId));

  const reset = () => { setInvoiceId(""); setMethod("bank"); setAmount(""); setDate(""); setRefNum(""); setError(""); setCreatedPaymentId(null); };

  const handleSubmit = async () => {
    setError("");
    if (!invoiceId || !amount) { setError("Invoice and amount are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    if (selectedInvoice && Number(amount) > selectedInvoice.amount) {
      setError("Payment cannot exceed invoice amount");
      return;
    }
    try {
      const paymentId = await onSubmit({ invoice_id: Number(invoiceId), method, amount: Number(amount), date: date ? new Date(date).toISOString() : undefined, reference_number: refNum || undefined });
      setCreatedPaymentId(paymentId);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to record payment");
    }
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={createdPaymentId ? "Payment Recorded" : "Record Payment"}
      subtitle={createdPaymentId ? "Payment has been recorded successfully" : "Record a payment toward an invoice"}
      size="md"
      icon={<CreditCard size={18} />}
      footer={
        createdPaymentId ? (
          <AppDialogCancelButton onClick={() => { reset(); onClose(); }} label="Done" />
        ) : (
          <>
            <AppDialogCancelButton onClick={() => { reset(); onClose(); }} />
            <AppDialogSubmitButton onClick={handleSubmit} label="Record Payment" loading={isLoading} />
          </>
        )
      }
    >
      {createdPaymentId ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
            <p className="text-sm font-semibold text-emerald-400">Payment #{createdPaymentId} recorded successfully</p>
            <p className="text-xs text-muted mt-1">You can now attach files below</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdPaymentId} title="Attachments" />
        </div>
      ) : (
        <>
          {error && <ErrorBanner msg={error} />}
          <FormField label="Invoice" required>
            <select className="dialog-select" value={invoiceId} onChange={e => setInvoiceId(e.target.value)} disabled={isLoading}>
              <option value="">Select invoice...</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>#{inv.id} — {inv.amount} ({inv.status})</option>
              ))}
            </select>
          </FormField>
          {selectedInvoice && (
            <div className="p-3 bg-secondary/50 rounded text-xs text-muted">
              Invoice amount: <span className="text-primary font-medium">{selectedInvoice.amount}</span> | Status: <span className="text-primary">{selectedInvoice.status}</span>
            </div>
          )}
          <FormRow cols={2}>
            <FormField label="Payment Method" required>
              <select className="dialog-select" value={method} onChange={e => setMethod(e.target.value)} disabled={isLoading}>
                {PAYMENT_METHOD_OPTS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Amount" required>
              <input className="dialog-input" type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
            </FormField>
          </FormRow>
          <FormRow cols={2}>
            <FormField label="Date" hint="Optional">
              <input className="dialog-input" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
            </FormField>
            <FormField label="Reference No." hint="Optional">
              <input className="dialog-input" value={refNum} onChange={e => setRefNum(e.target.value)} placeholder="e.g. CHQ-001" disabled={isLoading} />
            </FormField>
          </FormRow>
        </>
      )}
    </AppDialog>
  );
}

// ── Add Expense ───────────────────────────────────────────────────────────────

interface AddExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<number>;
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
  const [createdExpenseId, setCreatedExpenseId] = useState<number | null>(null);

  const reset = () => { setAccountId(""); setPaidFrom("bank"); setAmount(""); setDate(""); setDescription(""); setReference(""); setError(""); setCreatedExpenseId(null); };

  const handleSubmit = async () => {
    setError("");
    if (!accountId || !amount || !description) { setError("Account, amount and description are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    try {
      const expenseId = await onSubmit({ account_id: Number(accountId), paid_from: paidFrom, amount: Number(amount), date: date ? new Date(date).toISOString() : undefined, description, reference: reference || undefined });
      setCreatedExpenseId(expenseId);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to add expense");
    }
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={createdExpenseId ? "Expense Added" : "Add Expense"}
      subtitle={createdExpenseId ? "Expense has been added successfully" : "Log a new business expense"}
      size="md"
      icon={<Receipt size={18} />}
      footer={
        createdExpenseId ? (
          <AppDialogCancelButton onClick={() => { reset(); onClose(); }} label="Done" />
        ) : (
          <>
            <AppDialogCancelButton onClick={() => { reset(); onClose(); }} />
            <AppDialogSubmitButton onClick={handleSubmit} label="Add Expense" loading={isLoading} />
          </>
        )
      }
    >
      {createdExpenseId ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
            <p className="text-sm font-semibold text-emerald-400">Expense #{createdExpenseId} added successfully</p>
            <p className="text-xs text-muted mt-1">You can now attach files below</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdExpenseId} title="Attachments" />
        </div>
      ) : (
        <>
          {error && <ErrorBanner msg={error} />}
          <FormRow cols={2}>
            <FormField label="Expense Account" required>
              <select className="dialog-select" value={accountId} onChange={e => setAccountId(e.target.value)} disabled={isLoading}>
                <option value="">Select expense account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </FormField>
            <FormField label="Paid From" required>
              <select className="dialog-select" value={paidFrom} onChange={e => setPaidFrom(e.target.value)} disabled={isLoading}>
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
              </select>
            </FormField>
          </FormRow>
          <FormRow cols={2}>
            <FormField label="Amount" required>
              <input className="dialog-input" type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
            </FormField>
            <FormField label="Date" hint="Optional">
              <input className="dialog-input" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
            </FormField>
          </FormRow>
          <FormField label="Description" required>
            <input className="dialog-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Office supplies" disabled={isLoading} />
          </FormField>
          <FormField label="Reference" hint="Optional">
            <input className="dialog-input" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. INV-001" disabled={isLoading} />
          </FormField>
        </>
      )}
    </AppDialog>
  );
}

// ── Create Commission ─────────────────────────────────────────────────────────

interface CreateCommissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<number>;
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
  const [createdCommissionId, setCreatedCommissionId] = useState<number | null>(null);

  const reset = () => { setAgentId(""); setPropertyId(""); setAmount(""); setType("earned"); setDate(""); setReference(""); setDescription(""); setError(""); setCreatedCommissionId(null); };

  const handleSubmit = async () => {
    setError("");
    if (!agentId || !propertyId || !amount) { setError("Agent, property and amount are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    try {
      const commissionId = await onSubmit({ agent_id: Number(agentId), property_id: Number(propertyId), amount: Number(amount), type, date: date ? new Date(date).toISOString() : undefined, reference: reference || undefined, description: description || undefined });
      setCreatedCommissionId(commissionId);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to record commission");
    }
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={createdCommissionId ? "Commission Recorded" : "Record Commission"}
      subtitle={createdCommissionId ? "Commission has been recorded successfully" : "Record an agent commission"}
      size="md"
      icon={<TrendingUp size={18} />}
      footer={
        createdCommissionId ? (
          <AppDialogCancelButton onClick={() => { reset(); onClose(); }} label="Done" />
        ) : (
          <>
            <AppDialogCancelButton onClick={() => { reset(); onClose(); }} />
            <AppDialogSubmitButton onClick={handleSubmit} label="Record Commission" loading={isLoading} />
          </>
        )
      }
    >
      {createdCommissionId ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
            <p className="text-sm font-semibold text-emerald-400">Commission #{createdCommissionId} recorded successfully</p>
            <p className="text-xs text-muted mt-1">You can now attach files below</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdCommissionId} title="Attachments" />
        </div>
      ) : (
        <>
          {error && <ErrorBanner msg={error} />}
          <FormRow cols={2}>
            <FormField label="Agent ID" required>
              <input className="dialog-input" type="number" value={agentId} onChange={e => setAgentId(e.target.value)} placeholder="Agent ID" disabled={isLoading} />
            </FormField>
            <FormField label="Property ID" required>
              <input className="dialog-input" type="number" value={propertyId} onChange={e => setPropertyId(e.target.value)} placeholder="Property ID" disabled={isLoading} />
            </FormField>
          </FormRow>
          <FormField label="Type" required>
            <select className="dialog-select" value={type} onChange={e => setType(e.target.value)} disabled={isLoading}>
              <option value="earned">Earned (DR: Commission Receivable, CR: Commission Income)</option>
              <option value="paid">Paid (DR: Commission Expense, CR: Bank)</option>
            </select>
          </FormField>
          <FormRow cols={2}>
            <FormField label="Amount" required>
              <input className="dialog-input" type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
            </FormField>
            <FormField label="Date" hint="Optional">
              <input className="dialog-input" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
            </FormField>
          </FormRow>
          <FormRow cols={2}>
            <FormField label="Reference" hint="Optional">
              <input className="dialog-input" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. DEAL-001" disabled={isLoading} />
            </FormField>
            <FormField label="Description" hint="Optional">
              <input className="dialog-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes..." disabled={isLoading} />
            </FormField>
          </FormRow>
        </>
      )}
    </AppDialog>
  );
}

// ── Manual Journal Entry ──────────────────────────────────────────────────────

interface ManualJournalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<number>;
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
  const [createdJournalId, setCreatedJournalId] = useState<number | null>(null);

  const reset = () => {
    setDescription(""); setDate(""); setError(""); setCreatedJournalId(null);
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

  const handleSubmit = async () => {
    setError("");
    if (!balanced) { setError(`Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})`); return; }
    const validLines = lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { setError("At least 2 valid lines required"); return; }
    try {
      const journalId = await onSubmit({
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
      setCreatedJournalId(journalId);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to post journal");
    }
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={createdJournalId ? "Journal Posted" : "Manual Journal Entry"}
      subtitle={createdJournalId ? "Journal entry has been posted successfully" : "Post a balanced journal entry with debits and credits"}
      size="lg"
      icon={<BookOpen size={18} />}
      footer={
        createdJournalId ? (
          <AppDialogCancelButton onClick={() => { reset(); onClose(); }} label="Done" />
        ) : (
          <>
            <AppDialogCancelButton onClick={() => { reset(); onClose(); }} />
            <AppDialogSubmitButton onClick={handleSubmit} label="Post Journal" loading={isLoading} />
          </>
        )
      }
    >
      {createdJournalId ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
            <p className="text-sm font-semibold text-emerald-400">Journal #{createdJournalId} posted successfully</p>
            <p className="text-xs text-muted mt-1">You can now attach files below</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdJournalId} title="Attachments" />
        </div>
      ) : (
        <>
          {error && <ErrorBanner msg={error} />}
          <FormRow cols={2}>
            <FormField label="Description" hint="Optional">
              <input className="dialog-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Journal description" disabled={isLoading} />
            </FormField>
            <FormField label="Date" hint="Optional">
              <input className="dialog-input" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
            </FormField>
          </FormRow>

          <FormSection title="Journal Lines">
            <div className="flex items-center justify-between mb-2">
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
                    <select className="dialog-select text-xs py-1.5" value={line.account_id} onChange={e => updateLine(idx, "account_id", e.target.value)} disabled={isLoading}>
                      <option value="">Account...</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input className="dialog-input text-xs py-1.5 text-right" type="number" step="0.01" min="0" value={line.debit} onChange={e => updateLine(idx, "debit", e.target.value)} placeholder="0.00" disabled={isLoading} />
                  </div>
                  <div className="col-span-2">
                    <input className="dialog-input text-xs py-1.5 text-right" type="number" step="0.01" min="0" value={line.credit} onChange={e => updateLine(idx, "credit", e.target.value)} placeholder="0.00" disabled={isLoading} />
                  </div>
                  <div className="col-span-3">
                    <input className="dialog-input text-xs py-1.5" value={line.description} onChange={e => updateLine(idx, "description", e.target.value)} placeholder="Note..." disabled={isLoading} />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 2} className="p-1 hover:bg-red-500/20 rounded text-red-400 disabled:opacity-30">
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 p-3 bg-secondary/50 rounded flex justify-between text-xs">
              <span className="text-muted">Totals</span>
              <div className="flex gap-6">
                <span>DR: <span className="text-blue-400 font-medium">{totalDebit.toFixed(2)}</span></span>
                <span>CR: <span className="text-blue-400 font-medium">{totalCredit.toFixed(2)}</span></span>
                <span className={balanced ? "text-green-400" : "text-red-400"}>{balanced ? "\u2713 Balanced" : "\u2717 Unbalanced"}</span>
              </div>
            </div>
          </FormSection>
        </>
      )}
    </AppDialog>
  );
}

// ── Bank / Cash Dialog ────────────────────────────────────────────────────────

interface BankCashDialogProps {
  isOpen: boolean;
  type: "bank_payment" | "bank_receipt" | "cash_payment" | "cash_receipt" | null;
  onClose: () => void;
  onSubmit: (data: any) => Promise<number>;
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
  const [createdTxnId, setCreatedTxnId] = useState<number | null>(null);

  const reset = () => { setAccountId(""); setAmount(""); setDate(""); setDescription(""); setReference(""); setError(""); setCreatedTxnId(null); };

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

  const handleSubmit = async () => {
    setError("");
    if (!accountId || !amount || !description) { setError("Account, amount and description are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be greater than 0"); return; }
    try {
      const txnId = await onSubmit({ account_id: Number(accountId), amount: Number(amount), description, date: date ? new Date(date).toISOString() : undefined, reference: reference || undefined });
      setCreatedTxnId(txnId);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to record transaction");
    }
  };

  if (!type) return null;

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={createdTxnId ? titles[type] + " Recorded" : titles[type] || "Transaction"}
      subtitle={createdTxnId ? "Transaction has been recorded successfully" : "Record a bank or cash transaction"}
      size="md"
      icon={<Landmark size={18} />}
      footer={
        createdTxnId ? (
          <AppDialogCancelButton onClick={() => { reset(); onClose(); }} label="Done" />
        ) : (
          <>
            <AppDialogCancelButton onClick={() => { reset(); onClose(); }} />
            <AppDialogSubmitButton onClick={handleSubmit} label={titles[type]} loading={isLoading} />
          </>
        )
      }
    >
      {createdTxnId ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
            <p className="text-sm font-semibold text-emerald-400">{titles[type]} #{createdTxnId} recorded successfully</p>
            <p className="text-xs text-muted mt-1">You can now attach files below</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdTxnId} title="Attachments" />
        </div>
      ) : (
        <>
          {error && <ErrorBanner msg={error} />}
          <div className="p-3 bg-secondary/50 rounded text-xs text-muted">{hints[type]}</div>
          <FormField label="Counter Account" required>
            <select className="dialog-select" value={accountId} onChange={e => setAccountId(e.target.value)} disabled={isLoading}>
              <option value="">Select account...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.account_type})</option>)}
            </select>
          </FormField>
          <FormRow cols={2}>
            <FormField label="Amount" required>
              <input className="dialog-input" type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" disabled={isLoading} />
            </FormField>
            <FormField label="Date" hint="Optional">
              <input className="dialog-input" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading} />
            </FormField>
          </FormRow>
          <FormField label="Description" required>
            <input className="dialog-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Transaction description" disabled={isLoading} />
          </FormField>
          <FormField label="Reference" hint="Optional">
            <input className="dialog-input" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. TXN-001" disabled={isLoading} />
          </FormField>
        </>
      )}
    </AppDialog>
  );
}
