import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, AlertTriangle, ArrowLeft, Building2, PauseCircle, Play,
  Filter, Download, RotateCcw,
} from "lucide-react";
import AppDialog from "../../components/ui/AppDialog";
import { printRecord } from "../../components/actions";
import DataTable from "../../components/data-table/DataTable";
import type { TableColumn } from "../../components/data-table/types";
import { constructionApi, Project, ProjectStatus } from "../../lib/constructionApi";
import { formatCurrency } from "../../lib/currency";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: "",          label: "All Statuses" },
  { value: "planning",  label: "Planning" },
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PHASE_OPTS: { value: string; label: string }[] = [
  { value: "", label: "All Phases" },
  { value: "planning", label: "Planning" },
  { value: "budget_approval", label: "Budget Approval" },
  { value: "resource_planning", label: "Resource Planning" },
  { value: "procurement", label: "Procurement" },
  { value: "execution", label: "Execution" },
  { value: "finance", label: "Finance" },
  { value: "quality_inspection", label: "Quality Inspection" },
  { value: "documents", label: "Documents" },
  { value: "reporting", label: "Reporting" },
  { value: "completion", label: "Completion" },
  { value: "completed", label: "Completed" },
];

const STATUS_COLOR: Record<string, string> = {
  planning: "#6366f1", active: "#10b981", on_hold: "#f59e0b",
  completed: "#3b82f6", cancelled: "#ef4444",
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${c}20`, color: c }}>
      {status.replace("_", " ")}
    </span>
  );
}

type FormState = {
  name: string; location: string; description: string;
  start_date: string; end_date: string; status: ProjectStatus; total_budget: string;
};

const INIT: FormState = {
  name: "", location: "", description: "",
  start_date: "", end_date: "", status: "planning", total_budget: "",
};

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<FormState>(INIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pushToast = useNotifStore((s) => s.pushToast);
  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.location || !form.start_date) {
      setError("Name, location and start date are required"); return;
    }
    setSaving(true); setError("");
    try {
      await constructionApi.createProject({
        ...form,
        total_budget: form.total_budget ? Number(form.total_budget) : 0,
        end_date: form.end_date || null,
        description: form.description || null,
      });
      pushToast({ title: "Project created", message: `Project "${form.name}" has been created.`, type: "success" });
      onCreated();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setError(Array.isArray(d) ? d.map((x: any) => x.msg).join("; ") : (d ?? "Failed to create project"));
    } finally { setSaving(false); }
  };

  return (
    <AppDialog isOpen onClose={onClose} title="New Construction Project" subtitle="Create a new project" size="sm" icon={<Building2 size={16} />}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", width: "100%" }}>
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-primary transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            {saving ? "Creating…" : "Create Project"}
          </button>
        </div>
      }>
      <div className="space-y-4">
        {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Project Name", key: "name", span: 2, required: true },
            { label: "Location", key: "location", span: 2, required: true },
          ].map(({ label, key, span, required }) => (
            <div key={key} className={`flex flex-col gap-1 ${span === 2 ? "col-span-2" : ""}`}>
              <label className="text-[10px] text-muted uppercase tracking-wider">
                {label}{required && <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }}>*</span>}
              </label>
              <input value={(form as any)[key]} onChange={e => set(key as keyof FormState, e.target.value)}
                className="dialog-input" />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">Start Date<span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }}>*</span></label>
            <input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} className="dialog-input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">End Date</label>
            <input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} className="dialog-input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value as ProjectStatus)} className="dialog-select">
              {STATUS_OPTS.filter(s => s.value).map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">Total Budget</label>
            <input type="number" min="0" value={form.total_budget} onChange={e => set("total_budget", e.target.value)} className="dialog-input" placeholder="0" />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="dialog-textarea" />
          </div>
        </div>
      </div>
    </AppDialog>
  );
}

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteWarn, setDeleteWarn] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [suspending, setSuspending] = useState(false);
  const pushToast = useNotifStore((s) => s.pushToast);

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    if (phaseFilter) params.current_phase = phaseFilter;
    constructionApi.listProjects(params)
      .then(r => setProjects(Array.isArray(r) ? r : []))
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter, phaseFilter]);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase()) ||
    (p.project_code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    try { await constructionApi.deleteProject(id); load(); }
    catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail && (detail.includes("planning") || detail.includes("active"))) {
        const p = projects.find(x => x.id === id);
        if (p) setDeleteWarn(p);
      } else { alert(detail || "Failed to delete project"); }
    }
  };

  const handleSuspend = async (project: Project) => {
    setSuspending(true);
    try { await constructionApi.updateProject(project.id, { status: "on_hold" }); load(); }
    catch { alert("Failed to suspend project"); }
    finally { setSuspending(false); }
  };

  const handleUnsuspend = async (project: Project) => {
    try { await constructionApi.updateProject(project.id, { status: "active" }); load(); }
    catch { alert("Failed to unsuspend project"); }
  };

  return (
    <div className="p-6 space-y-5">
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
      {deleteWarn && (
        <AppDialog isOpen onClose={() => setDeleteWarn(null)} title="Cannot Delete Project" size="sm" icon={<AlertTriangle size={16} />}>
          <div className="space-y-4">
            <p className="text-sm text-primary">
              Project <strong>"{deleteWarn.name}"</strong> has status <strong>"{deleteWarn.status.replace("_", " ")}"</strong> and cannot be deleted directly.
            </p>
            <p className="text-sm text-muted">
              You must suspend the project first by changing its status to <strong>On Hold</strong>, then delete it.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setDeleteWarn(null)} className="px-4 py-2 text-sm text-muted hover:text-primary transition-colors">Cancel</button>
              <button onClick={() => { setDeleteWarn(null); handleSuspend(deleteWarn); }} disabled={suspending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <PauseCircle size={14} />{suspending ? "Suspending…" : "Suspend Project"}
              </button>
            </div>
          </div>
        </AppDialog>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Project"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (deleteTarget !== null) {
            try {
              await constructionApi.deleteProject(deleteTarget);
              pushToast({ title: "Project deleted", message: "The project has been deleted.", type: "success" });
              setDeleteTarget(null);
              load();
            } catch (e: any) {
              setDeleteTarget(null);
              const detail = e?.response?.data?.detail;
              if (detail && (detail.includes("planning") || detail.includes("active"))) {
                const p = projects.find(x => x.id === deleteTarget);
                if (p) setDeleteWarn(p);
              } else { alert(detail || "Failed to delete project"); }
            }
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/construction")}
            className="text-muted hover:text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-primary">Projects</h1>
            <p className="text-xs text-muted mt-0.5">{projects.length} total · {filtered.length} shown</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects by name, code, location…"
            className="input-dark w-full pl-8 pr-3 py-2 text-sm rounded-xl" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="input-dark text-sm px-3 py-2 rounded-xl">
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}
          className="input-dark text-sm px-3 py-2 rounded-xl">
          {PHASE_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-muted hover:text-primary border border-white/10 hover:border-white/20 transition-all">
          <RotateCcw size={12} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        (() => {
          const projectColumns: TableColumn<Project>[] = [
            { key: 'name', label: 'Project', render: (v, r) => (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[r.status] ?? "#94a3b8" }} />
                <div>
                  <span className="font-medium text-primary">{v}</span>
                  {r.project_code && <span className="text-[10px] text-muted ml-2">#{r.project_code}</span>}
                  {r.description && <p className="text-[10px] text-muted truncate max-w-[200px]">{r.description}</p>}
                </div>
              </div>
            )},
            { key: 'location', label: 'Location', render: (v) => <span className="text-xs text-muted">{v}</span> },
            { key: 'current_phase', label: 'Phase', render: (v) => (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-400">
                {v?.replace(/_/g, " ")}
              </span>
            )},
            { key: 'status', label: 'Status', render: (_, row) => <StatusBadge status={row.status} /> },
            { key: 'total_budget', label: 'Budget', render: (v) => <span className="text-primary font-mono text-xs">{formatCurrency(Number(v))}</span> },
            { key: 'actual_cost', label: 'Spent', render: (v) => <span className="text-primary font-mono text-xs">{formatCurrency(Number(v ?? 0))}</span> },
            {
              key: 'progress_percentage', label: 'Progress', render: (_, row) => (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${row.progress_percentage ?? 0}%`,
                      background: (row.progress_percentage ?? 0) >= 80 ? "linear-gradient(90deg,#10b981,#34d399)" :
                                  (row.progress_percentage ?? 0) >= 40 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" :
                                  "linear-gradient(90deg,#3b82f6,#6366f1)"
                    }} />
                  </div>
                  <span className="text-muted font-mono text-xs">{(row.progress_percentage ?? 0).toFixed(0)}%</span>
                </div>
              ),
            },
            { key: 'phase_count', label: 'Phases', render: (v) => <span className="text-muted text-xs">{v ?? 0}</span> },
            { key: 'task_count', label: 'Tasks', render: (_, r) => (
              <span className="text-xs text-muted">
                {r.completed_tasks ?? 0}/{r.task_count ?? 0}
                {(r.delayed_tasks ?? 0) > 0 && <span className="text-red-400 ml-1">({r.delayed_tasks} delayed)</span>}
              </span>
            )},
          ];
          return (
            <DataTable
              data={filtered}
              columns={projectColumns}
              searchable={false}
              hoverable
              emptyTitle="No projects found"
              emptyDescription="Try adjusting your filters or create a new project."
              onView={(row) => navigate(`/construction/projects/${row.id}`)}
              onDelete={(row) => setDeleteTarget(row.id)}
              onPrint={(row) => printRecord(`Project ${row.name}`, [
                { label: "Name", value: row.name },
                { label: "Location", value: row.location ?? "—" },
                { label: "Status", value: row.status },
                { label: "Phase", value: row.current_phase },
                { label: "Budget", value: formatCurrency(Number(row.total_budget)) },
                { label: "Spent", value: formatCurrency(Number(row.actual_cost ?? 0)) },
                { label: "Progress", value: `${(row.progress_percentage ?? 0).toFixed(0)}%` },
                { label: "Tasks", value: `${row.completed_tasks ?? 0}/${row.task_count ?? 0}` },
              ])}
              rowActions={(row) => {
                const acts: any[] = [];
                if (row.status === "planning" || row.status === "active") {
                  acts.push({ label: "Suspend", icon: PauseCircle, color: "#f59e0b", onClick: () => handleSuspend(row) });
                }
                if (row.status === "on_hold") {
                  acts.push({ label: "Unsuspend", icon: Play, color: "#10b981", onClick: () => handleUnsuspend(row) });
                }
                return acts;
              }}
            />
          );
        })()
      )}
    </div>
  );
}
