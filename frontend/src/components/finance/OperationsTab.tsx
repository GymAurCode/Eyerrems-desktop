import { useState, useEffect, FormEvent } from "react";
import {
  TrendingUp, TrendingDown, RotateCcw, ArrowLeftRight,
  SlidersHorizontal, GitMerge, Eye, AlertTriangle, X,
} from "lucide-react";
import Modal from "../Modal";
import { formatCurrency } from "../../lib/currency";
import {
  operationsApi, journalsApi, accountsApi,
  type FinanceOperation, type Journal, type Account,
} from "../../lib/financeApi";

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "input-field w-full px-3 py-2 rounded text-sm disabled:opacity-50";

function ErrBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg text-xs"
      style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
      <AlertTriangle size={13} /> {msg}
    </div>
  );
}

function WarnBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg text-xs"
      style={{ background: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
      <AlertTriangle size={13} /> {msg}
    </div>
  );
}

function Footer({ onClose, loading, label }: { onClose: () => void; loading?: boolean; label: string }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="submit" disabled={loading}
        className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50">
        {loading ? "Processing..." : label}
      </button>
      <button type="button" onClick={onClose} disabled={loading}
        className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
        Cancel
      </button>
    </div>
  );
}

function ConfirmCheck({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, [string, string]> = {
  REVENUE:    ["rgba(16,185,129,0.12)",  "#10b981"],
  EXPENSE:    ["rgba(239,68,68,0.12)",   "#f87171"],
  REFUND:     ["rgba(245,158,11,0.12)",  "#f59e0b"],
  TRANSFER:   ["rgba(59,130,246,0.12)",  "#60a5fa"],
  ADJUSTMENT: ["rgba(139,92,246,0.12)",  "#a78bfa"],
  MERGE:      ["rgba(236,72,153,0.12)",  "#f472b6"],
};

function TypeBadge({ type }: { type: string }) {
  const [bg, color] = TYPE_STYLE[type] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: bg, color }}>{type}</span>
  );
}

// ── Revenue Modal ─────────────────────────────────────────────────────────────

function RevenueModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subType, setSubType] = useState("rent_received");
  const [amount, setAmount] = useState("");
  const [debitId, setDebitId] = useState("");
  const [creditId, setCreditId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { accountsApi.list().then(setAccounts).catch(() => {}); }, []);

  const SUB_TYPES = [
    { value: "rent_received",            label: "Rent Received" },
    { value: "income_entry",             label: "Income Entry" },
    { value: "security_deposit_received",label: "Security Deposit Received" },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmed) { setError("Please confirm this action"); return; }
    if (!debitId || !creditId || !amount || !description) { setError("All fields are required"); return; }
    if (debitId === creditId) { setError("Debit and credit accounts must differ"); return; }
    if (Number(amount) <= 0) { setError("Amount must be positive"); return; }
    setLoading(true); setError("");
    try {
      await operationsApi.revenue({
        sub_type: subType,
        amount: Number(amount),
        debit_account_id: Number(debitId),
        credit_account_id: Number(creditId),
        description,
      });
      onDone(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Revenue operation failed");
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Record Revenue">
      <form onSubmit={handleSubmit} className="space-y-4">
        <WarnBanner msg="This creates a new immutable voucher and cannot be undone." />
        {error && <ErrBanner msg={error} />}
        <Field label="Revenue Type">
          <select className={inputCls} value={subType} onChange={e => setSubType(e.target.value)}>
            {SUB_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01"
            value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Debit Account (Cash / Bank / AR)">
          <select className={inputCls} value={debitId} onChange={e => setDebitId(e.target.value)}>
            <option value="">Select account...</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.account_type})</option>)}
          </select>
        </Field>
        <Field label="Credit Account (Income / Liability)">
          <select className={inputCls} value={creditId} onChange={e => setCreditId(e.target.value)}>
            <option value="">Select account...</option>
            {accounts.filter(a => String(a.id) !== debitId).map(a =>
              <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.account_type})</option>)}
          </select>
        </Field>
        <Field label="Description">
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Rent received for Unit 3A — April 2026" />
        </Field>
        <ConfirmCheck checked={confirmed} onChange={setConfirmed}
          label="I confirm this will create a new revenue voucher and cannot be undone" />
        <Footer onClose={onClose} loading={loading} label="Record Revenue" />
      </form>
    </Modal>
  );
}

