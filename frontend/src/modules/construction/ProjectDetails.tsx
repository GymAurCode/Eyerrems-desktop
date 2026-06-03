import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, AlertTriangle, LayoutDashboard, Calendar,
  DollarSign, Users, ShoppingCart, HardHat, Wallet, FileText, BarChart2,
} from "lucide-react";
import {
  constructionApi, Project, Phase, Budget, ProjectContractor,
  Procurement, DailyProgress, ConstructionExpense, Document, ProjectReport,
} from "../../lib/constructionApi";
import { formatCurrency } from "../../lib/currency";
import DataTable from "../../components/data-table/DataTable";
import type { TableColumn } from "../../components/data-table/types";
import ModuleTabs from "../../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../../config/moduleColors";

// ── Tab helpers ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",    label: "Overview",    icon: LayoutDashboard },
  { id: "planning",    label: "Planning",    icon: Calendar },
  { id: "budget",      label: "Budget",      icon: DollarSign },
  { id: "resources",   label: "Resources",   icon: Users },
  { id: "procurement", label: "Procurement", icon: ShoppingCart },
  { id: "execution",   label: "Execution",   icon: HardHat },
  { id: "finance",     label: "Finance",     icon: Wallet },
  { id: "documents",   label: "Documents",   icon: FileText },
  { id: "reports",     label: "Reports",     icon: BarChart2 },
] as const;

type TabId = typeof TABS[number]["id"];

