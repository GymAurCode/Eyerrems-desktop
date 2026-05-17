import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore, type BootstrapData } from "../store/auth";
import {
  Building2, TrendingUp, Receipt, DollarSign,
  Plus, Users, ArrowUpRight, Activity,
  ShoppingBag, UserPlus, Wallet,
} from "lucide-react";
import { formatCurrency } from "../lib/currency";

// ── Metric card ───────────────────────────────────────────────────────────────
type MetricCardProps = {
  label: string;
  value: string | number;
  icon: React.ElementType;
  glowClass: string;
  iconBg: string;
  iconColor: string;
  trend?: string;
};

function MetricCard({ label, value, icon: Icon, glowClass, iconBg, iconColor, trend }: MetricCardProps) {
  return (
    <div className={`card-dark p-5 transition-all duration-200 hover:scale-[1.02] cursor-default ${glowClass}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <ArrowUpRight size={12} /> {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-primary mb-1">{value}</p>
      <p className="text-xs text-muted font-medium">{label}</p>
    </div>
  );
}

// ── Activity helpers ──────────────────────────────────────────────────────────
type ActivityItem = { type: string; title: string; amount: number | null; timestamp: string };

const ACTIVITY_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  sale:     { icon: ShoppingBag, color: "#f59e0b", label: "Sale" },
  property: { icon: Building2,   color: "#3b82f6", label: "Property" },
  client:   { icon: UserPlus,    color: "#10b981", label: "Client" },
  lead:     { icon: Users,       color: "#6366f1", label: "Lead" },
  expense:  { icon: Receipt,     color: "#ef4444", label: "Expense" },
  payment:  { icon: Wallet,      color: "#10b981", label: "Payment" },
};

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 py-2.5 border-b border-theme last:border-0">
          <div className="skeleton w-7 h-7 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="skeleton h-2.5 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Add Property", path: "/property", qaClass: "qa-glass-blue" },
  { label: "New Client",   path: "/crm",      qaClass: "qa-glass-green" },
  { label: "Add Expense",  path: "/finance",  qaClass: "qa-glass-amber" },
  { label: "View Reports", path: "/admin",    qaClass: "qa-glass-cyan" },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const navigate  = useNavigate();

  const [bsData,  setBsData]  = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bootstrap().then((data) => {
      if (!cancelled) {
        setBsData(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [bootstrap]);

  const data     = bsData?.stats ?? null;
  const activity = bsData?.activity ?? [];

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-primary">Overview</h1>
        <p className="text-xs text-muted mt-0.5">Real-time snapshot of your portfolio</p>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total Properties" value={data?.total_properties ?? "—"} icon={Building2}
          glowClass="glow-blue glow-blue-hover" iconBg="rgba(59,130,246,0.12)" iconColor="#3b82f6" trend="+2 this month" />
        <MetricCard label="Sales Revenue" value={data?.income ? formatCurrency(data.income) : "—"} icon={TrendingUp}
          glowClass="glow-green glow-green-hover" iconBg="rgba(16,185,129,0.12)" iconColor="#10b981" trend="+12.4%" />
        <MetricCard label="Expenses" value={data?.expense ? formatCurrency(data.expense) : "—"} icon={Receipt}
          glowClass="glow-red glow-red-hover" iconBg="rgba(239,68,68,0.12)" iconColor="#ef4444" />
        <MetricCard label="Active Deals" value={data?.active_deals ?? "—"} icon={DollarSign}
          glowClass="glow-yellow glow-yellow-hover" iconBg="rgba(245,158,11,0.12)" iconColor="#f59e0b" trend="+3 this week" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Units", value: data?.total_units    ?? "—", color: "#3b82f6" },
          { label: "Occupied",    value: data?.occupied_units ?? "—", color: "#10b981" },
          { label: "Vacant",      value: data?.vacant_units   ?? "—", color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-dark px-5 py-4" style={{ border: "1px solid var(--border)" }}>
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 card-dark p-5" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-primary">Recent Activity</h2>
          </div>

          {loading && <ActivitySkeleton />}

          {!loading && activity.length === 0 && (
            <div className="py-8 text-center">
              <Activity size={24} className="text-muted mx-auto mb-2" />
              <p className="text-xs text-muted">No activity recorded yet.</p>
            </div>
          )}

          {!loading && activity.length > 0 && (
            <div className="space-y-0">
              {activity.map((item: ActivityItem, i: number) => {
                const meta = ACTIVITY_META[item.type] ?? ACTIVITY_META.sale;
                const Icon = meta.icon;
                return (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-theme last:border-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${meta.color}18` }}>
                      <Icon size={13} style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary leading-relaxed truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted">{formatTime(item.timestamp)}</span>
                        {item.amount != null && (
                          <span className="text-[10px] font-semibold" style={{ color: meta.color }}>
                            {formatCurrency(item.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `${meta.color}15`, color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card-dark p-5" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Plus size={15} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-primary">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {QUICK_ACTIONS.map(({ label, path, qaClass }) => (
              <button key={label} type="button" onClick={() => navigate(path)}
                className={`w-full px-4 py-3 rounded-2xl text-left text-sm font-semibold tracking-tight transition-all duration-150 hover:-translate-y-[1px] border backdrop-blur-md ${qaClass}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
