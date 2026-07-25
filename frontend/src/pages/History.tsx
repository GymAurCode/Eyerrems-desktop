import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar, Clock, FilterX, Search, ChevronLeft, ChevronRight,
  Eye, AlertCircle, LogIn, LogOut, FileText, Download,
  Plus, Pencil, Trash2, RefreshCw, Ban, UserCheck,
  Printer, Upload, Monitor, Smartphone, Globe,
} from "lucide-react";
import AppDialog from "../components/ui/AppDialog";
import { auditApi, type AuditLogEntry, type AuditLogsResponse, type AuditStats } from "../lib/auditApi";
import { DataTable } from "../components/data-table";

const MODULES = [
  "All Modules", "property", "tenant", "crm", "hr",
  "maintenance", "finance", "user", "settings", "construction",
  "booking", "report", "auth",
];

const MODULE_LABELS: Record<string, string> = {
  property: "Property", tenant: "Tenant", crm: "CRM", hr: "HR",
  maintenance: "Maintenance", finance: "Finance", user: "User",
  settings: "Settings", construction: "Construction",
  booking: "Booking", report: "Report", auth: "Auth",
};

const ACTIONS = [
  "All Actions", "CREATE", "UPDATE", "DELETE",
  "LOGIN", "LOGOUT", "GENERATE", "EXPORT",
  "DOWNLOAD", "PRINT",
  "STATUS_CHANGE", "BULK_CREATE", "BULK_UPDATE", "BULK_DELETE",
];

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  CREATE:       { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  UPDATE:       { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  DELETE:       { bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
  LOGIN:        { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  LOGOUT:       { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" },
  GENERATE:     { bg: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
  EXPORT:       { bg: "rgba(236,72,153,0.15)",  color: "#f472b6" },
  DOWNLOAD:     { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  PRINT:        { bg: "rgba(107,114,128,0.15)",  color: "#9ca3af" },
  STATUS_CHANGE:{ bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  BULK_CREATE:  { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  BULK_UPDATE:  { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  BULK_DELETE:  { bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
};

const MODULE_ACCENTS: Record<string, { bg: string; color: string }> = {
  property:     { bg: "rgba(16,185,129,0.12)", color: "#34d399" },
  tenant:       { bg: "rgba(249,115,22,0.12)", color: "#fb923c" },
  crm:          { bg: "rgba(99,102,241,0.12)", color: "#818cf8" },
  hr:           { bg: "rgba(139,92,246,0.12)", color: "#a78bfa" },
  maintenance:  { bg: "rgba(236,72,153,0.12)", color: "#f472b6" },
  finance:      { bg: "rgba(245,158,11,0.12)", color: "#fbbf24" },
  user:         { bg: "rgba(107,114,128,0.12)",color: "#9ca3af" },
  settings:     { bg: "rgba(107,114,128,0.12)",color: "#9ca3af" },
  construction: { bg: "rgba(20,184,166,0.12)", color: "#2dd4bf" },
  booking:      { bg: "rgba(59,130,246,0.12)", color: "#60a5fa" },
  report:       { bg: "rgba(245,158,11,0.12)", color: "#fbbf24" },
  auth:         { bg: "rgba(16,185,129,0.12)", color: "#34d399" },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  CREATE: Plus, UPDATE: Pencil, DELETE: Trash2,
  LOGIN: LogIn, LOGOUT: LogOut, GENERATE: FileText,
  EXPORT: Download, DOWNLOAD: Download, PRINT: Printer,
  STATUS_CHANGE: RefreshCw,
  BULK_CREATE: Plus, BULK_UPDATE: Pencil, BULK_DELETE: Trash2,
};

const PERIODS = ["today", "week", "month", "year"] as const;

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_COLORS[action] ?? { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" };
  const Icon = ACTION_ICONS[action];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase whitespace-nowrap"
      style={{ background: style.bg, color: style.color }}
    >
      {Icon && <Icon size={10} />}
      {action.replace("_", " ")}
    </span>
  );
}

function ModuleBadge({ module }: { module: string }) {
  const style = MODULE_ACCENTS[module.toLowerCase()] ?? { bg: "rgba(107,114,128,0.12)", color: "#9ca3af" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}20` }}
    >
      {MODULE_LABELS[module.toLowerCase()] ?? module}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "Success" || !status) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold"
        style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}>
        Success
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold"
      style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
      {status}
    </span>
  );
}

import StatCard from "../components/ui/StatCard";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr);
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }) + " " + d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function DiffSummary({ diff }: { diff: any }) {
  if (!diff) return <span className="text-muted">—</span>;
  let entries: { field: string; old_value: any; new_value: any }[] = [];
  if (Array.isArray(diff)) {
    entries = diff;
  } else if (typeof diff === "object") {
    entries = Object.entries(diff).map(([k, v]) => ({
      field: k,
      old_value: (v as any)?.from ?? (v as any)?.old_value,
      new_value: (v as any)?.to ?? (v as any)?.new_value,
    }));
  }
  const shown = entries.slice(0, 3);
  return (
    <div className="space-y-0.5">
      {shown.map(({ field, old_value, new_value }) => (
        <div key={field} className="text-[10px] text-secondary leading-tight">
          <span className="text-muted font-mono">{field}:</span>{" "}
          <span className="text-red-400 line-through">{old_value ?? "—"}</span>
          {" → "}
          <span className="text-emerald-400">{new_value ?? "—"}</span>
        </div>
      ))}
      {entries.length > 3 && (
        <span className="text-[10px] text-muted">+{entries.length - 3} more</span>
      )}
    </div>
  );
}

function DiffTable({ diff }: { diff: any }) {
  let entries: { field: string; old_value: any; new_value: any }[] = [];
  if (Array.isArray(diff)) {
    entries = diff;
  } else if (typeof diff === "object") {
    entries = Object.entries(diff).map(([k, v]) => ({
      field: k,
      old_value: (v as any)?.from ?? (v as any)?.old_value,
      new_value: (v as any)?.to ?? (v as any)?.new_value,
    }));
  }
  if (entries.length === 0) {
    return <p className="text-xs text-muted py-4 text-center">No changes recorded</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: "var(--bg-surface-hover)" }}>
            <th className="px-3 py-2 text-left font-semibold text-muted uppercase tracking-wider">Field</th>
            <th className="px-3 py-2 text-left font-semibold text-muted uppercase tracking-wider">Before</th>
            <th className="px-3 py-2 text-left font-semibold text-muted uppercase tracking-wider">After</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ field, old_value, new_value }) => (
            <tr key={field} style={{ borderTop: "1px solid var(--border)" }}>
              <td className="px-3 py-2 font-mono text-secondary">{field}</td>
              <td className="px-3 py-2 text-red-400 line-through">{old_value ?? "—"}</td>
              <td className="px-3 py-2 text-emerald-400">{new_value ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldValueTable({ rows }: { rows: Record<string, any> | null }) {
  if (!rows || Object.keys(rows).length === 0) {
    return <p className="text-xs text-muted py-4 text-center">No data</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: "var(--bg-surface-hover)" }}>
            <th className="px-3 py-2 text-left font-semibold text-muted uppercase tracking-wider">Field</th>
            <th className="px-3 py-2 text-left font-semibold text-muted uppercase tracking-wider">Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(rows).map(([k, v]) => (
            <tr key={k} style={{ borderTop: "1px solid var(--border)" }}>
              <td className="px-3 py-2 font-mono text-secondary">{k}</td>
              <td className="px-3 py-2 text-primary">{v ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ViewDetailsModal({ log, open, onClose }: { log: AuditLogEntry | null; open: boolean; onClose: () => void }) {
  if (!log) return null;
  const style = ACTION_COLORS[log.action] ?? { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" };
  return (
    <AppDialog isOpen={open} title="Activity Details" onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Record</p>
            <p className="font-medium text-primary">{log.entity_name ?? log.record_label ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Module</p>
            <ModuleBadge module={log.module} />
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Action</p>
            <ActionBadge action={log.action} />
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Entity ID</p>
            <p className="font-mono text-primary text-xs">{log.entity_id ?? log.record_id ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Date</p>
            <p className="text-primary">{formatDateShort(log.created_at)}</p>
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Time</p>
            <p className="text-primary">{formatTime(log.created_at)}</p>
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Changed By</p>
            <div className="flex items-center gap-2">
              <span className="text-primary">{log.changed_by}</span>
              {log.changed_by_role && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    color: "#818cf8",
                    border: "1px solid rgba(99,102,241,0.2)",
                  }}
                >
                  {log.changed_by_role}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Status</p>
            <StatusBadge status={log.status} />
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Request</p>
            <p className="font-mono text-primary text-xs">
              {log.request_method ?? ""} {log.api_endpoint ?? ""}
            </p>
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">IP Address</p>
            <p className="font-mono text-primary text-xs">{log.ip_address ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Device</p>
            <p className="text-primary text-xs">
              {[log.browser, log.os, log.device].filter(Boolean).join(" / ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">User</p>
            <p className="text-primary text-xs">{log.full_name ?? log.username ?? log.changed_by}</p>
          </div>
          <div>
            <p className="text-muted mb-0.5 uppercase tracking-wider text-[10px] font-semibold">Department</p>
            <p className="text-primary text-xs">{log.department ?? "—"}</p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }} className="pt-4">
          <p className="text-xs font-semibold text-primary mb-3 uppercase tracking-wider">Changes</p>
          {log.action === "UPDATE" && log.diff && <DiffTable diff={log.diff} />}
          {log.action === "CREATE" && log.new_data && <FieldValueTable rows={log.new_data} />}
          {log.action === "DELETE" && log.old_data && <FieldValueTable rows={log.old_data} />}
          {log.action === "STATUS_CHANGE" && log.diff && <DiffTable diff={log.diff} />}
          {["UPDATE", "STATUS_CHANGE"].includes(log.action) && !log.diff && (
            <p className="text-xs text-muted py-4 text-center">No diff data available</p>
          )}
          {log.action === "CREATE" && !log.new_data && (
            <p className="text-xs text-muted py-4 text-center">No creation data available</p>
          )}
          {log.action === "DELETE" && !log.old_data && (
            <p className="text-xs text-muted py-4 text-center">No deletion data available</p>
          )}
          {["LOGIN", "LOGOUT", "GENERATE", "EXPORT", "DOWNLOAD", "PRINT"].includes(log.action) && log.new_data && (
            <FieldValueTable rows={log.new_data} />
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
  const [searchFilter, setSearchFilter] = useState("");
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
      if (searchFilter) params.search = searchFilter;
      if (periodFilter) params.period = periodFilter;

      const res: AuditLogsResponse = await auditApi.getLogs(params);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error("[History] fetchLogs error:", err);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, moduleFilter, actionFilter, userFilter, searchFilter, periodFilter]);

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
    setSearchFilter("");
    setPeriodFilter("");
    setPage(1);
  };

  const hasActiveFilters = moduleFilter || actionFilter || userFilter || searchFilter || periodFilter;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const columns = useMemo(() => [
    {
      key: "created_at",
      label: "Date",
      render: (val: string, row: AuditLogEntry) => (
        <div className="flex flex-col gap-0">
          <span className="text-secondary text-[11px] font-medium">{formatDateShort(val)}</span>
          <span className="text-muted text-[10px]">{formatTime(val)}</span>
        </div>
      ),
      width: "100px",
    },
    {
      key: "changed_by",
      label: "User",
      render: (_val: string, row: AuditLogEntry) => (
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
            style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}
          >
            {(row.full_name || row.changed_by || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className="text-secondary text-[11px] truncate block max-w-[100px]">
              {row.full_name || row.changed_by}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "changed_by_role",
      label: "Role",
      render: (val: string | null) => (
        <span className="text-[10px] text-muted">{val || "—"}</span>
      ),
    },
    {
      key: "module",
      label: "Module",
      render: (val: string) => <ModuleBadge module={val} />,
    },
    {
      key: "action",
      label: "Action",
      render: (val: string) => <ActionBadge action={val} />,
    },
    {
      key: "entity_name",
      label: "Entity",
      render: (_val: string, row: AuditLogEntry) => (
        <div className="flex flex-col gap-0 min-w-0">
          <span className="text-primary text-[11px] truncate max-w-[140px] font-medium">
            {row.entity_name || row.record_label || "—"}
          </span>
          {row.entity_type && (
            <span className="text-muted text-[9px]">{row.entity_type}</span>
          )}
        </div>
      ),
    },
    {
      key: "diff",
      label: "Description",
      render: (val: any) => <div className="max-w-[180px]"><DiffSummary diff={val} /></div>,
    },
    {
      key: "status",
      label: "Status",
      render: (val: string | null) => <StatusBadge status={val} />,
    },
    {
      key: "ip_address",
      label: "IP",
      render: (val: string | null) => (
        <span className="text-muted text-[10px] font-mono">{val || "—"}</span>
      ),
    },
    {
      key: "device",
      label: "Device",
      render: (_val: string, row: AuditLogEntry) => (
        <div className="flex items-center gap-1">
          <Smartphone size={10} className="text-muted" />
          <span className="text-muted text-[10px]">{row.device || "—"}</span>
        </div>
      ),
    },
  ], []);

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Activity History
          </h1>
          <p className="text-xs text-muted mt-0.5">Track all changes made across the system</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">{total} total entries</span>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Today"     value={String(stats.total_today ?? 0)} icon={Calendar} iconBg="rgba(59,130,246,0.15)" iconColor="#3b82f6" />
          <StatCard label="This Week" value={String(stats.total_week ?? 0)} icon={Calendar} iconBg="rgba(16,185,129,0.15)" iconColor="#34d399" />
          <StatCard label="This Month" value={String(stats.total_month ?? 0)} icon={Calendar} iconBg="rgba(245,158,11,0.15)" iconColor="#fbbf24" />
          <StatCard label="Total All" value={String(stats.total_all ?? 0)} icon={Clock}     iconBg="rgba(139,92,246,0.15)" iconColor="#a78bfa" />
        </div>
      )}

      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-muted mb-1 uppercase tracking-wider">Module</label>
            <select
              value={moduleFilter || "All Modules"}
              onChange={(e) => { setModuleFilter(e.target.value === "All Modules" ? "" : e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 text-xs rounded-lg"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {MODULES.map((m) => <option key={m} value={m}>{MODULE_LABELS[m.toLowerCase()] ?? m}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-muted mb-1 uppercase tracking-wider">Action</label>
            <select
              value={actionFilter || "All Actions"}
              onChange={(e) => { setActionFilter(e.target.value === "All Actions" ? "" : e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 text-xs rounded-lg"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a === "All Actions" ? a : a.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-semibold text-muted mb-1 uppercase tracking-wider">User</label>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text" placeholder="Email or name..."
                value={userFilter}
                onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-semibold text-muted mb-1 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text" placeholder="Search across all fields..."
                value={searchFilter}
                onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
          <div className="flex items-end gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => { setPeriodFilter(periodFilter === p ? "" : p); setPage(1); }}
                className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-all ${
                  periodFilter === p ? "text-white" : "text-secondary hover:text-primary"
                }`}
                style={periodFilter === p
                  ? { background: "linear-gradient(135deg, #f59e0b, #d97706)" }
                  : { border: "1px solid var(--border)", background: "var(--bg-surface)" }
                }
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors"
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: hasActiveFilters ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <FilterX size={11} /> Reset
          </button>
        </div>
      </div>

      <DataTable
        data={logs}
        loading={loading}
        columns={columns}
        pagination={total > perPage ? { page, pageSize: perPage, total } : undefined}
        onPaginationChange={(p) => setPage(p.page)}
        searchable={false}
        emptyTitle={
          hasActiveFilters
            ? "No activity yet for the selected filters"
            : "No activity recorded yet"
        }
        emptyIcon={(props: any) => <Clock {...props} />}
        emptyDescription={
          hasActiveFilters
            ? "Try changing your filters or resetting to see all activity"
            : "Activity will appear here once actions are performed in the system"
        }
        onView={(row) => { setSelectedLog(row); setShowDetails(true); }}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted px-1">
          <span>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ border: "1px solid var(--border)" }}
            >
              <ChevronLeft size={12} /> Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ border: "1px solid var(--border)" }}
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      <ViewDetailsModal log={selectedLog} open={showDetails} onClose={() => setShowDetails(false)} />
    </div>
  );
}