import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStore, type DashboardData } from "../store/dashboard";
import { useActivity } from "../hooks/useActivity";
import StatCard from "../components/ui/StatCard";
import { formatCurrency } from "../lib/currency";
import { useUIStore } from "../store/ui";

const TEAL = "#14B8A6";
const YELLOW = "#f6ce3a";
const CARD_BG = "var(--bg-surface)";
/* ── Activity Row ── */
function ActivityRow({
  dotColor,
  text,
  timestamp,
}: {
  dotColor: string;
  text: string;
  timestamp: string;
}) {
  return (
    <div
      className="flex items-start gap-3 py-[10px]"
      style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
    >
      <span
        className="w-[7px] h-[7px] rounded-full mt-[5px] shrink-0"
        style={{ background: dotColor }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {text}
        </p>
        <p
          className="text-[10px] mt-[2px]"
          style={{ color: "var(--text-muted)" }}
        >
          {timestamp}
        </p>
      </div>
    </div>
  );
}

/* ── Quick Action Button ── */
function QuickActionBtn({ icon, iconBg, iconColor, label, isDark }: { icon: string; iconBg: string; iconColor: string; label: string; isDark: boolean }) {
  return (
    <button
      type="button"
      className="flex flex-col items-center justify-center gap-2 rounded-lg py-3 px-2 transition-all duration-150 border"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(246,206,58,0.08)" : "rgba(20,184,166,0.04)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: iconBg }}
      >
        <i className={`${icon} text-sm`} style={{ color: iconColor }} />
      </div>
      <span
        className="text-[10px] font-medium text-center leading-tight"
        style={{ color: isDark ? "#fff" : "#000" }}
      >
        {label}
      </span>
    </button>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function buildStatCards(data: DashboardData, isDark: boolean) {
  const accent = isDark ? YELLOW : TEAL;
  const accentBg = isDark ? "rgba(246,206,58,0.12)" : "rgba(20,184,166,0.12)";
  return [
    {
      icon: "ti ti-building",
      iconBg: accentBg,
      iconColor: accent,
      value: String(data.total_properties),
      label: "Total Properties",
      trend: `${data.total_units} units`,
      trendUp: true,
      trendColor: "#4ADE80",
    },
    {
      icon: "ti ti-currency-dollar",
      iconBg: accentBg,
      iconColor: accent,
      value: formatCurrency(data.income),
      label: "Total Income",
      trend: `${formatCurrency(data.expense)} expenses`,
      trendUp: data.income > data.expense,
      trendColor: data.income > data.expense ? "#4ADE80" : "#ef4444",
    },
    {
      icon: "ti ti-door-off",
      iconBg: "rgba(239,68,68,0.12)",
      iconColor: "#ef4444",
      value: String(data.vacant_units),
      label: "Vacant Units",
      trend: `${data.active_deals} active deals`,
      trendUp: false,
      trendColor: "#ef4444",
    },
    {
      icon: "ti ti-users",
      iconBg: accentBg,
      iconColor: accent,
      value: String(data.occupied_units),
      label: "Occupied Units",
      trend: `${data.total_units - data.vacant_units} occupied`,
      trendUp: true,
      trendColor: "#4ADE80",
    },
  ];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, fetchStats } = useDashboardStore();
  const { items: activities, loading: actLoading } = useActivity(8);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === "dark";

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const accent = isDark ? YELLOW : TEAL;
  const accentBg = isDark ? "rgba(246,206,58,0.12)" : "rgba(20,184,166,0.12)";
  const quickActions = [
    { icon: "ti ti-building", iconBg: accentBg, iconColor: accent, label: "Add Property" },
    { icon: "ti ti-file-text", iconBg: accentBg, iconColor: accent, label: "New Lease" },
    { icon: "ti ti-user-plus", iconBg: accentBg, iconColor: accent, label: "Add Tenant" },
    { icon: "ti ti-currency-dollar", iconBg: accentBg, iconColor: accent, label: "Collect Rent" },
    { icon: "ti ti-tool", iconBg: accentBg, iconColor: accent, label: "Maintenance Request" },
    { icon: "ti ti-chart-bar", iconBg: accentBg, iconColor: accent, label: "View Reports" },
  ];

  return (
    <div className="p-[18px] space-y-3 animate-slide-up" style={{ background: "var(--bg-base)" }}>
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-[18px] font-medium" style={{ color: "var(--text-primary)" }}>
            Dashboard
          </h1>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Real-time overview of your portfolio
          </p>
        </div>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col p-[18px] animate-pulse"
              style={{
                background: CARD_BG,
                border: "0.5px solid var(--border)",
                borderRadius: "10px",
              }}
            >
              <div className="w-9 h-9 rounded-lg bg-gray-600/20 mb-3" />
              <div className="h-5 w-24 rounded bg-gray-600/20 mb-1" />
              <div className="h-3 w-16 rounded bg-gray-600/20" />
            </div>
          ))
        ) : error ? (
          <div className="col-span-full text-[11px] text-red-400 p-4 text-center">{error}</div>
        ) : data ? (
          buildStatCards(data, isDark).map((card) => (
            <StatCard key={card.label} {...card} />
          ))
        ) : null}
      </div>

      {/* ── Two Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Left — Recent Activities */}
        <div
          className="lg:col-span-3 p-[18px]"
          style={{
            background: CARD_BG,
            border: "0.5px solid var(--border)",
            borderRadius: "10px",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="ti ti-clock text-sm" style={{ color: accent }} />
              <h2 className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                Recent Activities
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate("/activity")}
              className="text-[11px] font-medium hover:opacity-75 transition-opacity"
              style={{ color: accent }}
            >
              View all →
            </button>
          </div>
          <div>
            {actLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 py-[10px] animate-pulse"
                  style={{ borderBottom: "0.5px solid var(--border-subtle)" }}>
                  <div className="w-[7px] h-[7px] rounded-full bg-gray-600/20 mt-[5px]" />
                  <div className="flex-1">
                    <div className="h-3 w-3/4 rounded bg-gray-600/20 mb-1" />
                    <div className="h-2 w-1/4 rounded bg-gray-600/20" />
                  </div>
                </div>
              ))
            ) : activities.length === 0 ? (
              <p className="text-[11px] text-center py-6" style={{ color: "var(--text-muted)" }}>
                No recent activity
              </p>
            ) : (
              activities.slice(0, 8).map((act, i) => (
                <ActivityRow
                  key={i}
                  dotColor={act.type === "expense" ? "#ef4444" : accent}
                  text={act.title}
                  timestamp={timeAgo(act.timestamp)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right — Quick Actions */}
        <div
          className="lg:col-span-2 p-[18px]"
          style={{
            background: CARD_BG,
            border: "0.5px solid var(--border)",
            borderRadius: "10px",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <i className="ti ti-bolt text-sm" style={{ color: accent }} />
            <h2 className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <QuickActionBtn key={action.label} {...action} isDark={isDark} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}