// ── Expense Modal ─────────────────────────────────────────────────────────────

function ExpenseModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subType, setSubType] = useState("maintenance_cost");
  const [amount, setAmount] = useState("");
  const [debitId, setDebitId] = useState("");
  const [creditId, setCreditId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { accountsApi.list().then(setAccounts).catch(() => {}); }, []);

  const expenseAccounts = accounts.filter(a => a.account_type === "Expense");
  const cashBankAccounts = accounts.filter(a =>
    a.account_type === "Asset" && (a.code === "1010" || a.code === "1100" || a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"))
  );

  const SUB_TYPES = [
    { value: "maintenance_cost", label: "Maintenance Cost" },
    { value: "salary",           label: "Salary" },
    { value: "utility_bills",    label: "Utility Bills" },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmed) { setError("Please confirm this action"); return; }
    if (!debitId || !creditId || !amount || !description) { setError("All fields are required"); return; }
    if (Number(amount) <= 0) { setError("Amount must be positive"); return; }
    setLoading(true); setError("");
    try {
      await operationsApi.expense({
        sub_type: subType,
        amount: Number(amount),
        debit_account_id: Number(debitId),
        credit_account_id: Number(creditId),
        description,
      });
      onDone(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Expense operation failed");
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Record Expense">
      <form onSubmit={handleSubmit} className="space-y-4">
        <WarnBanner msg="This creates a new immutable voucher and cannot be undone." />
        {error && <ErrBanner msg={error} />}
        <Field label="Expense Type">
          <select className={inputCls} value={subType} onChange={e => setSubType(e.target.value)}>
            {SUB_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01"
            value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Expense Account (Debit)">
          <select className={inputCls} value={debitId} onChange={e => setDebitId(e.target.value)}>
            <option value="">Select expense account...</option>
            {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </Field>
        <Field label="Paid From (Credit — Cash / Bank)">
          <select className={inputCls} value={creditId} onChange={e => setCreditId(e.target.value)}>
            <option value="">Select cash/bank account...</option>
            {(cashBankAccounts.length > 0 ? cashBankAccounts : accounts.filter(a => a.account_type === "Asset")).map(a =>
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="e.g. AC repair — Unit 5B" />
        </Field>
        <ConfirmCheck checked={confirmed} onChange={setConfirmed}
          label="I confirm this will create a new expense voucher and cannot be undone" />
        <Footer onClose={onClose} loading={loading} label="Record Expense" />
      </form>
    </Modal>
  );
}

// ── Refund Modal ──────────────────────────────────────────────────────────────

function RefundModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalId, setJournalId] = useState("");
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [subType, setSubType] = useState("rent_refund");
  const [refundAmount, setRefundAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { journalsApi.list({ limit: 200 }).then(setJournals).catch(() => {}); }, []);

  useEffect(() => {
    const j = journals.find(j => j.id === Number(journalId)) ?? null;
    setSelectedJournal(j);
    if (j) setRefundAmount(String(j.entries.reduce((s, e) => s + Number(e.debit), 0)));
  }, [journalId, journals]);

  const originalAmount = selectedJournal
    ? selectedJournal.entries.reduce((s, e) => s + Number(e.debit), 0) : 0;

  const SUB_TYPES = [
    { value: "rent_refund",             label: "Rent Refund" },
    { value: "deposit_return",          label: "Deposit Return" },
    { value: "overpayment_correction",  label: "Overpayment Correction" },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmed) { setError("Please confirm this action"); return; }
    if (!journalId || !refundAmount || !reason) { setError("All fields are required"); return; }
    if (Number(refundAmount) <= 0) { setError("Refund amount must be positive"); return; }
    if (Number(refundAmount) > originalAmount) { setError("Refund cannot exceed original amount"); return; }
    setLoading(true); setError("");
    try {
      await operationsApi.refund({
        sub_type: subType,
        original_journal_id: Number(journalId),
        refund_amount: Number(refundAmount),
        reason,
      });
      onDone(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Refund failed");
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Create Refund">
      <form onSubmit={handleSubmit} className="space-y-4">
        <WarnBanner msg="This creates a new refund voucher linked to the original. Cannot be undone." />
        {error && <ErrBanner msg={error} />}
        <Field label="Refund Type">
          <select className={inputCls} value={subType} onChange={e => setSubType(e.target.value)}>
            {SUB_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Original Journal / Voucher">
          <select className={inputCls} value={journalId} onChange={e => setJournalId(e.target.value)}>
            <option value="">Select journal...</option>
            {journals.map(j => (
              <option key={j.id} value={j.id}>
                #{j.id} — {j.reference_type} — {j.description || new Date(j.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </Field>
        {selectedJournal && (
          <div className="p-3 rounded-lg text-xs space-y-1"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Original Amount</span>
              <span className="font-semibold text-primary">{formatCurrency(originalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Date</span>
              <span className="text-primary">{new Date(selectedJournal.date).toLocaleDateString()}</span>
            </div>
          </div>
        )}
        <Field label="Refund Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01"
            max={originalAmount || undefined}
            value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Reason">
          <textarea className={inputCls} rows={2}
            value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for refund..." />
        </Field>
        <ConfirmCheck checked={confirmed} onChange={setConfirmed}
          label="I confirm this creates a new refund voucher linked to the original" />
        <Footer onClose={onClose} loading={loading} label="Execute Refund" />
      </form>
    </Modal>
  );
}

// ── Transfer Modal ────────────────────────────────────────────────────────────

function TransferModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { accountsApi.list().then(setAccounts).catch(() => {}); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmed) { setError("Please confirm this action"); return; }
    if (!fromId || !toId || !amount) { setError("All fields are required"); return; }
    if (fromId === toId) { setError("From and To accounts must be different"); return; }
    if (Number(amount) <= 0) { setError("Amount must be positive"); return; }
    setLoading(true); setError("");
    try {
      await operationsApi.transfer({
        from_account_id: Number(fromId),
        to_account_id: Number(toId),
        amount: Number(amount),
        note: note || undefined,
      });
      onDone(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Transfer failed");
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Fund Transfer">
      <form onSubmit={handleSubmit} className="space-y-4">
        <WarnBanner msg="Creates a balanced journal entry (DR destination / CR source). Cannot be undone." />
        {error && <ErrBanner msg={error} />}
        <Field label="From Account">
          <select className={inputCls} value={fromId} onChange={e => setFromId(e.target.value)}>
            <option value="">Select source account...</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.account_type})</option>)}
          </select>
        </Field>
        <Field label="To Account">
          <select className={inputCls} value={toId} onChange={e => setToId(e.target.value)}>
            <option value="">Select destination account...</option>
            {accounts.filter(a => String(a.id) !== fromId).map(a =>
              <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.account_type})</option>)}
          </select>
        </Field>
        <Field label="Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01"
            value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Note (Optional)">
          <input className={inputCls} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Transfer note..." />
        </Field>
        <ConfirmCheck checked={confirmed} onChange={setConfirmed}
          label="I confirm this creates a new transfer voucher and cannot be undone" />
        <Footer onClose={onClose} loading={loading} label="Execute Transfer" />
      </form>
    </Modal>
  );
}

// ── Adjustment Modal ──────────────────────────────────────────────────────────

function AdjustmentModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subType, setSubType] = useState("correction");
  const [debitId, setDebitId] = useState("");
  const [creditId, setCreditId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { accountsApi.list().then(setAccounts).catch(() => {}); }, []);

  const SUB_TYPES = [
    { value: "correction",      label: "Correction of Wrong Entry" },
    { value: "discount",        label: "Discount Adjustment" },
    { value: "tax_adjustment",  label: "Tax Adjustment" },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmed) { setError("Please confirm this action"); return; }
    if (!debitId || !creditId || !amount || !reason) { setError("All fields are required"); return; }
    if (debitId === creditId) { setError("Debit and credit accounts must differ"); return; }
    if (Number(amount) <= 0) { setError("Amount must be positive"); return; }
    setLoading(true); setError("");
    try {
      await operationsApi.adjustment({
        sub_type: subType,
        debit_account_id: Number(debitId),
        credit_account_id: Number(creditId),
        amount: Number(amount),
        reason,
      });
      onDone(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Adjustment failed");
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Create Adjustment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <WarnBanner msg="Creates a new adjustment journal entry. Original records are never modified." />
        {error && <ErrBanner msg={error} />}
        <Field label="Adjustment Type">
          <select className={inputCls} value={subType} onChange={e => setSubType(e.target.value)}>
            {SUB_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Debit Account">
          <select className={inputCls} value={debitId} onChange={e => setDebitId(e.target.value)}>
            <option value="">Select account...</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.account_type})</option>)}
          </select>
        </Field>
        <Field label="Credit Account">
          <select className={inputCls} value={creditId} onChange={e => setCreditId(e.target.value)}>
            <option value="">Select account...</option>
            {accounts.filter(a => String(a.id) !== debitId).map(a =>
              <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.account_type})</option>)}
          </select>
        </Field>
        <Field label="Amount">
          <input className={inputCls} type="number" step="0.01" min="0.01"
            value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Reason / Notes">
          <textarea className={inputCls} rows={2}
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Describe the adjustment reason..." />
        </Field>
        <ConfirmCheck checked={confirmed} onChange={setConfirmed}
          label="I confirm this creates a new adjustment voucher and cannot be undone" />
        <Footer onClose={onClose} loading={loading} label="Execute Adjustment" />
      </form>
    </Modal>
  );
}

