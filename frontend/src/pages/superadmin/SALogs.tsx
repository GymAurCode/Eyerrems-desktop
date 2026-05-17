import { useEffect, useState } from "react";
import { ScrollText, RefreshCw, Search } from "lucide-react";
import { saApi, AuditEntry, Company } from "../../lib/superAdminApi";

const ACTION_COLOR: Record<string, string> = {
  CREATE:       "#10b981",
  UPDATE:       "#3b82f6",
  DELETE:       "#ef4444",
  LOGIN:        "#f59e0b",
  LOGIN_FAILED: "#ef4444",
  APPROVE:      "var(--sa-accent-light)",
  REJECT:       "#ef4444",
  SUSPEND:      "#f59e0b",
};

export default function SALogs() {
  const [logs,      setLogs]      = useState<AuditEntry[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<number | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      const [cs, ls] = await Promise.all([
        saApi.listCompanies(),
        saApi.getAuditLogs(undefined, 500),
      ]);
      setCompanies(cs);
      setLogs(ls);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const companyName = (id: number | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? `#${id}`) : "System";

  const filtered = logs.filter((l) => {
    const matchSearch =
      (l.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.action      ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.module      ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCompany = filter === "all" || l.company_id === filter;
    return matchSearch && matchCompany;
  });

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sa-text-primary">System Logs</h1>
          <p className="text-xs mt-0.5 sa-text-muted">Audit trail across all tenants</p>
        </div>
        <button type="button" onClick={load} className="sa-btn-ghost w-8 h-8 p-0 flex items-center justify-center">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 sa-text-muted" />
          <input
            className="sa-input pl-8"
            placeholder="Search logs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="sa-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Log list */}
      <div className="sa-table-wrap">
        <div className="sa-section-header">
          <ScrollText size={14} style={{ color: "var(--sa-accent)" }} />
          <span className="text-sm font-semibold sa-text-primary">{filtered.length} entries</span>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 sa-skeleton rounded-none" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center sa-text-muted">
            <ScrollText size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No logs found</p>
          </div>
        ) : (
          <div>
            {filtered.map((l) => (
              <div key={l.id} className="sa-table-row flex items-start gap-4 px-5 py-3">
                {/* Action badge */}
                <span
                  className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 mt-0.5"
                  style={{
                    background: `color-mix(in srgb, ${ACTION_COLOR[l.action] ?? "#64748b"} 15%, transparent)`,
                    color: ACTION_COLOR[l.action] ?? "#64748b",
                  }}
                >
                  {l.action}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm sa-text-primary">
                    {l.description ?? `${l.action} on ${l.entity_type ?? "entity"}`}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {l.module && (
                      <span className="text-[10px] sa-text-accent">{l.module}</span>
                    )}
                    <span className="text-[10px] sa-text-muted">{companyName(l.company_id)}</span>
                    <span className="text-[10px] sa-text-muted">
                      {new Date(l.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
