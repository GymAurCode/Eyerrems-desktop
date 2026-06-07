import { useCallback, useEffect, useState } from "react";
import {
  Calendar, Clock, FilterX, Search, ChevronLeft, ChevronRight,
  Eye, AlertCircle
} from "lucide-react";
import AppDialog from "../components/ui/AppDialog";
import { auditApi, type AuditLogEntry, type AuditLogsResponse, type AuditStats } from "../lib/auditApi";
import { DataTable } from "../components/data-table";

const MODULES = ["All Modules", "Property", "Tenant", "CRM", "HR", "Maintenance", "Finance", "User", "Settings", "Construction"];
const ACTIONS = ["All Actions", "CREATE", "UPDATE", "DELETE"];
const PERIODS = ["today", "week", "month", "year"] as const;

const MODULE_COLORS: Record<string, string> = {
  property:     "#3b82f6",
  tenant:       "#10b981",
  crm:          "#a855f7",
  hr:           "#f97316",
  maintenance:  "#eab308",
  finance:      "#10b981",
  user:         "#64748b",
  settings:     "#6b7280",
  construction: "#f59e0b",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "#10b981",
  UPDATE: "#eab308",
  DELETE: "#ef4444",
};

function ModuleBadge({ module }: { module: string }) {
  const color = MODULE_COLORS[module.toLowerCase()] ?? "#64748b";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {module}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? "#64748b";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {action}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="card-dark p-4 rounded-xl" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div>
          <p className="text-lg font-bold text-primary">{value}</p>
          <p className="text-xs text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function DiffSummary({ diff }: { diff: Record<string, { from: any; to: any }> | null }) {
  if (!diff) return <span className="text-muted">—</span>;
  const entries = Object.entries(diff).slice(0, 3);
  return (
    <div className="space-y-0.5">
      {entries.map(([key, val]) => {
        const from = val?.from ?? "—";
        const to = val?.to ?? "—";
        return (
          <div key={key} className="text-[10px] text-secondary">
            <span className="text-muted">{key}:</span>{" "}
            <span className="text-red-400 line-through">{typeof from === "object" ? JSON.stringify(from) : String(from)}</span>
            {" → "}
            <span className="text-emerald-400">{typeof to === "object" ? JSON.stringify(to) : String(to)}</span>
          </div>
        );
      })}
      {Object.keys(diff).length > 3 && (
        <span className="text-[10px] text-muted">+{Object.keys(diff).length - 3} more</span>
      )}
    </div>
  );
}

function FieldValueTable({ rows }: { rows: Record<string, any> }) {
  if (!rows || Object.keys(rows).length === 0) return <p className="text-xs text-muted py-4 text-center">No data</p>;
  return (
    <DataTable
      data={Object.entries(rows).map(([k, v]) => ({ key: k, value: v }))}
      columns={[
        { key: "key", label: "Field", render: (val) => <span className="font-medium text-secondary font-mono">{val}</span> },
        { key: "value", label: "Value", render: (val) => <span className="text-primary">{val ?? "—"}</span> },
      ]}
      variant="bordered"
      searchable={false}
      emptyTitle="No data"
    />
  );
}

function DiffTable({ diff }: { diff: Record<string, { from: any; to: any }> }) {
  const data = Object.entries(diff).map(([k, v]) => ({ field: k, from: v?.from, to: v?.to }));
  return (
    <DataTable
      data={data}
      columns={[
        { key: "field", label: "Field", render: (val) => <span className="font-medium text-secondary font-mono">{val}</span> },
        { key: "from", label: "Before", render: (val) => <span className="text-red-400 line-through">{val ?? "—"}</span> },
        { key: "to", label: "After", render: (val) => <span className="text-emerald-400">{val ?? "—"}</span> },
      ]}
      variant="bordered"
      searchable={false}
      emptyTitle="No changes"
    />
  );
}

