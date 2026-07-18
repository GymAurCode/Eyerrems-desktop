import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import type { NotificationLogEntry } from "../../lib/remindersApi";
import { remindersApi } from "../../lib/remindersApi";

const STATUS_BADGE: Record<string, string> = {
  delivered: "bg-green-500/15 text-green-400 border-green-500/30",
  missed: "bg-red-500/15 text-red-400 border-red-500/30",
  failed: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const ACTION_BADGE: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  snoozed: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  ignored: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
};

export default function NotificationLogs() {
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const data = await remindersApi.getLogs(params);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleSearch = () => load();

  const handleExport = async () => {
    try {
      const blob = await remindersApi.exportLogsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "notification_logs.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input-field w-full text-xs pl-7 pr-3 py-1.5"
            placeholder="Search by reminder title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <select
          className="input-field text-xs px-3 py-1.5"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="delivered">Delivered</option>
          <option value="missed">Missed</option>
          <option value="failed">Failed</option>
        </select>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors ml-auto"
        >
          <Download size={12} /> CSV Export
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-muted">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted border border-dashed border-theme rounded-xl">No notification logs found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-theme">
          <table className="w-full">
            <thead>
              <tr className="border-b border-theme text-[11px] text-muted">
                <th className="p-3 text-left font-medium">Reminder Title</th>
                <th className="p-3 text-left font-medium">Priority</th>
                <th className="p-3 text-left font-medium">Triggered At</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">User Action</th>
                <th className="p-3 text-left font-medium">Snooze</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-theme/50 hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <span className="text-xs text-primary">{l.reminder_title || "—"}</span>
                  </td>
                  <td className="p-3">
                    {l.reminder_priority ? (
                      <span className={`inline-block w-2 h-2 rounded-full ${PRIORITY_DOT[l.reminder_priority] ?? "bg-amber-500"}`} />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="text-xs text-secondary">{new Date(l.triggered_at).toLocaleString()}</span>
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_BADGE[l.status] ?? STATUS_BADGE.failed}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {l.user_action ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ACTION_BADGE[l.user_action] ?? "bg-gray-500/15 text-gray-400"}`}>
                        {l.user_action}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="text-xs text-secondary">{l.snooze_minutes ? `${l.snooze_minutes}m` : "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