const STATUS_COLOR: Record<string, string> = {
  planning: "#6366f1", active: "#10b981", on_hold: "#f59e0b",
  completed: "#3b82f6", cancelled: "#ef4444",
  pending: "#94a3b8", in_progress: "#f59e0b",
  requested: "#6366f1", approved: "#10b981", ordered: "#3b82f6",
  received: "#22c55e", cancelled_proc: "#ef4444",
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

function SectionCard({ title, children, action }: {
  title: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      <span className="text-sm text-primary">{value ?? "—"}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ project, onRefresh }: { project: Project; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ ...project });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const save = async () => {
    setSaving(true); setError("");
    try {
      await constructionApi.updateProject(project.id, {
        name: form.name, location: form.location, description: form.description,
        start_date: form.start_date, end_date: form.end_date || null,
        status: form.status, total_budget: Number(form.total_budget),
      });
      setEditing(false); onRefresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <SectionCard title="Project Details"
        action={
          editing
            ? <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-xs text-muted hover:text-primary">Cancel</button>
                <button onClick={save} disabled={saving}
                  className="text-xs px-3 py-1 rounded-lg text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            : <button onClick={() => setEditing(true)}
                className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
        }
      >
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Name",     key: "name",     span: 2 },
              { label: "Location", key: "location", span: 2 },
            ].map(({ label, key, span }) => (
              <div key={key} className={`flex flex-col gap-1 ${span === 2 ? "col-span-2" : ""}`}>
                <label className="text-[10px] text-muted uppercase tracking-wider">{label}</label>
                <input value={(form as any)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="input-dark text-sm px-3 py-2 rounded-lg" />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Start Date</label>
              <input type="date" value={form.start_date}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">End Date</label>
              <input type="date" value={form.end_date ?? ""}
                onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Status</label>
              <select value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                className="input-dark text-sm px-3 py-2 rounded-lg">
                {["planning","active","on_hold","completed","cancelled"].map(s => (
                  <option key={s} value={s}>{s.replace("_"," ")}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Total Budget</label>
              <input type="number" min="0" value={form.total_budget}
                onChange={e => setForm(p => ({ ...p, total_budget: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Description</label>
              <textarea value={form.description ?? ""}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={2} className="input-dark text-sm px-3 py-2 rounded-lg resize-none" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <Field label="Name"         value={project.name} />
            <Field label="Location"     value={project.location} />
            <Field label="Status"       value={<Badge label={project.status} />} />
            <Field label="Start Date"   value={project.start_date} />
            <Field label="End Date"     value={project.end_date ?? "—"} />
            <Field label="Total Budget" value={formatCurrency(Number(project.total_budget))} />
            <Field label="Actual Cost"  value={formatCurrency(Number(project.actual_cost ?? 0))} />
            <Field label="Progress"     value={`${(project.progress_percentage ?? 0).toFixed(1)}%`} />
            {project.description && (
              <div className="col-span-3 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted uppercase tracking-wider">Description</span>
                <span className="text-sm text-primary">{project.description}</span>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Progress bar */}
      <SectionCard title="Overall Progress">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>Completion</span>
            <span>{(project.progress_percentage ?? 0).toFixed(1)}%</span>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${project.progress_percentage ?? 0}%`,
                background: "linear-gradient(90deg,#3b82f6,#6366f1)",
              }} />
          </div>
          <div className="flex justify-between text-xs text-muted pt-1">
            <span>Budget used: {
              project.total_budget && Number(project.total_budget) > 0
                ? `${((Number(project.actual_cost ?? 0) / Number(project.total_budget)) * 100).toFixed(1)}%`
                : "N/A"
            }</span>
            <span>Remaining: {formatCurrency(Number(project.total_budget) - Number(project.actual_cost ?? 0))}</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Planning Tab ──────────────────────────────────────────────────────────────

function PlanningTab({ projectId }: { projectId: number }) {
  const [phases, setPhases]   = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", status: "pending", order_index: "0", description: "" });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const load = () => {
    constructionApi.listPhases(projectId)
      .then(r => setPhases(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!form.name || !form.start_date) { setError("Name and start date required"); return; }
    setSaving(true); setError("");
    try {
      await constructionApi.createPhase({
        project_id: projectId, ...form,
        order_index: Number(form.order_index),
        end_date: form.end_date || null,
        description: form.description || null,
      });
      setShowForm(false);
      setForm({ name: "", start_date: "", end_date: "", status: "pending", order_index: "0", description: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete phase?")) return;
    await constructionApi.deletePhase(id);
    load();
  };

  const handleStatusChange = async (phase: Phase, status: string) => {
    await constructionApi.updatePhase(phase.id, { status });
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(s => !s)}
          className="text-xs px-4 py-2 rounded-xl text-white"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          + Add Phase
        </button>
      </div>

      {showForm && (
        <SectionCard title="New Phase">
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Phase Name *", key: "name", span: 2 },
              { label: "Start Date *", key: "start_date", type: "date" },
              { label: "End Date",     key: "end_date",   type: "date" },
            ].map(({ label, key, type = "text", span }) => (
              <div key={key} className={`flex flex-col gap-1 ${span === 2 ? "col-span-2" : ""}`}>
                <label className="text-[10px] text-muted uppercase tracking-wider">{label}</label>
                <input type={type} value={(form as any)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="input-dark text-sm px-3 py-2 rounded-lg" />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg">
                {["pending","in_progress","completed"].map(s => (
                  <option key={s} value={s}>{s.replace("_"," ")}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Order</label>
              <input type="number" min="0" value={form.order_index}
                onChange={e => setForm(p => ({ ...p, order_index: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="text-xs text-muted hover:text-primary">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="text-xs px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
              {saving ? "Saving…" : "Create Phase"}
            </button>
          </div>
        </SectionCard>
      )}

      {phases.length === 0 && !showForm && (
        <p className="text-center text-muted text-sm py-10">No phases yet. Add the first phase.</p>
      )}

      <div className="space-y-3">
        {phases.map((ph, i) => (
          <div key={ph.id} className="card-dark rounded-xl px-5 py-4 flex items-center gap-4"
            style={{ border: "1px solid var(--border)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">{ph.name}</p>
              <p className="text-xs text-muted">{ph.start_date} → {ph.end_date ?? "TBD"}</p>
            </div>
            <Badge label={ph.status} />
            <select value={ph.status}
              onChange={e => handleStatusChange(ph, e.target.value)}
              className="input-dark text-xs px-2 py-1 rounded-lg">
              {["pending","in_progress","completed"].map(s => (
                <option key={s} value={s}>{s.replace("_"," ")}</option>
              ))}
            </select>
            <button onClick={() => handleDelete(ph.id)} className="text-red-400 hover:text-red-300 text-xs">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Budget Tab ────────────────────────────────────────────────────────────────

function BudgetTab({ projectId, totalBudget }: { projectId: number; totalBudget: number }) {
  const [budget, setBudget]   = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ material_cost: "0", labor_cost: "0", equipment_cost: "0", misc_cost: "0" });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const load = () => {
    constructionApi.getBudget(projectId)
      .then(r => {
        setBudget(r.data);
        setForm({
          material_cost:  r.data.material_cost,
          labor_cost:     r.data.labor_cost,
          equipment_cost: r.data.equipment_cost,
          misc_cost:      r.data.misc_cost,
        });
      })
      .catch(() => setBudget(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      await constructionApi.upsertBudget({
        project_id:     projectId,
        material_cost:  Number(form.material_cost),
        labor_cost:     Number(form.labor_cost),
        equipment_cost: Number(form.equipment_cost),
        misc_cost:      Number(form.misc_cost),
      });
      setEditing(false); load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Save failed");
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  const rows = [
    { label: "Material",  key: "material_cost",  value: budget?.material_cost },
    { label: "Labor",     key: "labor_cost",      value: budget?.labor_cost },
    { label: "Equipment", key: "equipment_cost",  value: budget?.equipment_cost },
    { label: "Misc",      key: "misc_cost",       value: budget?.misc_cost },
  ];

  return (
    <div className="space-y-5">
      <SectionCard title="Budget Breakdown"
        action={
          editing
            ? <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-xs text-muted hover:text-primary">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="text-xs px-3 py-1 rounded-lg text-white bg-blue-600 disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            : <button onClick={() => setEditing(true)} className="text-xs text-blue-400 hover:text-blue-300">
                {budget ? "Edit" : "Set Budget"}
              </button>
        }
      >
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            {rows.map(({ label, key }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[10px] text-muted uppercase tracking-wider">{label} Cost</label>
                <input type="number" min="0" value={(form as any)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="input-dark text-sm px-3 py-2 rounded-lg" />
              </div>
            ))}
          </div>
        ) : budget ? (
          <div className="space-y-3">
            {rows.map(({ label, value }) => {
              const pct = budget.total_cost && Number(budget.total_cost) > 0
                ? (Number(value) / Number(budget.total_cost)) * 100 : 0;
              return (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">{label}</span>
                    <span className="text-primary font-medium">{formatCurrency(Number(value))}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 flex justify-between text-sm font-semibold"
              style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-muted">Total Budgeted</span>
              <span className="text-primary">{formatCurrency(Number(budget.total_cost))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Project Budget</span>
              <span className="text-primary">{formatCurrency(totalBudget)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-4">No budget set yet. Click "Set Budget" to add one.</p>
        )}
      </SectionCard>
    </div>
  );
}

// ── Resources Tab ─────────────────────────────────────────────────────────────

function ResourcesTab({ projectId }: { projectId: number }) {
  const [contractors, setContractors]   = useState<ProjectContractor[]>([]);
  const [allContractors, setAll]        = useState<import("../../lib/constructionApi").Contractor[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showAssign, setShowAssign]     = useState(false);
  const [showCreate, setShowCreate]     = useState(false);
  const [assignForm, setAssignForm]     = useState({ contractor_id: "", role: "", contract_value: "" });
  const [createForm, setCreateForm]     = useState({ name: "", phone: "", email: "", company: "", contract_type: "fixed", rate: "", specialization: "" });
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

  const load = () => {
    Promise.all([
      constructionApi.projectContractors(projectId),
      constructionApi.listContractors(),
    ]).then(([a, b]) => { setContractors(a.data); setAll(b.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const handleAssign = async () => {
    if (!assignForm.contractor_id) { setError("Select a contractor"); return; }
    setSaving(true); setError("");
    try {
      await constructionApi.assignContractor({
        project_id:     projectId,
        contractor_id:  Number(assignForm.contractor_id),
        role:           assignForm.role || null,
        contract_value: assignForm.contract_value ? Number(assignForm.contract_value) : null,
      });
      setShowAssign(false);
      setAssignForm({ contractor_id: "", role: "", contract_value: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed");
    } finally { setSaving(false); }
  };

  const handleCreate = async () => {
    if (!createForm.name) { setError("Name required"); return; }
    setSaving(true); setError("");
    try {
      await constructionApi.createContractor({
        ...createForm, rate: Number(createForm.rate) || 0,
        phone: createForm.phone || null, email: createForm.email || null,
        company: createForm.company || null, specialization: createForm.specialization || null,
      });
      setShowCreate(false);
      setCreateForm({ name: "", phone: "", email: "", company: "", contract_type: "fixed", rate: "", specialization: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed");
    } finally { setSaving(false); }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remove contractor from project?")) return;
    await constructionApi.removeAssignment(id);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-end">
        <button onClick={() => { setShowCreate(s => !s); setShowAssign(false); }}
          className="text-xs px-4 py-2 rounded-xl border text-muted hover:text-primary"
          style={{ border: "1px solid var(--border)" }}>
          + New Contractor
        </button>
        <button onClick={() => { setShowAssign(s => !s); setShowCreate(false); }}
          className="text-xs px-4 py-2 rounded-xl text-white"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          + Assign Contractor
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {showCreate && (
        <SectionCard title="Create Contractor">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Name *",         key: "name",           span: 2 },
              { label: "Phone",          key: "phone" },
              { label: "Email",          key: "email" },
              { label: "Company",        key: "company" },
              { label: "Specialization", key: "specialization" },
            ].map(({ label, key, span }) => (
              <div key={key} className={`flex flex-col gap-1 ${span === 2 ? "col-span-2" : ""}`}>
                <label className="text-[10px] text-muted uppercase tracking-wider">{label}</label>
                <input value={(createForm as any)[key]}
                  onChange={e => setCreateForm(p => ({ ...p, [key]: e.target.value }))}
                  className="input-dark text-sm px-3 py-2 rounded-lg" />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Contract Type</label>
              <select value={createForm.contract_type}
                onChange={e => setCreateForm(p => ({ ...p, contract_type: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg">
                {["fixed","hourly","per_unit","lump_sum"].map(t => (
                  <option key={t} value={t}>{t.replace("_"," ")}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Rate</label>
              <input type="number" min="0" value={createForm.rate}
                onChange={e => setCreateForm(p => ({ ...p, rate: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="text-xs text-muted hover:text-primary">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="text-xs px-4 py-2 rounded-lg text-white bg-blue-600 disabled:opacity-50">
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </SectionCard>
      )}

      {showAssign && (
        <SectionCard title="Assign Contractor">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Contractor *</label>
              <select value={assignForm.contractor_id}
                onChange={e => setAssignForm(p => ({ ...p, contractor_id: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg">
                <option value="">Select contractor…</option>
                {allContractors.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.contract_type}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Role</label>
              <input value={assignForm.role}
                onChange={e => setAssignForm(p => ({ ...p, role: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" placeholder="e.g. Civil Engineer" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Contract Value</label>
              <input type="number" min="0" value={assignForm.contract_value}
                onChange={e => setAssignForm(p => ({ ...p, contract_value: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAssign(false)} className="text-xs text-muted hover:text-primary">Cancel</button>
            <button onClick={handleAssign} disabled={saving}
              className="text-xs px-4 py-2 rounded-lg text-white bg-blue-600 disabled:opacity-50">
              {saving ? "Assigning…" : "Assign"}
            </button>
          </div>
        </SectionCard>
      )}

      {contractors.length === 0 ? (
        <p className="text-center text-muted text-sm py-10">No contractors assigned yet.</p>
      ) : (
        (() => {
          const contractorCols: TableColumn<ProjectContractor>[] = [
            { key: 'contractor', label: 'Contractor', render: (_, row) => <span className="font-medium text-primary">{row.contractor.name}</span> },
            { key: 'company', label: 'Company', render: (_, row) => <span className="text-muted">{row.contractor.company ?? "—"}</span> },
            { key: 'type', label: 'Type', render: (_, row) => <span className="text-muted">{row.contractor.contract_type}</span> },
            { key: 'rate', label: 'Rate', render: (_, row) => <span className="text-primary">{formatCurrency(Number(row.contractor.rate))}</span> },
            { key: 'role', label: 'Role', render: (v) => <span className="text-muted">{v ?? "—"}</span> },
            { key: 'contract_value', label: 'Contract Value', render: (v) => <span className="text-primary">{v ? formatCurrency(Number(v)) : "—"}</span> },
            { key: 'status', label: 'Status', render: (_, row) => <Badge label={row.status} /> },
          ];
          return (
            <DataTable
              data={contractors}
              columns={contractorCols}
              searchable={false}
              hoverable
              rowActions={[
                {
                  key: 'remove',
                  label: 'Remove',
                  variant: 'danger',
                  onClick: (row) => handleRemove(row.id),
                },
              ]}
            />
          );
        })()
      )}
    </div>
  );
}

// ── Procurement Tab ───────────────────────────────────────────────────────────

const PROC_STATUS_FLOW: Record<string, string[]> = {
  requested: ["approved", "cancelled"],
  approved:  ["ordered", "cancelled"],
  ordered:   ["received", "cancelled"],
  received:  [],
  cancelled: [],
};

function ProcurementTab({ projectId }: { projectId: number }) {
  const [items, setItems]     = useState<Procurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ item_name: "", quantity: "1", unit: "", unit_cost: "", vendor: "", description: "", notes: "" });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const load = () => {
    constructionApi.listProcurement(projectId)
      .then(r => setItems(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!form.item_name || !form.unit_cost) { setError("Item name and unit cost required"); return; }
    setSaving(true); setError("");
    try {
      await constructionApi.createProcurement({
        project_id: projectId,
        item_name:  form.item_name,
        quantity:   Number(form.quantity),
        unit:       form.unit || null,
        unit_cost:  Number(form.unit_cost),
        vendor:     form.vendor || null,
        description: form.description || null,
        notes:      form.notes || null,
      });
      setShowForm(false);
      setForm({ item_name: "", quantity: "1", unit: "", unit_cost: "", vendor: "", description: "", notes: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed");
    } finally { setSaving(false); }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    await constructionApi.updateProcurementStatus(id, status);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete procurement item?")) return;
    await constructionApi.deleteProcurement(id);
    load();
  };

  if (loading) return <Spinner />;

  const total = items.reduce((s, i) => s + Number(i.cost), 0);
  const received = items.filter(i => i.status === "received").reduce((s, i) => s + Number(i.cost), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Items",    value: String(items.length) },
          { label: "Total Cost",     value: formatCurrency(total) },
          { label: "Received Value", value: formatCurrency(received) },
        ].map(({ label, value }) => (
          <div key={label} className="card-dark rounded-xl px-4 py-3" style={{ border: "1px solid var(--border)" }}>
            <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
            <p className="text-base font-semibold text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowForm(s => !s)}
          className="text-xs px-4 py-2 rounded-xl text-white"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          + Request Item
        </button>
      </div>

      {showForm && (
        <SectionCard title="New Procurement Request">
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Item Name *", key: "item_name", span: 2 },
              { label: "Vendor",      key: "vendor" },
              { label: "Unit",        key: "unit" },
              { label: "Quantity",    key: "quantity",  type: "number" },
              { label: "Unit Cost *", key: "unit_cost", type: "number" },
            ].map(({ label, key, type = "text", span }) => (
              <div key={key} className={`flex flex-col gap-1 ${span === 2 ? "col-span-2" : ""}`}>
                <label className="text-[10px] text-muted uppercase tracking-wider">{label}</label>
                <input type={type} min={type === "number" ? "0" : undefined}
                  value={(form as any)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="input-dark text-sm px-3 py-2 rounded-lg" />
              </div>
            ))}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} className="input-dark text-sm px-3 py-2 rounded-lg resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="text-xs text-muted hover:text-primary">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="text-xs px-4 py-2 rounded-lg text-white bg-blue-600 disabled:opacity-50">
              {saving ? "Saving…" : "Submit Request"}
            </button>
          </div>
        </SectionCard>
      )}

      <DataTable
        data={items}
        columns={[
          { key: 'item_name', label: 'Item', render: (v) => <span className="font-medium text-primary">{v}</span> },
          { key: 'vendor', label: 'Vendor', render: (v) => <span className="text-muted">{v ?? "—"}</span> },
          { key: 'quantity', label: 'Qty', render: (_, row) => <span className="text-muted">{row.quantity} {row.unit ?? ""}</span> },
          { key: 'unit_cost', label: 'Unit Cost', render: (v) => <span className="text-primary">{formatCurrency(Number(v))}</span> },
          { key: 'cost', label: 'Total', render: (v) => <span className="text-primary font-medium">{formatCurrency(Number(v))}</span> },
          { key: 'status', label: 'Status', render: (_, row) => <Badge label={row.status} /> },
        ]}
        searchable={false}
        hoverable
        emptyTitle="No procurement items yet"
        rowActions={[
          ...Object.entries(PROC_STATUS_FLOW).flatMap(([status, nextStatuses]) =>
            nextStatuses.map(next => ({
              key: `status_${next}`,
              label: `→ ${next}`,
              onClick: (row: Procurement) => handleStatusUpdate(row.id, next),
              hidden: (row: Procurement) => row.status !== status,
            }))
          ),
          {
            key: 'delete',
            label: 'Delete',
            variant: 'danger' as const,
            onClick: (row: Procurement) => handleDelete(row.id),
            hidden: (row: Procurement) => !["requested","approved"].includes(row.status),
          },
        ]}
      />
    </div>
  );
}

// ── Execution Tab ─────────────────────────────────────────────────────────────

function ExecutionTab({ projectId }: { projectId: number }) {
  const [logs, setLogs]       = useState<DailyProgress[]>([]);
  const [phases, setPhases]   = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    work_done: "", progress_percentage: "", workers_count: "",
    weather: "", issues: "", phase_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const load = () => {
    Promise.all([
      constructionApi.listProgress(projectId),
      constructionApi.listPhases(projectId),
    ]).then(([p, ph]) => { setLogs(p.data); setPhases(ph.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!form.work_done || !form.progress_percentage) {
      setError("Work done and progress % required"); return;
    }
    const pct = Number(form.progress_percentage);
    if (pct < 0 || pct > 100) { setError("Progress must be 0–100"); return; }
    setSaving(true); setError("");
    try {
      await constructionApi.logProgress({
        project_id:          projectId,
        date:                form.date,
        work_done:           form.work_done,
        progress_percentage: pct,
        workers_count:       form.workers_count ? Number(form.workers_count) : null,
        weather:             form.weather || null,
        issues:              form.issues || null,
        phase_id:            form.phase_id ? Number(form.phase_id) : null,
      });
      setShowForm(false);
      setForm({ date: new Date().toISOString().split("T")[0], work_done: "", progress_percentage: "", workers_count: "", weather: "", issues: "", phase_id: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this progress log?")) return;
    await constructionApi.deleteProgress(id);
    load();
  };

  if (loading) return <Spinner />;

  const latest = logs[0]?.progress_percentage ?? 0;

  return (
    <div className="space-y-4">
      <div className="card-dark rounded-xl px-5 py-4 space-y-2" style={{ border: "1px solid var(--border)" }}>
        <div className="flex justify-between text-xs">
          <span className="text-muted">Latest Progress</span>
          <span className="text-primary font-semibold">{latest.toFixed(1)}%</span>
        </div>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${latest}%`, background: "linear-gradient(90deg,#10b981,#3b82f6)" }} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowForm(s => !s)}
          className="text-xs px-4 py-2 rounded-xl text-white"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          + Log Progress
        </button>
      </div>

      {showForm && (
        <SectionCard title="Daily Progress Log">
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Date *</label>
              <input type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Progress % *</label>
              <input type="number" min="0" max="100" value={form.progress_percentage}
                onChange={e => setForm(p => ({ ...p, progress_percentage: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Work Done *</label>
              <textarea value={form.work_done}
                onChange={e => setForm(p => ({ ...p, work_done: e.target.value }))}
                rows={2} className="input-dark text-sm px-3 py-2 rounded-lg resize-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Workers Count</label>
              <input type="number" min="0" value={form.workers_count}
                onChange={e => setForm(p => ({ ...p, workers_count: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Weather</label>
              <input value={form.weather}
                onChange={e => setForm(p => ({ ...p, weather: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" placeholder="Sunny, Rainy…" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Phase</label>
              <select value={form.phase_id}
                onChange={e => setForm(p => ({ ...p, phase_id: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg">
                <option value="">No phase</option>
                {phases.map(ph => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Issues / Notes</label>
              <textarea value={form.issues}
                onChange={e => setForm(p => ({ ...p, issues: e.target.value }))}
                rows={2} className="input-dark text-sm px-3 py-2 rounded-lg resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="text-xs text-muted hover:text-primary">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="text-xs px-4 py-2 rounded-lg text-white bg-blue-600 disabled:opacity-50">
              {saving ? "Saving…" : "Log Progress"}
            </button>
          </div>
        </SectionCard>
      )}

      <div className="space-y-3">
        {logs.length === 0 && <p className="text-center text-muted text-sm py-10">No progress logs yet.</p>}
        {logs.map(log => (
          <div key={log.id} className="card-dark rounded-xl px-5 py-4"
            style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-semibold text-primary">{log.date}</span>
                  <span className="text-xs text-blue-400 font-medium">{log.progress_percentage.toFixed(1)}%</span>
                  {log.weather && <span className="text-xs text-muted">{log.weather}</span>}
                  {log.workers_count != null && (
                    <span className="text-xs text-muted">{log.workers_count} workers</span>
                  )}
                </div>
                <p className="text-sm text-primary">{log.work_done}</p>
                {log.issues && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> {log.issues}
                  </p>
                )}
              </div>
              <button onClick={() => handleDelete(log.id)} className="text-red-400 hover:text-red-300 text-xs shrink-0">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Finance Tab ───────────────────────────────────────────────────────────────

function FinanceTab({ projectId }: { projectId: number }) {
  const [expenses, setExpenses] = useState<ConstructionExpense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: "", expense_type: "material", description: "",
    date: new Date().toISOString().split("T")[0],
    reference_id: "", account_id: "", paid_from: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const load = () => {
    constructionApi.listExpenses(projectId)
      .then(r => setExpenses(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!form.amount || !form.description) { setError("Amount and description required"); return; }
    setSaving(true); setError("");
    try {
      await constructionApi.addExpense({
        project_id:   projectId,
        amount:       Number(form.amount),
        expense_type: form.expense_type,
        description:  form.description,
        date:         form.date,
        reference_id: form.reference_id || null,
        account_id:   form.account_id ? Number(form.account_id) : null,
        paid_from:    form.paid_from || null,
      });
      setShowForm(false);
      setForm({ amount: "", expense_type: "material", description: "", date: new Date().toISOString().split("T")[0], reference_id: "", account_id: "", paid_from: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed");
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byType: Record<string, number> = {};
  expenses.forEach(e => { byType[e.expense_type] = (byType[e.expense_type] ?? 0) + Number(e.amount); });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(byType).map(([type, amt]) => (
          <div key={type} className="card-dark rounded-xl px-4 py-3" style={{ border: "1px solid var(--border)" }}>
            <p className="text-[10px] text-muted uppercase tracking-wider">{type}</p>
            <p className="text-sm font-semibold text-primary">{formatCurrency(amt)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Total Spent: <span className="text-primary font-semibold">{formatCurrency(total)}</span></p>
        <button onClick={() => setShowForm(s => !s)}
          className="text-xs px-4 py-2 rounded-xl text-white"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          + Add Expense
        </button>
      </div>

      {showForm && (
        <SectionCard title="Record Expense">
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Amount *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Type</label>
              <select value={form.expense_type}
                onChange={e => setForm(p => ({ ...p, expense_type: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg">
                {["material","labor","equipment","procurement","misc"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Date</label>
              <input type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Reference</label>
              <input value={form.reference_id}
                onChange={e => setForm(p => ({ ...p, reference_id: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" placeholder="Invoice #, PO #…" />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Description *</label>
              <input value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Finance Account ID (optional)</label>
              <input type="number" value={form.account_id}
                onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg" placeholder="Links to COA" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted uppercase tracking-wider">Paid From (if linking)</label>
              <select value={form.paid_from}
                onChange={e => setForm(p => ({ ...p, paid_from: e.target.value }))}
                className="input-dark text-sm px-3 py-2 rounded-lg">
                <option value="">— not linked —</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="text-xs text-muted hover:text-primary">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="text-xs px-4 py-2 rounded-lg text-white bg-blue-600 disabled:opacity-50">
              {saving ? "Saving…" : "Record Expense"}
            </button>
          </div>
        </SectionCard>
      )}

      <DataTable
        data={expenses}
        columns={[
          { key: 'date', label: 'Date', render: (v) => <span className="text-muted">{v}</span> },
          { key: 'expense_type', label: 'Type', render: (_, row) => <Badge label={row.expense_type} /> },
          { key: 'description', label: 'Description', render: (v) => <span className="text-primary">{v}</span> },
          { key: 'amount', label: 'Amount', render: (v) => <span className="text-primary font-medium">{formatCurrency(Number(v))}</span> },
          { key: 'reference_id', label: 'Reference', render: (v) => <span className="text-muted">{v ?? "—"}</span> },
          { key: 'expense_id', label: 'Finance Linked', render: (_, row) => (
            row.expense_id
              ? <span className="text-emerald-400 text-[10px]">✓ Linked #{row.expense_id}</span>
              : <span className="text-muted text-[10px]">—</span>
          )},
        ]}
        searchable={false}
        hoverable
        emptyTitle="No expenses recorded"
      />
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

function DocumentsTab({ projectId }: { projectId: number }) {
  const [docs, setDocs]       = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("other");
  const [error, setError]     = useState("");

  const load = () => {
    constructionApi.listDocuments(projectId)
      .then(r => setDocs(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError("");
    try {
      await constructionApi.uploadDocument(projectId, file, docType);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete document?")) return;
    await constructionApi.deleteDocument(id);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={docType} onChange={e => setDocType(e.target.value)}
          className="input-dark text-sm px-3 py-2 rounded-xl">
          {["blueprint","contract","permit","report","photo","other"].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          {uploading ? "Uploading…" : "+ Upload Document"}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {docs.length === 0 ? (
        <p className="text-center text-muted text-sm py-10">No documents uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map(doc => (
            <div key={doc.id} className="card-dark rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ border: "1px solid var(--border)" }}>
              <FileText size={20} className="text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">{doc.name}</p>
                <p className="text-[10px] text-muted">
                  {doc.doc_type} · {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : "—"} · {doc.created_at.split("T")[0]}
                </p>
              </div>
              <a href={doc.file_url} target="_blank" rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 shrink-0">View</a>
              <button onClick={() => handleDelete(doc.id)} className="text-red-400 hover:text-red-300 text-xs shrink-0">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────

function ReportsTab({ projectId }: { projectId: number }) {
  const [report, setReport]   = useState<ProjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    constructionApi.getReport(projectId)
      .then(r => setReport(r.data))
      .catch(() => setError("Failed to load report"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <Spinner />;
  if (error)   return <p className="text-red-400 text-sm">{error}</p>;
  if (!report) return null;

  const bva = report.budget_vs_actual;

  const budgetRows = [
    { label: "Material",  budgeted: bva.budgeted_material,  actual: bva.actual_material },
    { label: "Labor",     budgeted: bva.budgeted_labor,     actual: bva.actual_labor },
    { label: "Equipment", budgeted: bva.budgeted_equipment, actual: bva.actual_equipment },
    { label: "Misc",      budgeted: bva.budgeted_misc,      actual: bva.actual_misc },
  ];

  return (
    <div className="space-y-5">
      {/* Budget vs Actual */}
      <SectionCard title="Budget vs Actual">
        <DataTable
          data={budgetRows}
          columns={[
            { key: 'label', label: 'Category', render: (v) => <span className="font-medium text-primary">{v}</span> },
            { key: 'budgeted', label: 'Budgeted', render: (v) => <span className="text-primary">{formatCurrency(Number(v))}</span> },
            { key: 'actual', label: 'Actual', render: (v) => <span className="text-primary">{formatCurrency(Number(v))}</span> },
            {
              key: 'variance', label: 'Variance', render: (_, row) => {
                const variance = Number(row.budgeted) - Number(row.actual);
                const over = variance < 0;
                return <span className={`font-medium ${over ? "text-red-400" : "text-emerald-400"}`}>{over ? "-" : "+"}{formatCurrency(Math.abs(variance))}</span>;
              },
            },
            {
              key: 'status', label: 'Status', render: (_, row) => {
                const variance = Number(row.budgeted) - Number(row.actual);
                const over = variance < 0;
                return <Badge label={over ? "over budget" : "on track"} color={over ? "#ef4444" : "#10b981"} />;
              },
            },
          ]}
          searchable={false}
          hoverable
          customFooter={
            <div style={{ display: 'flex', padding: '10px 16px', borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
              <div style={{ flex: 1 }}>Total</div>
              <div style={{ flex: 1, textAlign: 'left' }}>{formatCurrency(Number(bva.total_budget))}</div>
              <div style={{ flex: 1, textAlign: 'left' }}>{formatCurrency(Number(bva.actual_total))}</div>
              <div style={{ flex: 1, textAlign: 'left', color: Number(bva.variance) < 0 ? '#f87171' : '#34d399' }}>
                {Number(bva.variance) < 0 ? "-" : "+"}{formatCurrency(Math.abs(Number(bva.variance)))}
              </div>
              <div style={{ flex: 1, textAlign: 'left', color: 'var(--text-muted)' }}>{bva.variance_pct.toFixed(1)}% remaining</div>
            </div>
          }
        />
      </SectionCard>

      {/* Progress & Procurement */}
      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Progress Summary">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Latest Progress</span>
              <span className="text-primary font-semibold">{bva.latest_progress.toFixed(1)}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full"
                style={{ width: `${bva.latest_progress}%`, background: "linear-gradient(90deg,#10b981,#3b82f6)" }} />
            </div>
            <div className="space-y-1 pt-1">
              {report.phases.map(ph => (
                <div key={ph.id} className="flex justify-between text-xs">
                  <span className="text-muted">{ph.name}</span>
                  <Badge label={ph.status} />
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Procurement Summary">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Ordered</span>
              <span className="text-primary font-semibold">{formatCurrency(Number(bva.procurement_total))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Received</span>
              <span className="text-emerald-400 font-semibold">{formatCurrency(Number(bva.procurement_received))}</span>
            </div>
            <div className="pt-2 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
              {Object.entries(report.procurement_summary.by_status ?? {}).map(([status, count]) => (
                <div key={status} className="flex justify-between text-xs">
                  <Badge label={status} />
                  <span className="text-muted">{count as number} items</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Expense by type */}
      <SectionCard title="Expense Breakdown by Type">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(report.expense_by_type).map(([type, amt]) => (
            <div key={type} className="rounded-xl px-3 py-2 text-center"
              style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] text-muted uppercase tracking-wider">{type}</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(amt as number)}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Recent progress */}
      <SectionCard title="Recent Progress Logs">
        <div className="space-y-2">
          {report.recent_progress.length === 0 && (
            <p className="text-sm text-muted text-center py-4">No progress logs yet.</p>
          )}
          {report.recent_progress.map(log => (
            <div key={log.id} className="flex items-center gap-4 text-xs py-2"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-muted w-24 shrink-0">{log.date}</span>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500"
                    style={{ width: `${log.progress_percentage}%` }} />
                </div>
              </div>
              <span className="text-primary font-medium w-10 text-right">{log.progress_percentage.toFixed(0)}%</span>
              <span className="text-muted flex-1 truncate">{log.work_done}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Main ProjectDetails Page ──────────────────────────────────────────────────

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const loadProject = useCallback(() => {
    constructionApi.getProject(projectId)
      .then(r => setProject(r.data))
      .catch(() => setError("Project not found"))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadProject(); }, [loadProject]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !project) return (
    <div className="p-6 flex items-center gap-2 text-red-400">
      <AlertTriangle size={16} /> {error || "Project not found"}
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/construction/projects")}
          className="text-muted hover:text-primary transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-primary truncate">{project.name}</h1>
          <p className="text-xs text-muted">{project.location}</p>
        </div>
        <Badge label={project.status} />
      </div>

      {/* Tabs */}
      <ModuleTabs
        tabs={TABS.map((t) => ({ label: t.label, value: t.id, icon: t.icon }))}
        activeTab={activeTab}
        onChange={(v) => setActiveTab(v as TabId)}
        moduleColor={MODULE_COLORS.construction}
      />

      {/* Tab content */}
      <div>
        {activeTab === "overview"    && <OverviewTab    project={project} onRefresh={loadProject} />}
        {activeTab === "planning"    && <PlanningTab    projectId={projectId} />}
        {activeTab === "budget"      && <BudgetTab      projectId={projectId} totalBudget={Number(project.total_budget)} />}
        {activeTab === "resources"   && <ResourcesTab   projectId={projectId} />}
        {activeTab === "procurement" && <ProcurementTab projectId={projectId} />}
        {activeTab === "execution"   && <ExecutionTab   projectId={projectId} />}
        {activeTab === "finance"     && <FinanceTab     projectId={projectId} />}
        {activeTab === "documents"   && <DocumentsTab   projectId={projectId} />}
        {activeTab === "reports"     && <ReportsTab     projectId={projectId} />}
      </div>
    </div>
  );
}
