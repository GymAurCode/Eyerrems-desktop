import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, TrendingUp, AlertCircle, Clock,
  X, ChevronRight, ChevronLeft, CheckCircle, Bell, DollarSign,
  Eye, Printer
} from "lucide-react";
import { printRecord } from "../components/actions";
import AttachmentsButton from "../components/attachments/AttachmentsButton";
import { tenantApi, Tenant, TenantDashboard, TenantAlert, WizardPayload } from "../lib/tenantApi";
import { propApi, Property, Unit, FloorWithUnits } from "../lib/propertyApi";
import { formatCurrency } from "../lib/currency";
import { SmartTable } from "../components/data-table";
import { api } from "../lib/api";

// ── Shared helpers ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active:  "#10b981",
  ended:   "#94a3b8",
  inactive:"#94a3b8",
};

function StatusBadge({ status }: { status: string }) {
  const sc = STATUS_COLOR[status] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${sc}18`, color: sc }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="card-dark flex items-center gap-4 px-4 py-3"
      style={{ border: "1px solid var(--border)" }}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
        <p className="text-base font-semibold text-primary truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────

const STEPS = ["Basic Info", "Property", "Lease Details", "Review"];

type WizardState = {
  name: string; phone: string; email: string; cnic: string;
  family_size: string; notes: string;
  property_id: string; unit_id: string; is_full_property: boolean;
  rent_amount: string; security_deposit: string;
  rent_cycle: string; due_day: string;
  lease_start: string; lease_end: string;
};

const INIT: WizardState = {
  name: "", phone: "", email: "", cnic: "", family_size: "", notes: "",
  property_id: "", unit_id: "", is_full_property: false,
  rent_amount: "", security_deposit: "",
  rent_cycle: "monthly", due_day: "1",
  lease_start: "", lease_end: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted uppercase tracking-wider font-semibold">{label}</label>
      {children}
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-3 py-2 text-[10px] font-bold text-muted uppercase tracking-widest"
        style={{ background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border)" }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-2 text-xs" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="text-muted">{label}</span>
      <span className="text-primary font-medium">{value}</span>
    </div>
  );
}

function TenantWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep]        = useState(0);
  const [form, setForm]        = useState<WizardState>(INIT);
  const [properties, setProps] = useState<Property[]>([]);
  const [units, setUnits]      = useState<Unit[]>([]);
  const [error, setError]      = useState("");
  const [saving, setSaving]    = useState(false);

  useEffect(() => {
    propApi.getProperties().then(res => {
      const data = res && 'data' in res ? (res as any).data : res;
      setProps(Array.isArray(data) ? data : []);
    });
  }, []);
  useEffect(() => {
    if (!form.property_id) { setUnits([]); return; }
    propApi.getProperty(Number(form.property_id)).then(res => {
      const data = res && 'data' in res ? (res as any).data : res;
      if (data?.floors) {
        setUnits(data.floors.flatMap((f: FloorWithUnits) => f.units));
      } else {
        setUnits([]);
      }
    });
  }, [form.property_id]);

  const set = (k: keyof WizardState, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.phone.trim();
    if (step === 1) return !!form.property_id;
    if (step === 2) return !!(form.rent_amount && form.lease_start);
    return true;
  };

  const handleSubmit = async () => {
    setSaving(true); setError("");
    try {
      const payload: WizardPayload = {
        tenant: {
          name: form.name.trim(), phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          cnic: form.cnic.trim() || undefined,
          family_size: form.family_size ? Number(form.family_size) : undefined,
          notes: form.notes.trim() || undefined,
        },
        lease: {
          property_id: Number(form.property_id),
          unit_id: form.unit_id ? Number(form.unit_id) : undefined,
          is_full_property: form.is_full_property,
          rent_amount: Number(form.rent_amount),
          security_deposit: form.security_deposit ? Number(form.security_deposit) : undefined,
          rent_cycle: form.rent_cycle, due_day: Number(form.due_day),
          lease_start: form.lease_start, lease_end: form.lease_end || undefined,
        },
      };
      await tenantApi.create(payload);
      onCreated();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (Array.isArray(detail)) {
        // FastAPI 422 validation errors — extract human-readable messages
        setError(detail.map((d: any) => d?.msg ?? String(d)).join("; "));
      } else {
        setError(typeof detail === "string" ? detail : "Failed to create tenant");
      }
    } finally { setSaving(false); }
  };

  const selectedProp = properties.find(p => p.id === Number(form.property_id));

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 0.18s ease-out both" }}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <div className="relative w-full max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          maxWidth: "min(520px, 90vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
          animation: "modalSlideUp 0.2s ease-out both",
        }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-sm font-semibold text-primary">New Tenant</h2>
            <p className="text-xs text-muted mt-0.5">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--border)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <X size={14} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-4 gap-2 shrink-0">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                ${i < step ? "bg-green-500 text-white" : i === step ? "bg-blue-500 text-white" : ""}`}
                style={i >= step && i !== step ? { background: "var(--bg-surface2)", color: "var(--text-muted)", border: "1px solid var(--border)" } : {}}>
                {i < step ? <CheckCircle size={13} /> : i + 1}
              </div>
              <span className={`text-[10px] ${i === step ? "text-blue-400 font-medium" : "text-muted"}`}>{s}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1 min-h-[260px]">
          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {step === 0 && (
            <>
              <Field label="Full Name *">
                <input className="input-dark w-full px-3 py-2.5 text-sm" value={form.name}
                  onChange={e => set("name", e.target.value)} placeholder="e.g. Ahmed Khan" />
              </Field>
              <Field label="Phone *">
                <input className="input-dark w-full px-3 py-2.5 text-sm" value={form.phone}
                  onChange={e => set("phone", e.target.value)} placeholder="03XX-XXXXXXX" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input className="input-dark w-full px-3 py-2.5 text-sm" value={form.email}
                    onChange={e => set("email", e.target.value)} placeholder="optional" />
                </Field>
                <Field label="CNIC">
                  <input className="input-dark w-full px-3 py-2.5 text-sm" value={form.cnic}
                    onChange={e => set("cnic", e.target.value)} placeholder="XXXXX-XXXXXXX-X" />
                </Field>
              </div>
              <Field label="Family Size">
                <input type="number" className="input-dark w-full px-3 py-2.5 text-sm" value={form.family_size}
                  onChange={e => set("family_size", e.target.value)} placeholder="e.g. 4" />
              </Field>
              <Field label="Notes">
                <textarea className="input-dark w-full px-3 py-2.5 text-sm resize-none" rows={2}
                  value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes..." />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Property *">
                <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.property_id}
                  onChange={e => { set("property_id", e.target.value); set("unit_id", ""); set("is_full_property", false); }}>
                  <option value="">Select property...</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.address || p.tid}</option>)}
                </select>
              </Field>
              {form.property_id && (
                <>
                  <Field label="Unit (leave empty for full property)">
                    <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.unit_id}
                      onChange={e => { set("unit_id", e.target.value); set("is_full_property", !e.target.value); }}>
                      <option value="">Full Property</option>
                      {units.map(u => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}
                    </select>
                  </Field>
                  <div className="text-xs px-3 py-2 rounded-lg font-medium"
                    style={{
                      background: form.unit_id ? "rgba(59,130,246,0.08)" : "rgba(99,102,241,0.08)",
                      color: form.unit_id ? "#60a5fa" : "#818cf8",
                      border: `1px solid ${form.unit_id ? "rgba(59,130,246,0.2)" : "rgba(99,102,241,0.2)"}`,
                    }}>
                    {form.unit_id ? "Partial — specific unit selected" : "Full House — entire property"}
                  </div>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rent Amount (PKR) *">
                  <input type="number" className="input-dark w-full px-3 py-2.5 text-sm" value={form.rent_amount}
                    onChange={e => set("rent_amount", e.target.value)} placeholder="e.g. 25000" />
                </Field>
                <Field label="Security Deposit">
                  <input type="number" className="input-dark w-full px-3 py-2.5 text-sm" value={form.security_deposit}
                    onChange={e => set("security_deposit", e.target.value)} placeholder="optional" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rent Cycle *">
                  <select className="select-dark w-full px-3 py-2.5 text-sm" value={form.rent_cycle}
                    onChange={e => set("rent_cycle", e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </Field>
                <Field label="Due Day (of month)">
                  <input type="number" min={1} max={28} className="input-dark w-full px-3 py-2.5 text-sm"
                    value={form.due_day} onChange={e => set("due_day", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lease Start *">
                  <input type="date" className="input-dark w-full px-3 py-2.5 text-sm" value={form.lease_start}
                    onChange={e => set("lease_start", e.target.value)} />
                </Field>
                <Field label="Lease End">
                  <input type="date" className="input-dark w-full px-3 py-2.5 text-sm" value={form.lease_end}
                    onChange={e => set("lease_end", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <ReviewSection title="Tenant Info">
                <ReviewRow label="Name" value={form.name} />
                <ReviewRow label="Phone" value={form.phone} />
                {form.email && <ReviewRow label="Email" value={form.email} />}
                {form.cnic && <ReviewRow label="CNIC" value={form.cnic} />}
              </ReviewSection>
              <ReviewSection title="Property">
                <ReviewRow label="Property" value={selectedProp?.address ?? selectedProp?.tid ?? "—"} />
                <ReviewRow label="Type" value={form.unit_id ? "Partial (unit)" : "Full House"} />
              </ReviewSection>
              <ReviewSection title="Lease">
                <ReviewRow label="Rent" value={`PKR ${Number(form.rent_amount).toLocaleString()}`} />
                <ReviewRow label="Cycle" value={form.rent_cycle} />
                <ReviewRow label="Due Day" value={`${form.due_day}th of month`} />
                <ReviewRow label="Start" value={form.lease_start} />
                {form.lease_end && <ReviewRow label="End" value={form.lease_end} />}
                {form.security_deposit && <ReviewRow label="Deposit" value={`PKR ${Number(form.security_deposit).toLocaleString()}`} />}
              </ReviewSection>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}>
          <AttachmentsButton module="tenant" />
          <button type="button" onClick={() => setStep(s => s - 1)} disabled={step === 0}
            className="flex items-center gap-1.5 text-sm transition-colors disabled:opacity-30"
            style={{ color: "var(--text-secondary)" }}>
            <ChevronLeft size={15} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canNext()}
              className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40">
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                : "Confirm & Create"}
            </button>
          )}
        </div>
      </div>
    </div>
  , document.body);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TenantPage() {
  const navigate = useNavigate();
  const [tenants, setTenants]     = useState<Tenant[]>([]);
  const [dashboard, setDashboard] = useState<TenantDashboard | null>(null);
  const [alerts, setAlerts]       = useState<TenantAlert[]>([]);
  const [showWizard, setWizard]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [total, setTotal]         = useState(0);
  const paramsRef = useRef<any>(null);

  const fetchTenants = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<Tenant[]>("/tenants", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          filter: params.dateFilter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
          status: params.status || undefined,
        }
      });
      const data = res.data;
      setTenants(Array.isArray(data) ? data : []);
      const totalCount = Number(res.headers["x-total-count"] || res.headers["X-Total-Count"] || (Array.isArray(data) ? data.length : 0));
      setTotal(totalCount);
    } catch (err) {
      console.error(err);
      setTenants([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const d = await tenantApi.dashboard();
      setDashboard(d ?? null);
    } catch {
      setDashboard(null);
    }
    try {
      const a = await tenantApi.alerts();
      setAlerts(Array.isArray(a) ? a : []);
    } catch {
      setAlerts([]);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const refreshTable = () => {
    loadDashboard();
    if (paramsRef.current) {
      fetchTenants(paramsRef.current);
    }
  };

  const alertIcons: Record<string, React.ElementType> = {
    overdue: AlertCircle, due_soon: Clock, lease_expiry: Bell,
  };

  const columns = [
    {
      key: "tenant_id",
      label: "Tenant ID",
      className: "font-mono text-xs text-blue-400"
    },
    {
      key: "name",
      label: "Name",
      className: "text-primary font-medium"
    },
    {
      key: "phone",
      label: "Phone",
      className: "text-secondary"
    },
    {
      key: "email",
      label: "Email",
      render: (val: any) => val || "—",
      className: "text-secondary"
    },
    {
      key: "is_active",
      label: "Status",
      render: (val: boolean) => {
        const sc = STATUS_COLOR[val ? "active" : "ended"] ?? "#94a3b8";
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${sc}18`, color: sc }}>
            {val ? "Active" : "Ended"}
          </span>
        );
      }
    },
    {
      key: "created_at",
      label: "Joined",
      render: (val: string) => new Date(val).toLocaleDateString(),
      className: "text-secondary"
    }
  ];

  const rowActions = [
    {
      key: "view",
      label: "View Detail",
      icon: Eye,
      onClick: (row: Tenant) => navigate(`/tenants/${row.id}`)
    },
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: Tenant) => printRecord(`Tenant ${row.tenant_id}`, [
        { label: "Tenant ID", value: row.tenant_id },
        { label: "Name", value: row.name },
        { label: "Phone", value: row.phone ?? "—" },
        { label: "Email", value: row.email ?? "—" },
        { label: "Status", value: row.is_active ? "Active" : "Ended" },
        { label: "Joined", value: new Date(row.created_at).toLocaleDateString() },
      ])
    }
  ];

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Tenants</h1>
          <p className="text-xs text-muted mt-0.5">Manage tenants, leases, and rent collection</p>
        </div>
      </div>

      {/* Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Active Tenants"  value={String(dashboard.active_tenants)}               icon={Users}       color="bg-blue-500" />
          <StatCard label="Rent Collected"  value={formatCurrency(dashboard.total_rent_collected)} icon={TrendingUp}  color="bg-green-500" />
          <StatCard label="Pending"         value={formatCurrency(dashboard.total_pending)}         icon={Clock}       color="bg-yellow-500" />
          <StatCard label="Overdue"         value={formatCurrency(dashboard.total_overdue)}         icon={AlertCircle} color="bg-red-500" />
          <StatCard label="Net Profit"      value={formatCurrency(dashboard.net_profit)}            icon={DollarSign}  color="bg-purple-500" />
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-sidebar)" }}>
            <Bell size={14} className="text-orange-400" />
            <h3 className="text-sm font-semibold text-primary">Alerts</h3>
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>{alerts.length}</span>
          </div>
          <div className="divide-y max-h-48 overflow-y-auto" style={{ borderColor: "var(--border-subtle)" }}>
            {alerts.map((a, i) => {
              const Icon = alertIcons[a.type] ?? Bell;
              const severityColor: Record<string, string> = {
                high: "#f87171", medium: "#fbbf24", low: "#60a5fa",
              };
              const sc = severityColor[a.severity] ?? "#60a5fa";
              return (
                <div key={i} onClick={() => navigate(`/tenants/${a.tenant_id}`)}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors row-hover"
                  style={{ borderLeft: `2px solid ${sc}` }}>
                  <Icon size={13} className="mt-0.5 shrink-0" style={{ color: sc }} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-xs text-primary">{a.tenant_name}</span>
                    <span className="text-xs text-muted ml-1.5 font-mono">{a.tenant_ref}</span>
                    <p className="text-xs text-muted mt-0.5">{a.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SmartTable
        storageKey="rems_tenants"
        data={tenants}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchTenants}
        showStatusFilter={true}
        statusOptions={[
          { label: "Active", value: "active" },
          { label: "Ended", value: "ended" }
        ]}
        showDateFilter={true}
        toolbarActions={
          <button type="button" onClick={() => setWizard(true)}
            className="btn-primary flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> New Tenant
          </button>
        }
      />

      {showWizard && (
        <TenantWizard onClose={() => setWizard(false)} onCreated={() => { setWizard(false); refreshTable(); }} />
      )}
    </div>
  );
}