function ViewDetailsModal({ log, open, onClose }: { log: AuditLogEntry | null; open: boolean; onClose: () => void }) {
  if (!log) return null;
  return (
    <AppDialog isOpen={open} title="Activity Details" onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-muted mb-0.5">Record</p>
            <p className="font-medium text-primary">{log.record_label ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted mb-0.5">Module</p>
            <ModuleBadge module={log.module} />
          </div>
          <div>
            <p className="text-muted mb-0.5">Action</p>
            <ActionBadge action={log.action} />
          </div>
          <div>
            <p className="text-muted mb-0.5">Record ID</p>
            <p className="font-mono text-primary text-xs">{log.record_id ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted mb-0.5">Timestamp</p>
            <p className="text-primary">{formatDate(log.created_at)}</p>
          </div>
          <div>
            <p className="text-muted mb-0.5">Changed By</p>
            <div className="flex items-center gap-2">
              <span className="text-primary">{log.changed_by}</span>
              {log.changed_by_role && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                  {log.changed_by_role}
                </span>
              )}
            </div>
          </div>
          {log.ip_address && (
            <div>
              <p className="text-muted mb-0.5">IP Address</p>
              <p className="font-mono text-primary text-xs">{log.ip_address}</p>
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }} className="pt-4">
          <p className="text-xs font-semibold text-primary mb-3 uppercase tracking-wider">Changes</p>
          {log.action === "UPDATE" && log.diff && <DiffTable diff={log.diff} />}
          {log.action === "CREATE" && log.new_data && <FieldValueTable rows={log.new_data} />}
          {log.action === "DELETE" && log.old_data && <FieldValueTable rows={log.old_data} />}
          {log.action === "UPDATE" && !log.diff && (
            <p className="text-xs text-muted py-4 text-center">No diff data available</p>
          )}
          {log.action === "CREATE" && !log.new_data && (
            <p className="text-xs text-muted py-4 text-center">No creation data available</p>
          )}
          {log.action === "DELETE" && !log.old_data && (
            <p className="text-xs text-muted py-4 text-center">No deletion data available</p>
          )}
        </div>
      </div>
    </AppDialog>
  );
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 50;

  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("");

  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, per_page: perPage };
      if (moduleFilter && moduleFilter !== "All Modules") params.module = moduleFilter;
      if (actionFilter && actionFilter !== "All Actions") params.action = actionFilter;
      if (userFilter) params.changed_by = userFilter;
      if (periodFilter) params.period = periodFilter;

      const res: AuditLogsResponse = await auditApi.getLogs(params);
      setLogs(res.logs);
      setTotal(res.total);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, moduleFilter, actionFilter, userFilter, periodFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await auditApi.getStats();
      setStats(data);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const resetFilters = () => {
    setModuleFilter("");
    setActionFilter("");
    setUserFilter("");
    setPeriodFilter("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-primary">Activity History</h1>
        <p className="text-xs text-muted mt-0.5">Track all changes made across the system</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Today" value={stats.total_today} icon={Calendar} color="#3b82f6" />
          <StatCard label="This Week" value={stats.total_week} icon={Calendar} color="#10b981" />
          <StatCard label="This Month" value={stats.total_month} icon={Calendar} color="#a855f7" />
          <StatCard label="Total All" value={stats.total_all} icon={Clock} color="#f59e0b" />
        </div>
      )}

      <div className="card-dark p-4 space-y-3" style={{ border: "1px solid var(--border)" }}>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-medium text-muted mb-1 uppercase tracking-wider">Module</label>
            <select value={moduleFilter || "All Modules"} onChange={(e) => { setModuleFilter(e.target.value === "All Modules" ? "" : e.target.value); setPage(1); }}
              className="input-dark w-full px-3 py-1.5 text-xs rounded-lg">
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-medium text-muted mb-1 uppercase tracking-wider">Action</label>
            <select value={actionFilter || "All Actions"} onChange={(e) => { setActionFilter(e.target.value === "All Actions" ? "" : e.target.value); setPage(1); }}
              className="input-dark w-full px-3 py-1.5 text-xs rounded-lg">
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-medium text-muted mb-1 uppercase tracking-wider">User</label>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input type="text" placeholder="Email or name..." value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
                className="input-dark w-full pl-7 pr-3 py-1.5 text-xs rounded-lg" />
            </div>
          </div>
          <div className="flex items-end gap-1">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => { setPeriodFilter(periodFilter === p ? "" : p); setPage(1); }}
                className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-all ${
                  periodFilter === p ? "text-white" : "text-secondary hover:text-primary"
                }`}
                style={periodFilter === p ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)" } : { border: "1px solid var(--border)" }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={resetFilters}
            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium rounded-lg text-muted hover:text-primary transition-colors"
            style={{ border: "1px solid var(--border)" }}>
            <FilterX size={11} /> Reset
          </button>
        </div>
      </div>

      <DataTable
        data={logs}
        loading={loading}
        columns={[
          { key: "created_at", label: "Date & Time", render: (val) => <span className="text-secondary whitespace-nowrap text-[11px]">{formatDate(val)}</span> },
          { key: "module", label: "Module", render: (val) => <ModuleBadge module={val} /> },
          { key: "action", label: "Action", render: (val) => <ActionBadge action={val} /> },
          { key: "record_label", label: "Record", render: (val) => <span className="text-primary max-w-[160px] truncate font-medium">{val ?? "—"}</span> },
          { key: "changed_by", label: "Changed By", render: (val, row) => (
            <div className="flex items-center gap-1.5">
              <span className="text-secondary text-[11px]">{val}</span>
              {row.changed_by_role && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                  {row.changed_by_role}
                </span>
              )}
            </div>
          )},
          { key: "diff", label: "Changes", render: (val) => <div className="max-w-[220px]"><DiffSummary diff={val} /></div> },
        ]}
        pagination={{ page, pageSize: perPage, total }}
        onPaginationChange={(p) => setPage(p.page)}
        searchable={false}
        emptyTitle="No activity logs found"
        emptyIcon={Clock}
        onView={(row) => { setSelectedLog(row); setShowDetails(true); }}
      />

      <ViewDetailsModal log={selectedLog} open={showDetails} onClose={() => setShowDetails(false)} />
    </div>
  );
}
