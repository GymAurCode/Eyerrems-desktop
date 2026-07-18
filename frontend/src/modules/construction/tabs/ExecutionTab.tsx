import { useEffect, useState } from "react";
import {
  HardHat, Plus, Play, Pause, CheckCircle, AlertTriangle, Camera,
  MapPin, Cloud, FileText, Edit3, Trash2, ListTodo, Users,
} from "lucide-react";
import { constructionApi, DailyProgress, Task } from "../../../lib/constructionApi";
import DataTable from "../../../components/data-table/DataTable";
import type { TableColumn } from "../../../components/data-table/types";

const STATUS_COLOR: Record<string, string> = {
  pending: "#94a3b8", in_progress: "#f59e0b", completed: "#10b981", delayed: "#ef4444", paused: "#6366f1",
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

export default function ExecutionTab({ projectId, onRefresh }: { projectId: number; onRefresh: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<DailyProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showDiary, setShowDiary] = useState(false);
  const [diaryForm, setDiaryForm] = useState({
    date: new Date().toISOString().split("T")[0],
    work_done: "", progress_percentage: "0", workers_count: "",
    weather: "", issues: "", accidents: "", delay_reasons: "", site_notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        constructionApi.listTasks(projectId),
        constructionApi.listProgress(projectId),
      ]);
      setTasks(t);
      setProgress(p);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleTaskAction = async (task: Task, status: string) => {
    await constructionApi.updateTaskStatus(task.id, status);
    load();
    onRefresh();
  };

  const handleSaveDiary = async () => {
    if (!diaryForm.date || !diaryForm.work_done) return;
    setSaving(true);
    try {
      await constructionApi.logProgress({
        project_id: projectId,
        task_id: activeTask?.id ?? undefined,
        date: diaryForm.date,
        work_done: diaryForm.work_done,
        progress_percentage: Number(diaryForm.progress_percentage),
        workers_count: diaryForm.workers_count ? Number(diaryForm.workers_count) : undefined,
        weather: diaryForm.weather || undefined,
        issues: diaryForm.issues || undefined,
        accidents: diaryForm.accidents || undefined,
        delay_reasons: diaryForm.delay_reasons || undefined,
        site_notes: diaryForm.site_notes || undefined,
      });
      setShowDiary(false);
      setDiaryForm({ date: new Date().toISOString().split("T")[0], work_done: "", progress_percentage: "0", workers_count: "", weather: "", issues: "", accidents: "", delay_reasons: "", site_notes: "" });
      load();
      onRefresh();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Failed"); }
    finally { setSaving(false); }
  };

  const taskColumns: TableColumn<Task>[] = [
    { key: 'name', label: 'Task', render: (v, r) => (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-primary">{v}</span>
        {r.is_delayed && <AlertTriangle size={10} className="text-red-400" />}
        <Badge label={r.status} />
      </div>
    )},
    { key: 'phase_name', label: 'Phase', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'priority', label: 'Priority', render: (v) => <Badge label={v} color={v === "critical" ? "#ef4444" : v === "high" ? "#f97316" : v === "medium" ? "#f59e0b" : "#22c55e"} /> },
    { key: 'progress_pct', label: 'Progress', render: (v) => (
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{
            width: `${v ?? 0}%`,
            background: (v ?? 0) >= 80 ? "#10b981" : (v ?? 0) >= 40 ? "#f59e0b" : "#3b82f6"
          }} />
        </div>
        <span className="text-[10px] text-muted">{(v ?? 0).toFixed(0)}%</span>
      </div>
    )},
    { key: 'actions', label: '', render: (_, r) => (
      <div className="flex items-center gap-1">
        {(r.status === "pending" || r.status === "paused") && (
          <button onClick={() => handleTaskAction(r, "in_progress")}
            className="p-1 text-muted hover:text-emerald-400" title="Start"><Play size={11} /></button>
        )}
        {r.status === "in_progress" && (
          <>
            <button onClick={() => handleTaskAction(r, "paused")}
              className="p-1 text-muted hover:text-amber-400" title="Pause"><Pause size={11} /></button>
            <button onClick={() => handleTaskAction(r, "completed")}
              className="p-1 text-muted hover:text-emerald-400" title="Complete"><CheckCircle size={11} /></button>
          </>
        )}
        <button onClick={() => { setActiveTask(r); setShowDiary(true); setDiaryForm(p => ({ ...p, work_done: "", progress_percentage: String(r.progress_pct ?? 0) })); }}
          className="p-1 text-muted hover:text-blue-400" title="Log Progress"><FileText size={11} /></button>
      </div>
    )},
  ];

  const progressColumns: TableColumn<DailyProgress>[] = [
    { key: 'date', label: 'Date', render: (v) => <span className="text-xs font-mono text-muted">{v}</span> },
    { key: 'work_done', label: 'Work Done', render: (v) => (
      <span className="text-xs text-primary max-w-[200px] truncate block">{v}</span>
    )},
    { key: 'progress_percentage', label: '%', render: (v) => (
      <span className="text-xs font-mono text-primary">{v}%</span>
    )},
    { key: 'workers_count', label: 'Workers', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'weather', label: 'Weather', render: (v) => <span className="text-xs text-muted">{v ?? "—"}</span> },
    { key: 'issues', label: 'Issues', render: (v) => v ? <span className="text-xs text-red-400">{v}</span> : <span className="text-xs text-muted">—</span> },
  ];

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Task Status Board */}
      <SectionCard title="Task Execution Board"
        action={
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted">
              {tasks.filter(t => t.status === "completed").length}/{tasks.length} completed
            </span>
          </div>
        }>
        <DataTable data={tasks} columns={taskColumns} searchable
          emptyTitle="No tasks created yet"
          emptyDescription="Create tasks in the Planning tab before executing them." />
      </SectionCard>

      {/* Daily Progress */}
      <SectionCard title="Daily Site Diary"
        action={
          <button onClick={() => { setActiveTask(null); setShowDiary(true); setDiaryForm({
            date: new Date().toISOString().split("T")[0], work_done: "", progress_percentage: "0",
            workers_count: "", weather: "", issues: "", accidents: "", delay_reasons: "", site_notes: "",
          }); }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-white"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Plus size={10} /> Log Progress
          </button>
        }>
        {progress.length === 0 ? (
          <p className="text-xs text-muted text-center py-6">No daily progress entries yet. Start logging site activity.</p>
        ) : (
          <DataTable data={progress.sort((a, b) => b.date.localeCompare(a.date))} columns={progressColumns} searchable={false} />
        )}
      </SectionCard>

      {/* Site Diary Form Dialog */}
      {showDiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDiary(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
            style={{ border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <FileText size={14} className="text-blue-400" />
                Site Diary Entry
                {activeTask && <span className="text-[10px] text-muted">— {activeTask.name}</span>}
              </h3>
              <button onClick={() => setShowDiary(false)} className="text-muted hover:text-primary"><Edit3 size={14} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Date *</label>
                  <input type="date" value={diaryForm.date} onChange={e => setDiaryForm(p => ({ ...p, date: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Progress %</label>
                  <input type="number" min="0" max="100" value={diaryForm.progress_percentage}
                    onChange={e => setDiaryForm(p => ({ ...p, progress_percentage: e.target.value }))} className="dialog-input" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Work Done *</label>
                <textarea value={diaryForm.work_done} onChange={e => setDiaryForm(p => ({ ...p, work_done: e.target.value }))}
                  rows={3} className="dialog-textarea" placeholder="Describe the work completed today…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
                    <Users size={10} /> Workers Count
                  </label>
                  <input type="number" value={diaryForm.workers_count} onChange={e => setDiaryForm(p => ({ ...p, workers_count: e.target.value }))} className="dialog-input" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
                    <Cloud size={10} /> Weather
                  </label>
                  <select value={diaryForm.weather} onChange={e => setDiaryForm(p => ({ ...p, weather: e.target.value }))} className="dialog-select">
                    <option value="">Select</option>
                    {["Sunny","Cloudy","Rainy","Stormy","Hot","Cold","Windy"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={10} /> Issues / Problems
                </label>
                <textarea value={diaryForm.issues} onChange={e => setDiaryForm(p => ({ ...p, issues: e.target.value }))}
                  rows={2} className="dialog-textarea" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Accidents</label>
                  <textarea value={diaryForm.accidents} onChange={e => setDiaryForm(p => ({ ...p, accidents: e.target.value }))}
                    rows={2} className="dialog-textarea" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">Delay Reasons</label>
                  <textarea value={diaryForm.delay_reasons} onChange={e => setDiaryForm(p => ({ ...p, delay_reasons: e.target.value }))}
                    rows={2} className="dialog-textarea" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">Site Notes</label>
                <textarea value={diaryForm.site_notes} onChange={e => setDiaryForm(p => ({ ...p, site_notes: e.target.value }))}
                  rows={2} className="dialog-textarea" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowDiary(false)} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSaveDiary} disabled={saving || !diaryForm.date || !diaryForm.work_done}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  {saving ? "Saving…" : "Save Entry"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
