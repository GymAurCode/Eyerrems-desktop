import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, FileText, DollarSign, TrendingUp,
  AlertCircle, Clock, CheckCircle, Plus, X,
} from "lucide-react";
import { tenantApi, TenantDetail, RentRecord, TenantLease } from "../lib/tenantApi";
import { formatCurrency } from "../lib/currency";
import { StatusBadge } from "../components/detail";
import AttachmentPanel from "../components/attachments/AttachmentPanel";
import RecordHistory from "../components/RecordHistory";
import { useLookup } from "../hooks/useLookup";

// ── Payment Dialog ────────────────────────────────────────────────────────────

function PaymentDialog({ tenantId, records, onClose, onSaved }: {
  tenantId: number; records: RentRecord[]; onClose: () => void; onSaved: () => void;
}) {
  const { options: PAYMENT_METHOD_OPTS } = useLookup('payment_method');
  const [form, setForm] = useState({
    rent_record_id: "", amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "cash", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const pending = records.filter(r => r.status !== "paid");

  const handleSave = async () => {
    if (!form.amount || !form.payment_date) { setError("Amount and date are required"); return; }
    setSaving(true); setError("");
    try {
      await tenantApi.recordPayment({
        tenant_id: tenantId,
        rent_record_id: form.rent_record_id ? Number(form.rent_record_id) : undefined,
        amount: Number(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to record payment");
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 0.18s ease-out both" }}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <div className="relative w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: "min(480px, 90vw)",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "16px", boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
          animation: "modalSlideUp 0.2s ease-out both",
        }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold text-primary">Record Payment</h2>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--border)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted uppercase tracking-wider font-semibold">Apply to Rent Record</label>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.rent_record_id}
              onChange={e => setForm(p => ({ ...p, rent_record_id: e.target.value }))}>
              <option value="">General payment (no specific record)</option>
              {pending.map(r => (
                <option key={r.id} value={r.id}>
                  {r.due_date} — PKR {Number(r.amount_due).toLocaleString()} ({r.status})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted uppercase tracking-wider font-semibold">Amount (PKR) *</label>
              <input type="number" className="input-dark w-full px-3 py-2.5 text-sm" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 25000" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted uppercase tracking-wider font-semibold">Date *</label>
              <input type="date" className="input-dark w-full px-3 py-2.5 text-sm" value={form.payment_date}
                onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted uppercase tracking-wider font-semibold">Payment Method</label>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.payment_method}
              onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}>
              {PAYMENT_METHOD_OPTS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted uppercase tracking-wider font-semibold">Notes</label>
            <textarea className="input-dark w-full px-3 py-2.5 text-sm resize-none" rows={2}
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="px-5 pb-3">
          <AttachmentPanel module="payment" recordId={tenantId} title="Payment Attachments" />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
              : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

// ── Rent Increase Dialog ──────────────────────────────────────────────────────

function RentIncreaseDialog({ tenantId, lease, onClose, onSaved }: {
  tenantId: number; lease: TenantLease; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    new_amount: "", effective_from: new Date().toISOString().split("T")[0], notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const handleSave = async () => {
    if (!form.new_amount) { setError("New amount is required"); return; }
    setSaving(true); setError("");
    try {
      await tenantApi.increaseRent(tenantId, lease.id, {
        new_amount: Number(form.new_amount),
        effective_from: form.effective_from,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to update rent");
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 0.18s ease-out both" }}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <div className="relative w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: "min(400px, 90vw)",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "16px", boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
          animation: "modalSlideUp 0.2s ease-out both",
        }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold text-primary">Increase Rent</h2>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--border)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div className="px-3 py-2.5 rounded-xl text-xs"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24" }}>
            Current rent: <strong>PKR {Number(lease.rent_amount).toLocaleString()}</strong>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted uppercase tracking-wider font-semibold">New Rent Amount (PKR) *</label>
            <input type="number" className="input-dark w-full px-3 py-2.5 text-sm" value={form.new_amount}
              onChange={e => setForm(p => ({ ...p, new_amount: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted uppercase tracking-wider font-semibold">Effective From *</label>
            <input type="date" className="input-dark w-full px-3 py-2.5 text-sm" value={form.effective_from}
              onChange={e => setForm(p => ({ ...p, effective_from: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted uppercase tracking-wider font-semibold">Notes</label>
            <textarea className="input-dark w-full px-3 py-2.5 text-sm resize-none" rows={2}
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
              : "Apply Increase"}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

// ── Main Detail Page ──────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant]         = useState<TenantDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [showPayment, setPayment]   = useState(false);
  const [showIncrease, setIncrease] = useState(false);
  const [activeTab, setTab]         = useState<"rent" | "payments" | "leases" | "history">("rent");

  const load = async () => {
    setLoading(true);
    const tenant = await tenantApi.get(Number(id));
    setTenant(tenant);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div className="p-12 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
  if (!tenant) return (
    <div className="p-12 text-center text-sm" style={{ color: "#f87171" }}>Tenant not found</div>
  );

  const activeLease = tenant.leases.find(l => l.status === "active");

  const statusIcon = (s: string) => {
    if (s === "paid")    return <CheckCircle size={13} style={{ color: "#10b981" }} />;
    if (s === "overdue") return <AlertCircle size={13} style={{ color: "#ef4444" }} />;
    return <Clock size={13} style={{ color: "#f59e0b" }} />;
  };

  const TABS = [
    { key: "rent" as const,     label: "Rent History" },
    { key: "payments" as const, label: "Payments" },
    { key: "leases" as const,   label: "All Leases" },
    { key: "history" as const,  label: "History" },
  ];

  return (
    <div className="p-6 animate-slide-up max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 px-6 py-5"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px 14px 0 0", borderBottom: "none" }}>
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => navigate("/tenants")}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--hover-bg)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-primary">{tenant.name}</h1>
              <StatusBadge status={tenant.is_active ? "active" : "ended"} />
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="font-mono text-xs px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
                {tenant.tenant_id}
              </span>
              {tenant.phone && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{tenant.phone}</span>}
              {tenant.email && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{tenant.email}</span>}
            </div>
          </div>
        </div>
        {activeLease && (
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={() => setPayment(true)}
              className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs">
              <Plus size={13} /> Record Payment
            </button>
            <button type="button" onClick={() => setIncrease(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}>
              <TrendingUp size={13} /> Increase Rent
            </button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 14px 14px" }}>

        {/* Section: Finance Summary */}
        <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 px-6 py-3"
            style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface2)" }}>
            <DollarSign size={13} style={{ color: "var(--text-muted)" }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Financial Summary</span>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Paid",  value: formatCurrency(tenant.total_paid),    color: "#10b981", bg: "rgba(16,185,129,0.08)" },
                { label: "Pending",     value: formatCurrency(tenant.total_pending), color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
                { label: "Overdue",     value: formatCurrency(tenant.total_overdue), color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="rounded-xl px-4 py-4 transition-all hover:scale-[1.01]"
                  style={{ background: bg, border: `1px solid ${color}25` }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color }}>{label}</p>
                  <p className="text-xl font-bold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section: Tenant & Lease Info */}
        <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 px-6 py-3"
            style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface2)" }}>
            <FileText size={13} style={{ color: "var(--text-muted)" }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Tenant & Lease Information</span>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-0">
              {[
                { label: "Tenant ID",    value: <span className="font-mono text-xs" style={{ color: "#60a5fa" }}>{tenant.tenant_id}</span> },
                { label: "Name",         value: tenant.name },
                { label: "Phone",        value: tenant.phone ?? "—" },
                { label: "Email",        value: tenant.email ?? "—" },
                { label: "CNIC",         value: tenant.cnic ?? "—" },
                { label: "Family Size",  value: tenant.family_size ? String(tenant.family_size) : "—" },
                ...(activeLease ? [
                  { label: "Property",   value: activeLease.property_name ?? "—" },
                  { label: "Unit",       value: activeLease.unit_number ?? "—" },
                  { label: "Rent",       value: formatCurrency(activeLease.rent_amount) },
                  { label: "Deposit",    value: activeLease.security_deposit ? formatCurrency(activeLease.security_deposit) : "—" },
                  { label: "Cycle",      value: activeLease.rent_cycle },
                  { label: "Due Day",    value: `${activeLease.due_day}th` },
                  { label: "Lease Start", value: activeLease.lease_start },
                  { label: "Lease End",  value: activeLease.lease_end ?? "Open" },
                ] : []),
              ].map((item, i) => (
                <div key={i} className="flex items-start justify-between py-2.5"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <span className="text-xs shrink-0 w-36" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                  <span className="text-xs font-medium text-right text-primary flex-1">{item.value ?? "—"}</span>
                </div>
              ))}
            </div>
            {activeLease?.status === "active" && (
              <button type="button"
                onClick={async () => { if (!confirm("End this lease?")) return; await tenantApi.endLease(tenant.id, activeLease.id); load(); }}
                className="mt-4 text-xs py-2 px-4 rounded-xl transition-colors"
                style={{ border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                End Lease
              </button>
            )}
          </div>
        </div>

        {/* Section: Records (tabbed) */}
        <div>
          <div className="flex items-center justify-between px-6 py-3"
            style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface2)" }}>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Records</span>
            <div className="tab-bar">
              {TABS.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setTab(key)}
                  className={`tab-pill ${activeTab === key ? "active" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "rent" && (
            <div className="overflow-x-auto">
              {tenant.rent_records.length === 0 ? (
                <div className="px-6 py-10 text-xs text-center" style={{ color: "var(--text-muted)" }}>No rent records</div>
              ) : (
                <table className="erp-table">
                  <thead><tr><th>Due Date</th><th className="text-right">Amount Due</th><th className="text-right">Paid</th><th>Status</th><th>Paid On</th></tr></thead>
                  <tbody>
                    {tenant.rent_records.map(r => (
                      <tr key={r.id}>
                        <td>{r.due_date}</td>
                        <td className="text-right font-medium">{formatCurrency(r.amount_due)}</td>
                        <td className="text-right font-medium" style={{ color: "#10b981" }}>{formatCurrency(r.amount_paid)}</td>
                        <td><div className="flex items-center gap-1.5">{statusIcon(r.status)}<StatusBadge status={r.status} /></div></td>
                        <td style={{ color: "var(--text-secondary)" }}>{r.paid_date ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "payments" && (
            <div className="overflow-x-auto">
              {tenant.payments.length === 0 ? (
                <div className="px-6 py-10 text-xs text-center" style={{ color: "var(--text-muted)" }}>No payments recorded</div>
              ) : (
                <table className="erp-table">
                  <thead><tr><th>Date</th><th className="text-right">Amount</th><th>Method</th><th>Notes</th></tr></thead>
                  <tbody>
                    {tenant.payments.map(p => (
                      <tr key={p.id}>
                        <td>{p.payment_date}</td>
                        <td className="text-right font-semibold" style={{ color: "#10b981" }}>{formatCurrency(p.amount)}</td>
                        <td>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize"
                            style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
                            {p.payment_method}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>{p.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "leases" && (
            <div className="overflow-x-auto">
              {tenant.leases.length === 0 ? (
                <div className="px-6 py-10 text-xs text-center" style={{ color: "var(--text-muted)" }}>No leases</div>
              ) : (
                <table className="erp-table">
                  <thead><tr><th>Property</th><th>Unit</th><th className="text-right">Rent</th><th>Cycle</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
                  <tbody>
                    {tenant.leases.map(l => (
                      <tr key={l.id}>
                        <td>{l.property_name ?? "—"}</td>
                        <td style={{ color: "var(--text-secondary)" }}>{l.unit_number ?? "—"}</td>
                        <td className="text-right font-medium">{formatCurrency(l.rent_amount)}</td>
                        <td style={{ color: "var(--text-secondary)" }} className="capitalize">{l.rent_cycle}</td>
                        <td style={{ color: "var(--text-secondary)" }}>{l.lease_start}</td>
                        <td style={{ color: "var(--text-secondary)" }}>{l.lease_end ?? "Open"}</td>
                        <td><StatusBadge status={l.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="px-6 py-5">
              <RecordHistory module="tenant" recordId={String(tenant.id)} />
            </div>
          )}
        </div>
      </div>

      <AttachmentPanel module="tenant" recordId={tenant.id} />

      {showPayment && (
        <PaymentDialog tenantId={tenant.id} records={tenant.rent_records}
          onClose={() => setPayment(false)} onSaved={() => { setPayment(false); load(); }} />
      )}
      {showIncrease && activeLease && (
        <RentIncreaseDialog tenantId={tenant.id} lease={activeLease}
          onClose={() => setIncrease(false)} onSaved={() => { setIncrease(false); load(); }} />
      )}
    </div>
  );
}


