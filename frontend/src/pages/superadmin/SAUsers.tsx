import { useEffect, useState } from "react";
import { Search, RefreshCw, Building2 } from "lucide-react";
import { saApi, CompanyUser, Company } from "../../lib/superAdminApi";

export default function SAUsers() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users,     setUsers]     = useState<CompanyUser[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<number | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      const cs  = await saApi.listCompanies();
      setCompanies(cs);
      const all = await Promise.all(cs.map((c) => saApi.listUsers(c.id)));
      setUsers(all.flat());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase());
    const matchCompany = filter === "all" || u.company_id === filter;
    return matchSearch && matchCompany;
  });

  const companyName = (id: number | null) =>
    companies.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sa-text-primary">All Users</h1>
          <p className="text-xs mt-0.5 sa-text-muted">
            {users.length} users across {companies.length} companies
          </p>
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
            placeholder="Search users…"
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

      {/* Table */}
      <div className="sa-table-wrap">
        <div className="sa-table-head grid grid-cols-[1fr_1fr_120px_100px_100px] gap-4 px-5 py-3">
          <span>User</span>
          <span>Company</span>
          <span>Roles</span>
          <span>Status</span>
          <span>Joined</span>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 sa-skeleton rounded-none" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center sa-text-muted">
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className="sa-table-row grid grid-cols-[1fr_1fr_120px_100px_100px] gap-4 items-center px-5 py-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="sa-avatar">{u.full_name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate sa-text-primary">{u.full_name}</p>
                  <p className="text-[10px] truncate sa-text-muted">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <Building2 size={11} className="sa-text-muted shrink-0" />
                <span className="text-xs truncate sa-text-secondary">{companyName(u.company_id)}</span>
              </div>

              <div className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full sa-badge">{r}</span>
                ))}
              </div>

              <span
                className="text-xs font-medium"
                style={{ color: u.status === "active" ? "#10b981" : "#ef4444" }}
              >
                {u.status}
              </span>

              <span className="text-xs sa-text-muted">
                {new Date(u.created_at).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
