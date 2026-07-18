import { useEffect, useState } from "react";
import {
  Milestone, Plus, Edit3, Trash2, CheckCircle, Clock,
  AlertTriangle, Circle,
} from "lucide-react";
import { constructionApi, Milestone as MilestoneType } from "../../../lib/constructionApi";
import { useNotifStore } from "../../../store/notifications";

const PHASES = [
  { key: "planning", label: "Planning", icon: "📋", color: "#6366f1" },
  { key: "budget", label: "Budget", icon: "💰", color: "#f59e0b" },
  { key: "procurement", label: "Procurement", icon: "🛒", color: "#ec4899" },
  { key: "execution", label: "Execution", icon: "🏗️", color: "#10b981" },
  { key: "inspection", label: "Inspection", icon: "🔍", color: "#06b6d4" },
  { key: "completion", label: "Completion", icon: "✅", color: "#3b82f6" },
];

const STATUS_COLOR: Record<string, string> = {
  upcoming: "#94a3b8", in_progress: "#f59e0b", completed: "#10b981", delayed: "#ef4444",
};

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

export default function TimelineTab({ projectId }: { projectId: number }) {
  const [milestones, setMilestones] = useState<MilestoneType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MilestoneType | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", milestone_type: "execution",
    target_date: "", status: "upcoming",
  });
  const [saving, setSaving] = useState(false);
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = async () => {
    setLoading(true);
    try {
      const data = await constructionApi.listMilestones(projectId);
      setMilestones(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editing) {
        await constructionApi.updateMilestone(editing.id, form);
      } else {
        await constructionApi.createMilestone({
          project_id: projectId,
          ...form,
          order_index: milestones.length,
        });
      }
      pushToast({ title: editing ? "Milestone updated" : "Milestone created", message: `Milestone "${form.name}" has been ${editing ? "updated" : "created"}.`, type: "success" });
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", description: "", milestone_type: "execution", target_date: "", status: "upcoming" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (milestone: MilestoneType, status: string) => {
    await constructionApi.updateMilestone(milestone.id, { status });
    load();
  };

  const groupedMilestones = PHASES.map(phase => ({
    ...phase,
    milestones: milestones.filter(m => m.milestone_type === phase.key).sort((a, b) => a.order_index - b.order_index),
  }));

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Visual Timeline */}
      <SectionCard title="Project Timeline"
        action={
          <button onClick={() => { setEditing(null); setForm({ name: "", description: "", milestone_type: "execution", target_date: "", status: "upcoming" }); setShowForm(true); }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Plus size={10} /> Add Milestone
          </button>
        }>
        {/* Phase progress bar */}
        <div className="flex items-center gap-1 mb-6">
          {PHASES.map((phase, idx) => {
            const phaseMilestones = milestones.filter(m => m.milestone_type === phase.key);
            const completed = phaseMilestones.filter(m => m.status === "completed").length;
            const total = phaseMilestones.length;
            const allComplete = total > 0 && completed === total;
            const anyDelayed = phaseMilestones.some(m => m.status === "delayed");
            const anyInProgress = phaseMilestones.some(m => m.status === "in_progress");
            return (
              <div key={phase.key} className="flex-1 flex flex-col items-center">
                <div className="relative w-full flex items-center">
                  <div className={`h-1 w-full rounded-full ${allComplete ? "bg-emerald-500" : anyDelayed ? "bg-red-500" : anyInProgress ? "bg-amber-500" : "bg-white/10"}`} />
                  <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold
                    ${allComplete ? "bg-emerald-500 text-white" : anyDelayed ? "bg-red-500 text-white" : anyInProgress ? "bg-amber-500 text-white" : "bg-white/20 text-muted"}`}>
                    {allComplete ? "✓" : anyDelayed ? "!" : idx + 1}
                  </div>
                </div>
                <span className="text-[9px] text-muted mt-2">{phase.label}</span>
              </div>
            );
          })}
        </div>

        {/* Milestones by Phase */}
        {groupedMilestones.map(phase => (
          <div key={phase.key} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs">{phase.icon}</span>
              <span className="text-xs font-semibold text-primary">{phase.label}</span>
              <span className="text-[10px] text-muted">
                ({phase.milestones.filter(m => m.status === "completed").length}/{phase.milestones.length})
              </span>
            </div>
            {phase.milestones.length === 0 ? (
              <p className="text-[10px] text-muted ml-6 mb-2">No milestones</p>
            ) : (
              <div className="space-y-1 ml-6">
                {phase.milestones.map(m => (
                  <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{
                      background: STATUS_COLOR[m.status],
                      boxShadow: m.status === "in_progress" ? `0 0 6px ${STATUS_COLOR[m.status]}` : undefined,
                    }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-primary">{m.name}</span>
                        <Badge label={m.status} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted">
                        {m.description && <span className="truncate max-w-[150px]">{m.description}</span>}
                        {m.target_date && <span>Target: {m.target_date}</span>}
                        {m.completed_date && <span>Completed: {m.completed_date}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(m); setForm({
                        name: m.name, description: m.description ?? "",
                        milestone_type: m.milestone_type, target_date: m.target_date ?? "",
                        status: m.status,
                      }); setShowForm(true); }}
                        className="p-1 text-muted hover:text-blue-400"><Edit3 size={10} /></button>
                      <select value={m.status} onChange={e => handleStatusChange(m, e.target.value)}
                        className="text-[9px] px-1 py-0.5 rounded bg-transparent border border-white/10 text-primary">
                        {["upcoming","in_progress","completed","delayed"].map(s => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                      {m.status !== "completed" && (
                        <button onClick={() => handleStatusChange(m, "completed")}
                          className="p-1 text-muted hover:text-emerald-400"><CheckCircle size={10} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </SectionCard>

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-md" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">{editing ? "Edit Milestone" : "New Milestone"}</h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="dialog-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Phase Type</label>
                  <select value={form.milestone_type} onChange={e => setForm(p => ({ ...p, milestone_type: e.target.value }))} className="dialog-select">
                    {PHASES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Target Date</label>
                  <input type="date" value={form.target_date} onChange={e => setForm(p => ({ ...p, target_date: e.target.value }))} className="dialog-input" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="dialog-select">
                  {["upcoming","in_progress","completed","delayed"].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="dialog-textarea" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  {saving ? "Saving…" : editing ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
