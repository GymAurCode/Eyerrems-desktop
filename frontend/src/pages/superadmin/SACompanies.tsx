import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Search, ToggleLeft, Users, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { saApi, Company } from "../../lib/superAdminApi";

const PLAN_COLOR: Record<string, string> = {
  free: "#64748b", premium: "#f59e0b", enterprise: "var(--sa-accent)",
};

export default function SACompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [updating,  setUpdating]  = useState<number | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    saApi.listCompanies()
      .then((data) => {
        if (Array.isArray(data)) {
          setCompanies(data);
        } else {
          console.error("Expected array from listCompanies, got:", data);
          setCompanies([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const safeCompanies = Array.isArray(companies) ? companies : [];
  const filtered = safeCompanies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleStatus = async (c: Company) => {
    setUpdating(c.id);
    try {
      const updated = await saApi.setStatus(c.id, c.status === "active" ? "suspended" : "active");
      setCompanies((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x.id === updated.id ? updated : x)));
    } catch { /* ignore */ }
    finally { setUpdating(null); }
  };

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sa-text-primary">Companies</h1>
          <p className="text-xs mt-0.5 sa-text-muted">
            {safeCompanies.length} tenant{safeCompanies.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="sa-btn-ghost w-8 h-8 p-0 flex items-center justify-center">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => navigate("/super-admin/companies/new")}
            className="sa-btn-primary px-4 py-2"
          >
            <Plus size={14} /> New Company
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 sa-text-muted" />
        <input
          className="sa-input pl-9"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="sa-table-wrap">
        {/* Head */}
        <div className="sa-table-head grid grid-cols-[1fr_120px_100px_120px_auto] gap-4 px-5 py-3">
          <span>Company</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Created</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 sa-skeleton mx-0 rounded-none" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center sa-text-muted">
            <Building2 size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No companies found</p>
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className="sa-table-row grid grid-cols-[1fr_120px_100px_120px_auto] gap-4 items-center px-5 py-3.5"
            >
              {/* Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="sa-avatar-sm">{c.name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate sa-text-primary">{c.name}</p>
                  <p className="text-[10px] truncate sa-text-muted">/{c.slug}</p>
                </div>
              </div>

              {/* Plan */}
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full w-fit"
                style={{
                  background: `color-mix(in srgb, ${PLAN_COLOR[c.plan] ?? "#64748b"} 15%, transparent)`,
                  color: PLAN_COLOR[c.plan] ?? "#64748b",
                }}
              >
                {c.plan}
              </span>

              {/* Status */}
              <div className="flex items-center gap-1.5">
                {c.status === "active"
                  ? <CheckCircle size={13} style={{ color: "#10b981" }} />
                  : <XCircle    size={13} style={{ color: "#ef4444" }} />}
                <span
                  className="text-xs font-medium"
                  style={{ color: c.status === "active" ? "#10b981" : "#ef4444" }}
                >
                  {c.status}
                </span>
              </div>

              {/* Created */}
              <span className="text-xs sa-text-muted">
                {new Date(c.created_at).toLocaleDateString()}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigate(`/super-admin/companies/${c.id}`)}
                  className="sa-btn-ghost text-xs px-3 py-1.5"
                >
                  Manage
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/super-admin/companies/${c.id}/features`)}
                  className="sa-topbar-icon-btn w-7 h-7"
                  title="Features"
                  style={{ color: "#f59e0b" }}
                >
                  <ToggleLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/super-admin/companies/${c.id}/users`)}
                  className="sa-topbar-icon-btn w-7 h-7"
                  title="Users"
                  style={{ color: "#3b82f6" }}
                >
                  <Users size={14} />
                </button>
                <button
                  type="button"
                  disabled={updating === c.id}
                  onClick={() => toggleStatus(c)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 border"
                  style={{
                    color: c.status === "active" ? "#ef4444" : "#10b981",
                    borderColor: c.status === "active" ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)",
                    background: "transparent",
                  }}
                >
                  {updating === c.id ? "…" : c.status === "active" ? "Suspend" : "Activate"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
