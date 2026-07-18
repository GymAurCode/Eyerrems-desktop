import { useState, useEffect, useMemo } from "react";
import {
  DollarSign, Send, X, Check, Loader2, Printer, Edit2, FileText,
  Clock, AlertTriangle, Ban, History, Download, Eye, CreditCard,
  Calendar, Hash, User, Phone, Mail, MapPin, Building2, ArrowRight
} from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import {
  invoicesApi, paymentsApi, type Invoice, type Account, type PaymentCreate
} from "../../lib/financeApi";
import AppDialog from "../ui/AppDialog";
import { api } from "../../lib/api";
import FileUpload from "../ui/FileUpload";
import { MODULE_COLORS } from "../../config/moduleColors";
import MakePaymentDialog from "./MakePaymentDialog";
import { useNotifStore } from "../../store/notifications";

const ACCENT = MODULE_COLORS.finance.primary;

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  pending: "#f59e0b",
  sent: "#3b82f6",
  viewed: "#8b5cf6",
  partially_paid: "#f59e0b",
  paid: "#10b981",
  overdue: "#ef4444",
  cancelled: "#6b7280",
  void: "#ef4444",
};

const STATUS_FLOW = ["draft", "pending", "sent", "viewed", "partially_paid", "paid"];
const TERMINAL_STATUSES = ["paid", "cancelled", "void"];

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ background: color + "22", color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <Icon size={14} style={{ color: ACCENT }} />
        <span className="text-xs font-semibold text-primary">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function InvoiceDetailView({
  invoice: initialInvoice, onClose, onRefresh, accounts,
}: {
  invoice: Invoice; onClose: () => void; onRefresh: () => void; accounts: Account[];
}) {
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  const [tab, setTab] = useState<"preview" | "payments" | "activity">("preview");
  const [payments, setPayments] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const pushToast = useNotifStore((s) => s.pushToast);

  useEffect(() => {
    if (!invoice) return;
    setLoading(true);
    Promise.all([
      api.get(`/audit/record/finance_invoice-${invoice.id}`)
        .then(r => setActivityLog(Array.isArray(r.data) ? r.data : []))
        .catch(() => setActivityLog([])),
      invoicesApi.get(invoice.id).then(inv => {
        setInvoice(inv);
        setPayments(inv.allocations?.map((a: any) => a.payment).filter(Boolean) || []);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [invoice?.id]);

  const canSend = invoice.status === "draft" || invoice.status === "pending";
  const canCancel = !["paid", "cancelled", "void"].includes(invoice.status);
  const canVoid = !["void"].includes(invoice.status) && invoice.status !== "paid";
  const isTerminal = TERMINAL_STATUSES.includes(invoice.status);

  const handleAction = async (action: string) => {
    setActionLoading(action); setActionError("");
    try {
      let updated: Invoice;
      if (action === "send") { updated = await invoicesApi.send(invoice.id); pushToast({ title: "Invoice Sent", message: `Invoice #${invoice.id} marked as sent`, type: "success" }); }
      else if (action === "cancel") { updated = await invoicesApi.cancel(invoice.id); pushToast({ title: "Invoice Cancelled", message: `Invoice #${invoice.id} has been cancelled`, type: "success" }); }
      else if (action === "void") { updated = await invoicesApi.void(invoice.id); pushToast({ title: "Invoice Voided", message: `Invoice #${invoice.id} has been voided`, type: "success" }); }
      else return;
      setInvoice(updated);
      onRefresh();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || err.message || `Failed to ${action} invoice`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePaymentSubmit = async (payload: PaymentCreate): Promise<number> => {
    const payment = await paymentsApi.create(payload);
    pushToast({ title: "Payment Recorded", message: `Payment #${payment.id} recorded successfully`, type: "success" });
    onRefresh();
    const updated = await invoicesApi.get(invoice.id);
    setInvoice(updated);
    setPayments(prev => [...prev, payment]);
    return payment.id;
  };

  const itemsList = invoice.items || invoice.line_items || [];
  const subtotal = itemsList.reduce((s: number, li: any) => s + Number(li.quantity) * Number(li.unit_price), 0) || 0;
  const taxAmount = itemsList.reduce((s: number, li: any) => s + Number(li.amount) - (Number(li.quantity) * Number(li.unit_price) * (1 - Number(li.discount_pct) / 100)), 0) || 0;
  const discountAmount = itemsList.reduce((s: number, li: any) => {
    const base = Number(li.quantity) * Number(li.unit_price);
    return s + (base * Number(li.discount_pct) / 100);
  }, 0) || 0;

  const dueAmount = invoice.remaining_amount ?? invoice.amount - (invoice.paid_amount || 0);

  const statusStep = STATUS_FLOW.indexOf(invoice.status);

  return (
    <AppDialog isOpen onClose={onClose}
      title={`Invoice ${invoice.invoice_number || `#${invoice.id}`}`}
      subtitle={`${new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()} · ${invoice.invoice_type || "manual"}`}
      size="2xl">

      {/* Status Timeline */}
      <div className="flex items-center gap-1 mb-4 px-1">
        {STATUS_FLOW.map((s, i) => {
          const isActive = i <= statusStep;
          const isCurrent = s === invoice.status;
          return (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isCurrent ? "ring-2" : ""}`}
                  style={{
                    background: isActive ? (STATUS_COLORS[s] || "#94a3b8") : "var(--border)",
                    "--tw-ring-color": isCurrent ? (STATUS_COLORS[s] || "#94a3b8") : "transparent",
                  } as React.CSSProperties} />
                <span className={`text-[9px] ${isCurrent ? "font-semibold" : isActive ? "text-muted" : "text-muted"}`}
                  style={{ color: isCurrent ? (STATUS_COLORS[s] || "#94a3b8") : "var(--text-muted)" }}>
                  {s.replace(/_/g, " ")}
                </span>
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <div className="flex-1 h-px" style={{ background: isActive ? (STATUS_COLORS[s] || "#94a3b8") : "var(--border)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {canSend && (
          <button onClick={() => handleAction("send")} disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white"
            style={{ background: ACCENT }}>
            {actionLoading === "send" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Mark Sent
          </button>
        )}
        {canCancel && (
          <button onClick={() => handleAction("cancel")} disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg"
            style={{ border: "1px solid #f59e0b44", color: "#f59e0b" }}>
            {actionLoading === "cancel" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Cancel
          </button>
        )}
          {canVoid && (
          <button onClick={() => handleAction("void")} disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg"
            style={{ border: "1px solid #ef444444", color: "#ef4444" }}>
            {actionLoading === "void" ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
            Void
          </button>
        )}
        {!isTerminal && (
          <button onClick={() => setShowPaymentDialog(true)} disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white"
            style={{ background: ACCENT }}>
            <DollarSign size={12} /> Record Payment
          </button>
        )}
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }}>
          <Printer size={12} /> Print
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }}>
          <Download size={12} /> PDF
        </button>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 p-2 mb-3 rounded-lg text-[10px]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
          <AlertTriangle size={12} /> {actionError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {[
          { id: "preview", label: "Invoice Preview", icon: Eye },
          { id: "payments", label: "Payments", icon: DollarSign },
          { id: "activity", label: "Activity Log", icon: History },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
              tab === t.id ? "text-white" : "text-muted"
            }`}
            style={{ background: tab === t.id ? ACCENT : "var(--bg-card)", border: "1px solid var(--border)" }}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "preview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Section title="Invoice Details" icon={FileText}>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><span className="text-muted">Invoice #:</span> <span className="font-semibold text-primary">{invoice.invoice_number || `INV-${String(invoice.id).padStart(6, "0")}`}</span></div>
                <div><span className="text-muted">Status:</span> <StatusBadge status={invoice.status} /></div>
                <div><span className="text-muted">Currency:</span> <span className="font-medium">{invoice.currency || "PKR"}</span></div>
                <div><span className="text-muted">Date:</span> <span className="text-primary">{new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}</span></div>
                <div><span className="text-muted">Due Date:</span> <span className="text-primary">{new Date(invoice.due_date).toLocaleDateString()}</span></div>
                <div><span className="text-muted">Type:</span> <span className="text-primary capitalize">{invoice.invoice_type || "manual"}</span></div>
                {invoice.reference && <div className="col-span-3"><span className="text-muted">Reference:</span> <span className="font-mono text-[10px]">{invoice.reference}</span></div>}
                {invoice.source_module && <div className="col-span-3"><span className="text-muted">Source:</span> <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{invoice.source_module} #{invoice.source_record_id}</span></div>}
              </div>
            </Section>

            <Section title="Line Items" icon={Hash}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left py-1.5 text-muted">#</th>
                      <th className="text-left py-1.5 text-muted">Description</th>
                      <th className="text-right py-1.5 text-muted">Qty</th>
                      <th className="text-right py-1.5 text-muted">Unit Price</th>
                      <th className="text-right py-1.5 text-muted">Disc%</th>
                      <th className="text-right py-1.5 text-muted">Tax%</th>
                      <th className="text-right py-1.5 text-muted">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsList.map((li: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-1.5 text-muted">{i + 1}</td>
                        <td className="py-1.5 text-primary">{li.description || "—"}</td>
                        <td className="py-1.5 text-right">{li.quantity}</td>
                        <td className="py-1.5 text-right">{formatCurrency(Number(li.unit_price))}</td>
                        <td className="py-1.5 text-right">{li.discount_pct || 0}%</td>
                        <td className="py-1.5 text-right">{li.tax_pct || 0}%</td>
                        <td className="py-1.5 text-right font-medium">{formatCurrency(Number(li.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1 mt-3 pt-3 text-xs max-w-xs ml-auto" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {discountAmount > 0 && <div className="flex justify-between"><span className="text-muted">Discount</span><span className="text-red-400">-{formatCurrency(discountAmount)}</span></div>}
                {taxAmount > 0 && <div className="flex justify-between"><span className="text-muted">Tax</span><span className="text-blue-400">{formatCurrency(taxAmount)}</span></div>}
                {Number(invoice.adjustment) > 0 && <div className="flex justify-between"><span className="text-muted">Adjustment</span><span>{formatCurrency(Number(invoice.adjustment))}</span></div>}
                <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-primary">Total</span>
                  <span style={{ color: ACCENT }}>{formatCurrency(invoice.amount)}</span>
                </div>
              </div>
            </Section>
          </div>

          <div className="space-y-4">
            <Section title="Party Information" icon={User}>
              <div className="space-y-2 text-xs">
                {invoice.party_type && <div><span className="text-muted">Type:</span> <span className="capitalize">{invoice.party_type}</span></div>}
                {invoice.client_name && (
                  <div className="p-2 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <p className="font-medium text-primary">{invoice.client_name}</p>
                    {invoice.client_phone && <p className="text-muted flex items-center gap-1 mt-1"><Phone size={10} /> {invoice.client_phone}</p>}
                    {invoice.client_email && <p className="text-muted flex items-center gap-1"><Mail size={10} /> {invoice.client_email}</p>}
                    {invoice.client_cnic && <p className="text-muted">CNIC: {invoice.client_cnic}</p>}
                    {invoice.client_ntn && <p className="text-muted">NTN: {invoice.client_ntn}</p>}
                    {invoice.client_address && <p className="text-muted flex items-start gap-1 mt-1"><MapPin size={10} className="mt-0.5" /> {invoice.client_address}</p>}
                  </div>
                )}
                {invoice.tenant_id && <div><span className="text-muted">Tenant ID:</span> #{invoice.tenant_id}</div>}
              </div>
            </Section>

            <Section title="Payment Summary" icon={CreditCard}>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted">Total Amount</span><span className="font-medium text-primary">{formatCurrency(invoice.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Paid</span><span className="font-medium text-emerald-400">{formatCurrency(invoice.paid_amount || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Due</span><span className="font-medium" style={{ color: dueAmount > 0 ? "#ef4444" : "#10b981" }}>{formatCurrency(dueAmount)}</span></div>
                {invoice.payment_terms && <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-muted">Terms:</span> <span className="capitalize">{invoice.payment_terms.replace(/_/g, " ")}</span>
                </div>}
              </div>
            </Section>

            {invoice.customer_notes && (
              <Section title="Customer Notes" icon={FileText}>
                <p className="text-xs text-primary whitespace-pre-wrap">{invoice.customer_notes}</p>
              </Section>
            )}
            {invoice.terms_conditions && (
              <Section title="Terms & Conditions" icon={FileText}>
                <p className="text-xs text-primary whitespace-pre-wrap">{invoice.terms_conditions}</p>
              </Section>
            )}
          </div>
        </div>
      )}

      {tab === "payments" && (
        <Section title="Payment History" icon={DollarSign}>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted">
              <CreditCard size={24} className="mb-2 opacity-50" />
              <p className="text-xs">No payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)" }}>
                      <DollarSign size={14} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-primary">{formatCurrency(p.amount)} via {p.method}</p>
                      <p className="text-[10px] text-muted">{new Date(p.date).toLocaleDateString()} {p.reference_number ? `· ${p.reference_number}` : ""}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {p.status !== "completed" && <p className="text-[10px] text-yellow-400 capitalize">{p.status}</p>}
                    {p.posted_to_finance && <p className="text-[9px] text-emerald-400">Posted JE-{p.finance_journal_id}</p>}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 text-xs font-semibold">
                <span className="text-muted">Total Paid</span>
                <span className="text-emerald-400">{formatCurrency(payments.reduce((s: number, p: any) => s + Number(p.amount), 0))}</span>
              </div>
            </div>
          )}
        </Section>
      )}

      {tab === "activity" && (
        <Section title="Activity Log" icon={History}>
          {activityLog.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted">
              <History size={24} className="mb-2 opacity-50" />
              <p className="text-xs">No activity recorded yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activityLog.map((log: any, i: number) => (
                <div key={i} className="flex items-start gap-3 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${ACCENT}22` }}>
                    <Clock size={11} style={{ color: ACCENT }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-primary">{log.action || log.message || "Activity entry"}</p>
                    <p className="text-[9px] text-muted">
                      {log.user_name && `${log.user_name} · `}
                      {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <div className="pt-3 mt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <FileUpload module="finance" recordType="invoice" recordId={String(invoice.id)}
          documentTypes={["Invoice", "Receipt", "Purchase Order", "Bank Statement", "Other"]} />
      </div>

      <MakePaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        onSubmit={handlePaymentSubmit}
        accounts={accounts}
        preselectedInvoiceId={invoice.id}
      />
    </AppDialog>
  );
}
