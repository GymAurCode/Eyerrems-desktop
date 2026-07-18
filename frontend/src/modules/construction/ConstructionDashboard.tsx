import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HardHat, TrendingUp, DollarSign, CheckCircle, AlertTriangle,
  Plus, ArrowRight, Clock, Users, Package, ShoppingCart, FileText,
  Shield, Building2, Activity, BarChart3, ListTodo, Truck, Wallet,
  GanttChart, Timer, Zap,
} from "lucide-react";
import { constructionApi, DashboardStats, Project } from "../../lib/constructionApi";
import { formatCurrency } from "../../lib/currency";
import DataTable from "../../components/data-table/DataTable";
import type { TableColumn } from "../../components/data-table/types";
import StatCard from "../../components/ui/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";

const STATUS_COLOR: Record<string, string> = {
  planning: "#6366f1", active: "#10b981", on_hold: "#f59e0b",
  completed: "#3b82f6", cancelled: "#ef4444",
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "#94a3b8";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${c}20`, color: c }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const fmt = (n: number | null | undefined) => n != null ? formatCurrency(n) : "—";
const fmtNum = (n: number | null | undefined) => n != null ? String(n) : "—";
const fmtPct = (n: number | null | undefined) => n != null ? `${Math.round(n)}%` : "—";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function ConstructionDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartData, setChartData] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    const loadStats = constructionApi.stats().then(setStats).catch(() => setStats(null));
    const loadProjects = constructionApi.listProjects().then(r => setProjects(r)).catch(() => {});
    const loadCharts = constructionApi.getDashboardCharts().then(setChartData).catch(() => setChartData(null));
    const loadActivity = constructionApi.getRecentActivity(10).then(setRecentActivity).catch(() => {});
    Promise.all([loadStats, loadProjects, loadCharts, loadActivity]).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const projectColumns: TableColumn<Project>[] = [
    { key: 'name', label: 'Project', render: (v, r) => (
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[r.status] ?? "#94a3b8" }} />
        <span className="font-medium text-primary">{v}</span>
        {r.project_code && <span className="text-[10px] text-muted ml-1">#{r.project_code}</span>}
      </div>
    )},
    { key: 'current_phase', label: 'Phase', render: (v) => (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-400">
        {v?.replace(/_/g, " ")}
      </span>
    )},
    { key: 'status', label: 'Status', render: (_, r) => <StatusBadge status={r.status} /> },
    { key: 'total_budget', label: 'Budget', render: (v) => <span className="text-primary font-mono text-xs">{formatCurrency(Number(v))}</span> },
    { key: 'actual_cost', label: 'Spent', render: (v) => <span className="text-primary font-mono text-xs">{formatCurrency(Number(v ?? 0))}</span> },
    { key: 'progress_percentage', label: 'Progress', render: (_, r) => (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden min-w-[60px]">
          <div className="h-full rounded-full transition-all" style={{
            width: `${r.progress_percentage ?? 0}%`,
            background: (r.progress_percentage ?? 0) >= 80 ? "linear-gradient(90deg,#10b981,#34d399)" :
                        (r.progress_percentage ?? 0) >= 40 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" :
                        "linear-gradient(90deg,#3b82f6,#6366f1)"
          }} />
        </div>
        <span className="text-muted font-mono text-xs w-8 text-right">{(r.progress_percentage ?? 0).toFixed(0)}%</span>
      </div>
    )},
  ];

  const stageChartData = [
    { name: "Planning", value: projects.filter(p => p.current_phase === "planning" || p.status === "planning").length, color: "#6366f1" },
    { name: "Active", value: projects.filter(p => p.status === "active" && p.current_phase !== "completion").length, color: "#10b981" },
    { name: "On Hold", value: projects.filter(p => p.status === "on_hold").length, color: "#f59e0b" },
    { name: "Completed", value: projects.filter(p => p.status === "completed").length, color: "#3b82f6" },
    { name: "Delayed", value: projects.filter(p => p.status === "active" && (p.delayed_tasks ?? 0) > 0).length, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const monthlySpendingData = chartData?.monthly_spending ?? [
    { month: "Jan", budget: 0, actual: 0 },
    { month: "Feb", budget: 0, actual: 0 },
    { month: "Mar", budget: 0, actual: 0 },
    { month: "Apr", budget: 0, actual: 0 },
    { month: "May", budget: 0, actual: 0 },
    { month: "Jun", budget: 0, actual: 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary flex items-center gap-2">
            <HardHat size={22} className="text-orange-400" />
            Construction Management
          </h1>
          <p className="text-xs text-muted mt-0.5">Enterprise ERP — Full Lifecycle Management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/construction/projects")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted hover:text-primary border border-white/10 hover:border-white/20 transition-all">
            <ListTodo size={13} /> All Projects
          </button>
          <button onClick={() => navigate("/construction/projects")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 px-4 py-2 rounded-xl">
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard label="Projects Running" value={fmtNum(stats?.active_projects)} icon={HardHat} iconBg="rgba(99,102,241,0.15)" iconColor="#6366f1" sub={`${stats?.total_projects ?? 0} total`} />
        <StatCard label="Completed" value={fmtNum(stats?.completed_projects)} icon={CheckCircle} iconBg="rgba(16,185,129,0.15)" iconColor="#10b981" />
        <StatCard label="Delayed" value={fmtNum(stats?.delayed_projects)} icon={AlertTriangle} iconBg="rgba(239,68,68,0.15)" iconColor="#ef4444" />
        <StatCard label="Budget Used" value={fmtPct(stats?.budget_used_pct)} icon={DollarSign} iconBg="rgba(59,130,246,0.15)" iconColor="#3b82f6" sub={stats ? `Rem: ${fmtPct(stats.budget_remaining_pct)}` : undefined} />
        <StatCard label="Avg Progress" value={fmtPct(stats?.avg_progress_pct)} icon={TrendingUp} iconBg="rgba(245,158,11,0.15)" iconColor="#f59e0b" />
        <StatCard label="Workers On Site" value={fmtNum(stats?.workers_on_site)} icon={Users} iconBg="rgba(139,92,246,0.15)" iconColor="#8b5cf6" />
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard label="Equipment Active" value={fmtNum(stats?.equipment_active)} icon={Truck} iconBg="rgba(6,182,212,0.15)" iconColor="#06b6d4" />
        <StatCard label="Pending POs" value={fmtNum(stats?.purchase_orders_pending)} icon={ShoppingCart} iconBg="rgba(236,72,153,0.15)" iconColor="#ec4899" />
        <StatCard label="Quality Failures" value={fmtNum(stats?.quality_failures)} icon={Shield} iconBg="rgba(239,68,68,0.15)" iconColor="#ef4444" />
        <StatCard label="Safety Incidents" value={fmtNum(stats?.safety_incidents)} icon={AlertTriangle} iconBg="rgba(245,158,11,0.15)" iconColor="#f59e0b" />
        <StatCard label="Material Consumed" value={fmtPct(stats?.material_consumption_pct)} icon={Package} iconBg="rgba(132,204,22,0.15)" iconColor="#84cc16" />
        <StatCard label="Task Completion" value={fmtPct(stats?.task_completion_pct)} icon={ListTodo} iconBg="rgba(99,102,241,0.15)" iconColor="#6366f1" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Budget vs Actual */}
        <div className="card-dark rounded-2xl p-4" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={14} className="text-blue-400" />
            <span className="text-xs font-semibold text-primary">Budget vs Actual Cost</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: "Material", budget: Number(stats?.total_budget ?? 0) * 0.3, actual: Number(stats?.total_expenses ?? 0) * 0.3 },
                { name: "Labor", budget: Number(stats?.total_budget ?? 0) * 0.2, actual: Number(stats?.total_expenses ?? 0) * 0.25 },
                { name: "Equipment", budget: Number(stats?.total_budget ?? 0) * 0.15, actual: Number(stats?.total_expenses ?? 0) * 0.12 },
                { name: "Contractor", budget: Number(stats?.total_budget ?? 0) * 0.2, actual: Number(stats?.total_expenses ?? 0) * 0.18 },
                { name: "Other", budget: Number(stats?.total_budget ?? 0) * 0.15, actual: Number(stats?.total_expenses ?? 0) * 0.15 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="budget" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Spending */}
        <div className="card-dark rounded-2xl p-4" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-emerald-400" />
            <span className="text-xs font-semibold text-primary">Monthly Spending</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySpendingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="budget" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                <Area type="monotone" dataKey="actual" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Stage Distribution */}
        <div className="card-dark rounded-2xl p-4" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-purple-400" />
            <span className="text-xs font-semibold text-primary">Project Stage Distribution</span>
          </div>
          <div className="h-48 flex items-center justify-center">
            {stageChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stageChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={3} dataKey="value">
                    {stageChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted">No project data</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-1">
            {stageChartData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="text-[10px] text-muted">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Construction Progress */}
        <div className="card-dark rounded-2xl p-4" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-primary">Construction Progress by Project</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projects.slice(0, 8).map(p => ({
                name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
                progress: p.progress_percentage ?? 0,
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#94a3b8" }} width={80} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="progress" radius={[0, 3, 3, 0]}>
                  {projects.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card-dark rounded-2xl p-4" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-cyan-400" />
            <span className="text-xs font-semibold text-primary">Recent Activity</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentActivity.length > 0 ? recentActivity.map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-primary truncate">{a.action ?? a.message ?? "—"}</p>
                  <p className="text-muted">
                    {a.user_name ?? "System"} · {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-muted text-center py-8">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Project List */}
      <DataTable
        data={projects}
        columns={projectColumns}
        title="All Construction Projects"
        searchable
        hoverable
        emptyTitle="No projects yet"
        emptyDescription="Create your first construction project to get started."
        onView={(row) => navigate(`/construction/projects/${row.id}`)}
        customToolbar={
          <button onClick={() => navigate("/construction/projects")}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
            View all <ArrowRight size={12} />
          </button>
        }
      />
    </div>
  );
}
