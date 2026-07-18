import { useEffect, useState } from "react";
import {
  Plus, Edit3, Trash2, AlertTriangle, CheckCircle, Clock,
  ArrowUpDown, GripVertical, Link2, Unlink, User,
} from "lucide-react";
import {
  constructionApi, Phase, Task,
} from "../../../lib/constructionApi";
import { formatCurrency } from "../../../lib/currency";
import DataTable from "../../../components/data-table/DataTable";
import type { TableColumn } from "../../../components/data-table/types";
import ConfirmDialog from "../../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../../store/notifications";

const STATUS_COLOR: Record<string, string> = {
  pending: "#94a3b8", in_progress: "#f59e0b", completed: "#10b981", delayed: "#ef4444", paused: "#6366f1",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "#22c55e", medium: "#f59e0b", high: "#f97316", critical: "#ef4444",
};
const RISK_COLOR: Record<string, string> = {
  low: "#22c55e", medium: "#f59e0b", high: "#ef4444",
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

export default function PlanningTab({ projectId, onRefresh }: { projectId: number; onRefresh: () => void }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [phaseForm, setPhaseForm] = useState({ name: "", start_date: "", end_date: "", description: "" });
  const [taskForm, setTaskForm] = useState<any>({
    name: "", phase_id: 0, description: "", priority: "medium", estimated_cost: "",
    estimated_duration: "", start_date: "", end_date: "", risk_level: "low", remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{type: 'phase' | 'task', id: number} | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        constructionApi.listPhases(projectId),
        constructionApi.listTasks(projectId),
      ]);
      setPhases(p);
      setTasks(t);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSavePhase = async () => {
    if (!phaseForm.name || !phaseForm.start_date) return;
    setSaving(true);
    try {
      if (selectedPhase) {
        await constructionApi.updatePhase(selectedPhase.id, phaseForm);
      } else {
        await constructionApi.createPhase({ ...phaseForm, project_id: projectId, order_index: phases.length });
      }
      pushToast({ title: selectedPhase ? "Phase updated" : "Phase created", message: `Phase "${phaseForm.name}" has been ${selectedPhase ? "updated" : "created"}.`, type: "success" });
      setShowPhaseForm(false);
      setSelectedPhase(null);
      setPhaseForm({ name: "", start_date: "", end_date: "", description: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed to save phase"); }
    finally { setSaving(false); }
  };

  const handleSaveTask = async () => {
    if (!taskForm.name || !taskForm.phase_id) return;
    setSaving(true);
    try {
      if (editingTask) {
        await constructionApi.updateTask(editingTask.id, {
          ...taskForm,
          estimated_cost: taskForm.estimated_cost ? Number(taskForm.estimated_cost) : null,
          estimated_duration: taskForm.estimated_duration ? Number(taskForm.estimated_duration) : null,
        });
      } else {
        await constructionApi.createTask({
          ...taskForm, project_id: projectId,
          estimated_cost: taskForm.estimated_cost ? Number(taskForm.estimated_cost) : null,
          estimated_duration: taskForm.estimated_duration ? Number(taskForm.estimated_duration) : null,
        });
      }
      pushToast({ title: editingTask ? "Task updated" : "Task created", message: `Task "${taskForm.name}" has been ${editingTask ? "updated" : "created"}.`, type: "success" });
      setShowTaskForm(false);
      setEditingTask(null);
      setTaskForm({ name: "", phase_id: 0, description: "", priority: "medium", estimated_cost: "", estimated_duration: "", start_date: "", end_date: "", risk_level: "low", remarks: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed to save task"); }
    finally { setSaving(false); }
  };

  const handleDeletePhase = async (id: number) => {
    setDeleteTarget({ type: 'phase', id });
  };

  const handleDeleteTask = async (id: number) => {
    setDeleteTarget({ type: 'task', id });
  };

  const handleTaskStatusChange = async (task: Task, status: string) => {
    await constructionApi.updateTaskStatus(task.id, status);
    load();
  };

  const phaseTasks = (phaseId: number) => tasks.filter(t => t.phase_id === phaseId);

  const taskColumns: TableColumn<Task>[] = [
    { key: 'task_number', label: '#', render: (v) => <span className="text-xs text-muted font-mono">{v ?? "—"}</span> },
    { key: 'name', label: 'Task', render: (v, r) => (
      <div>
        <span className="text-xs font-medium text-primary">{v}</span>
        {r.is_delayed && <AlertTriangle size={10} className="text-red-400 inline ml-1" />}
        {r.description && <p className="text-[10px] text-muted truncate max-w-[200px]">{r.description}</p>}
      </div>
    )},
    { key: 'priority', label: 'Priority', render: (v) => <Badge label={v} color={PRIORITY_COLOR[v]} /> },
    { key: 'status', label: 'Status', render: (v) => (
      <select value={v} onChange={e => { const t = tasks.find(x => x.status === v); if (t) handleTaskStatusChange(t, e.target.value); }}
        className="text-[10px] px-1 py-0.5 rounded bg-transparent border border-white/10 text-primary">
        {["pending","in_progress","completed","delayed","paused"].map(s => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
    )},
    { key: 'estimated_cost', label: 'Est. Cost', render: (v) => <span className="text-xs font-mono text-primary">{v ? formatCurrency(Number(v)) : "—"}</span> },
    { key: 'start_date', label: 'Start', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'end_date', label: 'End', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'progress_pct', label: '%', render: (v) => (
      <div className="flex items-center gap-1.5">
        <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${v ?? 0}%` }} />
        </div>
        <span className="text-[10px] text-muted">{(v ?? 0).toFixed(0)}%</span>
      </div>
    )},
    { key: 'actions', label: '', render: (_, r) => (
      <div className="flex items-center gap-1">
        <button onClick={() => { setEditingTask(r); setTaskForm({
          name: r.name, phase_id: r.phase_id, description: r.description ?? "", priority: r.priority,
          estimated_cost: String(r.estimated_cost ?? ""), estimated_duration: String(r.estimated_duration ?? ""),
          start_date: r.start_date ?? "", end_date: r.end_date ?? "", risk_level: r.risk_level ?? "low",
          remarks: r.remarks ?? "",
        }); setShowTaskForm(true); }}
          className="p-1 text-muted hover:text-blue-400 transition-colors"><Edit3 size={11} /></button>
        <button onClick={() => handleDeleteTask(r.id)}
          className="p-1 text-muted hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
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
      {/* Phases Section */}
      <SectionCard title="Project Phases"
        action={
          <button onClick={() => { setSelectedPhase(null); setPhaseForm({ name: "", start_date: "", end_date: "", description: "" }); setShowPhaseForm(true); }}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Plus size={12} /> Add Phase
          </button>
        }>
        <div className="space-y-2">
          {phases.length === 0 ? (
            <p className="text-xs text-muted text-center py-6">No phases defined yet. Create your first phase to get started.</p>
          ) : (
            <div className="space-y-1">
              {phases.sort((a, b) => a.order_index - b.order_index).map((phase, idx) => (
                <div key={phase.id}>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl transition-colors cursor-pointer hover:bg-white/5"
                    style={{ background: expandedPhase === phase.id ? "rgba(255,255,255,0.03)" : undefined }}
                    onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
                    onDoubleClick={() => {
                      setSelectedPhase(phase);
                      setPhaseForm({
                        name: phase.name, start_date: phase.start_date,
                        end_date: phase.end_date ?? "", description: phase.description ?? "",
                      });
                      setShowPhaseForm(true);
                    }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: STATUS_COLOR[phase.status] + "20", color: STATUS_COLOR[phase.status] ?? "#94a3b8" }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-primary">{phase.name}</span>
                        <Badge label={phase.status} />
                      </div>
                      {phase.description && <p className="text-[10px] text-muted truncate">{phase.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted">
                      <span>{phase.start_date}{phase.end_date ? ` → ${phase.end_date}` : ""}</span>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${phase.progress_pct ?? 0}%`,
                            background: (phase.progress_pct ?? 0) >= 80 ? "#10b981" : (phase.progress_pct ?? 0) >= 40 ? "#f59e0b" : "#3b82f6"
                          }} />
                        </div>
                        <span>{(phase.progress_pct ?? 0).toFixed(0)}%</span>
                      </div>
                      <span className="text-muted">{phaseTasks(phase.id).length} tasks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedPhase(phase); setPhaseForm({
                        name: phase.name, start_date: phase.start_date,
                        end_date: phase.end_date ?? "", description: phase.description ?? "",
                      }); setShowPhaseForm(true); }}
                        className="p-1 text-muted hover:text-blue-400 transition-colors"><Edit3 size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeletePhase(phase.id); }}
                        className="p-1 text-muted hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                    </div>
                  </div>

                  {/* Expanded Tasks */}
                  {expandedPhase === phase.id && (
                    <div className="ml-8 pl-4" style={{ borderLeft: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-[10px] text-muted uppercase tracking-wider">Tasks</span>
                        <button onClick={() => { setEditingTask(null); setTaskForm(p => ({ ...p, phase_id: phase.id })); setShowTaskForm(true); }}
                          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                          <Plus size={10} /> Add Task
                        </button>
                      </div>
                      {phaseTasks(phase.id).length === 0 ? (
                        <p className="text-[10px] text-muted py-3 text-center">No tasks in this phase</p>
                      ) : (
                        <DataTable data={phaseTasks(phase.id)} columns={taskColumns} searchable={false} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Phase Form Dialog */}
      {showPhaseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPhaseForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-md" style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-primary">{selectedPhase ? "Edit Phase" : "New Phase"}</h3>
              <button onClick={() => setShowPhaseForm(false)} className="text-muted hover:text-primary"><Edit3 size={14} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Phase Name", key: "name", required: true },
                { label: "Start Date", key: "start_date", type: "date", required: true },
                { label: "End Date", key: "end_date", type: "date" },
              ].map(({ label, key, type, required }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">
                    {label}{required && <span className="text-red-400">*</span>}
                  </label>
                  <input type={type ?? "text"} value={(phaseForm as any)[key]}
                    onChange={e => setPhaseForm(p => ({ ...p, [key]: e.target.value }))}
                    className="dialog-input" />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Description</label>
                <textarea value={phaseForm.description}
                  onChange={e => setPhaseForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="dialog-textarea" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowPhaseForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSavePhase} disabled={saving}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  {saving ? "Saving…" : selectedPhase ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Form Dialog */}
      {showTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTaskForm(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
            style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-primary">{editingTask ? "Edit Task" : "New Task"}</h3>
              <button onClick={() => setShowTaskForm(false)} className="text-muted hover:text-primary"><Edit3 size={14} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Task Name *</label>
                  <input value={taskForm.name} onChange={e => setTaskForm(p => ({ ...p, name: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Phase *</label>
                  <select value={taskForm.phase_id} onChange={e => setTaskForm(p => ({ ...p, phase_id: Number(e.target.value) }))} className="dialog-select">
                    <option value={0}>Select phase</option>
                    {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Priority</label>
                  <select value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))} className="dialog-select">
                    {["low","medium","high","critical"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Est. Cost</label>
                  <input type="number" value={taskForm.estimated_cost} onChange={e => setTaskForm(p => ({ ...p, estimated_cost: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Duration (days)</label>
                  <input type="number" value={taskForm.estimated_duration} onChange={e => setTaskForm(p => ({ ...p, estimated_duration: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Start Date</label>
                  <input type="date" value={taskForm.start_date} onChange={e => setTaskForm(p => ({ ...p, start_date: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">End Date</label>
                  <input type="date" value={taskForm.end_date} onChange={e => setTaskForm(p => ({ ...p, end_date: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Risk Level</label>
                  <select value={taskForm.risk_level} onChange={e => setTaskForm(p => ({ ...p, risk_level: e.target.value }))} className="dialog-select">
                    {["low","medium","high"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Description</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={2} className="dialog-textarea" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Remarks</label>
                <textarea value={taskForm.remarks} onChange={e => setTaskForm(p => ({ ...p, remarks: e.target.value }))} rows={2} className="dialog-textarea" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowTaskForm(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSaveTask} disabled={saving || !taskForm.name || !taskForm.phase_id}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  {saving ? "Saving…" : editingTask ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.type === 'phase' ? "Delete Phase" : "Delete Task"}
        message={deleteTarget?.type === 'phase' ? "Are you sure you want to delete this phase and all its tasks? This action cannot be undone." : "Are you sure you want to delete this task? This action cannot be undone."}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (deleteTarget !== null) {
            if (deleteTarget.type === 'phase') {
              await constructionApi.deletePhase(deleteTarget.id);
              pushToast({ title: "Phase deleted", message: "The phase and all its tasks have been deleted.", type: "success" });
            } else {
              await constructionApi.deleteTask(deleteTarget.id);
              pushToast({ title: "Task deleted", message: "The task has been deleted.", type: "success" });
            }
            setDeleteTarget(null);
            load();
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
