import { CheckCircle2, AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import type { ImportRowPreview } from "../../lib/importApi";

const STATUS_STYLE: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  valid:     { color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: CheckCircle2 },
  invalid:   { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   icon: XCircle },
  warning:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  icon: AlertTriangle },
  duplicate: { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  icon: AlertCircle },
};

interface ImportPreviewTableProps {
  rows: ImportRowPreview[];
  columns: string[];
  excludedRows: Set<number>;
  onToggleRow: (rowNumber: number) => void;
  filter?: "all" | "valid" | "invalid";
}

export default function ImportPreviewTable({
  rows,
  columns,
  excludedRows,
  onToggleRow,
  filter = "all",
}: ImportPreviewTableProps) {
  const display = rows.filter((r) => {
    if (filter === "valid") return r.status === "valid";
    if (filter === "invalid") return r.status === "invalid" || r.status === "duplicate";
    return true;
  });

  if (!display.length) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        No rows to display
      </div>
    );
  }

  const showCols = columns.slice(0, 6);

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
      <table className="erp-table w-full text-xs">
        <thead>
          <tr>
            <th className="w-10">#</th>
            <th className="w-24">Status</th>
            {showCols.map((c) => (
              <th key={c} className="capitalize">{c.replace(/_/g, " ")}</th>
            ))}
            <th>Issues</th>
            <th className="w-16">Inc.</th>
          </tr>
        </thead>
        <tbody>
          {display.map((row) => {
            const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.invalid;
            const Icon = st.icon;
            const excluded = excludedRows.has(row.row_number);
            const canToggle = row.status === "valid";
            return (
              <tr
                key={row.row_number}
                style={{
                  opacity: excluded ? 0.45 : 1,
                  background: row.status === "invalid" ? "rgba(239,68,68,0.04)" : undefined,
                }}
              >
                <td className="font-mono text-muted">{row.row_number}</td>
                <td>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: st.bg, color: st.color }}
                  >
                    <Icon size={10} />
                    {row.status}
                  </span>
                </td>
                {showCols.map((c) => (
                  <td key={c} className="max-w-[140px] truncate">
                    {row.data[c] ?? "—"}
                  </td>
                ))}
                <td className="text-[10px]" style={{ color: "#f87171" }}>
                  {[...row.errors, ...row.warnings].join("; ") || "—"}
                </td>
                <td>
                  {canToggle && (
                    <input
                      type="checkbox"
                      checked={!excluded}
                      onChange={() => onToggleRow(row.row_number)}
                      title="Include in import"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
