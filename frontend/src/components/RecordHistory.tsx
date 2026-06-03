import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { auditApi, type AuditLogEntry } from "../lib/auditApi";
import { DataTable } from "./data-table";

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
    <DataTable
      data={logs}
      columns={[
        { key: 'created_at', label: 'Date', render: (val) => <span className="text-secondary whitespace-nowrap text-[10px]">{formatDate(val)}</span> },
        { key: 'action', label: 'Action', render: (val) => <ActionBadge action={val} /> },
        { key: 'changed_by', label: 'Changed By', render: (val) => <span className="text-secondary text-[10px]">{val}</span> },
        { key: 'diff', label: 'Changes', render: (val) => <div className="max-w-[200px]"><DiffSummary diff={val} /></div> },
      ]}
      searchable={false}
      sortable={false}
    />
  );
}
