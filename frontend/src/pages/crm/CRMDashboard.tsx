import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, UserCheck, TrendingUp, Award, XCircle,
  CalendarCheck, DollarSign, Clock, AlertTriangle,
  BarChart3, Target,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { useCrmDashboardStore } from "../../store/crmDashboard";
import { DealerPerformance, RecentActivityItem } from "../../lib/crmApi";
import StatCard from "../../components/ui/StatCard";

const KPI_CARDS = [
  { key: "total_leads", label: "Total Leads", icon: Users, color: "#3b82f6", prefix: "" },
  { key: "new_leads", label: "New Leads", icon: UserPlus, color: "#8b5cf6", prefix: "" },
  { key: "active_clients", label: "Active Clients", icon: UserCheck, color: "#10b981", prefix: "" },
  { key: "total_deals", label: "Total Deals", icon: TrendingUp, color: "#f59e0b", prefix: "" },
  { key: "won_deals", label: "Won Deals", icon: Award, color: "#10b981", prefix: "" },
  { key: "lost_deals", label: "Lost Deals", icon: XCircle, color: "#ef4444", prefix: "" },
  { key: "total_bookings", label: "Bookings", icon: CalendarCheck, color: "#6366f1", prefix: "" },
  { key: "revenue", label: "Revenue", icon: DollarSign, color: "#10b981", prefix: "PKR " },
  { key: "pending_revenue", label: "Pending Revenue", icon: Clock, color: "#f59e0b", prefix: "PKR " },
  { key: "overdue_installments", label: "Overdue Installments", icon: AlertTriangle, color: "#ef4444", prefix: "" },
];

const DONUT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#6366f1", "#ec4899", "#84cc16", "#14b8a6"];

const FUNNEL_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#6366f1", "#10b981"];

function FunnelRow({ stage, count, max, prevCount, color, index }: {
  stage: string; count: number; max: number; prevCount: number; color: string; index: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const pctOfPrev = index === 0 ? 100 : prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
  const pctColor = pctOfPrev >= 50 ? "#10b981" : pctOfPrev >= 25 ? "#f59e0b" : "#ef4444";
  const arrow = index === 0 ? "" : pctOfPrev >= 100 ? "→" : pctOfPrev >= 50 ? "↓" : "↓↓";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-28 shrink-0 text-right truncate" style={{ color: "var(--text-muted)" }}>{stage}</span>
      <div className="flex-1 h-7 rounded-lg overflow-hidden" style={{ background: "var(--bg-surface2)" }}>
        <div className="h-full rounded-lg flex items-center justify-end px-2 text-xs font-bold text-white transition-all" style={{ width: `${Math.max(pct, 4)}%`, background: color }}>
          {count}
        </div>
      </div>
      {index > 0 && (
        <span className="text-[10px] font-mono w-14 text-right shrink-0" style={{ color: pctColor }}>
          {pctOfPrev}% {arrow}
        </span>
      )}
    </div>
  );
}

function ActivityIcon({ action }: { action: string }) {
  const icons: Record<string, string> = {
    lead_created: "\u{1F464}", lead_converted: "\u2705", followup_added: "\u{1F4DE}",
    followup_completed: "\u2705", visit_scheduled: "\u{1F4CD}", visit_status_changed: "\u{1F4CD}",
    deal_created: "\u{1F91D}", deal_won: "\u{1F3C6}", booking_created: "\u{1F516}",
    payment_received: "\u{1F4B0}", lead_status_changed: "\u{1F504}",
  };
  return <span className="text-base shrink-0">{icons[action] ?? "\u{1F4CB}"}</span>;
}

function humanizeDescription(action: string, description: string | null, entityType: string): string {
  if (description) {
    const cleaned = description.replace(/lead status changed from \w+ to /, "");
    if (action === "lead_status_changed" && description.includes(" from ")) {
      const parts = description.match(/from (\w+) to (\w+)/);
      if (parts) {
        const toStage = parts[2].replace(/_/g, " ");
        const name = description.split(" ")[0] || "A lead";
        return `${name} moved to ${toStage.charAt(0).toUpperCase() + toStage.slice(1)} stage`;
      }
    }
    if (action === "followup_completed" || description.includes("follow-up")) {
      return description.replace(/follow.?up/i, "Call follow-up").replace(/completed/i, "completed").trim();
    }
    if (action === "visit_scheduled" || description.includes("visit")) {
      return description.charAt(0).toUpperCase() + description.slice(1);
    }
    return description;
  }
  if (action === "lead_created") return "New lead created";
  if (action === "deal_created") return "New deal created";
  if (action === "booking_created") return "New booking created";
  if (action === "payment_received") return "Payment received";
  if (action === "deal_won") return "Deal was won";
  return action.replace(/_/g, " ");
}

