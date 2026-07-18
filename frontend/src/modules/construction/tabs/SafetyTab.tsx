import { useEffect, useState } from "react";
import {
  AlertTriangle, Plus, Shield, Edit3, Trash2, Search,
  CheckCircle, XCircle, Users, MapPin,
} from "lucide-react";
import { constructionApi, SafetyIncident } from "../../../lib/constructionApi";
import DataTable from "../../../components/data-table/DataTable";
import type { TableColumn } from "../../../components/data-table/types";
import ConfirmDialog from "../../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../../store/notifications";

const STATUS_COLOR: Record<string, string> = {
  open: "#f59e0b", investigating: "#f97316", resolved: "#3b82f6", closed: "#22c55e",
};
const SEVERITY_COLOR: Record<string, string> = {
  low: "#22c55e", medium: "#f59e0b", high: "#f97316", critical: "#ef4444",
};
const INCIDENT_TYPES = [
  "safety_meeting", "incident", "near_miss", "accident", "violation", "ppe_compliance",
];

function Badge({ label, color }: { label: string; color?: string }) {
  const c = color ?? STATUS_COLOR[label] ?? "#94a3b8";
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

export default function SafetyTab({ projectId }: { projectId: number }) {
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    incident_type: "incident", title: "", description: "",
    incident_date: new Date().toISOString().split("T")[0],
    severity: "medium", location: "", affected_persons: "", corrective_action: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = async () => {
    setLoading(true);
    try {
      const data = await constructionApi.listSafety(projectId);
      setIncidents(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSave = async () => {
    if (!form.title || !form.incident_date) return;
    setSaving(true);
    try {
      await constructionApi.createSafetyIncident({
        project_id: projectId,
        ...form,
        affected_persons: form.affected_persons ? Number(form.affected_persons) : undefined,
      });
      pushToast({ title: "Incident recorded", message: `Safety incident "${form.title}" has been recorded.`, type: "success" });
      setShowForm(false);
      setForm({ incident_type: "incident", title: "", description: "", incident_date: new Date().toISOString().split("T")[0], severity: "medium", location: "", affected_persons: "", corrective_action: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const handleClose = async (id: number) => {
    setDeleteTarget(id);
  };

  const columns: TableColumn<SafetyIncident>[] = [
    { key: 'incident_type', label: 'Type', render: (v) => (
      <Badge label={v.replace(/_/g, " ")} color={v === "accident" ? "#ef4444" : v === "violation" ? "#f97316" : v === "near_miss" ? "#f59e0b" : "#6366f1"} />
    )},
    { key: 'title', label: 'Title', render: (v, r) => (
      <div>
        <span className="text-xs font-medium text-primary">{v}</span>
        {r.description && <p className="text-[10px] text-muted truncate max-w-[200px]">{r.description}</p>}
      </div>
    )},
    { key: 'incident_date', label: 'Date', render: (v) => <span className="text-xs text-muted">{v}</span> },
    { key: 'severity', label: 'Severity', render: (v) => <Badge label={v} color={SEVERITY_COLOR[v]} /> },
    { key: 'status', label: 'Status', render: (v, r) => (
      <div className="flex items-center gap-1">
        <Badge label={v} />
        {(v === "open" || v === "investigating") && (
          <button onClick={() => handleClose(r.id)}
            className="p-0.5 text-muted hover:text-emerald-400" title="Close"><CheckCircle size={10} /></button>
        )}
      </div>
    )},
    { key: 'corrective_action', label: 'Action', render: (v) => (
      <span className="text-[10px] text-muted max-w-[120px] truncate block">{v || "—"}</span>
    )},
  ];

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
          <span className="text-[10px] text-muted uppercase tracking-wider">Total Incidents</span>
          <p className="text-lg font-bold text-primary">{incidents.length}</p>
        </div>
        <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
          <span className="text-[10px] text-muted uppercase tracking-wider">Open</span>
          <p className="text-lg font-bold text-amber-400">{incidents.filter(i => i.status === "open" || i.status === "investigating").length}</p>
        </div>
        <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
          <span className="text-[10px] text-muted uppercase tracking-wider">Closed</span>
          <p className="text-lg font-bold text-emerald-400">{incidents.filter(i => i.status === "closed").length}</p>
        </div>
        <div className="card-dark rounded-2xl p-3" style={{ border: "1px solid var(--border)" }}>
          <span className="text-[10px] text-muted uppercase tracking-wider">Critical</span>
          <p className="text-lg font-bold text-red-400">{incidents.filter(i => i.severity === "critical" || i.severity === "high").length}</p>
        </div>
      </div>

      <SectionCard title="Safety Incidents & Reports"
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            <Plus size={10} /> Record Incident
          </button>
        }>
        <DataTable data={incidents} columns={columns} searchable
          emptyTitle="No incidents recorded"
          emptyDescription="Safety first! Record any incidents or safety meetings here." />
      </SectionCard>

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
            style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" />
              Record Safety Incident
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Type *</label>
                  <select value={form.incident_type} onChange={e => setForm(p => ({ ...p, incident_type: e.target.value }))} className="dialog-select">
                    {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Severity</label>
                  <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))} className="dialog-select">
                    {["low","medium","high","critical"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="dialog-input" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="dialog-textarea" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Date *</label>
                  <input type="date" value={form.incident_date}
                    onChange={e => setForm(p => ({ ...p, incident_date: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={10} /> Location
                  </label>
                  <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
                    <Users size={10} /> Affected Persons
                  </label>
                  <input type="number" value={form.affected_persons}
                    onChange={e => setForm(p => ({ ...p, affected_persons: e.target.value }))} className="dialog-input" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Corrective Action</label>
                <textarea value={form.corrective_action}
                  onChange={e => setForm(p => ({ ...p, corrective_action: e.target.value }))}
                  rows={2} className="dialog-textarea" placeholder="What actions were taken?" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.title}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50">
                  {saving ? "Saving…" : "Record"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Close Incident"
        message="Are you sure you want to close this incident?"
        confirmLabel="Close Incident"
        variant="warning"
        onConfirm={async () => {
          if (deleteTarget !== null) {
            await constructionApi.closeSafetyIncident(deleteTarget);
            pushToast({ title: "Incident closed", message: "The safety incident has been closed.", type: "success" });
            setDeleteTarget(null);
            load();
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
