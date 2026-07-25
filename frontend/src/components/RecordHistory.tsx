import { useEffect, useState } from "react";
import { Clock, LogIn, LogOut, Plus, Pencil, Trash2, FileText, RefreshCw } from "lucide-react";
import { auditApi, type AuditLogEntry } from "../lib/auditApi";
import { DataTable } from "./data-table";

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  CREATE:       { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  UPDATE:       { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  DELETE:       { bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
  LOGIN:        { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  LOGOUT:       { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" },
  GENERATE:     { bg: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
  EXPORT:       { bg: "rgba(236,72,153,0.15)",  color: "#f472b6" },
  STATUS_CHANGE:{ bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_COLORS[action] ?? { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" };
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {action.replace("_", " ")}
    </span>
  );
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function DiffSummary({ diff }: { diff: any }) {
  if (!diff) return null;
  let entries: { field: string; old_value: any; new_value: any }[] = [];
  if (Array.isArray(diff)) {
    entries = diff;
  } else if (typeof diff === "object") {
    entries = Object.entries(diff).map(([k, v]) => ({
      field: k,
      old_value: (v as any)?.from ?? (v as any)?.old_value,
      new_value: (v as any)?.to ?? (v as any)?.new_value,
    }));
  }
  const shown = entries.slice(0, 2);
  return (
    <div className="space-y-0.5">
      {shown.map(({ field, old_value, new_value }) => (
        <div key={field} className="text-[10px] text-secondary leading-tight">
          <span className="text-muted font-mono">{field}:</span>{" "}
          <span className="text-red-400 line-through">{old_value ?? "—"}</span>
          {" → "}
          <span className="text-emerald-400">{new_value ?? "—"}</span>
        </div>
      ))}
      {entries.length > 2 && (
        <span className="text-[10px] text-muted">+{entries.length - 2} more</span>
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
      <div className="flex flex-col items-center gap-2 py-8 text-xs text-muted">
        <Clock size={18} className="opacity-50" />
        <span>No history recorded for this record</span>
      </div>
    );
  }

  return (
    <DataTable
      data={logs}
      columns={[
        {
          key: 'created_at',
          label: 'Date',
          render: (val: string) => (
            <span className="text-secondary whitespace-nowrap text-[10px]" title={formatDate(val)}>
              {relativeTime(val)}
            </span>
          ),
        },
        {
          key: 'action',
          label: 'Action',
          render: (val: string) => <ActionBadge action={val} />,
        },
        {
          key: 'changed_by',
          label: 'Changed By',
          render: (val: string) => <span className="text-secondary text-[10px]">{val}</span>,
        },
        {
          key: 'diff',
          label: 'Changes',
          render: (val: any) => <div className="max-w-[200px]"><DiffSummary diff={val} /></div>,
        },
      ]}
      searchable={false}
      sortable={false}
    />
  );
}
