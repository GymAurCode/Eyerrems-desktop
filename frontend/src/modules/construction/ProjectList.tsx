import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, AlertTriangle, ArrowLeft, Building2 } from "lucide-react";
import AppDialog from "../../components/ui/AppDialog";
import { printRecord } from "../../components/actions";
import DataTable from "../../components/data-table/DataTable";
import type { TableColumn } from "../../components/data-table/types";
import { constructionApi, Project, ProjectStatus } from "../../lib/constructionApi";
import { formatCurrency } from "../../lib/currency";

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: "",          label: "All Statuses" },
  { value: "planning",  label: "Planning" },
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
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

// ── Create Project Modal ──────────────────────────────────────────────────────

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
  const [error, setError]   = useState("");

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
      onCreated();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setError(Array.isArray(d) ? d.map((x: any) => x.msg).join("; ") : (d ?? "Failed to create project"));
    } finally {
      setSaving(false);
    }
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
      }
    >
      <div className="space-y-4">
        {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Project Name *", key: "name", span: 2 },
            { label: "Location *",     key: "location", span: 2 },
          ].map(({ label, key, span }) => (
            <div key={key} className={`flex flex-col gap-1 ${span === 2 ? "col-span-2" : ""}`}>
              <label className="text-[10px] text-muted uppercase tracking-wider">{label}</label>
              <input value={(form as any)[key]} onChange={e => set(key as keyof FormState, e.target.value)}
                className="dialog-input" />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">Start Date *</label>
            <input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)}
              className="dialog-input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">End Date</label>
            <input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)}
              className="dialog-input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value as ProjectStatus)}
              className="dialog-select">
              {STATUS_OPTS.filter(s => s.value).map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">Total Budget</label>
            <input type="number" min="0" value={form.total_budget}
              onChange={e => set("total_budget", e.target.value)}
              className="dialog-input" placeholder="0" />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-[10px] text-muted uppercase tracking-wider">Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              rows={2} className="dialog-textarea" />
          </div>
        </div>
      </div>
    </AppDialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate]     = useState(false);

  const load = () => {
    setLoading(true);
    constructionApi.listProjects(statusFilter || undefined)
      .then(r => {
        const data = r.data;
        setProjects(Array.isArray(data) ? data : []);
      })
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      await constructionApi.deleteProject(id);
      load();
    } catch {
      alert("Failed to delete project");
    }
  };

  return (
    <div className="p-6 space-y-5">
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
        <button onClick={() => navigate("/construction")}
          className="text-muted hover:text-primary transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-primary">Projects</h1>
          <p className="text-xs text-muted mt-0.5">{projects.length} total</p>
        </div>
      </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="input-dark w-full pl-8 pr-3 py-2 text-sm rounded-xl" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="input-dark text-sm px-3 py-2 rounded-xl">
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
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
            { key: 'name', label: 'Project', render: (v) => <span className="font-medium text-primary">{v}</span> },
            { key: 'location', label: 'Location', render: (v) => <span className="text-muted">{v}</span> },
            { key: 'status', label: 'Status', render: (_, row) => <StatusBadge status={row.status} /> },
            { key: 'total_budget', label: 'Budget', render: (v) => <span className="text-primary">{formatCurrency(Number(v))}</span> },
            { key: 'actual_cost', label: 'Spent', render: (v) => <span className="text-primary">{formatCurrency(Number(v ?? 0))}</span> },
            {
              key: 'progress_percentage', label: 'Progress', render: (_, row) => (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${row.progress_percentage ?? 0}%` }} />
                  </div>
                  <span className="text-muted">{(row.progress_percentage ?? 0).toFixed(0)}%</span>
                </div>
              ),
            },
            { key: 'phase_count', label: 'Phases', render: (v) => <span className="text-muted">{v ?? 0}</span> },
          ];
          return (
            <DataTable
              data={filtered}
              columns={projectColumns}
              searchable={false}
              hoverable
              emptyTitle="No projects found"
              onView={(row) => navigate(`/construction/projects/${row.id}`)}
              onDelete={(row) => handleDelete(row.id)}
              onPrint={(row) => printRecord(`Project ${row.name}`, [
                { label: "Name", value: row.name },
                { label: "Location", value: row.location ?? "—" },
                { label: "Status", value: row.status },
                { label: "Budget", value: formatCurrency(Number(row.total_budget)) },
                { label: "Spent", value: formatCurrency(Number(row.actual_cost ?? 0)) },
              ])}
            />
          );
        })()
      )}
    </div>
  );
}
