import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { auditApi, type AuditLogEntry } from "../lib/auditApi";

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    CREATE: "#10b981",
    UPDATE: "#eab308",
    DELETE: "#ef4444",
  };
  const color = colors[action] ?? "#64748b";
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {action}
    </span>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function DiffSummary({ diff }: { diff: Record<string, { from: any; to: any }> | null }) {
  if (!diff) return null;
  const entries = Object.entries(diff).slice(0, 2);
  return (
    <div className="space-y-0.5">
      {entries.map(([key, val]) => (
        <div key={key} className="text-[10px] text-secondary">
          <span className="text-muted">{key}:</span>{" "}
          <span className="text-red-400 line-through">{String(val?.from ?? "—")}</span>
          {" → "}
          <span className="text-emerald-400">{String(val?.to ?? "—")}</span>
        </div>
      ))}
      {Object.keys(diff).length > 2 && (
        <span className="text-[10px] text-muted">+{Object.keys(diff).length - 2} more</span>
      )}
    </div>
  );
}

export default function RecordHistory({ module, recordId }: { module: string; recordId: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    auditApi.getRecordHistory(recordId)
      .then((data) => setLogs(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [recordId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-muted justify-center">
        <Clock size={14} />
        <span>No history recorded for this record</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--hover-bg-sm)" }}>
            {["Date", "Action", "Changed By", "Changes"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-muted font-semibold uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="row-hover" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td className="px-3 py-2 text-secondary whitespace-nowrap text-[10px]">
                {formatDate(log.created_at)}
              </td>
              <td className="px-3 py-2"><ActionBadge action={log.action} /></td>
              <td className="px-3 py-2 text-secondary text-[10px]">{log.changed_by}</td>
              <td className="px-3 py-2 max-w-[200px]">
                <DiffSummary diff={log.diff} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
