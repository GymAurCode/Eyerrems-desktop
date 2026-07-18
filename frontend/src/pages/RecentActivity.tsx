import { useEffect, useState, useMemo } from "react";
import { Clock, FilterX, Loader2 } from "lucide-react";
import { api } from "../lib/api";

type ActivityItem = {
  type: "sale" | "property" | "client" | "lead" | "expense" | "payment";
  title: string;
  amount: number | null;
  timestamp: string;
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  sale:     { label: "Sale",     color: "#10b981" },
  property: { label: "Property", color: "#3b82f6" },
  client:   { label: "Client",   color: "#a855f7" },
  lead:     { label: "Lead",     color: "#f59e0b" },
  expense:  { label: "Expense",  color: "#ef4444" },
  payment:  { label: "Payment",  color: "#06b6d4" },
};

const ALL_TYPES = Object.keys(TYPE_CONFIG);

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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

function getDateGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dStart.getTime() === today.getTime()) return "Today";
  if (dStart.getTime() === yesterday.getTime()) return "Yesterday";
  const diffDays = Math.floor((today.getTime() - dStart.getTime()) / 86400000);
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "Earlier This Month";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function RecentActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ActivityItem[]>("/activity/recent", { params: { limit: 200 } });
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(
    () => typeFilter ? items.filter((i) => i.type === typeFilter) : items,
    [items, typeFilter],
  );

  const grouped = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};
    filtered.forEach((item) => {
      const key = getDateGroup(item.timestamp);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    const order = ["Today", "Yesterday", "This Week", "Earlier This Month"];
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
  }, [filtered]);

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Recent Activity</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            All recent changes across the system
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          style={{ background: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          <Loader2 size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div
        className="flex flex-wrap items-center gap-2 p-3 rounded-lg"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <span className="text-[10px] font-medium uppercase tracking-wider mr-1" style={{ color: "var(--text-muted)" }}>Filter:</span>
        <button
          onClick={() => setTypeFilter("")}
          className="px-2.5 py-1 text-[10px] font-medium rounded-full transition-all"
          style={{
            background: !typeFilter ? "var(--accent-primary, #3b82f6)" : "var(--bg-surface-hover)",
            color: !typeFilter ? "#fff" : "var(--text-secondary)",
            border: `1px solid ${!typeFilter ? "transparent" : "var(--border)"}`,
          }}
        >
          All
        </button>
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
            className="px-2.5 py-1 text-[10px] font-medium rounded-full transition-all flex items-center gap-1"
            style={{
              background: typeFilter === t ? `${TYPE_CONFIG[t].color}20` : "var(--bg-surface-hover)",
              color: typeFilter === t ? TYPE_CONFIG[t].color : "var(--text-secondary)",
              border: `1px solid ${typeFilter === t ? `${TYPE_CONFIG[t].color}40` : "var(--border)"}`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_CONFIG[t].color }} />
            {TYPE_CONFIG[t].label}
          </button>
        ))}
        {typeFilter && (
          <button onClick={() => setTypeFilter("")} className="ml-auto p-1 rounded" style={{ color: "var(--text-muted)" }}>
            <FilterX size={12} />
          </button>
        )}
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Clock size={32} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No recent activity found</p>
          </div>
        ) : (
          grouped.map(([group, activities]) => (
            <div key={group}>
              <h3
                className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1"
                style={{ color: "var(--text-muted)" }}
              >
                {group}
              </h3>
              <div
                className="rounded-lg overflow-hidden"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
              >
                {activities.map((act, i) => {
                  const cfg = TYPE_CONFIG[act.type] ?? { label: "Other", color: "#6b7280" };
                  return (
                    <div
                      key={`${act.timestamp}-${i}`}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ borderBottom: i < activities.length - 1 ? "0.5px solid var(--border-subtle)" : "none" }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: cfg.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] leading-snug" style={{ color: "var(--text-primary)" }}>
                          {act.title}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium mr-1.5"
                            style={{
                              background: `${cfg.color}15`,
                              color: cfg.color,
                            }}
                          >
                            {cfg.label}
                          </span>
                          {timeAgo(act.timestamp)}
                        </p>
                      </div>
                      {act.amount != null && (
                        <span
                          className="text-[12px] font-semibold whitespace-nowrap"
                          style={{ color: act.amount >= 0 ? "var(--text-primary)" : "#ef4444" }}
                        >
                          {act.amount >= 0 ? "+" : ""}{act.amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
