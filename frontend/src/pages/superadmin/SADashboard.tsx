import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle, XCircle, ToggleLeft, TrendingUp } from "lucide-react";
import { saApi, Company } from "../../lib/superAdminApi";

function StatCard({
  label, value, icon: Icon, accentColor, onClick,
}: {
  label: string; value: string | number; icon: React.ElementType;
  accentColor: string; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="sa-stat-card"
      style={{
        background: `color-mix(in srgb, ${accentColor} 8%, var(--sa-bg-surface))`,
        borderColor: `color-mix(in srgb, ${accentColor} 25%, transparent)`,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
      >
        <Icon size={18} style={{ color: accentColor }} />
      </div>
      <p className="text-2xl font-bold mb-1 sa-text-primary">{value}</p>
      <p className="text-xs font-medium sa-text-muted">{label}</p>
    </button>
  );
}

export default function SADashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading,   setLoading]   = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    saApi.listCompanies()
      .then(setCompanies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active    = companies.filter((c) => c.status === "active").length;
  const suspended = companies.filter((c) => c.status === "suspended").length;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold sa-text-primary">System Overview</h1>
        <p className="text-xs mt-0.5 sa-text-muted">Global view across all tenant companies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Companies" value={loading ? "…" : companies.length}
          icon={Building2} accentColor="var(--sa-accent)"
          onClick={() => navigate("/super-admin/companies")} />
        <StatCard label="Active" value={loading ? "…" : active}
          icon={CheckCircle} accentColor="#10b981"
          onClick={() => navigate("/super-admin/companies")} />
        <StatCard label="Suspended" value={loading ? "…" : suspended}
          icon={XCircle} accentColor="#ef4444"
          onClick={() => navigate("/super-admin/companies")} />
        <StatCard label="Feature Flags" value="8 modules"
          icon={ToggleLeft} accentColor="#f59e0b"
          onClick={() => navigate("/super-admin/features")} />
      </div>

      {/* Recent companies */}
      <div className="sa-card-faint p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} style={{ color: "var(--sa-accent)" }} />
            <h2 className="text-sm font-semibold sa-text-primary">Recent Companies</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/super-admin/companies")}
            className="text-xs font-medium transition-colors sa-text-accent"
          >
            View all →
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-xl sa-skeleton" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <p className="text-xs text-center py-6 sa-text-muted">
            No companies yet.{" "}
            <button
              type="button"
              onClick={() => navigate("/super-admin/companies/new")}
              className="sa-text-accent"
            >
              Create one →
            </button>
          </p>
        ) : (
          <div className="space-y-2">
            {companies.slice(0, 6).map((c) => (
              <div
                key={c.id}
                className="sa-table-row flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer"
                onClick={() => navigate(`/super-admin/companies/${c.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="sa-avatar-sm">{c.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="text-sm font-medium sa-text-primary">{c.name}</p>
                    <p className="text-[10px] sa-text-muted">/{c.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: c.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                      color: c.status === "active" ? "#10b981" : "#ef4444",
                    }}
                  >
                    {c.status}
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium sa-badge"
                  >
                    {c.plan}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Create Company",  path: "/super-admin/companies/new", color: "var(--sa-accent)" },
          { label: "Manage Features", path: "/super-admin/features",      color: "#f59e0b" },
          { label: "View All Users",  path: "/super-admin/users",         color: "#3b82f6" },
          { label: "System Logs",     path: "/super-admin/logs",          color: "#10b981" },
        ].map(({ label, path, color }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(path)}
            className="px-4 py-3 rounded-2xl text-sm font-semibold text-left border transition-all hover:scale-[1.02]"
            style={{
              background: `color-mix(in srgb, ${color} 8%, var(--sa-bg-surface))`,
              borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
              color,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