// ── Merge Modal ───────────────────────────────────────────────────────────────

function MergeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { accountsApi.list().then(setAccounts).catch(() => {}); }, []);

  const sourceAcc = accounts.find(a => String(a.id) === sourceId);
  const targetAcc = accounts.find(a => String(a.id) === targetId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmed) { setError("Please confirm this action"); return; }
    if (!sourceId || !targetId) { setError("Both accounts are required"); return; }
    if (sourceId === targetId) { setError("Source and target must be different"); return; }
    setLoading(true); setError("");
    try {
      await operationsApi.merge({
        source_account_id: Number(sourceId),
        target_account_id: Number(targetId),
        note: note || undefined,
      });
      onDone(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Merge failed");
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Merge Accounts">
      <form onSubmit={handleSubmit} className="space-y-4">
        <WarnBanner msg="Source account will be deactivated. Balance transfers to target. Cannot be undone." />
        {error && <ErrBanner msg={error} />}
        <Field label="Source Account (will be deactivated)">
          <select className={inputCls} value={sourceId} onChange={e => setSourceId(e.target.value)}>
            <option value="">Select source account...</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </Field>
        <Field label="Target Account (receives balance)">
          <select className={inputCls} value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">Select target account...</option>
            {accounts.filter(a => String(a.id) !== sourceId).map(a =>
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </Field>
        {sourceAcc && targetAcc && (
          <div className="p-3 rounded-lg text-xs space-y-2"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <p className="font-semibold text-primary">Merge Preview</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-1 rounded text-[10px]"
                style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                {sourceAcc.code} — {sourceAcc.name}
              </span>
              <span style={{ color: "var(--text-muted)" }}>→</span>
              <span className="px-2 py-1 rounded text-[10px]"
                style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                {targetAcc.code} — {targetAcc.name}
              </span>
            </div>
          </div>
        )}
        <Field label="Note (Optional)">
          <input className={inputCls} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Merge reason..." />
        </Field>
        <ConfirmCheck checked={confirmed} onChange={setConfirmed}
          label="I confirm this will deactivate the source account and cannot be undone" />
        <Footer onClose={onClose} loading={loading} label="Execute Merge" />
      </form>
    </Modal>
  );
}

// ── Operation Detail Modal ────────────────────────────────────────────────────

function DetailModal({ op, onClose }: { op: FinanceOperation; onClose: () => void }) {
  const rows: [string, string][] = [
    ["ID",            `#${op.id}`],
    ["Type",          op.type],
    ["Sub-Type",      op.sub_type ?? "—"],
    ["Date",          new Date(op.created_at).toLocaleString()],
    ["Amount",        formatCurrency(op.amount)],
    ["Journal #",     `J#${op.journal_id}`],
    ...(op.reference_journal_id ? [["Original Journal", `J#${op.reference_journal_id}`] as [string, string]] : []),
    ...(op.from_account_name ? [["From Account", op.from_account_name] as [string, string]] : []),
    ...(op.to_account_name   ? [["To Account",   op.to_account_name]   as [string, string]] : []),
    ...(op.entity_type ? [["Entity", `${op.entity_type} #${op.entity_id}`] as [string, string]] : []),
    ...(op.reason ? [["Reason / Note", op.reason] as [string, string]] : []),
  ];

  return (
    <Modal open onClose={onClose} title="Operation Details">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <TypeBadge type={op.type} />
          {op.sub_type && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-surface2)", color: "var(--text-muted)" }}>
              {op.sub_type}
            </span>
          )}
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {rows.map(([label, value], i) => (
            <div key={i} className="flex justify-between items-center px-4 py-2.5 text-xs"
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid var(--border-subtle)" : "none",
                background: i % 2 === 0 ? "transparent" : "var(--bg-surface2)",
              }}>
              <span style={{ color: "var(--text-muted)" }}>{label}</span>
              <span className="font-medium text-primary text-right max-w-[60%] break-words">{value}</span>
            </div>
          ))}
        </div>
        {op.meta && Object.keys(op.meta).length > 0 && (
          <div className="p-3 rounded-lg text-xs"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <p className="font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Meta</p>
            <pre className="text-primary text-[10px] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(op.meta, null, 2)}
            </pre>
          </div>
        )}
        <button onClick={onClose} className="w-full py-2.5 text-sm rounded-xl transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// ── Action Card ───────────────────────────────────────────────────────────────

