import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Edit2, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import type { Reminder } from "../../lib/remindersApi";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-l-red-600",
  high: "border-l-orange-500",
  medium: "border-l-amber-500",
  low: "border-l-blue-500",
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  upcoming: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  due_soon: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  overdue: "bg-red-500/15 text-red-400 border-red-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/30 line-through",
  snoozed: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const CATEGORY_TAGS: Record<string, string> = {
  meeting: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  task: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  followup: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  deadline: "bg-red-500/15 text-red-400 border-red-500/30",
  inventory: "bg-green-500/15 text-green-400 border-green-500/30",
  general: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

interface Props {
  reminder: Reminder;
  onComplete?: (id: number) => void;
  onSnooze?: (id: number, minutes: number) => void;
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (id: number) => void;
}

export default function ReminderCard({ reminder, onComplete, onSnooze, onEdit, onDelete }: Props) {
  const [countdown, setCountdown] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const remindTime = new Date(reminder.remind_at).getTime();

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = remindTime - now;
      if (diff <= 0) {
        setCountdown("Due now");
        setOverdue(true);
        return;
      }
      setOverdue(false);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${mins}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${mins}m ${secs}s`);
      } else if (mins > 0) {
        setCountdown(`${mins}m ${secs}s left`);
      } else {
        setCountdown(`${secs}s left`);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [remindTime]);

  const computedStatus = reminder.status === "completed"
    ? "completed"
    : reminder.status === "cancelled"
      ? "cancelled"
      : reminder.status === "snoozed"
        ? "snoozed"
        : overdue
          ? "overdue"
          : remindTime - Date.now() <= reminder.reminder_before * 60000
            ? "due_soon"
            : remindTime - Date.now() <= 3600000
              ? "upcoming"
              : "pending";

  const isCompleted = reminder.status === "completed";

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border bg-surface transition-all
        ${overdue && !isCompleted ? "border-red-500/40 animate-pulse" : "border-theme"}
        ${isCompleted ? "opacity-60" : ""}`}
    >
      {onComplete && reminder.status === "pending" && (
        <button
          onClick={() => onComplete(reminder.id)}
          className="mt-0.5 shrink-0 text-muted hover:text-emerald-400 transition-colors"
        >
          <CheckCircle2 size={16} />
        </button>
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`text-sm font-medium text-primary truncate ${isCompleted ? "line-through" : ""}`}>
            {reminder.title}
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_BADGE[reminder.priority] ?? PRIORITY_BADGE.medium}`}>
            {reminder.priority}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_BADGE[computedStatus] ?? STATUS_BADGE.pending} ${overdue && !isCompleted ? "animate-pulse" : ""}`}>
            {computedStatus}
          </span>
          {reminder.category && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CATEGORY_TAGS[reminder.category] ?? CATEGORY_TAGS.general}`}>
              {reminder.category}
            </span>
          )}
          {reminder.repeat !== "none" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400">
              ↻ {reminder.repeat}
            </span>
          )}
        </div>
        {reminder.description && (
          <p className="text-xs text-secondary line-clamp-2">{reminder.description}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-muted flex-wrap">
          <span className="flex items-center gap-1"><Clock size={10} /> {new Date(reminder.remind_at).toLocaleString()}</span>
          {countdown && <span className={`font-medium ${overdue ? "text-red-400" : "text-amber-400"}`}>{countdown}</span>}
          {reminder.reminder_before > 0 && <span>Remind {reminder.reminder_before}m before</span>}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 relative">
        {onSnooze && reminder.status === "pending" && (
          <div className="relative">
            <button
              onClick={() => setSnoozeOpen((v) => !v)}
              title="Snooze"
              className="p-1.5 rounded text-muted hover:text-purple-400 transition-colors"
            >
              <RotateCcw size={13} />
            </button>
            {snoozeOpen && (
              <div className="absolute top-full right-0 mt-1 bg-surface border border-theme rounded-lg shadow-xl z-50 py-1 min-w-[90px]"
                onMouseLeave={() => setSnoozeOpen(false)}
              >
                {[5, 10, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => { onSnooze(reminder.id, mins); setSnoozeOpen(false); }}
                    className="block w-full text-left text-[11px] px-3 py-1.5 text-secondary hover:bg-white/5 transition-colors"
                  >
                    {mins} min{mins > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {onEdit && (
          <button onClick={() => onEdit(reminder)} title="Edit" className="p-1.5 rounded text-muted hover:text-blue-400 transition-colors">
            <Edit2 size={13} />
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(reminder.id)} title="Delete" className="p-1.5 rounded text-muted hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
