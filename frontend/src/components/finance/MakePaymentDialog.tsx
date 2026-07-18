import { useState, useEffect } from "react";
import { DollarSign, Check, X, Receipt, Search } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import {
  paymentsApi, type PaymentCreate,
  type PaymentSearchInvoice, type PaymentAllocationCreate,
  type Account
} from "../../lib/financeApi";
import AppDialog from "../ui/AppDialog";
import AttachmentPanel from "../attachments/AttachmentPanel";

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }}>*</span>}
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

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "credit_card", label: "Credit Card" },
  { value: "online", label: "Online" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "other", label: "Other" },
];

const PAYMENT_TYPES = [
  { value: "against_invoice", label: "Against Invoice" },
  { value: "advance", label: "Advance Payment" },
  { value: "misc_income", label: "Misc Income" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: PaymentCreate) => Promise<number>;
  preselectedInvoiceId?: number;
  accounts?: Account[];
}

export default function MakePaymentDialog({ isOpen, onClose, onSubmit, preselectedInvoiceId, accounts }: Props) {
  const [createdPaymentId, setCreatedPaymentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [paymentType, setPaymentType] = useState("against_invoice");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PaymentSearchInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentSearchInvoice | null>(null);

  const [method, setMethod] = useState("bank_transfer");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [partyName, setPartyName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    if (paymentType !== "against_invoice") return;
    const timer = setTimeout(async () => {
      try {
        const results = await paymentsApi.searchInvoices({ q: invoiceSearch });
        setSearchResults(results);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [invoiceSearch, paymentType]);

  useEffect(() => {
    if (preselectedInvoiceId) {
      setPaymentType("against_invoice");
    }
  }, [preselectedInvoiceId]);

  const reset = () => {
    setPaymentType("against_invoice");
    setInvoiceSearch("");
    setSearchResults([]);
    setSelectedInvoice(null);
    setMethod("bank_transfer");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setPartyName("");
    setReferenceNumber("");
    setAccountId("");
    setError("");
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) { setError("Amount is required"); return; }
    if (paymentType === "against_invoice" && !selectedInvoice) { setError("Please select an invoice"); return; }
    setError("");
    setLoading(true);
    try {
      const allocations: PaymentAllocationCreate[] = [];
      if (selectedInvoice) allocations.push({ invoice_id: selectedInvoice.id, allocated_amount: Number(amount) });
      const payload: PaymentCreate = {
        payment_type: paymentType,
        method,
        amount: Number(amount),
        date: date || new Date().toISOString(),
        party_name: partyName || undefined,
        reference_number: referenceNumber || undefined,
        account_id: accountId ? Number(accountId) : undefined,
        allocations: allocations.length > 0 ? allocations : undefined,
      };
      const paymentId = await onSubmit(payload);
      setCreatedPaymentId(paymentId);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  if (createdPaymentId) {
    return (
      <AppDialog isOpen={isOpen} onClose={() => { setCreatedPaymentId(null); reset(); onClose(); }} title="Record Payment" subtitle="Payment recorded successfully" size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <Check size={16} className="text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">Payment recorded successfully</p>
          </div>
          <AttachmentPanel module="finance" recordId={createdPaymentId} />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setCreatedPaymentId(null); reset(); }} className="btn-ghost px-4 py-2 text-xs">Add Another</button>
            <button onClick={() => { setCreatedPaymentId(null); reset(); onClose(); }} className="btn-primary px-4 py-2 text-xs">Done</button>
          </div>
        </div>
      </AppDialog>
    );
  }

  return (
    <AppDialog isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Record Payment" subtitle="Record a payment against invoice or general income" size="lg">
      <div className="space-y-4">
        <FormField label="Payment Type">
          <Select value={paymentType} onChange={e => setPaymentType(e.target.value)}>
            {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </FormField>

        {paymentType === "against_invoice" && (
          <div className="space-y-2">
            <FormField label="Search Invoice">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input className="dialog-input w-full text-xs pl-8" value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="Invoice number, client name..." />
              </div>
            </FormField>
            {selectedInvoice && (
              <div className="p-3 rounded-lg" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-emerald-400">{selectedInvoice.invoice_number || `#${selectedInvoice.id}`}</p>
                  <button onClick={() => setSelectedInvoice(null)} className="text-muted hover:text-red-400"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-muted">Client:</span> <span className="text-primary">{selectedInvoice.client_name}</span></div>
                  <div><span className="text-muted">Amount:</span> <span className="text-primary">{formatCurrency(selectedInvoice.amount)}</span></div>
                  <div><span className="text-muted">Remaining:</span> <span className="text-emerald-400">{formatCurrency(selectedInvoice.remaining_amount)}</span></div>
                  <div><span className="text-muted">Due:</span> <span>{new Date(selectedInvoice.due_date).toLocaleDateString()}</span></div>
                </div>
              </div>
            )}
            {!selectedInvoice && searchResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {searchResults.map(inv => (
                  <button key={inv.id} onClick={() => { setSelectedInvoice(inv); setPartyName(inv.client_name || ""); }}
                    className="w-full p-2.5 rounded-lg text-left transition-all hover:scale-[1.002] flex items-center justify-between"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-primary truncate">{inv.invoice_number || `#${inv.id}`} — {inv.client_name}</p>
                      <p className="text-[9px] text-muted">{inv.invoice_type} · Due {new Date(inv.due_date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-xs font-semibold">{formatCurrency(inv.remaining_amount)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!selectedInvoice && searchResults.length === 0 && invoiceSearch && (
              <p className="text-xs text-muted text-center py-2">No matching invoices</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Amount" required>
            <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </FormField>
          <FormField label="Date">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Payment Method" required>
            <Select value={method} onChange={e => setMethod(e.target.value)}>
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Account">
            <Select value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Select account...</option>
              {accounts?.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Party Name">
            <Input value={partyName} onChange={e => setPartyName(e.target.value)} placeholder="Client / tenant name" />
          </FormField>
          <FormField label="Reference Number">
            <Input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="e.g. REC-001" />
          </FormField>
        </div>

        {error && <p className="text-[10px]" style={{ color: "#ef4444" }}>{error}</p>}

        <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => { reset(); onClose(); }} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary px-4 py-2 text-xs flex items-center gap-1">
            <DollarSign size={12} />
            {loading ? "Saving..." : "Record Payment"}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
