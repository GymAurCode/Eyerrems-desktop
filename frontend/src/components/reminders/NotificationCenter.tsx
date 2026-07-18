import { useState } from "react";
import { Bell, BellOff, Check, Clock, X } from "lucide-react";
import type { Reminder } from "../../lib/remindersApi";
import { remindersApi } from "../../lib/remindersApi";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
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
  notifications: Reminder[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
  connected: boolean;
}

export default function NotificationCenter({ notifications, onDismiss, onDismissAll, connected }: Props) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [snoozeId, setSnoozeId] = useState<number | null>(null);

  if (notifications.length === 0) return null;

  const handleComplete = async (id: number) => {
    setLoadingId(id);
    try {
      await remindersApi.completeReminder(id);
      onDismiss(id);
    } catch {
      // silently fail
    } finally {
      setLoadingId(null);
    }
  };

  const handleSnooze = async (id: number, minutes: number) => {
    setLoadingId(id);
    try {
      await remindersApi.snoozeReminder(id, minutes);
      onDismiss(id);
    } catch {
      // silently fail
    } finally {
      setLoadingId(null);
      setSnoozeId(null);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 w-96 space-y-2">
      {notifications.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={onDismissAll}
            className="text-[11px] px-2 py-1 rounded bg-surface border border-theme text-muted hover:text-primary transition-colors"
          >
            Dismiss all
          </button>
        </div>
      )}
      {notifications.map((reminder) => (
        <div
          key={reminder.id}
          className="rounded-xl border border-theme bg-surface shadow-2xl overflow-hidden animate-in slide-in-from-right"
          style={{ animation: "slideIn 0.2s ease-out" }}
        >
          <div className={`h-1 ${PRIORITY_COLORS[reminder.priority] ?? "bg-amber-500"}`} />
          <div className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                    PRIORITY_COLORS[reminder.priority]?.replace("bg-", "text-") ??
                    "text-amber-500"
                  }`}
                  style={{
                    background: `${
                      reminder.priority === "critical"
                        ? "rgba(220,38,38,0.15)"
                        : reminder.priority === "high"
                          ? "rgba(249,115,22,0.15)"
                          : reminder.priority === "medium"
                            ? "rgba(217,119,6,0.15)"
                            : "rgba(59,130,246,0.15)"
                    }`,
                  }}
                >
                  {reminder.priority}
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
              <button
                onClick={() => onDismiss(reminder.id)}
                className="p-0.5 rounded text-muted hover:text-primary shrink-0"
              >
                <X size={12} />
              </button>
            </div>
            <p className="text-sm font-medium text-primary line-clamp-2">{reminder.title}</p>
            {reminder.description && (
              <p className="text-xs text-secondary line-clamp-2">{reminder.description}</p>
            )}
            <p className="text-[11px] text-muted">
              {new Date(reminder.remind_at).toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleComplete(reminder.id)}
                disabled={loadingId === reminder.id}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
              >
                {loadingId === reminder.id ? (
                  <span className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check size={10} />
                )}
                Done
              </button>
              <div className="relative">
                <button
                  onClick={() => setSnoozeId(snoozeId === reminder.id ? null : reminder.id)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition-colors"
                >
                  <Clock size={10} />
                  Snooze
                </button>
                {snoozeId === reminder.id && (
                  <div className="absolute top-full left-0 mt-1 bg-surface border border-theme rounded-lg shadow-xl z-50 py-1 min-w-[100px]">
                    {[5, 10, 15, 30, 60].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => handleSnooze(reminder.id, mins)}
                        className="block w-full text-left text-[11px] px-3 py-1.5 text-secondary hover:bg-white/5 transition-colors"
                      >
                        {mins} min{mins > 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-in { animation: slideIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
