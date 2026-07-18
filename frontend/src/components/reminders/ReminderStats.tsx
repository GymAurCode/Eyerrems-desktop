import { AlertTriangle, CheckCircle2, Clock, List } from "lucide-react";
import type { Reminder } from "../../lib/remindersApi";

interface Props {
  reminders: Reminder[];
}

export default function ReminderStats({ reminders }: Props) {
  const total = reminders.length;
  const completed = reminders.filter((r) => r.status === "completed").length;
  const pending = reminders.filter((r) => r.status === "pending").length;
  const overdue = reminders.filter((r) => {
    if (r.status === "completed" || r.status === "cancelled" || r.status === "snoozed") return false;
    return new Date(r.remind_at) < new Date();
  }).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const priorityDist: Record<string, number> = {};
  for (const r of reminders) {
    priorityDist[r.priority] = (priorityDist[r.priority] || 0) + 1;
  }

  const PRIORITY_BAR_COLORS: Record<string, string> = {
    critical: "bg-red-600",
    high: "bg-orange-500",
    medium: "bg-amber-500",
    low: "bg-blue-500",
  };

  const PRIORITY_LABELS: Record<string, string> = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  const maxPriority = Math.max(...Object.values(priorityDist), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", count: total, icon: List, color: "text-blue-400" },
          { label: "Completed", count: completed, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Pending", count: pending, icon: Clock, color: "text-amber-400" },
          { label: "Overdue", count: overdue, icon: AlertTriangle, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-theme bg-surface p-3 flex items-center gap-3">
            <s.icon size={16} className={s.color} />
            <div>
              <p className="text-lg font-bold text-primary">{s.count}</p>
              <p className="text-[10px] text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-theme bg-surface p-4">
          <p className="text-xs font-semibold text-primary mb-3">Completion Rate</p>
          <div className="flex items-center justify-center">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54"
                fill="none" stroke="#10B981"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - completionRate / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fill="var(--text-primary)" fontSize="16" fontWeight="bold">
                {completionRate}%
              </text>
            </svg>
          </div>
        </div>

        <div className="rounded-xl border border-theme bg-surface p-4">
          <p className="text-xs font-semibold text-primary mb-3">Priority Distribution</p>
          <div className="space-y-2">
            {(["critical", "high", "medium", "low"] as const).map((p) => {
              const count = priorityDist[p] || 0;
              const pct = maxPriority > 0 ? (count / maxPriority) * 100 : 0;
              return (
                <div key={p}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-secondary">{PRIORITY_LABELS[p]}</span>
                    <span className="text-primary font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${PRIORITY_BAR_COLORS[p]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
