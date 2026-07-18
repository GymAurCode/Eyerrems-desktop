import { useEffect, useState } from "react";
import {
  DollarSign, CheckCircle, XCircle, Lock, Send, AlertTriangle,
} from "lucide-react";
import { constructionApi, Budget } from "../../../lib/constructionApi";
import { formatCurrency } from "../../../lib/currency";

const STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8", submitted: "#6366f1", approved: "#10b981", locked: "#8b5cf6", rejected: "#ef4444",
};

const CATEGORIES = [
  { key: "material_cost", label: "Material Budget", icon: "🧱" },
  { key: "labor_cost", label: "Labor Budget", icon: "👷" },
  { key: "equipment_cost", label: "Equipment Budget", icon: "🔧" },
  { key: "machinery_cost", label: "Machinery Budget", icon: "🏗️" },
  { key: "contractor_cost", label: "Contractor Budget", icon: "👥" },
  { key: "utility_cost", label: "Utility Budget", icon: "⚡" },
  { key: "transport_cost", label: "Transportation Budget", icon: "🚚" },
  { key: "permit_fees", label: "Permit Fees", icon: "📋" },
  { key: "govt_charges", label: "Government Charges", icon: "🏛️" },
  { key: "misc_cost", label: "Miscellaneous", icon: "📦" },
];

