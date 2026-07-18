import { useEffect, useState } from "react";
import {
  Shield, Plus, CheckCircle, XCircle, AlertTriangle,
  Edit3, Trash2, Search, ClipboardList,
} from "lucide-react";
import { constructionApi, QualityInspection, InspectionChecklistItem } from "../../../lib/constructionApi";
import DataTable from "../../../components/data-table/DataTable";
import type { TableColumn } from "../../../components/data-table/types";
import ConfirmDialog from "../../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../../store/notifications";

const STATUS_COLOR: Record<string, string> = {
  pending: "#94a3b8", in_progress: "#f59e0b", completed: "#10b981",
};
const RESULT_COLOR: Record<string, string> = {
  pending: "#94a3b8", passed: "#10b981", failed: "#ef4444", rework_required: "#f59e0b",
};

const INSPECTION_TYPES = [
  "Foundation Inspection", "Concrete Inspection", "Steel Inspection",
  "Electrical Inspection", "Plumbing Inspection", "Final Inspection",
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

export default function QualityTab({ projectId }: { projectId: number }) {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showChecklist, setShowChecklist] = useState<QualityInspection | null>(null);
  const [checklist, setChecklist] = useState<InspectionChecklistItem[]>([]);
  const [form, setForm] = useState({
    inspection_type: "", inspection_date: new Date().toISOString().split("T")[0],
    inspector_name: "", result: "pending", remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = async () => {
    setLoading(true);
    try {
      const insp = await constructionApi.listInspections(projectId);
      setInspections(insp);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSave = async () => {
    if (!form.inspection_type || !form.inspection_date) return;
    setSaving(true);
    try {
      await constructionApi.createInspection({
        project_id: projectId,
        ...form,
      });
      pushToast({ title: "Inspection created", message: `Inspection "${form.inspection_type}" has been created.`, type: "success" });
      setShowForm(false);
      setForm({ inspection_type: "", inspection_date: new Date().toISOString().split("T")[0], inspector_name: "", result: "pending", remarks: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const handleResultChange = async (id: number, result: string) => {
    await constructionApi.updateInspection(id, { result });
    load();
  };

  const loadChecklist = async (inspection: QualityInspection) => {
    setShowChecklist(inspection);
    try {
      const items = await constructionApi.getInspectionChecklist(inspection.id);
      setChecklist(items);
    } catch {
      setChecklist(INSPECTION_TYPES.map(t => ({
        id: 0, inspection_id: inspection.id,
        item_name: `${t} - ${inspection.inspection_type}`,
        is_checked: false,
      })));
    }
  };

  const toggleChecklistItem = async (item: InspectionChecklistItem) => {
    try {
      await constructionApi.updateChecklistItem(item.id, { is_checked: !item.is_checked });
      if (showChecklist) loadChecklist(showChecklist);
    } catch { /* ignore */ }
  };

  const columns: TableColumn<QualityInspection>[] = [
    { key: 'inspection_type', label: 'Type', render: (v) => <span className="text-xs font-medium text-primary">{v}</span> },
    { key: 'inspection_date', label: 'Date', render: (v) => <span className="text-xs text-muted">{v}</span> },
    { key: 'inspector_name', label: 'Inspector', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'result', label: 'Result', render: (v) => (
      <select value={v} onChange={e => { const insp = inspections.find(x => x.result === v); if (insp) handleResultChange(insp.id, e.target.value); }}
        className="text-[10px] px-1 py-0.5 rounded bg-transparent border border-white/10 text-primary">
        {["pending","passed","failed","rework_required"].map(s => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
    )},
    { key: 'status', label: 'Status', render: (v) => <Badge label={v} /> },
    { key: 'actions', label: '', render: (_, r) => (
      <div className="flex items-center gap-1">
        <button onClick={() => loadChecklist(r)}
          className="p-1 text-muted hover:text-blue-400" title="Checklist">
          <ClipboardList size={11} />
        </button>
        <button onClick={() => setDeleteTarget(r.id)}
          className="p-1 text-muted hover:text-red-400"><Trash2 size={11} /></button>
      </div>
    )},
  ];

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionCard title="Quality Inspections"
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Plus size={10} /> New Inspection
          </button>
        }>
        <DataTable data={inspections} columns={columns} searchable
          emptyTitle="No inspections" emptyDescription="Schedule your first quality inspection." />
      </SectionCard>

      {/* Inspection Checklist Panel */}
      {showChecklist && (
        <SectionCard title={`Checklist: ${showChecklist.inspection_type}`}
          action={
            <button onClick={() => setShowChecklist(null)}
              className="text-[10px] px-2 py-1 rounded-lg text-muted hover:text-primary border border-white/10 hover:border-white/20">
              Close
            </button>
          }>
          <div className="space-y-1">
            {checklist.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No checklist items defined</p>
            ) : (
              checklist.map((item, i) => (
                <label key={item.id || i}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={item.is_checked}
                    onChange={() => toggleChecklistItem(item)}
                    className="rounded border-white/20" />
                  <span className={`text-xs flex-1 ${item.is_checked ? "text-emerald-400 line-through" : "text-primary"}`}>
                    {item.item_name}
                  </span>
                  {item.is_checked ? (
                    <CheckCircle size={12} className="text-emerald-400" />
                  ) : (
                    <XCircle size={12} className="text-muted" />
                  )}
                </label>
              ))
            )}
          </div>
        </SectionCard>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-md" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">New Inspection</h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Inspection Type *</label>
                <select value={form.inspection_type} onChange={e => setForm(p => ({ ...p, inspection_type: e.target.value }))} className="dialog-select">
                  <option value="">Select type</option>
                  {INSPECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Date *</label>
                  <input type="date" value={form.inspection_date}
                    onChange={e => setForm(p => ({ ...p, inspection_date: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Inspector</label>
                  <input value={form.inspector_name}
                    onChange={e => setForm(p => ({ ...p, inspector_name: e.target.value }))} className="dialog-input" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Result</label>
                <select value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))} className="dialog-select">
                  {["pending","passed","failed","rework_required"].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Remarks</label>
                <textarea value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                  rows={2} className="dialog-textarea" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.inspection_type}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  {saving ? "Saving…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Inspection"
        message="Are you sure you want to delete this inspection? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (deleteTarget !== null) {
            await constructionApi.deleteInspection(deleteTarget);
            pushToast({ title: "Inspection deleted", message: "The inspection has been deleted.", type: "success" });
            setDeleteTarget(null);
            load();
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