function ActionCard({
  icon: Icon, title, description, color, onClick,
}: {
  icon: React.ElementType; title: string; description: string;
  color: string; onClick: () => void;
}) {
  return (
    <div className="detail-container p-5 flex flex-col gap-4 transition-all hover:scale-[1.01]"
      style={{ border: `1px solid ${color}25` }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary">{title}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{description}</p>
        </div>
      </div>
      <button onClick={onClick}
        className="w-full py-2 text-xs font-semibold rounded-xl transition-colors"
        style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
        onMouseEnter={e => (e.currentTarget.style.background = `${color}28`)}
        onMouseLeave={e => (e.currentTarget.style.background = `${color}15`)}>
        Execute
      </button>
    </div>
  );
}

// ── Main OperationsTab ────────────────────────────────────────────────────────

type ModalType = "revenue" | "expense" | "refund" | "transfer" | "adjustment" | "merge" | null;

export default function OperationsTab() {
  const [modal, setModal] = useState<ModalType>(null);
  const [ops, setOps] = useState<FinanceOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOp, setDetailOp] = useState<FinanceOperation | null>(null);
  const [typeFilter, setTypeFilter] = useState("ALL");

  const load = async () => {
    setLoading(true);
    try { setOps(await operationsApi.history({ limit: 500 })); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const CARDS: { id: ModalType; icon: React.ElementType; title: string; description: string; color: string }[] = [
    {
      id: "revenue", icon: TrendingUp, color: "#10b981",
      title: "Revenue",
      description: "Record rent received, income entries, or security deposits. DR Cash/AR · CR Income.",
    },
    {
      id: "expense", icon: TrendingDown, color: "#f87171",
      title: "Expense",
      description: "Record maintenance costs, salaries, or utility bills. DR Expense · CR Cash/Bank.",
    },
    {
      id: "refund", icon: RotateCcw, color: "#f59e0b",
      title: "Refund",
      description: "Reverse a previous transaction. Creates a new refund voucher linked to the original.",
    },
    {
      id: "transfer", icon: ArrowLeftRight, color: "#60a5fa",
      title: "Transfer",
      description: "Move funds between accounts. Creates 2 ledger movements in one balanced journal.",
    },
    {
      id: "adjustment", icon: SlidersHorizontal, color: "#a78bfa",
      title: "Adjustment",
      description: "Correct wrong entries or apply discounts/tax adjustments with full audit trail.",
    },
    {
      id: "merge", icon: GitMerge, color: "#f472b6",
      title: "Merge",
      description: "Consolidate two accounts. Balance transfers to target; source is soft-deleted.",
    },
  ];

  const TYPES = ["ALL", "REVENUE", "EXPENSE", "REFUND", "TRANSFER", "ADJUSTMENT", "MERGE"];
  const filtered = typeFilter === "ALL" ? ops : ops.filter(o => o.type === typeFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-primary">Finance Operations Engine</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Every operation creates a new immutable voucher — originals are never modified
        </p>
      </div>

      {/* 6 Operation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {CARDS.map(c => (
          <ActionCard key={c.id} icon={c.icon} title={c.title}
            description={c.description} color={c.color}
            onClick={() => setModal(c.id)} />
        ))}
      </div>

      {/* Operations History Table */}
      <div className="detail-container">
        <div className="detail-section flex items-center justify-between flex-wrap gap-2">
          <p className="detail-section-title mb-0">Operations History</p>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type filter */}
            <div className="flex gap-1 flex-wrap">
              {TYPES.map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className="text-[10px] px-2.5 py-1 rounded-full font-semibold transition-colors"
                  style={typeFilter === t
                    ? { background: (TYPE_STYLE[t] ?? ["rgba(59,130,246,0.2)", "#60a5fa"])[0], color: (TYPE_STYLE[t] ?? ["", "#60a5fa"])[1] }
                    : { background: "var(--bg-surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  {t}
                </button>
              ))}
            </div>
            <button onClick={load}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Type</th>
                <th>Sub-Type</th>
                <th className="text-right">Amount</th>
                <th>From / Debit</th>
                <th>To / Credit</th>
                <th>Reference</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-10" style={{ color: "var(--text-muted)" }}>No operations yet</td></tr>
              )}
              {filtered.map(op => (
                <tr key={op.id}>
                  <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>#{op.id}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{new Date(op.created_at).toLocaleDateString()}</td>
                  <td><TypeBadge type={op.type} /></td>
                  <td className="text-xs" style={{ color: "var(--text-muted)" }}>{op.sub_type ?? "—"}</td>
                  <td className="text-right font-semibold">{formatCurrency(op.amount)}</td>
                  <td className="text-xs" style={{ color: "var(--text-secondary)" }}>{op.from_account_name ?? "—"}</td>
                  <td className="text-xs" style={{ color: "var(--text-secondary)" }}>{op.to_account_name ?? "—"}</td>
                  <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                    J#{op.journal_id}{op.reference_journal_id ? ` ← J#${op.reference_journal_id}` : ""}
                  </td>
                  <td className="max-w-[140px] truncate text-xs" style={{ color: "var(--text-muted)" }}>
                    {op.reason ?? "—"}
                  </td>
                  <td>
                    <button onClick={() => setDetailOp(op)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                      style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(59,130,246,0.1)")}>
                      <Eye size={11} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal === "revenue"    && <RevenueModal    onClose={() => setModal(null)} onDone={load} />}
      {modal === "expense"    && <ExpenseModal    onClose={() => setModal(null)} onDone={load} />}
      {modal === "refund"     && <RefundModal     onClose={() => setModal(null)} onDone={load} />}
      {modal === "transfer"   && <TransferModal   onClose={() => setModal(null)} onDone={load} />}
      {modal === "adjustment" && <AdjustmentModal onClose={() => setModal(null)} onDone={load} />}
      {modal === "merge"      && <MergeModal      onClose={() => setModal(null)} onDone={load} />}
      {detailOp && <DetailModal op={detailOp} onClose={() => setDetailOp(null)} />}
    </div>
  );
}
