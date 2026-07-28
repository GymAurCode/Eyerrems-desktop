import { useEffect, useState, useCallback } from "react";
import { Clock, Search, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { addRbacEventListener } from "../../../hooks/useWebSocket";
import {
  fetchAuditLogs,
  type AuditLogEntry,
  type AuditLogPage,
} from "../../../lib/rbacApi";

const MODULE_OPTIONS = [
  "", "property", "crm", "finance", "hr", "construction", "tenant",
  "maintenance", "booking", "report", "auth", "rbac", "user",
  "settings", "mail", "reminder", "communication", "spreadsheet",
];

const ACTION_OPTIONS = [
  "", "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT",
  "STATUS_CHANGE", "GENERATE", "EXPORT", "DOWNLOAD",
];

export default function AuditLogsTab() {
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAuditLogs({
        page,
        per_page: perPage,
        module: filterModule || undefined,
        action: filterAction || undefined,
        search: filterSearch || undefined,
      });
      setData(result);
    } catch { } finally { setLoading(false); }
  }, [page, perPage, filterModule, filterAction, filterSearch]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Real-time updates via shared WebSocket hub
  useEffect(() => {
    const unsubscribe = addRbacEventListener((event) => {
      if (event === "audit_log.created" || event.startsWith("rbac.")) {
        loadLogs();
      }
    });
    return unsubscribe;
  }, [loadLogs]);

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE": return { bg: "rgba(16,185,129,0.08)", text: "#10b981", border: "rgba(16,185,129,0.15)" };
      case "UPDATE":
      case "STATUS_CHANGE": return { bg: "rgba(245,158,11,0.08)", text: "#f59e0b", border: "rgba(245,158,11,0.15)" };
      case "DELETE": return { bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "rgba(239,68,68,0.15)" };
      case "LOGIN": return { bg: "rgba(99,102,241,0.08)", text: "#818cf8", border: "rgba(99,102,241,0.15)" };
      case "LOGOUT": return { bg: "rgba(168,85,247,0.08)", text: "#a855f7", border: "rgba(168,85,247,0.15)" };
      default: return { bg: "rgba(107,114,128,0.08)", text: "#6b7280", border: "rgba(107,114,128,0.15)" };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Audit Logs</h2>
          <p className="text-xs text-muted mt-0.5">Real-time activity log for your company</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted">
            {data ? `${data.total} entries` : "—"}
          </span>
          <button onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg"
            style={{ border: "1px solid var(--border)" }}>
            <Filter size={12} /> Filters
          </button>
          <button onClick={loadLogs}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg btn-primary">
            <Clock size={12} /> Refresh
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 rounded-xl" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-muted uppercase mb-1">Module</label>
            <select value={filterModule} onChange={(e) => { setFilterModule(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 text-xs border rounded-lg"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
              <option value="">All modules</option>
              {MODULE_OPTIONS.filter(Boolean).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-muted uppercase mb-1">Action</label>
            <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 text-xs border rounded-lg"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
              <option value="">All actions</option>
              {ACTION_OPTIONS.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-semibold text-muted uppercase mb-1">Search</label>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search logs..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); loadLogs(); } }} />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : !data || data.logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted">
            <Clock size={32} className="mb-2 opacity-30" />
            <p className="text-xs">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">Time</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">Module</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">Description</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => {
                  const ac = getActionColor(log.action);
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-[11px] text-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString(undefined, {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-primary">{log.full_name || log.username || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: ac.bg, color: ac.text, border: `1px solid ${ac.border}` }}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary">{log.module}</td>
                      <td className="px-4 py-3 text-xs text-secondary max-w-[300px] truncate">
                        {log.entity_name || `${log.action} ${log.entity_type || ""} ${log.entity_id || ""}`}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted font-mono">{log.ip_address || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">
            Page {page} of {totalPages} ({data?.total ?? 0} entries)
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1.5 rounded hover:bg-white/5 text-muted disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className="w-7 h-7 text-xs font-medium rounded-lg"
                  style={{
                    background: p === page ? "rgba(99,102,241,0.12)" : "transparent",
                    color: p === page ? "#818cf8" : "var(--text-secondary)",
                    border: p === page ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent",
                  }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1.5 rounded hover:bg-white/5 text-muted disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
