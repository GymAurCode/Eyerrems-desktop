import { useState, useMemo } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import type { ImportRowPreview } from "../../lib/importApi";
import { DataTable } from "../data-table";

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
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter based on dropdown/tab filter (all, valid, invalid)
  const statusFiltered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "valid") return r.status === "valid";
      if (filter === "invalid") return r.status === "invalid" || r.status === "duplicate";
      return true;
    });
  }, [rows, filter]);

  // Filter based on search query
  const searched = useMemo(() => {
    if (!search.trim()) return statusFiltered;
    const q = search.toLowerCase();
    return statusFiltered.filter((r) => {
      // Search in data keys/values
      const matchesData = Object.values(r.data).some((val) =>
        String(val).toLowerCase().includes(q)
      );
      const matchesErrors = [...r.errors, ...r.warnings].some((err) =>
        err.toLowerCase().includes(q)
      );
      return matchesData || matchesErrors || String(r.row_number).includes(q);
    });
  }, [statusFiltered, search]);

  // Paginated display
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return searched.slice(start, start + pageSize);
  }, [searched, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(searched.length / pageSize));

  useMemo(() => {
    setCurrentPage(1);
  }, [search, filter, pageSize]);

  const showCols = columns.slice(0, 7);

  const dtColumns = [
    { key: 'row_number', label: '#', render: (val: any) => <span className="font-mono text-muted text-xs">{val}</span> },
    { key: 'status', label: 'Status', render: (val: any) => {
      const st = STATUS_STYLE[val] ?? STATUS_STYLE.invalid;
      const Icon = st.icon;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: st.bg, color: st.color }}>
          <Icon size={10} /> {val}
        </span>
      );
    }},
    ...showCols.map((c) => ({
      key: `data.${c}`,
      label: c.replace(/_/g, " "),
      render: (_: any, row: any) => <span className="max-w-[140px] truncate block text-xs">{row.data?.[c] ?? "—"}</span>,
    })),
    { key: 'issues', label: 'Issues', render: (_: any, row: any) => {
      const issues = [...(row.errors || []), ...(row.warnings || [])].join("; ") || "—";
      return <span className="text-[10px]" style={{ color: row.status === "invalid" ? "#f87171" : "var(--text-muted)" }}>{issues}</span>;
    }},
    { key: 'include', label: 'Include', align: 'center' as const, render: (_: any, row: any) => {
      const canToggle = row.status === "valid" || row.status === "warning";
      return canToggle ? (
        <input type="checkbox" checked={!excludedRows.has(row.row_number)}
          onChange={() => onToggleRow(row.row_number)}
          title="Include in import" className="cursor-pointer" />
      ) : null;
    }},
  ];

  return (
    <div className="space-y-3">
      <DataTable
        data={paginated}
        columns={dtColumns}
        searchable={false}
        sortable={false}
        striped={false}
        bordered={true}
        pagination={{ page: currentPage, pageSize, total: searched.length }}
        onPaginationChange={(config) => setCurrentPage(config.page)}
      />
    </div>
  );
}
