import { useState, useMemo } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, XCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
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

  // Reset page on search or filter change
  useMemo(() => {
    setCurrentPage(1);
  }, [search, filter, pageSize]);

  const showCols = columns.slice(0, 7); // Show up to 7 columns

  return (
    <div className="space-y-3">
      {/* Search and Page Size Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative w-64">
          <Search size={13} className="absolute left-3 top-2.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search preview rows..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="select-dark py-1 px-2 text-xs rounded-lg"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {searched.length === 0 ? (
        <div className="py-12 text-center text-sm border rounded-xl" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          No matching rows to display
        </div>
      ) : (
        <>
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
                  <th className="w-16 text-center">Include</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((row) => {
                  const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.invalid;
                  const Icon = st.icon;
                  const excluded = excludedRows.has(row.row_number);
                  const canToggle = row.status === "valid" || row.status === "warning";
                  return (
                    <tr
                      key={row.row_number}
                      style={{
                        opacity: excluded ? 0.45 : 1,
                        background:
                          row.status === "invalid" ? "rgba(239,68,68,0.04)" :
                          row.status === "duplicate" ? "rgba(139,92,246,0.04)" :
                          row.status === "warning" ? "rgba(245,158,11,0.04)" : undefined,
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
                      <td className="text-[10px]" style={{ color: row.status === "invalid" ? "#f87171" : "var(--text-muted)" }}>
                        {[...row.errors, ...row.warnings].join("; ") || "—"}
                      </td>
                      <td className="text-center">
                        {canToggle && (
                          <input
                            type="checkbox"
                            checked={!excluded}
                            onChange={() => onToggleRow(row.row_number)}
                            title="Include in import"
                            className="cursor-pointer"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t pt-3 text-xs text-muted" style={{ borderColor: "var(--border)" }}>
            <span>
              Showing {Math.min(searched.length, (currentPage - 1) * pageSize + 1)}-
              {Math.min(searched.length, currentPage * pageSize)} of {searched.length} rows
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 px-2 rounded-lg border text-muted hover:text-primary transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--border)" }}
              >
                <ChevronLeft size={14} />
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 px-2 rounded-lg border text-muted hover:text-primary transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--border)" }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