function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diff === 0) return "TODAY";
  if (diff === 1) return "YESTERDAY";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function groupByDate(activities: RecentActivityItem[]): { dateLabel: string; items: RecentActivityItem[] }[] {
  const groups: Record<string, RecentActivityItem[]> = {};
  activities.forEach(a => {
    const label = formatActivityDate(a.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  });
  return Object.entries(groups).map(([dateLabel, items]) => ({ dateLabel, items }));
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = pct >= 100 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-surface2)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>{pct}%</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const count = payload.find((p: any) => p.dataKey === "count")?.value ?? 0;
  const value = payload.find((p: any) => p.dataKey === "value")?.value ?? 0;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{label}</p>
      <p style={{ color: "#3b82f6" }}>{count} deal{count !== 1 ? "s" : ""}</p>
      <p style={{ color: "#10b981" }}>PKR {Number(value).toLocaleString()}</p>
    </div>
  );
}

export default function CRMDashboard() {
  const navigate = useNavigate();
  const { data, loading, fetch } = useCrmDashboardStore();
  const [showAllActivities, setShowAllActivities] = useState(false);

  useEffect(() => { void fetch(); }, []);

  const stats = data?.stats;
  const winRate = stats && stats.total_deals > 0 ? Math.round((stats.won_deals / stats.total_deals) * 100) : null;
  const avgDealSize = stats && stats.won_deals > 0 ? Math.round(stats.revenue / stats.won_deals) : null;
  const avgLeadAge = stats?.avg_lead_age ?? 0;

  const funnelMax = useMemo(() => {
    if (!data?.conversion_funnel?.length) return 1;
    return Math.max(...data.conversion_funnel.map(x => x.count), 1);
  }, [data?.conversion_funnel]);

  const totalLeadsWithSource = useMemo(() => {
    if (!data?.lead_source_distribution) return 0;
    return data.lead_source_distribution.filter(s => s.source !== "Not set").reduce((a, b) => a + b.count, 0);
  }, [data?.lead_source_distribution]);

  const activitiesToShow = useMemo(() => {
    if (!data?.recent_activities) return [];
    return showAllActivities ? data.recent_activities : data.recent_activities.slice(0, 20);
  }, [data?.recent_activities, showAllActivities]);

  const activityGroups = useMemo(() => groupByDate(activitiesToShow), [activitiesToShow]);

  const totalLeads = stats?.total_leads ?? 0;
  const showNoSource = totalLeads > 0 && totalLeadsWithSource === 0;

  if (loading && !data) {
    return (
      <div className="p-6 space-y-5 animate-slide-up">
        <h1 className="text-xl font-bold text-primary">CRM Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "var(--bg-surface2)" }}>
              <div className="h-3 w-16 mb-3 rounded" style={{ background: "var(--bg-surface)" }} />
              <div className="h-6 w-20 rounded" style={{ background: "var(--bg-surface)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">CRM Dashboard</h1>
          <p className="text-xs text-muted mt-0.5">Real-time overview of your sales pipeline and customer lifecycle</p>
        </div>
        <button onClick={fetch} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <BarChart3 size={14} /> Refresh
        </button>
      </div>

      {/* ── SECTION 1: KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {KPI_CARDS.map(card => {
          const val = (stats as any)?.[card.key] ?? 0;
          const display = card.prefix ? `${card.prefix}${val?.toLocaleString?.() ?? 0}` : (val ?? 0).toLocaleString();
          return (
            <StatCard key={card.key} label={card.label} value={display} icon={card.icon} iconBg={`${card.color}15`} iconColor={card.color} />
          );
        })}
        <StatCard label="Win Rate" value={winRate !== null ? `${winRate}%` : "\u2014"} icon={Target} iconBg="rgba(139,92,246,0.15)" iconColor="#8b5cf6" sub="deals won" />
        <StatCard label="Avg Deal Size" value={avgDealSize !== null ? `PKR ${avgDealSize.toLocaleString()}` : "\u2014"} icon={DollarSign} iconBg="rgba(99,102,241,0.15)" iconColor="#6366f1" sub="per deal average" />
        <StatCard label="Avg Lead Age" value={avgLeadAge > 0 ? `${avgLeadAge.toFixed(1)} days` : "\u2014"} icon={Clock} iconBg="rgba(245,158,11,0.15)" iconColor="#f59e0b" sub="avg time to convert" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── SECTION 2: CONVERSION FUNNEL ── */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold text-primary mb-4">Conversion Funnel</h3>
          <div className="space-y-2">
            {(data?.conversion_funnel ?? []).length === 0 ? (
              <p className="text-xs text-muted">No funnel data yet</p>
            ) : (
              (data?.conversion_funnel ?? []).map((f, i) => (
                <FunnelRow
                  key={i}
                  stage={f.stage}
                  count={f.count}
                  max={funnelMax}
                  prevCount={i > 0 ? data!.conversion_funnel[i - 1].count : 1}
                  color={FUNNEL_COLORS[i] ?? "#94a3b8"}
                  index={i}
                />
              ))
            )}
          </div>
        </div>

        {/* ── SECTION 3: LEAD SOURCES DONUT CHART ── */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold text-primary mb-4">Lead Sources</h3>
          {showNoSource || (data?.lead_source_distribution ?? []).length === 0 ? (
            <p className="text-xs text-muted">No source data yet</p>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={data!.lead_source_distribution}
                    cx="50%" cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="source"
                  >
                    {(data?.lead_source_distribution ?? []).map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="mt-3 space-y-1">
                {(data?.lead_source_distribution ?? []).map((s, i) => {
                  const total = (data?.lead_source_distribution ?? []).reduce((a, b) => a + b.count, 0);
                  const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span style={{ color: "var(--text-secondary)" }} className="flex-1">{s.source}</span>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{s.count}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 4: MONTHLY SALES CHART ── */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold text-primary mb-4">Monthly Sales</h3>
          {(data?.monthly_sales ?? []).length === 0 ? (
            <p className="text-xs text-muted">No sales data yet</p>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data!.monthly_sales.slice().reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    tickFormatter={(v) => {
                      const parts = v.split("-");
                      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                      return months[parseInt(parts[1], 10) - 1] || v;
                    }}
                  />
                  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value: string) => (
                      <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                        {value === "count" ? "Deals" : "Revenue"}
                      </span>
                    )}
                  />
                  <Bar yAxisId="left" dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="count" />
                  <Line yAxisId="right" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="value" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── SECTION 5: DEALER PERFORMANCE TABLE ── */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold text-primary mb-4">Dealer Performance</h3>
          {(data?.dealer_performance ?? []).length === 0 ? (
            <p className="text-xs text-muted">No dealer data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="erp-table w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[10px]">Dealer</th>
                    <th className="text-right text-[10px]">Leads</th>
                    <th className="text-right text-[10px]">Converted</th>
                    <th className="text-right text-[10px]">Rate</th>
                    <th className="text-right text-[10px]">Sales</th>
                    <th className="text-right text-[10px]">Avg Deal</th>
                    <th className="text-right text-[10px]">Target (Rs)</th>
                    <th className="text-right text-[10px]">Achievement</th>
                    <th className="text-right text-[10px]">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.dealer_performance ?? []).slice(0, 10).map((d, i) => (
                    <tr key={i} className="cursor-pointer" onClick={() => navigate(`/crm?tab=dealers`)}>
                      <td className="text-xs text-primary font-medium">{d.dealer_name}</td>
                      <td className="text-xs text-right text-secondary">{d.total_leads}</td>
                      <td className="text-xs text-right text-secondary">{d.converted_leads}</td>
                      <td className="text-xs text-right" style={{ color: "#10b981" }}>
                        {d.total_leads > 0 ? Math.round((d.converted_leads / d.total_leads) * 100) : 0}%
                      </td>
                      <td className="text-xs text-right font-medium text-primary">{Number(d.total_sales).toLocaleString()}</td>
                      <td className="text-xs text-right" style={{ color: "#6366f1" }}>
                        {d.won_deals > 0 ? `PKR ${Number(d.avg_deal_value).toLocaleString()}` : "\u2014"}
                      </td>
                      <td className="text-xs text-right" style={{ color: "var(--text-secondary)" }}>
                        {d.monthly_target ? `PKR ${Number(d.monthly_target).toLocaleString()}` : "\u2014"}
                      </td>
                      <td className="text-xs text-right" style={{ minWidth: 100 }}>
                        {d.monthly_target && d.monthly_target > 0 ? (
                          <ProgressBar value={Number(d.total_sales)} max={Number(d.monthly_target)} />
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>\u2014</span>
                        )}
                      </td>
                      <td className="text-xs text-right" style={{ color: "#f59e0b" }}>{Number(d.commission_earned).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── SECTION 6: RECENT ACTIVITY FEED ── */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold text-primary mb-4">Recent Activity</h3>
          {activitiesToShow.length === 0 ? (
            <p className="text-xs text-muted py-8 text-center">No recent activity</p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {activityGroups.map((group) => (
                <div key={group.dateLabel}>
                  <p className="text-[10px] font-bold tracking-widest mb-2 sticky top-0 py-1 z-10"
                    style={{ color: "var(--text-muted)", background: "var(--bg-surface)" }}>
                    {group.dateLabel}
                  </p>
                  <div className="space-y-2">
                    {group.items.map((a) => (
                      <div key={a.id} className="flex items-start gap-2.5">
                        <ActivityIcon action={a.action} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
                            {humanizeDescription(a.action, a.description, a.entity_type)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {a.performed_by_name && (
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                by {a.performed_by_name}
                              </span>
                            )}
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {formatTimeAgo(a.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!showAllActivities && (data?.recent_activities?.length ?? 0) > 20 && (
                <button
                  onClick={() => setShowAllActivities(true)}
                  className="text-xs font-medium w-full py-2 rounded-lg transition-colors"
                  style={{ color: "#60a5fa", background: "var(--bg-surface2)" }}
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}