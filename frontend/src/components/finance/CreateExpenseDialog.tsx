import { useState } from "react";
import { Receipt, Loader2, Check, Upload } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import {
  expensesApi, type Account, type ExpenseCreate
} from "../../lib/financeApi";
import AppDialog from "../ui/AppDialog";
import AttachmentPanel from "../attachments/AttachmentPanel";
import { MODULE_COLORS } from "../../config/moduleColors";

const ACCENT = MODULE_COLORS.finance.primary;

const EXPENSE_TYPES = [
  "purchase", "construction", "maintenance", "utility", "salary",
  "office", "fuel", "travel", "marketing", "repair", "tax",
  "petty_cash", "miscellaneous"
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ExpenseCreate) => Promise<number>;
  accounts: Account[];
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="dialog-input w-full text-xs" {...props} />;
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="dialog-select w-full text-xs" {...props}>{children}</select>;
}

export default function CreateExpenseDialog({ isOpen, onClose, onSubmit, accounts }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);

  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseType, setExpenseType] = useState("miscellaneous");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paidFrom, setPaidFrom] = useState("bank");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [vendorName, setVendorName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");

  const expenseAccounts = accounts?.filter((a: Account) => a.account_type === "Expense") || [];

  const resetForm = () => {
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setExpenseType("miscellaneous");
    setAmount("");
    setDescription("");
    setAccountId("");
    setPaidFrom("bank");
    setPaymentMethod("bank_transfer");
    setPaymentStatus("pending");
    setVendorName("");
    setReferenceNo("");
    setNotes("");
    setError("");
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) { setError("Amount is required"); return; }
    setError("");
    setLoading(true);
    try {
      const numAmount = Number(amount);
      const payload: ExpenseCreate = {
        expense_date: expenseDate,
        expense_type: expenseType,
        amount: numAmount,
        line_items: [{
          description: description || "Expense",
          quantity: 1,
          unit_cost: numAmount,
          discount_pct: 0,
          tax_pct: 0,
          discount_amount: 0,
          tax_amount: 0,
          line_total: numAmount,
        }],
        vendor_name: vendorName || undefined,
        invoice_bill_no: referenceNo || undefined,
        account_id: accountId ? Number(accountId) : null,
        paid_from: paidFrom,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        internal_notes: notes || undefined,
      };
      const id = await onSubmit(payload);
      setCreatedId(id);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to create expense");
    } finally {
      setLoading(false);
    }
  };

  if (createdId) {
    return (
      <AppDialog isOpen={isOpen} onClose={() => { setCreatedId(null); resetForm(); onClose(); }} title="Expense Created" size="md">
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <Check size={16} className="text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">Expense created successfully</p>
          </div>
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Attachments</p>
            <AttachmentPanel module="finance" recordId={createdId} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setCreatedId(null); resetForm(); }} className="btn-ghost px-4 py-2 text-xs">Add Another</button>
            <button onClick={() => { setCreatedId(null); resetForm(); onClose(); }} className="btn-primary px-4 py-2 text-xs">Done</button>
          </div>
        </div>
      </AppDialog>
    );
  }

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title="Add Expense" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
          </Field>
          <Field label="Type" required>
            <Select value={expenseType} onChange={e => setExpenseType(e.target.value)}>
              {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Amount" required>
          <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </Field>

        <Field label="Description">
          <textarea className="dialog-input w-full text-xs min-h-[60px] resize-y" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this expense for?" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Expense Account" required>
            <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Select account</option>
              {expenseAccounts.map((a: Account) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </Select>
          </Field>
          <Field label="Paid From">
            <Select value={paidFrom} onChange={e => setPaidFrom(e.target.value)}>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment Method">
            <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="online">Online Transfer</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor">
            <Input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor name" />
          </Field>
          <Field label="Reference / Invoice No">
            <Input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="Invoice or ref no" />
          </Field>
        </div>

        <Field label="Notes">
          <textarea className="dialog-input w-full text-xs min-h-[60px] resize-y" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes..." />
        </Field>

        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Receipt size={12} />}
            {loading ? "Saving..." : "Save Expense"}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}