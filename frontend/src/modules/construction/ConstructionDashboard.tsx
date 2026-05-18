import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HardHat, TrendingUp, DollarSign, CheckCircle,
  Plus, ArrowRight, AlertTriangle,
} from "lucide-react";
import { constructionApi, DashboardStats, Project } from "../../lib/constructionApi";
import { formatCurrency } from "../../lib/currency";
import { QuickRowActions, ActionsTh, ActionsCell, printRecord } from "../../components/actions";

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="card-dark flex items-center gap-4 px-5 py-4"
      style={{ border: "1px solid var(--border)" }}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
        <p className="text-lg font-semibold text-primary truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  planning:  "#6366f1",
  active:    "#10b981",
  on_hold:   "#f59e0b",
  completed: "#3b82f6",
  cancelled: "#ef4444",
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

const fmt = (n: number | null | undefined) =>
  n != null ? formatCurrency(n) : "—";

const fmtNum = (n: number | null | undefined) =>
  n != null ? String(n) : "—";

const fmtPct = (n: number | null | undefined) =>
  n != null ? `${n}%` : "—";

export default function ConstructionDashboard() {
  const navigate = useNavigate();
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    const loadStats = constructionApi.stats()
      .then(r => setStats(r.data))
      .catch(() => setStats(null));

    const loadProjects = constructionApi.listProjects()
      .then(r => setProjects(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError("Failed to load projects"));

    Promise.all([loadStats, loadProjects]).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-6 flex items-center gap-2 text-red-400">
      <AlertTriangle size={16} /> {error}
    </div>
  );

  const variancePct =
    stats && stats.total_budget > 0
      ? ((stats.budget_variance / stats.total_budget) * 100).toFixed(1)
      : "0";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">Construction</h1>
          <p className="text-xs text-muted mt-0.5">Project overview & tracking</p>
        </div>
        <button
          onClick={() => navigate("/construction/projects")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
        >
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Stats — always render, show "—" when data unavailable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Projects"
          value={fmtNum(stats?.total_projects)}
          icon={HardHat} color="bg-indigo-500"
        />
        <StatCard
          label="Active Projects"
          value={fmtNum(stats?.active_projects)}
          sub={stats ? `${stats.completed_projects} completed` : undefined}
          icon={TrendingUp} color="bg-emerald-500"
        />
        <StatCard
          label="Total Budget"
          value={fmt(stats?.total_budget)}
          sub={stats ? `Spent: ${fmt(stats.total_actual_cost)}` : undefined}
          icon={DollarSign} color="bg-blue-500"
        />
        <StatCard
          label="Avg Progress"
          value={fmtPct(stats?.avg_progress_pct)}
          sub={stats ? `Variance: ${variancePct}%` : undefined}
          icon={CheckCircle} color="bg-amber-500"
        />
      </div>

      {/* Projects table */}
      <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold text-primary">All Projects</p>
          <button onClick={() => navigate("/construction/projects")}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
            View all <ArrowRight size={12} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Project", "Location", "Status", "Budget", "Spent", "Progress"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-muted font-medium uppercase tracking-wider">
                    {h}
                  </th>
                ))}
                <ActionsTh className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No projects yet. Create your first one.
                  </td>
                </tr>
              )}
              {projects.map(p => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td className="px-4 py-3 font-medium text-primary">{p.name}</td>
                  <td className="px-4 py-3 text-muted">{p.location}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-primary">{formatCurrency(Number(p.total_budget))}</td>
                  <td className="px-4 py-3 text-primary">
                    {formatCurrency(Number(p.actual_cost ?? 0))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500"
                          style={{ width: `${p.progress_percentage ?? 0}%` }} />
                      </div>
                      <span className="text-muted w-8 text-right">
                        {(p.progress_percentage ?? 0).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <ActionsCell className="px-4 py-3">
                    <QuickRowActions
                      row={p}
                      compact
                      onView={(row) => navigate(`/construction/projects/${row.id}`)}
                      onPrint={(row) => printRecord(`Project ${row.name}`, [
                        { label: "Location", value: row.location ?? "—" },
                        { label: "Budget", value: formatCurrency(Number(row.total_budget)) },
                      ])}
                      hiddenActions={["edit", "delete"]}
                    />
                  </ActionsCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
