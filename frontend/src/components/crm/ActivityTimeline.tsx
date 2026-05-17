import { useState } from "react";
import {
  Phone, MessageCircle, Calendar, StickyNote, Mail,
  CheckCircle2, XCircle, Clock, Trash2, ChevronDown,
} from "lucide-react";
import { Activity, ActivityType, crmApi } from "../../lib/crmApi";

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ActivityType, {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
  emoji: string;
}> = {
  call:      { icon: Phone,          color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  label: "Call",       emoji: "📞" },
  whatsapp:  { icon: MessageCircle,  color: "#25d366", bg: "rgba(37,211,102,0.12)",  label: "WhatsApp",   emoji: "💬" },
  followup:  { icon: Calendar,       color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Follow-up",  emoji: "📅" },
  note:      { icon: StickyNote,     color: "#10b981", bg: "rgba(16,185,129,0.12)",  label: "Note",       emoji: "📝" },
  email:     { icon: Mail,           color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  label: "Email",      emoji: "✉️" },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  initiated:  { color: "#3b82f6", label: "Initiated" },
  completed:  { color: "#10b981", label: "Completed" },
  missed:     { color: "#ef4444", label: "Missed" },
  pending:    { color: "#f59e0b", label: "Pending" },
  done:       { color: "#10b981", label: "Done" },
  sent:       { color: "#8b5cf6", label: "Sent" },
};

// ── Filter bar ────────────────────────────────────────────────────────────────

const FILTERS: { key: ActivityType | "all"; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "call",     label: "📞 Calls" },
  { key: "whatsapp", label: "💬 WhatsApp" },
  { key: "followup", label: "📅 Follow-ups" },
  { key: "note",     label: "📝 Notes" },
  { key: "email",    label: "✉️ Emails" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)   return "Just now";
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)   return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Activity Item ─────────────────────────────────────────────────────────────

function ActivityItem({
  activity,
  onStatusChange,
  onDelete,
}: {
  activity: Activity;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.note;
  const statusCfg = STATUS_CONFIG[activity.status] ?? { color: "#94a3b8", label: activity.status };
  const Icon = cfg.icon;

  const callStatusOptions =
    activity.type === "call"     ? ["initiated", "completed", "missed"] :
    activity.type === "followup" ? ["pending", "done"] :
    activity.type === "whatsapp" ? ["initiated", "sent"] :
    activity.type === "email"    ? ["initiated", "sent"] :
    [];

  return (
    <div className="flex gap-3 relative group">
      {/* Timeline dot */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 text-white"
        style={{ background: cfg.color }}
      >
        <Icon size={13} />
      </div>

      {/* Content card */}
      <div
        className="flex-1 min-w-0 rounded-xl px-4 py-3 mb-1"
        style={{ background: cfg.bg, border: `1px solid ${cfg.color}25` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Type + status */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                {cfg.emoji} {cfg.label}
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: `${statusCfg.color}20`, color: statusCfg.color }}
              >
                {statusCfg.label}
              </span>
              {activity.type === "followup" && activity.scheduled_at && (
                <span className="text-[10px] flex items-center gap-1" style={{ color: "#f59e0b" }}>
                  <Clock size={10} /> {formatScheduled(activity.scheduled_at)}
                </span>
              )}
            </div>

            {/* Message */}
            {activity.message && (
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {activity.message}
              </p>
            )}

            {/* Timestamp */}
            <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
              {formatDateTime(activity.created_at)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {callStatusOptions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                  style={{ border: `1px solid ${cfg.color}40`, color: cfg.color }}
                  title="Update status"
                >
                  Status <ChevronDown size={10} />
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-xl"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", minWidth: 120 }}
                  >
                    {callStatusOptions.map(s => (
                      <button
                        key={s}
                        onClick={() => { onStatusChange(activity.id, s); setMenuOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs transition-colors"
                        style={{ color: STATUS_CONFIG[s]?.color ?? "var(--text-secondary)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {STATUS_CONFIG[s]?.label ?? s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => onDelete(activity.id)}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "#ef4444" }}
              title="Delete activity"
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Props = {
  activities: Activity[];
  onRefresh: () => void;
};

export default function ActivityTimeline({ activities, onRefresh }: Props) {
  const [filter, setFilter] = useState<ActivityType | "all">("all");

  const filtered = filter === "all"
    ? activities
    : activities.filter(a => a.type === filter);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await crmApi.updateActivity(id, { status });
      onRefresh();
    } catch {
      // silently fail — user can retry
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this activity?")) return;
    try {
      await crmApi.deleteActivity(id);
      onRefresh();
    } catch {
      // silently fail
    }
  };

  return (
    <div>
      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={
              filter === f.key
                ? { background: "var(--accent)", color: "#fff" }
                : { background: "var(--bg-surface2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
            }
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
          {filtered.length} {filtered.length === 1 ? "activity" : "activities"}
        </span>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activities yet.</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Use the Quick Actions above to log calls, notes, and more.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-4 top-0 bottom-0 w-px"
            style={{ background: "var(--border)" }}
          />
          <div className="space-y-2 pl-1">
            {filtered.map(a => (
              <ActivityItem
                key={a.id}
                activity={a}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
