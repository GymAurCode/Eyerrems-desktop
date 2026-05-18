import { useCallback, useEffect, useState } from "react";
import {
  Wrench, Plus, X, AlertCircle, DollarSign, CheckCircle,
  Clock, Zap, Building2, Users, BarChart2, RefreshCw,
  ChevronRight, ArrowLeft, Filter, Search, Edit2, Trash2,
  Activity, TrendingUp, Calendar, User, Phone, Home, Loader2,
} from "lucide-react";
import { tenantApi, type Maintenance, type MaintenanceAnalytics, type UnitTenantInfo } from "../lib/tenantApi";
import { propApi, type Property, type Unit } from "../lib/propertyApi";
import { formatCurrency } from "../lib/currency";
import PortalModal from "../components/Modal";
import { QuickRowActions, ActionsTh, ActionsCell, printRecord } from "../components/actions";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "repair","electrical","plumbing","hvac","cleaning",
  "security","emergency","preventive","utility","other",
];
const PRIORITIES = ["low","normal","high","urgent"];
const STATUSES   = ["pending","assigned","in_progress","completed","cancelled"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: "Pending",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  assigned:    { label: "Assigned",    color: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  in_progress: { label: "In Progress", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  completed:   { label: "Completed",   color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  cancelled:   { label: "Cancelled",   color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

const PRIORITY_CFG: Record<string, { color: string; bg: string }> = {
  low:    { color: "#64748b", bg: "rgba(100,116,139,0.10)" },
  normal: { color: "#3b82f6", bg: "rgba(59,130,246,0.10)"  },
  high:   { color: "#f97316", bg: "rgba(249,115,22,0.10)"  },
  urgent: { color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
};

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CFG[priority] ?? PRIORITY_CFG.normal;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize"
      style={{ color: cfg.color, background: cfg.bg }}>
      {priority}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="card-dark rounded-2xl p-4 flex items-start gap-3" style={{ border: "1px solid var(--border)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-primary">{value}</p>
        <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

function MaintenanceFormModal({
  record, onClose, onSaved,
}: { record?: Maintenance | null; onClose: () => void; onSaved: () => void }) {
  const [properties, setProps]   = useState<Property[]>([]);
  const [units,      setUnits]   = useState<Unit[]>([]);
  const [unitsLoading, setUL]    = useState(false);
  const [unitInfo,   setUnitInfo] = useState<UnitTenantInfo | null>(null);
  const [tenantLoading, setTL]   = useState(false);

  // scope: "property" = whole-property maintenance, "unit" = unit-specific
  const [scope, setScope] = useState<"property" | "unit">(
    record?.unit_id ? "unit" : "property"
  );

  const [form, setForm] = useState({
    property_id:    record?.property_id?.toString() ?? "",
    unit_id:        record?.unit_id?.toString()     ?? "",
    tenant_id:      record?.tenant_id?.toString()   ?? "",
    title:          record?.title          ?? "",
    description:    record?.description    ?? "",
    category:       record?.category       ?? "repair",
    priority:       record?.priority       ?? "normal",
    estimated_cost: record?.estimated_cost ?? "",
    date:           record?.date           ?? new Date().toISOString().split("T")[0],
    vendor_name:    record?.vendor_name    ?? "",
    vendor_phone:   record?.vendor_phone   ?? "",
    notes:          record?.notes          ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  // Load properties once
  useEffect(() => {
    propApi.getProperties().then(res => {
      const data = res && 'data' in res ? (res as any).data : res;
      setProps(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  // When property changes → load its units
  useEffect(() => {
    if (!form.property_id || scope === "property") {
      setUnits([]); setUnitInfo(null);
      setForm(p => ({ ...p, unit_id: "", tenant_id: "" }));
      return;
    }
    setUL(true);
    propApi.getUnits(Number(form.property_id))
      .then(res => {
        const data = res && 'data' in res ? (res as any).data : res;
        setUnits(Array.isArray(data) ? data : []);
      })
      .catch(() => setUnits([]))
      .finally(() => setUL(false));
  }, [form.property_id, scope]);

  // When unit changes → auto-detect tenant
  useEffect(() => {
    if (!form.unit_id) {
      setUnitInfo(null);
      setForm(p => ({ ...p, tenant_id: "" }));
      return;
    }
    setTL(true);
    tenantApi.getUnitTenant(Number(form.unit_id))
      .then(res => {
        const info = res && 'data' in res ? (res as any).data : res;
        setUnitInfo(info);
        setForm(p => ({
          ...p,
          tenant_id: info?.tenant ? String(info.tenant.id) : "",
        }));
      })
      .catch(() => { setUnitInfo(null); setForm(p => ({ ...p, tenant_id: "" })); })
      .finally(() => setTL(false));
  }, [form.unit_id]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleScopeChange = (s: "property" | "unit") => {
    setScope(s);
    setForm(p => ({ ...p, unit_id: "", tenant_id: "" }));
    setUnitInfo(null);
  };

  const handleSave = async () => {
    if (!form.property_id || !form.description || !form.date) {
      setError("Property, description and date are required"); return;
    }
    if (scope === "unit" && !form.unit_id) {
      setError("Please select a unit for unit-specific maintenance"); return;
    }
    setSaving(true); setError("");
    try {
      const payload = {
        property_id:    Number(form.property_id),
        unit_id:        scope === "unit" && form.unit_id ? Number(form.unit_id) : undefined,
        tenant_id:      form.tenant_id ? Number(form.tenant_id) : undefined,
        title:          form.title || undefined,
        description:    form.description,
        category:       form.category,
        mtype:          form.category,
        priority:       form.priority,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : undefined,
        cost:           form.estimated_cost ? Number(form.estimated_cost) : 0,
        date:           form.date,
        vendor_name:    form.vendor_name  || undefined,
        vendor_phone:   form.vendor_phone || undefined,
        notes:          form.notes        || undefined,
      };
      if (record) {
        await tenantApi.updateMaintenance(record.id, payload);
      } else {
        await tenantApi.createMaintenance(payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <PortalModal open title={record ? "Edit Request" : "New Maintenance Request"} onClose={onClose} size="lg">
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
            style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">

          {/* Title */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Title</label>
            <input className="input-dark w-full px-3 py-2 text-sm" value={form.title}
              onChange={e => set("title", e.target.value)} placeholder="Brief title (optional)" />
          </div>

          {/* ── Scope toggle ── */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Maintenance Scope</label>
            <div className="flex gap-2">
              {([
                { id: "property", label: "Whole Property", icon: Building2, desc: "Applies to entire building" },
                { id: "unit",     label: "Specific Unit",  icon: Home,      desc: "Applies to one unit" },
              ] as const).map(({ id, label, icon: Icon, desc }) => (
                <button key={id} type="button" onClick={() => handleScopeChange(id)}
                  className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    border:     `1px solid ${scope === id ? "rgba(59,130,246,0.5)" : "var(--border)"}`,
                    background: scope === id ? "rgba(59,130,246,0.08)" : "transparent",
                  }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: scope === id ? "rgba(59,130,246,0.15)" : "var(--border)" }}>
                    <Icon size={13} style={{ color: scope === id ? "#60a5fa" : "var(--text-muted)" }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: scope === id ? "#60a5fa" : "var(--text-secondary)" }}>{label}</p>
                    <p className="text-[10px] text-muted">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Property ── */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Property *</label>
            <select className="select-dark w-full px-3 py-2 text-sm" value={form.property_id}
              onChange={e => { set("property_id", e.target.value); setForm(p => ({ ...p, unit_id: "", tenant_id: "" })); setUnitInfo(null); }}>
              <option value="">Select property...</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name || p.address || p.tid}</option>)}
            </select>
          </div>

          {/* ── Unit (only when scope = unit) ── */}
          {scope === "unit" && (
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
                Unit *
                {unitsLoading && <Loader2 size={11} className="animate-spin text-muted" />}
              </label>
              {!form.property_id ? (
                <div className="px-3 py-2.5 rounded-xl text-xs text-muted"
                  style={{ border: "1px dashed var(--border)" }}>
                  Select a property first to load its units
                </div>
              ) : units.length === 0 && !unitsLoading ? (
                <div className="px-3 py-2.5 rounded-xl text-xs text-muted"
                  style={{ border: "1px dashed var(--border)" }}>
                  No units found for this property
                </div>
              ) : (
                <select className="select-dark w-full px-3 py-2 text-sm" value={form.unit_id}
                  onChange={e => set("unit_id", e.target.value)}
                  disabled={unitsLoading}>
                  <option value="">Select unit...</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.unit_number} {u.status !== "available" ? `(${u.status})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── Tenant auto-detection panel ── */}
          {scope === "unit" && form.unit_id && (
            <div className="col-span-2">
              {tenantLoading ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-muted"
                  style={{ border: "1px solid var(--border)" }}>
                  <Loader2 size={12} className="animate-spin" /> Checking tenant...
                </div>
              ) : unitInfo?.tenant ? (
                <div className="px-3 py-2.5 rounded-xl text-xs flex items-start gap-3"
                  style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-emerald-400">Tenant auto-detected</p>
                    <p className="text-secondary mt-0.5 font-medium">{unitInfo.tenant.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-muted">
                      <span className="font-mono">{unitInfo.tenant.tenant_id}</span>
                      {unitInfo.tenant.phone && (
                        <span className="flex items-center gap-1"><Phone size={10} />{unitInfo.tenant.phone}</span>
                      )}
                      <span>Rent: {formatCurrency(unitInfo.tenant.rent_amount)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
                  style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b" }}>
                  <AlertCircle size={13} className="shrink-0" />
                  <span>No active tenant linked to this unit — maintenance will proceed without tenant assignment.</span>
                </div>
              )}
            </div>
          )}

          {/* ── Description ── */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Description *</label>
            <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={2}
              value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Describe the issue or work required..." />
          </div>

          {/* Category + Priority */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Category</label>
            <select className="select-dark w-full px-3 py-2 text-sm" value={form.category}
              onChange={e => set("category", e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Priority</label>
            <select className="select-dark w-full px-3 py-2 text-sm" value={form.priority}
              onChange={e => set("priority", e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
          </div>

          {/* Cost + Date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Estimated Cost</label>
            <input type="number" className="input-dark w-full px-3 py-2 text-sm" value={form.estimated_cost}
              onChange={e => set("estimated_cost", e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Date *</label>
            <input type="date" className="input-dark w-full px-3 py-2 text-sm" value={form.date}
              onChange={e => set("date", e.target.value)} />
          </div>

          {/* Vendor */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Vendor Name</label>
            <input className="input-dark w-full px-3 py-2 text-sm" value={form.vendor_name}
              onChange={e => set("vendor_name", e.target.value)} placeholder="Vendor / contractor" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Vendor Phone</label>
            <input className="input-dark w-full px-3 py-2 text-sm" value={form.vendor_phone}
              onChange={e => set("vendor_phone", e.target.value)} placeholder="Contact number" />
          </div>

          {/* Notes */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted font-semibold uppercase tracking-wider">Notes</label>
            <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={2}
              value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Additional notes..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
            {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {saving ? "Saving..." : record ? "Save Changes" : "Create Request"}
          </button>
        </div>
      </div>
    </PortalModal>
  );
}
// ── Status Update Modal ───────────────────────────────────────────────────────

function StatusUpdateModal({
  record, onClose, onSaved,
}: { record: Maintenance; onClose: () => void; onSaved: () => void }) {
  const [newStatus,   setNewStatus]   = useState(record.status);
  const [actualCost,  setActualCost]  = useState(record.actual_cost ?? record.cost ?? "");
  const [completedDate, setCompletedDate] = useState(record.completed_date ?? new Date().toISOString().split("T")[0]);
  const [note,        setNote]        = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      await tenantApi.updateMaintenance(record.id, {
        status:         newStatus,
        actual_cost:    actualCost ? Number(actualCost) : undefined,
        cost:           actualCost ? Number(actualCost) : undefined,
        completed_date: newStatus === "completed" ? completedDate : undefined,
        status_note:    note || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to update");
    } finally { setSaving(false); }
  };

  return (
    <PortalModal open title="Update Status" onClose={onClose} size="md">
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-xl text-xs flex items-center gap-2"
            style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted font-semibold uppercase tracking-wider">New Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => {
              const cfg = STATUS_CFG[s];
              return (
                <button key={s} onClick={() => setNewStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    color:      newStatus === s ? cfg.color : "var(--text-muted)",
                    background: newStatus === s ? cfg.bg    : "transparent",
                    border:     `1px solid ${newStatus === s ? cfg.color + "50" : "var(--border)"}`,
                  }}>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {(newStatus === "completed" || newStatus === "in_progress") && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted font-semibold uppercase tracking-wider">Actual Cost</label>
              <input type="number" className="input-dark w-full px-3 py-2 text-sm"
                value={actualCost} onChange={e => setActualCost(e.target.value)} placeholder="0" />
            </div>
            {newStatus === "completed" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted font-semibold uppercase tracking-wider">Completion Date</label>
                <input type="date" className="input-dark w-full px-3 py-2 text-sm"
                  value={completedDate} onChange={e => setCompletedDate(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted font-semibold uppercase tracking-wider">Note (optional)</label>
          <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={2}
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Add a note about this status change..." />
        </div>

        {newStatus === "completed" && (
          <div className="px-3 py-2.5 rounded-xl text-xs flex items-start gap-2"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399" }}>
            <CheckCircle size={13} className="mt-0.5 shrink-0" />
            <span>Completing this request will automatically post the expense to Finance and update the Property Ledger.</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
            {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {saving ? "Updating..." : "Update Status"}
          </button>
        </div>
      </div>
    </PortalModal>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ record, onBack, onRefresh }: {
  record: Maintenance; onBack: () => void; onRefresh: () => void;
}) {
  const [full, setFull]           = useState<Maintenance | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantApi.getMaintenance(record.id);
      const data = res && 'data' in res ? (res as any).data : res;
      setFull(data || record);
    }
    catch { setFull(record); }
    finally { setLoading(false); }
  }, [record.id]);

  useEffect(() => { void load(); }, [load]);

  const m = full ?? record;

  const handleDelete = async () => {
    if (!confirm("Delete this maintenance request? This cannot be undone.")) return;
    await tenantApi.deleteMaintenance(m.id);
    onBack();
    onRefresh();
  };

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            <ArrowLeft size={12} /> Back
          </button>
          <div>
            <h2 className="text-base font-bold text-primary">{m.title || m.description?.slice(0, 60) || ""}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={m.status} />
              <PriorityBadge priority={m.priority} />
              <span className="text-[10px] text-muted capitalize">{m.category}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            <Edit2 size={12} /> Edit
          </button>
          <button onClick={() => setShowStatus(true)}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Activity size={12} /> Update Status
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-dark rounded-2xl p-5 space-y-4" style={{ border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Request Details</p>
            <p className="text-sm text-secondary leading-relaxed">{m.description}</p>
            {m.notes && (
              <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-secondary">{m.notes}</p>
              </div>
            )}
          </div>

          {/* Finance integration */}
          <div className="card-dark rounded-2xl p-5 space-y-3" style={{ border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Finance Integration</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Estimated Cost", value: m.estimated_cost, color: "#f59e0b" },
                { label: "Actual Cost",    value: m.actual_cost,    color: "#ef4444" },
                { label: "Recorded Cost",  value: m.cost,           color: "#3b82f6" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-3 rounded-xl"
                  style={{ background: `${color}0d`, border: `1px solid ${color}20` }}>
                  <p className="text-sm font-bold" style={{ color }}>{formatCurrency(value ?? 0)}</p>
                  <p className="text-[9px] text-muted mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs">
                {m.expense_posted
                  ? <CheckCircle size={12} className="text-emerald-400" />
                  : <Clock size={12} className="text-muted" />}
                <span style={{ color: m.expense_posted ? "#34d399" : "var(--text-muted)" }}>
                  {m.expense_posted ? "Expense posted to Finance" : "Expense not yet posted"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {m.ledger_posted
                  ? <CheckCircle size={12} className="text-emerald-400" />
                  : <Clock size={12} className="text-muted" />}
                <span style={{ color: m.ledger_posted ? "#34d399" : "var(--text-muted)" }}>
                  {m.ledger_posted ? "Property ledger updated" : "Ledger not yet updated"}
                </span>
              </div>
            </div>
          </div>

          {/* Activity log */}
          {m.activity_logs && m.activity_logs.length > 0 && (
            <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Activity History</p>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {m.activity_logs.map(log => (
                  <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: log.new_status ? (STATUS_CFG[log.new_status]?.color ?? "#64748b") : "#64748b" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary">{log.note || log.action}</p>
                      {log.old_status && log.new_status && (
                        <p className="text-[10px] text-muted mt-0.5">
                          {log.old_status} → {log.new_status}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted">{log.user_name ?? `User #${log.user_id}`}</p>
                      <p className="text-[10px] text-muted">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <div className="card-dark rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Info</p>
            {[
              { icon: Building2, label: "Property",  value: m.property_name ?? `#${m.property_id}` },
              { icon: Home,      label: "Unit",       value: m.unit_number   ?? "—" },
              { icon: Users,     label: "Tenant",    value: m.tenant_name ?? "—" },
              { icon: Calendar,  label: "Reported",  value: m.date },
              { icon: Calendar,  label: "Completed", value: m.completed_date ?? "—" },
              { icon: User,      label: "Assigned",  value: m.assigned_name ?? "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={12} className="text-muted shrink-0" />
                <span className="text-[10px] text-muted w-20 shrink-0">{label}</span>
                <span className="text-xs text-secondary truncate">{value}</span>
              </div>
            ))}
          </div>

          {(m.vendor_name || m.vendor_phone) && (
            <div className="card-dark rounded-2xl p-4 space-y-2" style={{ border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Vendor</p>
              {m.vendor_name  && <p className="text-xs text-primary font-medium">{m.vendor_name}</p>}
              {m.vendor_phone && (
                <div className="flex items-center gap-1.5 text-xs text-secondary">
                  <Phone size={11} /> {m.vendor_phone}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showStatus && (
        <StatusUpdateModal record={m} onClose={() => setShowStatus(false)}
          onSaved={() => { setShowStatus(false); void load(); onRefresh(); }} />
      )}
      {showEdit && (
        <MaintenanceFormModal record={m} onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); void load(); onRefresh(); }} />
      )}
    </div>
  );
}
// ── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [data,    setData]    = useState<MaintenanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tenantApi.maintenanceAnalytics().then(res => {
      const data = res && 'data' in res ? (res as any).data : res;
      setData(data ?? null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-muted text-sm">Loading analytics...</div>;
  if (!data)   return <div className="p-10 text-center text-muted text-sm">No data available.</div>;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Requests" value={data.total_requests ?? 0} icon={Wrench}       color="#3b82f6" />
        <StatCard label="Pending"        value={data.pending ?? 0}        icon={Clock}        color="#f59e0b" />
        <StatCard label="In Progress"    value={data.in_progress ?? 0}    icon={Activity}     color="#8b5cf6" />
        <StatCard label="Completed"      value={data.completed ?? 0}      icon={CheckCircle}  color="#10b981" />
        <StatCard label="Total Cost"     value={formatCurrency(data.total_cost)} icon={DollarSign} color="#ef4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Category */}
        <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">By Category</p>
          </div>
          <div className="p-4 space-y-2">
            {data.by_category.slice(0, 8).map((row: any) => {
              const total = data.total_requests ?? 0;
              const pct = total > 0 ? (row.count / total) * 100 : 0;
              return (
                <div key={row.category} className="flex items-center gap-3">
                  <span className="text-xs text-secondary capitalize w-24 shrink-0">{row.category}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#3b82f6" }} />
                  </div>
                  <span className="text-xs text-muted w-8 text-right">{row.count}</span>
                  <span className="text-xs text-muted w-24 text-right">{formatCurrency(row.total_cost)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Property */}
        <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Top Properties by Cost</p>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {data.by_property.slice(0, 8).map((row: any) => (
              <div key={row.property_id} className="px-5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={12} className="text-muted shrink-0" />
                  <span className="text-xs text-secondary truncate">{row.property_name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-muted">{row.count} req</span>
                  <span className="text-xs font-semibold" style={{ color: "#f87171" }}>{formatCurrency(row.total_cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly trend */}
        <div className="lg:col-span-2 card-dark rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Monthly Trend</p>
          {data.monthly_trend.length === 0 ? (
            <p className="text-xs text-muted text-center py-6">No data yet</p>
          ) : (
            <div className="flex items-end gap-2 h-24">
              {data.monthly_trend.slice(-12).map((row: any) => {
                const maxCost = Math.max(...data.monthly_trend.map((r: any) => r.total_cost), 1);
                const h = Math.max(4, (row.total_cost / maxCost) * 80);
                return (
                  <div key={row.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-sm" style={{ height: `${h}px`, background: "#3b82f6", opacity: 0.8 }} />
                    <span className="text-[8px] text-muted">{row.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Requests Tab ──────────────────────────────────────────────────────────────

function RequestsTab({ onSelect }: { onSelect: (m: Maintenance) => void }) {
  const [records,  setRecords]  = useState<Maintenance[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [statusF,  setStatusF]  = useState("");
  const [priorityF,setPriorityF]= useState("");
  const [categoryF,setCategoryF]= useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const records = await tenantApi.listMaintenance({
        status:   statusF   || undefined,
        priority: priorityF || undefined,
        category: categoryF || undefined,
        limit: 200,
      });
      setRecords(Array.isArray(records) ? records : []);
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [statusF, priorityF, categoryF]);

  useEffect(() => { void load(); }, [load]);

  const filtered = records.filter(r =>
    !search ||
    (r.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.property_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.tenant_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input-dark w-full pl-8 pr-3 py-2 text-xs rounded-xl"
            placeholder="Search requests..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select-dark px-3 py-2 text-xs rounded-xl" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s} className="capitalize">{STATUS_CFG[s]?.label ?? s}</option>)}
        </select>
        <select className="select-dark px-3 py-2 text-xs rounded-xl" value={priorityF} onChange={e => setPriorityF(e.target.value)}>
          <option value="">All Priority</option>
          {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
        </select>
        <select className="select-dark px-3 py-2 text-xs rounded-xl" value={categoryF} onChange={e => setCategoryF(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <RefreshCw size={11} />
        </button>
        <span className="text-xs text-muted ml-auto">{filtered.length} records</span>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs">
          <Plus size={13} /> New Request
        </button>
      </div>

      {/* Table */}
      <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {loading ? (
          <div className="p-10 text-center">
            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench size={28} className="text-muted mx-auto mb-2" />
            <p className="text-sm text-secondary">No maintenance requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Date","Property","Unit","Title / Description","Category","Priority","Status","Cost","Tenant"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                  <ActionsTh />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="row-hover transition-colors cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    onClick={() => onSelect(r)}>
                    <td className="px-4 py-3 text-secondary whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3 text-primary font-medium max-w-[120px] truncate">{r.property_name ?? `#${r.property_id}`}</td>
                    <td className="px-4 py-3 text-secondary text-xs whitespace-nowrap">{r.unit_number ?? <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-3 text-secondary max-w-xs">
                      {r.title
                        ? <><p className="font-medium text-primary truncate">{r.title}</p><p className="text-muted truncate">{r.description}</p></>
                        : <p className="truncate">{r.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                        style={{ background: "var(--border)", color: "var(--text-secondary)" }}>{r.category}</span>
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "#f87171" }}>
                      {formatCurrency(r.actual_cost ?? r.cost ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-secondary">{r.tenant_name ?? "—"}</td>
                    <ActionsCell className="px-4 py-3">
                      <QuickRowActions
                        row={r}
                        compact
                        onView={(row) => onSelect(row)}
                        onDelete={async (row) => {
                          await tenantApi.deleteMaintenance(row.id);
                          void load();
                        }}
                        onPrint={(row) => printRecord(`Maintenance #${row.id}`, [
                          { label: "Title", value: row.title ?? row.description?.slice(0, 80) ?? "—" },
                          { label: "Property", value: row.property_name ?? String(row.property_id) },
                          { label: "Status", value: row.status },
                          { label: "Priority", value: row.priority },
                          { label: "Cost", value: formatCurrency(row.actual_cost ?? row.cost ?? 0) },
                        ])}
                      />
                    </ActionsCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <MaintenanceFormModal onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "requests" | "analytics";

export default function MaintenancePage() {
  const [tab,      setTab]      = useState<Tab>("requests");
  const [selected, setSelected] = useState<Maintenance | null>(null);
  const [stats,    setStats]    = useState({ total: 0, pending: 0, inProgress: 0, totalCost: 0 });

  const loadStats = useCallback(async () => {
    try {
      const records = await tenantApi.listMaintenance({ limit: 500 });
      const list = Array.isArray(records) ? records : [];
      setStats({
        total:      list.length,
        pending:    list.filter(m => m.status === "pending").length,
        inProgress: list.filter(m => m.status === "in_progress").length,
        totalCost:  list.reduce((s, m) => s + Number(m.actual_cost ?? m.cost ?? 0), 0),
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  if (selected) {
    return (
      <div className="p-6 animate-slide-up">
        <DetailPanel record={selected} onBack={() => setSelected(null)} onRefresh={loadStats} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <Wrench size={18} style={{ color: "#f97316" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Maintenance Management</h1>
            <p className="text-xs text-muted mt-0.5">Requests · Workflow · Finance Integration · Analytics</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Requests" value={stats.total}      icon={Wrench}      color="#3b82f6" />
        <StatCard label="Pending"        value={stats.pending}    icon={Clock}       color="#f59e0b" sub="Awaiting action" />
        <StatCard label="In Progress"    value={stats.inProgress} icon={Activity}    color="#8b5cf6" />
        <StatCard label="Total Cost"     value={formatCurrency(stats.totalCost)} icon={DollarSign} color="#ef4444" />
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex gap-0">
          {([
            { id: "requests",  label: "Requests",  icon: Wrench    },
            { id: "analytics", label: "Analytics", icon: BarChart2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap"
              style={{
                borderBottomColor: tab === id ? "#f97316" : "transparent",
                color: tab === id ? "#f97316" : "var(--text-muted)",
              }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "requests"  && <RequestsTab onSelect={setSelected} />}
      {tab === "analytics" && <AnalyticsTab />}
    </div>
  );
}