import { useState } from "react";
import { CheckCircle2, Clock, Edit2, RotateCcw, Search, Trash2 } from "lucide-react";
import type { Reminder } from "../../lib/remindersApi";
import { remindersApi } from "../../lib/remindersApi";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/30 line-through",
  snoozed: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

interface Props {
  reminders: Reminder[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (reminder: Reminder) => void;
}

export default function MyRemindersTable({ reminders, loading, onRefresh, onEdit }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const pushToast = useNotifStore((s) => s.pushToast);
  const [deleteTarget, setDeleteTarget] = useState<{ item: any; type?: string } | null>(null);

  const filtered = reminders.filter((r) => {
    if (filter && r.status !== filter && filter !== "overdue") return false;
    if (filter === "overdue") {
      if (r.status === "completed" || r.status === "cancelled") return false;
      if (new Date(r.remind_at) >= new Date()) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !(r.description || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleBulkComplete = async () => {
    await remindersApi.bulkAction(Array.from(selected), "complete");
    setSelected(new Set());
    onRefresh();
  };

  const handleBulkDelete = () => {
    setDeleteTarget({ item: Array.from(selected), type: "bulk" });
  };

  const handleComplete = async (id: number) => {
    await remindersApi.completeReminder(id);
    onRefresh();
  };

  const handleDelete = (id: number) => {
    setDeleteTarget({ item: id, type: "single" });
  };

  const handleSnooze = async (id: number, minutes: number) => {
    await remindersApi.snoozeReminder(id, minutes);
    onRefresh();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "bulk") {
        await remindersApi.bulkAction(deleteTarget.item as number[], "delete");
        pushToast({ title: "Reminders deleted", message: `${(deleteTarget.item as number[]).length} reminder(s) deleted successfully`, type: "success" });
        setSelected(new Set());
      } else {
        await remindersApi.deleteReminder(deleteTarget.item as number);
        pushToast({ title: "Reminder deleted", message: "Reminder has been deleted successfully", type: "success" });
      }
      onRefresh();
    } catch {
      // silently fail
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input-field w-full text-xs pl-7 pr-3 py-1.5"
            placeholder="Search reminders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field text-xs px-3 py-1.5"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
          <option value="snoozed">Snoozed</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <span className="text-xs text-blue-400">{selected.size} selected</span>
          <button onClick={handleBulkComplete} className="text-[11px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">
            Complete Selected
          </button>
          <button onClick={handleBulkDelete} className="text-[11px] px-2 py-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
            Delete Selected
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted">No reminders found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-theme">
          <table className="w-full">
            <thead>
              <tr className="border-b border-theme text-[11px] text-muted">
                <th className="p-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="w-3 h-3 accent-blue-500"
                  />
                </th>
                <th className="p-3 text-left font-medium">Title</th>
                <th className="p-3 text-left font-medium">Date & Time</th>
                <th className="p-3 text-left font-medium">Priority</th>
                <th className="p-3 text-left font-medium">Repeat</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-theme/50 hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="w-3 h-3 accent-blue-500"
                    />
                  </td>
                  <td className="p-3">
                    <p className={`text-xs font-medium text-primary ${r.status === "completed" ? "line-through opacity-60" : ""}`}>
                      {r.title}
                    </p>
                  </td>
                  <td className="p-3">
                    <span className="text-xs text-secondary">{new Date(r.remind_at).toLocaleString()}</span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${PRIORITY_DOT[r.priority] ?? "bg-amber-500"}`} />
                  </td>
                  <td className="p-3">
                    {r.repeat !== "none" ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400">
                        {r.repeat}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_BADGE[r.status] ?? STATUS_BADGE.pending}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      {r.status === "pending" && (
                        <>
                          <button onClick={() => handleComplete(r.id)} title="Complete" className="p-1 rounded text-muted hover:text-emerald-400 transition-colors">
                            <CheckCircle2 size={12} />
                          </button>
                          <div className="relative group">
                            <button title="Snooze" className="p-1 rounded text-muted hover:text-purple-400 transition-colors">
                              <RotateCcw size={12} />
                            </button>
                            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-surface border border-theme rounded-lg shadow-xl z-50 py-1 min-w-[80px]">
                              {[5, 10, 15, 30, 60].map((mins) => (
                                <button
                                  key={mins}
                                  onClick={() => handleSnooze(r.id, mins)}
                                  className="block w-full text-left text-[10px] px-2 py-1 text-secondary hover:bg-white/5"
                                >
                                  {mins}m
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      <button onClick={() => onEdit(r)} title="Edit" className="p-1 rounded text-muted hover:text-blue-400 transition-colors">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => handleDelete(r.id)} title="Delete" className="p-1 rounded text-muted hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === "bulk" ? "Delete Reminders" : "Delete Reminder"}
        message={deleteTarget?.type === "bulk" ? `Delete ${(deleteTarget?.item as number[])?.length ?? 0} reminder(s)?` : "Delete this reminder?"}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
