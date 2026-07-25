import { useEffect, useState } from "react";
import { Calendar, Clock, AlertTriangle, Bell, ChevronDown, CheckCircle2 } from "lucide-react";
import type { DashboardData } from "../../lib/remindersApi";
import { remindersApi } from "../../lib/remindersApi";
import ReminderCard from "./ReminderCard";
import type { Reminder } from "../../lib/remindersApi";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";
import { playTaskSound } from "../../hooks/useReminderWebSocket";

interface Props {
  refreshKey?: number;
  onEdit: (reminder: Reminder) => void;
}

export default function ReminderDashboard({ refreshKey, onEdit }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const pushToast = useNotifStore((s) => s.pushToast);
  const [deleteTarget, setDeleteTarget] = useState<{ item: any; type?: string } | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await remindersApi.getDashboard();
      setData(d);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  if (loading) return <div className="py-12 text-center text-xs text-muted">Loading dashboard...</div>;
  if (!data) return <div className="py-12 text-center text-xs text-muted">Could not load dashboard.</div>;

  const stats = [
    { label: "Today Total", count: data.today_total, icon: Calendar, color: "text-blue-400" },
    { label: "Today Pending", count: data.today_pending, icon: Clock, color: "text-amber-400" },
    { label: "Overdue", count: data.overdue.length, icon: AlertTriangle, color: "text-red-400" },
    { label: "Upcoming 24h", count: data.upcoming_24h.length, icon: Bell, color: "text-emerald-400" },
  ];

  const handleComplete = async (id: number) => {
    await remindersApi.completeReminder(id);
    playTaskSound();
    load();
  };

  const handleSnooze = async (id: number, minutes: number) => {
    await remindersApi.snoozeReminder(id, minutes);
    load();
  };

  const handleDelete = (id: number) => {
    setDeleteTarget({ item: id });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await remindersApi.deleteReminder(deleteTarget.item as number);
    pushToast({ title: "Reminder deleted", message: "Reminder has been deleted successfully", type: "success" });
    load();
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-theme bg-surface p-3 flex items-center gap-3">
            <s.icon size={16} className={s.color} />
            <div>
              <p className="text-lg font-bold text-primary">{s.count}</p>
              <p className="text-[10px] text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {data.overdue.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-red-400">Overdue</p>
          <div className="space-y-2">
            {data.overdue.map((r) => (
              <ReminderCard key={r.id} reminder={r} onComplete={handleComplete} onSnooze={handleSnooze} onEdit={onEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {data.upcoming_24h.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-emerald-400">Next 24 Hours</p>
          <div className="space-y-2">
            {data.upcoming_24h.map((r) => (
              <ReminderCard key={r.id} reminder={r} onComplete={handleComplete} onSnooze={handleSnooze} onEdit={onEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {data.future.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-blue-400">Upcoming</p>
          <div className="space-y-2">
            {data.future.map((r) => (
              <ReminderCard key={r.id} reminder={r} onComplete={handleComplete} onSnooze={handleSnooze} onEdit={onEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {data.completed.length > 0 && (
        <div>
          <button
            onClick={() => setCompletedOpen((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2 text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <CheckCircle2 size={14} />
            Completed ({data.completed.length})
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${completedOpen ? "rotate-0" : "-rotate-90"}`}
            />
          </button>
          <div
            className={`space-y-2 overflow-hidden transition-all duration-300 ${
              completedOpen ? "opacity-100 max-h-[2000px]" : "opacity-0 max-h-0"
            }`}
          >
            {data.completed.map((r) => (
              <ReminderCard key={r.id} reminder={r} onEdit={onEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {data.overdue.length === 0 && data.upcoming_24h.length === 0 && data.future.length === 0 && (
        <div className="py-12 text-center text-xs text-muted border border-dashed border-theme rounded-xl">
          No reminders scheduled. Create one to get started.
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Reminder"
        message="Delete this reminder?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
