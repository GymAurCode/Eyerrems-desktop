import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  Edit2, Plus, CreditCard, DollarSign, Info,
  Calendar, Paperclip, Clock, CheckCircle2, AlertCircle,
  Download, Upload, X, FileText, Trash2, ChevronRight,
} from "lucide-react";
import { crmApi, Deal, DealLedger, InstallmentPlan, Installment, TimelineEntry } from "../../lib/crmApi";
import { syncApi } from "../../lib/financeApi";
import FinanceSyncBadge from "../../components/finance/FinanceSyncBadge";
import DealForm from "../../components/crm/DealForm";
import AttachmentPanel from "../../components/attachments/AttachmentPanel";
import {
  DetailPage, DetailHeader, DetailBody, DetailSection,
  InfoGrid, StatusBadge, MonoId, SummaryCards,
} from "../../components/detail";
import ModuleTabs from "../../components/ui/ModuleTabs";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";
import { MODULE_COLORS } from "../../config/moduleColors";

const CRM_ACCENT = MODULE_COLORS.crm.primary;
const DEAL_TABS = ["Overview", "Payment Schedule", "Timeline", "Documents"] as const;
type DealTab = typeof DEAL_TABS[number];

type DisplayStatus = "paid" | "due_soon" | "due_today" | "overdue" | "upcoming";

function computeDisplayStatus(inst: Installment): DisplayStatus {
  if (inst.status === "paid" || inst.status === "partial") return "paid";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(inst.due_date + "T00:00:00");
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  if (diff <= 7) return "due_soon";
  return "upcoming";
}

const INST_STATUS_CFG: Record<DisplayStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  paid:     { label: "Paid",      color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: CheckCircle2 },
  due_soon: { label: "Due Soon",  color: "#eab308", bg: "rgba(234,179,8,0.12)",  icon: Clock },
  due_today:{ label: "Due Today", color: "#f97316", bg: "rgba(249,115,22,0.12)", icon: AlertCircle },
  overdue:  { label: "Overdue",   color: "#ef4444", bg: "rgba(239,68,68,0.12)",  icon: AlertCircle },
  upcoming: { label: "Upcoming",  color: "#94a3b8", bg: "rgba(148,163,184,0.12)",icon: Clock },
};

