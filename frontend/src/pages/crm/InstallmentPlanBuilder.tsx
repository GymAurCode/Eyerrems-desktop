import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle2,
  CreditCard, RefreshCw, Calendar, DollarSign, TrendingUp,
} from "lucide-react";
import { crmApi, Deal, InstallmentPlan, Installment } from "../../lib/crmApi";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";
import { StatusBadge, MonoId } from "../../components/detail";

type RuleRow = {
  id: number;
  type: "monthly" | "quarterly" | "yearly" | "custom";
  amount: string;
  count: string;
  start_date: string;
};

const TYPE_LABELS: Record<string, string> = {
  monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly", custom: "Custom",
};

const INST_COLOR: Record<string, string> = {
  paid: "#10b981", partial: "#3b82f6", pending: "#f59e0b", overdue: "#ef4444",
};

// ── Pay Dialog ───────────────────────────────────────────────────────────────
function PayDialog({ inst, onClose, onPaid }: {
  inst: Installment; onClose: () => void; onPaid: () => void;
}) {
  const [method, setMethod] = useState<"cash" | "bank">("bank");
  const remaining = Number(inst.amount) - Number(inst.paid_amount);
  const [amount, setAmount] = useState(String(remaining));
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setErr("Enter a valid amount"); return; }
    if (amt > remaining) { setErr(`Cannot exceed remaining balance (${remaining.toLocaleString()})`); return; }
    setSaving(true); setErr("");
    try {
      await crmApi.payInstallment(inst.id, {
        installment_id: inst.id, method, amount: amt, reference_number: ref || null,
      });
      onPaid();
    } catch (e: any) { setErr(e?.response?.data?.detail ?? "Payment failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl w-full max-w-sm overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
          <p className="text-sm font-semibold text-primary">Record Payment</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Installment #{inst.id} · Due {inst.due_date} · Balance {remaining.toLocaleString()}
          </p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Method</label>
            <div className="grid grid-cols-2 gap-2">
              {(["bank", "cash"] as const).map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className="py-2 rounded-lg text-xs font-semibold capitalize transition-all"
                  style={method === m
                    ? { background: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.4)" }
                    : { background: "var(--bg-surface2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Amount</label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" type="number"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Reference (optional)</label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" value={ref}
              onChange={e => setRef(e.target.value)} placeholder="Cheque / TXN no." />
          </div>
          {err && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={12} /> {err}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm rounded-xl"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={submit} disabled={saving || !amount}
            className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50">
            {saving ? "Processing…" : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InstallmentPlanBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [deleteTarget, setDeleteTarget] = useState<{ item: any; type: string } | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);
  const [totalAmount, setTotalAmount] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [rules, setRules] = useState<RuleRow[]>([
    { id: Date.now(), type: "monthly", amount: "", count: "1", start_date: "" },
  ]);

  // Load deal
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await crmApi.getDeal(Number(id));
        setDeal(res);
        if (res.deal_value) setTotalAmount(String(res.deal_value));
        if (res.down_payment) setDownPayment(String(res.down_payment));
      } catch (e: any) {
        setError("Failed to load deal");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { item, type } = deleteTarget;
      if (type === "installment_rule") {
        setRules(rules.filter(r => r.id !== item.id));
        pushToast({ title: "Rule Removed", message: "Installment rule has been removed", type: "success" });
      }
    } catch (e: any) {
      pushToast({ title: "Error", message: e?.response?.data?.detail ?? "Failed to remove", priority: "urgent" });
    } finally {
      setDeleteTarget(null);
    }
  };

  // Calculations
  const remaining = useMemo(() => {
    const total = Number(totalAmount) || 0;
    const dp = Number(downPayment) || 0;
    return total - dp;
  }, [totalAmount, downPayment]);

  const rulesTotal = useMemo(() => {
    return rules.reduce((sum, r) => {
      const amt = Number(r.amount) || 0;
      const cnt = Number(r.count) || 0;
      return sum + amt * cnt;
    }, 0);
  }, [rules]);

  const isValid = useMemo(() => {
    if (!totalAmount || Number(totalAmount) <= 0) return false;
    if (Number(downPayment) < 0) return false;
    if (remaining <= 0) return false;
    if (rules.length === 0) return false;
    // Check all rules have required fields
    const allFilled = rules.every(r => r.amount && r.count && r.start_date);
    if (!allFilled) return false;
    // Check total matches
    return Math.abs(rulesTotal - remaining) < 0.01;
  }, [totalAmount, downPayment, remaining, rules, rulesTotal]);

  const mismatch = Math.abs(rulesTotal - remaining) >= 0.01;

  // Rule management
  const addRule = () => {
    setRules([...rules, { id: Date.now(), type: "monthly", amount: "", count: "1", start_date: "" }]);
  };

  const removeRule = (id: number) => {
    if (rules.length === 1) return;
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: number, field: keyof Omit<RuleRow, "id">, value: string) => {
    setRules(rules.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // Submit
  const handleGenerate = async () => {
    if (!deal || !isValid) return;
    setSaving(true);
    setError("");
    try {
      await crmApi.createInstallmentPlan(deal.id, {
        total_amount: Number(totalAmount),
        down_payment: Number(downPayment),
        rules: rules.map(r => ({
          type: r.type,
          amount: Number(r.amount),
          count: Number(r.count),
          start_date: r.start_date,
        })),
        installments: [],
      });
      pushToast({ title: "Plan Created", message: "Installment plan has been created", type: "success" });
      navigate(`/crm/deals/${deal.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create plan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>
        Loading deal...
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>
        Deal not found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/crm/deals/${deal.id}`)}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-primary">Create Installment Plan</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {deal.deal_title} · {deal.deal_id}
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={14} style={{ color: "var(--text-muted)" }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Payment Summary
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--text-muted)" }}>
              Total Amount
            </label>
            <input
              type="number"
              className="input-dark w-full px-3 py-2.5 text-sm"
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              placeholder="e.g. 1200000"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--text-muted)" }}>
              Down Payment
            </label>
            <input
              type="number"
              className="input-dark w-full px-3 py-2.5 text-sm"
              value={downPayment}
              onChange={e => setDownPayment(e.target.value)}
              placeholder="e.g. 600000"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--text-muted)" }}>
              Remaining Amount
            </label>
            <div className="px-3 py-2.5 text-sm font-semibold rounded-lg"
              style={{ background: "var(--bg-surface2)", color: remaining > 0 ? "#60a5fa" : "var(--text-muted)" }}>
              {remaining > 0 ? remaining.toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Installment Rules */}
      <div className="rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: "var(--text-muted)" }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Installment Structure
            </span>
          </div>
          <button
            onClick={addRule}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(59,130,246,0.12)")}>
            <Plus size={12} /> Add Rule
          </button>
        </div>

        <div className="p-5 space-y-3">
          {rules.map((rule, idx) => (
            <div key={rule.id} className="grid grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Type
                </label>
                <select
                  className="select-dark w-full px-3 py-2.5 text-sm"
                  value={rule.type}
                  onChange={e => updateRule(rule.id, "type", e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Amount
                </label>
                <input
                  type="number"
                  className="input-dark w-full px-3 py-2.5 text-sm"
                  value={rule.amount}
                  onChange={e => updateRule(rule.id, "amount", e.target.value)}
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Count
                </label>
                <input
                  type="number"
                  className="input-dark w-full px-3 py-2.5 text-sm"
                  value={rule.count}
                  onChange={e => updateRule(rule.id, "count", e.target.value)}
                  placeholder="6"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="input-dark w-full px-3 py-2.5 text-sm"
                  value={rule.start_date}
                  onChange={e => updateRule(rule.id, "start_date", e.target.value)}
                />
              </div>
              <button
                onClick={() => removeRule(rule.id)}
                disabled={rules.length === 1}
                className="pb-1 disabled:opacity-30 transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Validation Summary */}
          <div className="pt-3 mt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--text-muted)" }}>Rules Total:</span>
              <span className="font-semibold" style={{ color: mismatch ? "#f59e0b" : "#10b981" }}>
                {rulesTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span style={{ color: "var(--text-muted)" }}>Remaining Amount:</span>
              <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                {remaining.toLocaleString()}
              </span>
            </div>
            {mismatch && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs"
                style={{ background: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
                <AlertCircle size={12} />
                Total mismatch: {Math.abs(rulesTotal - remaining).toLocaleString()} difference
              </div>
            )}
            {!mismatch && rulesTotal > 0 && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs"
                style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                <CheckCircle2 size={12} />
                Perfect match! Ready to generate.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
          style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Confirm Delete"
        message={`Are you sure you want to delete this ${deleteTarget?.type}?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate(`/crm/deals/${deal.id}`)}
          className="px-5 py-2.5 text-sm rounded-xl transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          Cancel
        </button>
        <button
          onClick={handleGenerate}
          disabled={!isValid || saving}
          className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? "Generating..." : "Generate Plan"}
        </button>
      </div>
    </div>
  );
}

