import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

const TEAL = "#f6ce3a";
const YELLOW = "#f6ce3a";

interface ModuleCard {
  icon: string;
  label: string;
  path: string;
  statLabel: string;
  statValue: string | number;
  iconBg: string;
  iconColor: string;
}

function ModuleCard({ icon, label, path, statLabel, statValue, iconBg, iconColor }: ModuleCard) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(path)}
      className="flex items-start gap-4 p-[18px] text-left transition-all duration-150 hover:scale-[1.01]"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border)",
        borderRadius: "10px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = TEAL;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px rgba(246,206,58,0.15)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: iconBg }}
      >
        <i className={`${icon} text-lg`} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          {statLabel}
        </p>
        <p className="text-[15px] font-medium mt-[2px]" style={{ color: "var(--text-primary)" }}>
          {statValue}
        </p>
      </div>
      <i className="ti ti-chevron-right text-sm" style={{ color: "var(--text-muted)", marginTop: "2px" }} />
    </button>
  );
}

interface Stats {
  total_properties: number;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  active_tenants: number;
  active_deals: number;
  income: number;
  expense: number;
  pending_maintenance: number;
  active_projects: number;
  total_employees: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const promises = [
          api.get("/dashboard/stats").catch(() => null),
          api.get("/tenants/dashboard").catch(() => null),
          api.get("/tenants/maintenance/analytics").catch(() => null),
          api.get("/construction/dashboard/stats").catch(() => null),
          api.get("/hr/stats").catch(() => null),
        ];
        const [dashRes, tenantRes, maintRes, constrRes, hrRes] = await Promise.all(promises);
        const dashData = dashRes?.data || {};
        const tenantData = tenantRes?.data || {};
        setStats({
          total_properties: dashData.total_properties ?? 0,
          total_units: dashData.total_units ?? 0,
          occupied_units: dashData.occupied_units ?? 0,
          vacant_units: dashData.vacant_units ?? 0,
          active_tenants: tenantData.active_tenants ?? tenantData.total ?? 0,
          active_deals: dashData.active_deals ?? 0,
          income: dashData.income ?? 0,
          expense: dashData.expense ?? 0,
          pending_maintenance: maintRes?.data?.pending ?? 0,
          active_projects: constrRes?.data?.active_projects ?? constrRes?.data?.total ?? 0,
          total_employees: hrRes?.data?.total ?? 0,
        });
      } catch {
        setStats({
          total_properties: 0, total_units: 0, occupied_units: 0, vacant_units: 0,
          active_tenants: 0, active_deals: 0, income: 0, expense: 0,
          pending_maintenance: 0, active_projects: 0, total_employees: 0,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const modules: ModuleCard[] = [
    { icon: "ti ti-building", label: "Properties", path: "/property", statLabel: "Total Properties", statValue: stats?.total_properties ?? "—", iconBg: "rgba(246,206,58,0.12)", iconColor: TEAL },
    { icon: "ti ti-hard-hat", label: "Construction", path: "/construction", statLabel: "Active Projects", statValue: stats?.active_projects ?? "—", iconBg: "rgba(246,206,58,0.12)", iconColor: YELLOW },
    { icon: "ti ti-users", label: "Tenants", path: "/tenants", statLabel: "Active Tenants", statValue: stats?.active_tenants ?? "—", iconBg: "rgba(246,206,58,0.12)", iconColor: TEAL },
    { icon: "ti ti-currency-dollar", label: "Finance", path: "/finance", statLabel: "Income / Expense", statValue: stats ? `${(stats.income / 1000000).toFixed(1)}M / ${(stats.expense / 1000000).toFixed(1)}M` : "—", iconBg: "rgba(246,206,58,0.12)", iconColor: YELLOW },
    { icon: "ti ti-user-check", label: "CRM", path: "/crm", statLabel: "Active Deals", statValue: stats?.active_deals ?? "—", iconBg: "rgba(246,206,58,0.12)", iconColor: TEAL },
    { icon: "ti ti-chart-bar", label: "Reports", path: "/reports", statLabel: "Analytics & Insights", statValue: "View Reports", iconBg: "rgba(246,206,58,0.12)", iconColor: YELLOW },
    { icon: "ti ti-tool", label: "Maintenance", path: "/maintenance", statLabel: "Pending Requests", statValue: stats?.pending_maintenance ?? "—", iconBg: "rgba(239,68,68,0.12)", iconColor: "#ef4444" },
    { icon: "ti ti-user-cog", label: "HR", path: "/hr", statLabel: "Total Employees", statValue: stats?.total_employees ?? "—", iconBg: "rgba(246,206,58,0.12)", iconColor: TEAL },
  ];

  const quickLinks = [
    { icon: "ti ti-plus", label: "Add Property", path: "/property", color: TEAL },
    { icon: "ti ti-user-plus", label: "Add Tenant", path: "/tenants", color: YELLOW },
    { icon: "ti ti-file-text", label: "New Lease", path: "/tenants", color: TEAL },
    { icon: "ti ti-currency-dollar", label: "Collect Rent", path: "/finance", color: YELLOW },
    { icon: "ti ti-wrench", label: "Maintenance", path: "/maintenance", color: TEAL },
    { icon: "ti ti-settings", label: "Settings", path: "/admin", color: YELLOW },
  ];

  const statCards = [
    { icon: "ti ti-building", value: stats?.total_properties ?? "—", label: "Properties", color: TEAL },
    { icon: "ti ti-users", value: stats?.active_tenants ?? "—", label: "Tenants", color: YELLOW },
    { icon: "ti ti-door", value: stats?.vacant_units ?? "—", label: "Vacant Units", color: "#ef4444" },
    { icon: "ti ti-home", value: stats?.occupied_units ?? "—", label: "Occupied", color: TEAL },
  ];

  return (
    <div className="p-[18px] space-y-[14px] animate-slide-up" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div>
        <h1 className="text-[18px] font-medium" style={{ color: "var(--text-primary)" }}>
          Management Dashboard
        </h1>
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Overview of all modules across your organization
        </p>
      </div>

      {/* Mini stat row */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 p-[14px]"
              style={{
                background: "var(--bg-surface)",
                border: "0.5px solid var(--border)",
                borderRadius: "10px",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${s.color}15` }}
              >
                <i className={`${s.icon} text-sm`} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-[14px] font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
                  {s.value}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Module cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {modules.map((mod) => (
          <ModuleCard key={mod.label} {...mod} />
        ))}
      </div>

      {/* Quick Actions + System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Quick Actions */}
        <div
          className="lg:col-span-2 p-[18px]"
          style={{
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border)",
            borderRadius: "10px",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <i className="ti ti-bolt text-sm" style={{ color: YELLOW }} />
            <h2 className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {quickLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => navigate(link.path)}
                className="flex items-center gap-2 px-3 py-[10px] rounded-lg transition-all duration-150 border text-left"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(246,206,58,0.04)";
                  (e.currentTarget as HTMLElement).style.borderColor = link.color;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                }}
              >
                <i className={`${link.icon} text-sm`} style={{ color: link.color }} />
                <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  {link.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div
          className="p-[18px]"
          style={{
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border)",
            borderRadius: "10px",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <i className="ti ti-shield-check text-sm" style={{ color: TEAL }} />
            <h2 className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              System
            </h2>
          </div>
          <div className="space-y-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Role</span>
              <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>Admin</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Modules Active</span>
              <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>{modules.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Units</span>
              <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>{stats?.total_units ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Occupancy</span>
              <span className="text-[11px] font-medium" style={{ color: YELLOW }}>
                {stats && stats.total_units > 0
                  ? `${Math.round((stats.occupied_units / stats.total_units) * 100)}%`
                  : "—"}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3" style={{ borderTop: "0.5px solid var(--border-subtle)" }}>
            <button
              type="button"
              onClick={() => navigate("/reports")}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: "rgba(246,206,58,0.08)",
                color: TEAL,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(246,206,58,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(246,206,58,0.08)";
              }}
            >
              <i className="ti ti-chart-bar text-sm" />
              View Full Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