function Badge({ label }: { label: string }) {
  const c = STATUS_COLOR[label] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${c}20`, color: c }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function BudgetTab({ projectId, onRefresh }: { projectId: number; onRefresh: () => void }) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const b = await constructionApi.getBudget(projectId);
      setBudget(b);
      const f: Record<string, string> = {};
      CATEGORIES.forEach(c => { f[c.key] = String((b as any)[c.key] ?? "0"); });
      setForm(f);
    } catch { /* no budget yet */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { project_id: projectId };
      let total = 0;
      CATEGORIES.forEach(c => {
        const val = Number(form[c.key]) || 0;
        payload[c.key] = val;
        total += val;
      });
      payload.total_cost = total;
      await constructionApi.upsertBudget(payload);
      setEditing(false);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed to save budget"); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (status: string) => {
    setSaving(true);
    try {
      await constructionApi.updateBudgetStatus(projectId, status);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed to update status"); }
    finally { setSaving(false); }
  };

  const isLocked = budget?.status === "locked" || budget?.status === "approved";

  const totalEstimated = CATEGORIES.reduce((s, c) => s + (Number((budget as any)?.[c.key]) || 0), 0);
  const totalApproved = CATEGORIES.reduce((s, c) => s + (Number((budget as any)?.[`${c.key.replace("_cost", "")}_approved`]) || Number((budget as any)?.[c.key]) || 0), 0);
  const totalActual = CATEGORIES.reduce((s, c) => s + (Number((budget as any)?.[`${c.key.replace("_cost", "")}_actual`]) || 0), 0);
  const totalVariance = totalApproved - totalActual;

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Budget Status & Actions */}
      <SectionCard title="Budget Overview"
        action={
          <div className="flex items-center gap-2">
            <Badge label={budget?.status ?? "draft"} />
            {!isLocked && budget && (
              <>
                <button onClick={() => setEditing(!editing)}
                  className="text-[10px] px-2 py-1 rounded-lg text-muted hover:text-primary border border-white/10 hover:border-white/20">
                  {editing ? "Cancel" : "Edit"}
                </button>
                {budget.status === "draft" && (
                  <button onClick={() => setShowSubmit(true)}
                    className="text-[10px] px-2 py-1 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1">
                    <Send size={10} /> Submit
                  </button>
                )}
                {budget.status === "submitted" && (
                  <>
                    <button onClick={() => handleStatusChange("approved")}
                      className="text-[10px] px-2 py-1 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1">
                      <CheckCircle size={10} /> Approve
                    </button>
                    <button onClick={() => handleStatusChange("rejected")}
                      className="text-[10px] px-2 py-1 rounded-lg text-white bg-red-600 hover:bg-red-500 flex items-center gap-1">
                      <XCircle size={10} /> Reject
                    </button>
                  </>
                )}
                {budget.status === "approved" && (
                  <button onClick={() => handleStatusChange("locked")}
                    className="text-[10px] px-2 py-1 rounded-lg text-white bg-purple-600 hover:bg-purple-500 flex items-center gap-1">
                    <Lock size={10} /> Lock
                  </button>
                )}
              </>
            )}
            {!budget && (
              <button onClick={() => setEditing(true)}
                className="text-[10px] px-2 py-1 rounded-lg text-white"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                Create Budget
              </button>
            )}
          </div>
        }>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted uppercase tracking-wider">Estimated Total</span>
            <span className="text-lg font-bold text-blue-400">{formatCurrency(totalEstimated)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted uppercase tracking-wider">Approved Total</span>
            <span className="text-lg font-bold text-indigo-400">{formatCurrency(totalApproved)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted uppercase tracking-wider">Actual Spent</span>
            <span className="text-lg font-bold text-orange-400">{formatCurrency(totalActual)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted uppercase tracking-wider">Variance</span>
            <span className={`text-lg font-bold ${totalVariance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalVariance >= 0 ? "+" : ""}{formatCurrency(totalVariance)}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Budget Categories */}
      <SectionCard title="Budget Categories">
        <div className="space-y-3">
          {CATEGORIES.map((cat) => {
            const estimated = Number((budget as any)?.[cat.key]) || 0;
            const approved = Number((budget as any)?.[cat.key.replace("_cost", "") + "_approved"]) || estimated;
            const actual = Number((budget as any)?.[cat.key.replace("_cost", "") + "_actual"]) || 0;
            const variance = approved - actual;
            const remaining = Math.max(0, approved - actual);

            return (
              <div key={cat.key} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{cat.icon}</span>
                    <span className="text-xs font-medium text-primary">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-muted">Est: {formatCurrency(estimated)}</span>
                    <span className="text-blue-400">Appr: {formatCurrency(approved)}</span>
                    <span className="text-orange-400">Actual: {formatCurrency(actual)}</span>
                    <span className={variance >= 0 ? "text-emerald-400" : "text-red-400"}>
                      Var: {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                    </span>
                  </div>
                </div>

                {editing && !isLocked && (
                  <div className="flex items-center gap-2 mt-2">
                    <input type="number" value={form[cat.key] ?? "0"}
                      onChange={e => setForm(p => ({ ...p, [cat.key]: e.target.value }))}
                      className="dialog-input text-xs py-1" placeholder="Amount" />
                  </div>
                )}

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${approved > 0 ? Math.min(100, (actual / approved) * 100) : 0}%`,
                    background: (actual / approved) > 0.9 ? "linear-gradient(90deg,#ef4444,#dc2626)" :
                                (actual / approved) > 0.7 ? "linear-gradient(90deg,#f59e0b,#d97706)" :
                                "linear-gradient(90deg,#3b82f6,#6366f1)"
                  }} />
                </div>

                <div className="flex justify-between text-[10px] text-muted mt-0.5">
                  <span>Remaining: {formatCurrency(remaining)}</span>
                  <span>{approved > 0 ? `${((actual / approved) * 100).toFixed(1)}%` : "0%"}</span>
                </div>
              </div>
            );
          })}
        </div>

        {editing && !isLocked && (
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              {saving ? "Saving…" : "Save Budget"}
            </button>
          </div>
        )}
      </SectionCard>

      {/* Submit Confirmation */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSubmit(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-sm" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-2">Submit Budget for Approval</h3>
            <p className="text-xs text-muted mb-4">Once submitted, the budget will be reviewed by management. You can still edit until it is approved.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSubmit(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
              <button onClick={() => { handleStatusChange("submitted"); setShowSubmit(false); }} disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1">
                <Send size={12} /> {saving ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
