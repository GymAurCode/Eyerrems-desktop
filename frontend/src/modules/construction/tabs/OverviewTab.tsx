import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, Building2, Download } from "lucide-react";
import {
  constructionApi, Project, CompletionCheck,
} from "../../../lib/constructionApi";
import { formatCurrency } from "../../../lib/currency";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const STATUS_COLOR: Record<string, string> = {
  planning: "#6366f1", active: "#10b981", on_hold: "#f59e0b",
  completed: "#3b82f6", cancelled: "#ef4444",
  pending: "#94a3b8", in_progress: "#f59e0b", draft: "#94a3b8",
  submitted: "#6366f1", approved: "#10b981", passed: "#10b981",
  failed: "#ef4444", delayed: "#ef4444", open: "#f59e0b",
  resolved: "#3b82f6", closed: "#22c55e",
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      <span className="text-sm text-primary">{value ?? "—"}</span>
    </div>
  );
}

export default function OverviewTab({ project, onRefresh }: { project: Project; onRefresh: () => void }) {
  const [completion, setCompletion] = useState<CompletionCheck | null>(null);
  const [showConvert, setShowConvert] = useState(false);
  const [convertForm, setConvertForm] = useState({
    property_name: "", num_buildings: "1", floors_per_building: "1",
    units_per_floor: "1", price_per_unit: "", building_prefix: "Building",
    unit_prefix: "",
  });
  const [converting, setConverting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    constructionApi.checkCompletion(project.id).then(setCompletion).catch(() => {});
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [project.id]);

  const handleConvert = async () => {
    setConverting(true);
    try {
      await constructionApi.convertToProperty(project.id, {
        property_name: convertForm.property_name || undefined,
        num_buildings: Number(convertForm.num_buildings),
        floors_per_building: Number(convertForm.floors_per_building),
        units_per_floor: Number(convertForm.units_per_floor),
        price_per_unit: convertForm.price_per_unit ? Number(convertForm.price_per_unit) : undefined,
      });
      setShowConvert(false);
      onRefresh();
    } catch (e: any) { alert(e?.response?.data?.detail ?? "Conversion failed"); }
    finally { setConverting(false); }
  };

  const progressColor = (project.progress_percentage ?? 0) >= 80 ? "#10b981" :
    (project.progress_percentage ?? 0) >= 40 ? "#f59e0b" : "#3b82f6";

  const budgetUsedPct = project.total_budget > 0
    ? ((Number(project.actual_cost ?? 0) / Number(project.total_budget)) * 100) : 0;

  const budgetData = [
    { name: "Budget", value: Number(project.total_budget) || 1 },
    { name: "Actual", value: Number(project.actual_cost ?? 0) },
  ];

  const taskData = [
    { name: "Completed", value: project.completed_tasks ?? 0, color: "#10b981" },
    { name: "Delayed", value: project.delayed_tasks ?? 0, color: "#ef4444" },
    { name: "Pending", value: Math.max(0, (project.task_count ?? 0) - (project.completed_tasks ?? 0) - (project.delayed_tasks ?? 0)), color: "#6366f1" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {/* Project Info Header */}
      <SectionCard title="Project Details">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Name" value={project.name} />
          <Field label="Code" value={project.project_code ?? "—"} />
          <Field label="Location" value={project.location} />
          <Field label="Status" value={<Badge label={project.status} />} />
          <Field label="Current Phase" value={<Badge label={project.current_phase ?? "planning"} />} />
          <Field label="Start Date" value={project.start_date} />
          <Field label="Expected End" value={project.expected_end ?? "—"} />
          <Field label="Actual End" value={project.actual_end ?? "—"} />
        </div>
        {project.description && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs text-muted">{project.description}</p>
          </div>
        )}
      </SectionCard>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SectionCard title="Total Budget">
          <p className="text-2xl font-bold text-blue-400">{formatCurrency(Number(project.total_budget))}</p>
        </SectionCard>
        <SectionCard title="Total Expenses">
          <p className="text-2xl font-bold text-orange-400">{formatCurrency(Number(project.actual_cost ?? 0))}</p>
        </SectionCard>
        <SectionCard title="Remaining Budget">
          <p className="text-2xl font-bold text-emerald-400">
            {formatCurrency(Math.max(0, Number(project.total_budget) - Number(project.actual_cost ?? 0)))}
          </p>
        </SectionCard>
        <SectionCard title="Progress">
          <p className="text-2xl font-bold text-purple-400">{(project.progress_percentage ?? 0).toFixed(1)}%</p>
        </SectionCard>
      </div>

      {/* Task Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SectionCard title="Total Tasks"><p className="text-xl font-bold text-primary">{project.task_count ?? 0}</p></SectionCard>
        <SectionCard title="Completed">
          <p className="text-xl font-bold text-emerald-400">{project.completed_tasks ?? 0}</p>
        </SectionCard>
        <SectionCard title="Delayed">
          <p className="text-xl font-bold text-red-400">{project.delayed_tasks ?? 0}</p>
        </SectionCard>
        <SectionCard title="Phases"><p className="text-xl font-bold text-primary">{project.phase_count ?? 0}</p></SectionCard>
      </div>

      {/* Resource Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SectionCard title="Active Workers">
          <p className="text-lg font-bold text-indigo-400">{project.active_workers ?? 0}</p>
        </SectionCard>
        <SectionCard title="Active Equipment">
          <p className="text-lg font-bold text-cyan-400">{project.active_equipment ?? 0}</p>
        </SectionCard>
        <SectionCard title="Pending POs">
          <p className="text-lg font-bold text-amber-400">{project.purchase_orders_pending ?? 0}</p>
        </SectionCard>
        <SectionCard title="Outstanding Payments">
          <p className="text-lg font-bold text-rose-400">{project.outstanding_vendor_payments ?? 0}</p>
        </SectionCard>
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Overall Construction Progress">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted">
              <span>Completion</span>
              <span>{(project.progress_percentage ?? 0).toFixed(1)}%</span>
            </div>
            <div className="h-4 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${project.progress_percentage ?? 0}%`, background: `linear-gradient(90deg,${progressColor},${progressColor}dd)` }} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Budget Utilization">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted">
              <span>Budget Used</span>
              <span>{budgetUsedPct.toFixed(1)}%</span>
            </div>
            <div className="h-4 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, budgetUsedPct)}%`,
                  background: budgetUsedPct > 90 ? "linear-gradient(90deg,#ef4444,#dc2626)" :
                              budgetUsedPct > 70 ? "linear-gradient(90deg,#f59e0b,#d97706)" :
                              "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
            </div>
            <div className="flex justify-between text-xs text-muted pt-1">
              <span>Remaining: {formatCurrency(Math.max(0, Number(project.total_budget) - Number(project.actual_cost ?? 0)))}</span>
              <span>Total: {formatCurrency(Number(project.total_budget))}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Budget vs Actual">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {budgetData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#3b82f6" : "#f59e0b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Task Completion">
          <div className="h-48 flex items-center justify-center">
            {taskData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={taskData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={3} dataKey="value">
                    {taskData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted">No task data</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-1">
            {taskData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="text-[10px] text-muted">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Safety & Quality */}
      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Safety">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-xs text-muted">Issues:</span>
              <span className="text-sm font-semibold text-primary">{project.safety_incidents ?? 0}</span>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Quality">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-emerald-400" />
              <span className="text-xs text-muted">Issues:</span>
              <span className="text-sm font-semibold text-primary">{project.quality_issues ?? 0}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Completion Checklist */}
      {completion && (
        <SectionCard title="Project Completion Checklist"
          action={completion.all_checks_passed && project.status !== "completed" ? (
            <button onClick={() => setShowConvert(true)}
              className="text-xs px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1">
              <Building2 size={12} /> Convert to Property
            </button>
          ) : undefined}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Tasks Completed", done: completion.tasks_completed },
              { label: "Inspections Passed", done: completion.inspections_passed },
              { label: "No Pending Orders", done: completion.no_pending_orders },
              { label: "No Pending Payments", done: completion.no_pending_payments },
              { label: "No Quality Issues", done: completion.no_quality_issues },
              { label: "No Safety Issues", done: completion.no_safety_issues },
              { label: "Docs Uploaded", done: completion.docs_uploaded },
              { label: "Completion Approved", done: completion.completion_approved },
            ].map(({ label, done }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                {done ? (
                  <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={12} className="text-red-400 shrink-0" />
                )}
                <span className={done ? "text-emerald-400" : "text-muted"}>{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex justify-between text-xs text-muted">
              <span>Completion Progress</span>
              <span>{completion.passed_checks}/{completion.total_checks} checks passed</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-1">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(completion.passed_checks / Math.max(1, completion.total_checks)) * 100}%`,
                  background: completion.all_checks_passed ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,#f59e0b,#f97316)" }} />
            </div>
          </div>
        </SectionCard>
      )}

      {/* Convert to Property Dialog */}
      {showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowConvert(false)}>
          <div className="card-dark rounded-2xl p-6 w-full max-w-md"
            style={{ border: "1px solid var(--border)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Building2 size={16} className="text-emerald-400" />
                Convert to Property
              </h3>
              <button onClick={() => setShowConvert(false)} className="text-muted hover:text-primary">
                <XCircle size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Property Name", key: "property_name", placeholder: project.name },
                { label: "Buildings", key: "num_buildings", type: "number" },
                { label: "Floors per Building", key: "floors_per_building", type: "number" },
                { label: "Units per Floor", key: "units_per_floor", type: "number" },
                { label: "Price per Unit", key: "price_per_unit", type: "number", placeholder: "0" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted uppercase tracking-wider">{label}</label>
                  <input type={type ?? "text"} value={(convertForm as any)[key]}
                    onChange={e => setConvertForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="dialog-input" />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowConvert(false)}
                  className="px-4 py-2 text-sm text-muted hover:text-primary transition-colors">Cancel</button>
                <button onClick={handleConvert} disabled={converting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                  <Building2 size={14} /> {converting ? "Converting…" : "Convert"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