function formatCurrency(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function NotSet({ onEdit }: { onEdit?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
      Not Set
      {onEdit && (
        <button onClick={onEdit} className="hover:opacity-70" style={{ color: CRM_ACCENT }}>
          <Edit2 size={11} />
        </button>
      )}
    </span>
  );
}

function InstBadge({ inst }: { inst: Installment }) {
  const ds = computeDisplayStatus(inst);
  const cfg = INST_STATUS_CFG[ds];
  const Icon = cfg.icon;
  const daysOverdue = ds === "overdue"
    ? Math.ceil((Date.now() - new Date(inst.due_date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={10} /> {cfg.label}{daysOverdue > 0 ? ` (${daysOverdue}d)` : ""}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Create Payment Plan Dialog
// ───────────────────────────────────────────────────────────────────────
function CreatePlanDialog({
  deal,
  onClose,
  onCreated,
}: {
  deal: Deal;
  onClose: () => void;
  onCreated: () => void;
}) {
  const totalValue = Number(deal.deal_value);
  const [downPay, setDownPay] = useState(deal.down_payment ? String(Number(deal.down_payment)) : "");
  const [dpPaid, setDpPaid] = useState(deal.down_payment_status === "paid");
  const [dpDate, setDpDate] = useState("");
  const [rules, setRules] = useState([{ type: "monthly" as const, amount: "", count: "1", startDate: "", dayOfMonth: "1" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pushToast = useNotifStore((s) => s.pushToast);

  const dp = Number(downPay) || 0;
  const remaining = totalValue - dp;

  const ruleTotals = rules.map(r => {
    const amt = Number(r.amount) || 0;
    const cnt = Number(r.count) || 0;
    return { amt, cnt, total: amt * cnt };
  });
  const instalmentsTotal = ruleTotals.reduce((s, r) => s + r.total, 0);
  const grandTotal = dp + instalmentsTotal;
  const difference = grandTotal - totalValue;

  const isValid = difference === 0 && dp > 0 && rules.some(r => Number(r.amount) > 0 && Number(r.count) > 0 && r.startDate);

  const addRule = () => setRules(prev => [...prev, { type: "monthly", amount: "", count: "1", startDate: "", dayOfMonth: "1" }]);
  const removeRule = (idx: number) => setRules(prev => prev.filter((_, i) => i !== idx));
  const updateRule = (idx: number, field: string, value: string) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const generate = async () => {
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      const rulesPayload = rules.map(r => ({
        type: r.type,
        amount: Number(r.amount),
        count: Number(r.count),
        start_date: r.startDate,
      }));
      await crmApi.createInstallmentPlan(deal.id, {
        total_amount: totalValue,
        down_payment: dp,
        rules: rulesPayload,
      });
      if (dpPaid && dp > 0) {
        await crmApi.updateDeal(deal.id, { down_payment_status: "paid" } as any);
      }
      // Post down payment to finance if marked paid
      if (dpPaid && dp > 0) {
        try {
          const dpInst = (await crmApi.getInstallmentSchedule(deal.id)).find(
            (i: Installment) => Number(i.amount) === dp
          );
          if (dpInst) {
            await crmApi.payInstallment(dpInst.id, {
              installment_id: dpInst.id,
              method: "bank",
              amount: dp,
              reference_number: "DOWN-PAYMENT",
            });
            // Sync to finance
            syncApi.downPayment({
              deal_id: deal.id,
              amount: dp,
              client_name: deal.client_name || "Unknown",
              property_name: deal.property_name || "Unknown",
              unit_name: "",
            }).catch(() => {});
          }
        } catch {
          // dp payment posting failed silently
        }
      }
      pushToast({ title: "Plan Created", message: "Payment plan created successfully", type: "success" });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create payment plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        {/* Sticky header */}
        <div className="px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-primary">Create Payment Plan</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {deal.deal_id} · {deal.client_name ?? "—"} · Unit #{deal.property_name ?? "—"}
              </p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          {/* Deal Summary */}
          <div className="rounded-xl p-4" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Deal Summary</p>
            <p className="text-lg font-bold" style={{ color: CRM_ACCENT }}>PKR {formatCurrency(totalValue)}</p>
          </div>

          {/* Down Payment Section */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Section 1 — Down Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>Down Payment Amount <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
                <input className="input-dark w-full px-3 py-2 text-sm" type="number" value={downPay} onChange={e => setDownPay(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>Payment Date</label>
                <input className="input-dark w-full px-3 py-2 text-sm" type="date" value={dpDate} onChange={e => setDpDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="dp-paid" checked={dpPaid} onChange={e => setDpPaid(e.target.checked)} />
              <label htmlFor="dp-paid" className="text-xs" style={{ color: "var(--text-secondary)" }}>Down payment already paid</label>
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: "var(--text-muted)" }}>Remaining after DP</p>
              <p className="text-xl font-bold" style={{ color: "#818cf8" }}>PKR {formatCurrency(Math.max(0, remaining))}</p>
            </div>
          </div>

          {/* Installment Rules Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Section 2 — Installment Rules</p>
              <button onClick={addRule} className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg" style={{ background: `${CRM_ACCENT}15`, color: CRM_ACCENT }}>
                <Plus size={11} /> Add Rule
              </button>
            </div>
            {rules.map((rule, idx) => (
              <div key={idx} className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Rule {idx + 1}</span>
                  {rules.length > 1 && (
                    <button onClick={() => removeRule(idx)} style={{ color: "#ef4444" }} className="text-[10px] hover:underline">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>Type</label>
                    <select className="select-dark w-full px-3 py-2 text-sm" value={rule.type} onChange={e => updateRule(idx, "type", e.target.value)}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>Installment Amount <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
                    <input className="input-dark w-full px-3 py-2 text-sm" type="number" value={rule.amount} onChange={e => updateRule(idx, "amount", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>Number of Installments <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
                    <input className="input-dark w-full px-3 py-2 text-sm" type="number" min="1" value={rule.count} onChange={e => updateRule(idx, "count", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>Start Date <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
                    <input className="input-dark w-full px-3 py-2 text-sm" type="date" value={rule.startDate} onChange={e => updateRule(idx, "startDate", e.target.value)} />
                  </div>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Rule subtotal: PKR {formatCurrency(Number(rule.amount))} × {Number(rule.count)} = <strong>PKR {formatCurrency(ruleTotals[idx]?.total ?? 0)}</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Plan Summary */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Plan Summary</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span style={{ color: "var(--text-muted)" }}>Down Payment:</span>
              <span className="font-semibold text-right">PKR {formatCurrency(dp)}</span>
              <span style={{ color: "var(--text-muted)" }}>Installments Total:</span>
              <span className="font-semibold text-right">PKR {formatCurrency(instalmentsTotal)}</span>
              <span style={{ color: "var(--text-muted)" }}>Grand Total:</span>
              <span className="font-semibold text-right">PKR {formatCurrency(grandTotal)}</span>
              <span style={{ color: "var(--text-muted)" }}>Difference:</span>
              <span className="font-semibold text-right" style={{ color: difference === 0 ? "#10b981" : "#ef4444" }}>
                PKR {formatCurrency(difference)} {difference === 0 ? "✓" : "✗"}
              </span>
            </div>
            {difference !== 0 && (
              <p className="text-[10px] mt-1" style={{ color: "#ef4444" }}>
                Installment total ({formatCurrency(instalmentsTotal)}) + down payment ({formatCurrency(dp)}) must equal deal value ({formatCurrency(totalValue)})
              </p>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-4 shrink-0 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={generate} disabled={!isValid || saving}
            className="btn-primary px-5 py-2 text-xs disabled:opacity-40">
            {saving ? "Generating…" : "Generate Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Pay Dialog
// ───────────────────────────────────────────────────────────────────────
function PayDialog({
  inst,
  dealId,
  onClose,
  onPaid,
}: {
  inst: Installment;
  dealId: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState("bank");
  const [amount, setAmount] = useState(String(Number(inst.amount) - Number(inst.paid_amount)));
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const pushToast = useNotifStore((s) => s.pushToast);

  const submit = async () => {
    setSaving(true);
    setErr("");
    try {
      // 1. Post payment to installment (creates journal entry in backend)
      await crmApi.payInstallment(inst.id, {
        installment_id: inst.id,
        method,
        amount: Number(amount),
        reference_number: ref || null,
        date: payDate ? new Date(payDate).toISOString() : undefined,
      });

      // Sync to finance (fire-and-forget)
      syncApi.installment({
        deal_id: dealId,
        installment_id: inst.id,
        installment_no: inst.installment_number || 1,
        amount: Number(amount),
        client_name: "",
      }).catch(() => {});

      // 2. Also record in CRM Payments tab
      try {
        const deal = await crmApi.getDeal(String(dealId));
        if (deal) {
          await crmApi.createPayment({
            client_id: deal.client_id,
            deal_id: dealId,
            amount: Number(amount),
            payment_method: method === "cash" ? "cash" : "bank_transfer",
            payment_date: payDate ? new Date(payDate).toISOString() : undefined,
            reference: ref || `INS-${inst.id}`,
            notes: notes || `Installment payment for Deal ${deal.deal_id || dealId}`,
          } as any);
        }
      } catch {
        // Payment tab recording is best-effort
      }

      pushToast({ title: "Payment Recorded", message: `Payment of PKR ${formatCurrency(Number(amount))} recorded`, type: "success" });
      onPaid();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm space-y-4"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-primary">Mark Installment as Paid</h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Due: {inst.due_date} · Total: {formatCurrency(inst.amount)} · Paid: {formatCurrency(inst.paid_amount)}
        </p>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Amount <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
          <input className="input-dark w-full px-3 py-2 text-sm" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Date <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input className="input-dark w-full px-3 py-2 text-sm" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Method</label>
            <select className="select-dark w-full px-3 py-2 text-sm" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Reference</label>
          <input className="input-dark w-full px-3 py-2 text-sm" value={ref} onChange={e => setRef(e.target.value)} placeholder="Cheque / TXN no." />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Notes</label>
          <input className="input-dark w-full px-3 py-2 text-sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment notes..." />
        </div>
        {err && <p className="text-xs" style={{ color: "#ef4444" }}>{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm rounded-lg"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={submit} disabled={saving || !amount || Number(amount) <= 0}
            className="flex-1 btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Processing…" : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Timeline Item
// ───────────────────────────────────────────────────────────────────────
const TIMELINE_COLORS: Record<string, string> = {
  deal_created: "#f59e0b", deal_updated: "#3b82f6", deal_status_changed: "#8b5cf6",
  down_payment: "#10b981", payment_received: "#10b981", plan_created: "#6366f1",
};

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const color = TIMELINE_COLORS[entry.action] ?? "#94a3b8";
  return (
    <div className="flex gap-3 py-2">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
        <Clock size={10} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold capitalize" style={{ color }}>{entry.action.replace(/_/g, " ")}</span>
          {entry.performed_by_name && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>by {entry.performed_by_name}</span>}
        </div>
        {entry.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{entry.description}</p>}
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{new Date(entry.created_at).toLocaleString()}</p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Main DealDetail Component
// ───────────────────────────────────────────────────────────────────────
export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ledger, setLedger] = useState<DealLedger | null>(null);
  const [plan, setPlan] = useState<InstallmentPlan | null>(null);
  const [schedule, setSchedule] = useState<Installment[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [payInst, setPayInst] = useState<Installment | null>(null);
  const [activeTab, setActiveTab] = useState<DealTab>("Overview");
  const [deleteTarget, setDeleteTarget] = useState<{ item: any; type: string } | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const entityId: string | number = /^\d+$/.test(id) ? Number(id) : id;
      const lRes = await crmApi.getDealLedger(entityId);
      setLedger(lRes);
      const numericId = lRes.deal.id;
      try { const pRes = await crmApi.getInstallmentPlan(numericId); setPlan(pRes || null); } catch { setPlan(null); }
      try { const sRes = await crmApi.getInstallmentSchedule(numericId); setSchedule(Array.isArray(sRes) ? sRes : []); } catch { setSchedule([]); }
      try { const tlRes = await crmApi.getTimeline("deal", numericId, 50); setTimeline(tlRes ?? []); } catch { setTimeline([]); }
    } catch { setLedger(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { item, type } = deleteTarget;
      if (type === "deal") {
        await crmApi.deleteDeal(item.id);
        pushToast({ title: "Deal Deleted", message: "Deal has been deleted", type: "success" });
        navigate("/crm");
      }
    } catch (e: any) {
      pushToast({ title: "Error", message: e?.response?.data?.detail ?? "Failed to delete", priority: "urgent" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const afterSave = (d: Deal) => {
    setEditOpen(false);
    setLedger(prev => prev ? { ...prev, deal: d } : null);
    pushToast({ title: "Deal Updated", message: "Deal has been updated", type: "success" });
  };

  if (loading) return (
    <DetailPage>
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 rounded-full border-t-transparent" style={{ borderColor: `${CRM_ACCENT}`, borderTopColor: "transparent" }} />
      </div>
    </DetailPage>
  );

  const deal = ledger?.deal;
  if (!deal) return <DetailPage><p className="text-sm text-center py-10" style={{ color: "#ef4444" }}>Deal not found.</p></DetailPage>;

  // ── Computed values ──
  const totalValue = Number(deal.deal_value);
  const downPayAmount = Number(deal.down_payment ?? 0);
  const dpPaid = deal.down_payment_status === "paid";
  const instalmentsPaid = schedule
    .filter(i => i.status === "paid" || i.status === "partial")
    .reduce((s, i) => s + Number(i.paid_amount), 0);
  const amountPaid = (dpPaid ? downPayAmount : 0) + instalmentsPaid;
  const remainingBalance = Math.max(0, totalValue - amountPaid);
  const surcharges = schedule
    .filter(i => i.status === "overdue")
    .reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount)), 0);
  const pctPaid = totalValue > 0 ? Math.min(100, Math.round((amountPaid / totalValue) * 100)) : 0;
  const paidCount = schedule.filter(i => i.status === "paid" || i.status === "partial").length;
  const overdueCount = schedule.filter(i => i.status === "overdue" || computeDisplayStatus(i) === "overdue").length;
  const totalCount = schedule.length;
  const hasPlan = !!plan;

  const summaryCards = [
    { label: "Deal Value", value: `PKR ${formatCurrency(totalValue)}`, color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
    { label: "Amount Paid", value: `PKR ${formatCurrency(amountPaid)}`, color: "#10b981", bg: "rgba(16,185,129,0.08)" },
    { label: "Remaining", value: `PKR ${formatCurrency(remainingBalance)}`, color: remainingBalance > 0 ? "#f59e0b" : "#10b981", bg: `rgba(${remainingBalance > 0 ? "245,158,11" : "16,185,129"},0.08)` },
    { label: "Commission", value: deal.commission ? `PKR ${formatCurrency(deal.commission)}` : "—", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
  ];

  return (
    <DetailPage>
      {payInst && createPortal(
        <PayDialog inst={payInst} dealId={deal.id} onClose={() => setPayInst(null)}
          onPaid={async () => { setPayInst(null); await load(); }} />,
        document.body
      )}
      {planOpen && createPortal(
        <CreatePlanDialog deal={deal} onClose={() => setPlanOpen(false)} onCreated={async () => { setPlanOpen(false); await load(); }} />,
        document.body
      )}

      <DetailHeader
        backTo="/crm"
        title={deal.deal_title ?? deal.deal_id}
        subtitle={`Client: ${deal.client_name ?? "—"}`}
        badge={<StatusBadge status={deal.status} />}
        meta={[
          { label: "ID",       value: <MonoId value={deal.deal_id} /> },
          { label: "Tracking", value: <MonoId value={deal.tracking_id} /> },
          { label: "Dealer",   value: <span style={{ color: "var(--text-secondary)" }}>{deal.dealer_name ?? "—"}</span> },
        ]}
        actions={[
          { label: "Edit", icon: Edit2, onClick: () => setEditOpen(true) },
          { label: hasPlan ? "Edit Plan" : "Create Plan", icon: Plus, onClick: () => setPlanOpen(true), variant: "primary" },
          { label: "Download Summary", icon: Download, onClick: () => window.print() },
        ]}
      />

      <DetailBody>
        {/* Summary Cards Row */}
        <div className="px-6 pt-5 pb-3">
          <SummaryCards cards={summaryCards} />
        </div>

        {/* Progress Bar */}
        {totalValue > 0 && (
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              <span>{formatCurrency(amountPaid)} paid of {formatCurrency(totalValue)}</span>
              <span style={{ color: CRM_ACCENT }}>{pctPaid}% Paid</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-surface2)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pctPaid}%`, background: `linear-gradient(90deg, ${CRM_ACCENT}, ${CRM_ACCENT}cc)` }} />
            </div>
          </div>
        )}

        {/* Tabs */}
        <ModuleTabs
          tabs={DEAL_TABS.map(t => ({ label: t, value: t, icon: t === "Overview" ? Info : t === "Payment Schedule" ? Calendar : t === "Timeline" ? Clock : Paperclip }))}
          activeTab={activeTab}
          onChange={(v) => setActiveTab(v as DealTab)}
          moduleColor={CRM_ACCENT}
        />

        {/* ════════════════ OVERVIEW TAB ════════════════ */}
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
            <div className="lg:col-span-3" style={{ borderRight: "1px solid var(--border-subtle)" }}>
              {/* Deal Information */}
              <DetailSection title="Deal Information" icon={Info}>
                <InfoGrid items={[
                  { label: "Client", value: (
                    <span className="cursor-pointer hover:underline" style={{ color: CRM_ACCENT }}
                      onClick={() => navigate(`/crm/clients/${deal.client_id}`)}>
                      {deal.client_name ?? <NotSet />}
                    </span>
                  )},
                  { label: "Client Role", value: deal.client_role || <NotSet onEdit={() => setEditOpen(true)} /> },
                  { label: "Dealer", value: deal.dealer_name || <NotSet onEdit={() => setEditOpen(true)} /> },
                  { label: "Property", value: deal.property_name || <NotSet onEdit={() => setEditOpen(true)} /> },
                  { label: "Unit", value: deal.unit_id ? `Unit #${deal.unit_id}` : <NotSet onEdit={() => setEditOpen(true)} /> },
                  { label: "Deal Value", value: <span className="font-semibold" style={{ color: CRM_ACCENT }}>PKR {formatCurrency(deal.deal_value)}</span> },
                  { label: "Down Payment", value: deal.down_payment ? `PKR ${formatCurrency(deal.down_payment)}` : <NotSet onEdit={() => setEditOpen(true)} /> },
                  { label: "DP Status", value: <StatusBadge status={deal.down_payment_status} /> },
                  { label: "Deal Date", value: deal.deal_date || <NotSet /> },
                  { label: "Due Date", value: deal.due_date || <NotSet /> },
                  { label: "Status", value: <StatusBadge status={deal.status} /> },
                ]} />
                {deal.description && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Description</p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{deal.description}</p>
                  </div>
                )}
              </DetailSection>

              {/* Cash-Flow Breakdown */}
              <DetailSection title="Cash-Flow Breakdown" icon={DollarSign}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Total Deal Value", value: formatCurrency(totalValue), color: "#3b82f6" },
                    { label: "Down Payment", value: dpPaid ? formatCurrency(downPayAmount) : "Pending", color: dpPaid ? "#10b981" : "#f59e0b" },
                    { label: "Installments Paid", value: formatCurrency(instalmentsPaid), color: "#10b981" },
                    { label: "Amount Paid", value: formatCurrency(amountPaid), color: "#10b981" },
                    { label: "Remaining Balance", value: formatCurrency(remainingBalance), color: remainingBalance > 0 ? "#f59e0b" : "#10b981" },
                    { label: "Surcharges", value: formatCurrency(surcharges), color: surcharges > 0 ? "#ef4444" : "var(--text-muted)" },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: `${item.color}08`, border: `1px solid ${item.color}20` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: item.color }}>{item.label}</p>
                      <p className="text-lg font-bold" style={{ color: item.color }}>{item.label === "Down Payment" && !dpPaid ? item.value : `PKR ${item.value}`}</p>
                    </div>
                  ))}
                </div>
              </DetailSection>
            </div>

            {/* Right column — Payment Summary */}
            <div className="lg:col-span-2">
              <DetailSection title="Payment Schedule Summary" icon={Calendar} noPad>
                {totalCount === 0 ? (
                  <div className="px-6 py-5 text-xs" style={{ color: "var(--text-muted)" }}>
                    No payment plan created yet.{' '}
                    <span className="cursor-pointer hover:underline" style={{ color: CRM_ACCENT }}
                      onClick={() => setPlanOpen(true)}>Create a payment plan</span>.
                  </div>
                ) : (
                  <div className="px-6 py-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--text-muted)" }}>Total Installments</span>
                      <span className="font-semibold">{totalCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: "#10b981" }}>Paid</span>
                      <span className="font-semibold" style={{ color: "#10b981" }}>{paidCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: overdueCount > 0 ? "#ef4444" : "var(--text-muted)" }}>Overdue</span>
                      <span className="font-semibold" style={{ color: overdueCount > 0 ? "#ef4444" : "var(--text-muted)" }}>{overdueCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--text-muted)" }}>Remaining</span>
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>PKR {formatCurrency(remainingBalance)}</span>
                    </div>
                    <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <button onClick={() => setActiveTab("Payment Schedule")}
                        className="flex items-center gap-1 text-xs" style={{ color: CRM_ACCENT }}>
                        View Full Schedule <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </DetailSection>
            </div>
          </div>
        )}

        {/* ════════════════ PAYMENT SCHEDULE TAB ════════════════ */}
        {activeTab === "Payment Schedule" && (
          <div>
            {totalCount === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No schedule generated yet.</p>
                <button onClick={() => setPlanOpen(true)} className="btn-primary mt-3 px-4 py-2 text-xs">
                  <Plus size={12} /> Create Payment Plan
                </button>
              </div>
            ) : (
              <div>
                {/* Summary bar */}
                <div className="flex items-center gap-4 px-6 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface2)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Total: <strong>{totalCount}</strong></span>
                  <span className="text-xs" style={{ color: "#10b981" }}>Paid: <strong>{paidCount}</strong></span>
                  <span className="text-xs" style={{ color: overdueCount > 0 ? "#ef4444" : "var(--text-muted)" }}>Overdue: <strong>{overdueCount}</strong></span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Remaining: <strong>PKR {formatCurrency(remainingBalance)}</strong></span>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => setPayInst(schedule.find(i => i.status !== "paid" && i.status !== "partial") ?? schedule[0])}
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg btn-primary">
                      <CreditCard size={11} /> Record Payment
                    </button>
                    {!schedule.some(i => i.status === "paid" || i.status === "partial") && (
                      <button onClick={() => setPlanOpen(true)}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <Edit2 size={11} /> Edit Plan
                      </button>
                    )}
                  </div>
                </div>

                {/* Schedule table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface2)" }}>
                        <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>#</th>
                        <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Type</th>
                        <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Due Date</th>
                        <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Amount</th>
                        <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Paid</th>
                        <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Status</th>
                        <th className="text-center px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Finance</th>
                        <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Down Payment Row */}
                      {downPayAmount > 0 && (
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)", background: dpPaid ? "rgba(16,185,129,0.03)" : "rgba(245,158,11,0.03)" }}>
                          <td className="px-4 py-3 font-mono" style={{ color: "var(--text-muted)" }}>DP</td>
                          <td className="px-4 py-3 capitalize" style={{ color: "var(--text-muted)" }}>Down Payment</td>
                          <td className="px-4 py-3 font-mono" style={{ color: "var(--text-secondary)" }}>{deal.deal_date ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(downPayAmount)}</td>
                          <td className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>{dpPaid ? formatCurrency(downPayAmount) : "—"}</td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={dpPaid ? "paid" : "pending"} /></td>
                          <td className="px-4 py-3 text-center">
                            {dpPaid ? <FinanceSyncBadge module="CRM" recordType="deal" recordId={deal.id} posted /> : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!dpPaid && (
                              <button onClick={async () => {
                                await crmApi.updateDeal(deal.id, { down_payment_status: "paid" } as any);
                                pushToast({ title: "Down Payment", message: "Down payment marked as paid", type: "success" });
                                syncApi.downPayment({
                                  deal_id: deal.id,
                                  amount: downPayAmount,
                                  client_name: deal.client_name || "Unknown",
                                  property_name: deal.property_name || "Unknown",
                                }).catch(() => {});
                                await load();
                              }}
                                className="text-[10px] px-2 py-1 rounded-lg btn-primary">
                                Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      )}

                      {/* Installment Rows */}
                      {schedule.map((inst, idx) => {
                        const isPaid = inst.status === "paid" || inst.status === "partial";
                        const ds = computeDisplayStatus(inst);
                        return (
                          <tr key={inst.id} style={{
                            borderBottom: "1px solid var(--border-subtle)",
                            background: ds === "overdue" ? "rgba(239,68,68,0.03)" : undefined,
                          }}>
                            <td className="px-4 py-3 font-mono" style={{ color: "var(--text-muted)" }}>INS-{idx + 1}</td>
                            <td className="px-4 py-3 capitalize" style={{ color: "var(--text-muted)" }}>{inst.type}</td>
                            <td className="px-4 py-3 font-mono" style={{ color: "var(--text-secondary)" }}>
                              {new Date(inst.due_date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inst.amount)}</td>
                            <td className="px-4 py-3 text-right" style={{ color: isPaid ? "#10b981" : "var(--text-muted)" }}>
                              {isPaid ? formatCurrency(inst.paid_amount) : "—"}
                            </td>
                            <td className="px-4 py-3 text-center"><InstBadge inst={inst} /></td>
                            <td className="px-4 py-3 text-center">
                              {isPaid ? <FinanceSyncBadge module="CRM" recordType="installment" recordId={inst.id} posted /> : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!isPaid && (
                                <button onClick={() => setPayInst(inst)}
                                  className="flex items-center gap-1 ml-auto text-[10px] px-2 py-1 rounded-lg btn-primary">
                                  <CreditCard size={10} /> Pay
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Progress bar at bottom */}
                <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    <span>{paidCount} of {totalCount + (downPayAmount > 0 ? 1 : 0)} installments paid</span>
                    <span style={{ color: CRM_ACCENT }}>{pctPaid}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-surface2)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pctPaid}%`, background: `linear-gradient(90deg, ${CRM_ACCENT}, ${CRM_ACCENT}cc)` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ TIMELINE TAB ════════════════ */}
        {activeTab === "Timeline" && (
          <div className="px-6 py-5">
            {timeline.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No timeline entries</p>
            ) : (
              <div className="space-y-1">
                {timeline.map((entry, idx) => <TimelineItem key={idx} entry={entry} />)}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ DOCUMENTS TAB ════════════════ */}
        {activeTab === "Documents" && (
          <div className="px-6 py-5">
            <AttachmentPanel module="deal" recordId={deal.id} />
          </div>
        )}
      </DetailBody>

      <DealForm open={editOpen} onClose={() => setEditOpen(false)}
        initial={deal} onSaved={afterSave} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Confirm Delete"
        message={`Are you sure you want to delete this ${deleteTarget?.type}?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </DetailPage>
  );
}
