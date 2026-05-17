/**
 * ReportTable — Enterprise data table for reports.
 * Styled to match the dark theme of the existing app.
 *
 * Features: sorting, pagination, badge rendering, currency/number formatting,
 * empty state, loading skeleton.
 */
import React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { ReportColumn, ReportMeta, SortConfig } from "./types";

interface Props {
  columns: ReportColumn[];
  rows: Record<string, any>[];
  meta?: ReportMeta;
  loading?: boolean;
  onSort?: (key: string, order: "asc" | "desc") => void;
  onPageChange?: (page: number) => void;
  sortConfig?: SortConfig;
  showPagination?: boolean;
}

// ── Badge color map ───────────────────────────────────────────────────────────
const BADGE: Record<string, { bg: string; color: string }> = {
  ACTIVE:       { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  INACTIVE:     { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" },
  PENDING:      { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  PAID:         { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  PARTIAL:      { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  OVERDUE:      { bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
  CANCELLED:    { bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
  CONFIRMED:    { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  COMPLETED:    { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  RESERVED:     { bg: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
  AVAILABLE:    { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  SOLD:         { bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
  BOOKED:       { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  CASH:         { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  BANK:         { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  NEW:          { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  WON:          { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  LOST:         { bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
  OPEN:         { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  NEGOTIATING:  { bg: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
  ENDED:        { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" },
};

function BadgeCell({ value }: { value: string }) {
  const style = BADGE[value?.toUpperCase()] ?? { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {value}
    </span>
  );
}

function SortIcon({ columnKey, sortConfig }: { columnKey: string; sortConfig?: SortConfig }) {
  if (!sortConfig || sortConfig.key !== columnKey) {
    return <ChevronsUpDown size={11} className="ml-1 inline opacity-40" />;
  }
  return sortConfig.order === "asc"
    ? <ChevronUp size={11} className="ml-1 inline text-blue-400" />
    : <ChevronDown size={11} className="ml-1 inline text-blue-400" />;
}

function formatCell(value: any, col: ReportColumn): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
  switch (col.data_type) {
    case "badge":
      return <BadgeCell value={String(value)} />;
    case "currency":
      if (typeof value === "number") {
        return (
          <span className="font-mono text-xs" style={{ color: "var(--text-primary)" }}>
            ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
      return <span className="font-mono text-xs">{value}</span>;
    case "number":
      if (typeof value === "number") {
        return <span className="font-mono text-xs">{value.toLocaleString("en-US")}</span>;
      }
      return <span className="font-mono text-xs">{value}</span>;
    case "percentage":
      return <span className="font-mono text-xs">{value}%</span>;
    default:
      return <span className="text-xs">{String(value)}</span>;
  }
}

export default function ReportTable({
  columns, rows, meta, loading = false,
  onSort, onPageChange, sortConfig, showPagination = true,
}: Props) {
  const visible = columns.filter((c) => c.visible !== false);

  const handleSort = (col: ReportColumn) => {
    if (!col.sortable || !onSort) return;
    const order = sortConfig?.key === col.key && sortConfig.order === "asc" ? "desc" : "asc";
    onSort(col.key, order);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "var(--bg-surface2)" }}>
              {visible.map((_, i) => (
                <th key={i} className="px-3 py-2.5">
                  <div className="h-3 rounded animate-pulse" style={{ background: "var(--border)" }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, ri) => (
              <tr key={ri} style={{ borderBottom: "1px solid var(--border)" }}>
                {visible.map((_, ci) => (
                  <td key={ci} className="px-3 py-2">
                    <div
                      className="h-3 rounded animate-pulse"
                      style={{ background: "var(--border)", width: `${60 + Math.random() * 30}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          {/* Header */}
          <thead>
            <tr style={{ background: "var(--bg-surface2)", borderBottom: "1px solid var(--border)" }}>
              {visible.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap select-none
                    ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                    ${col.sortable && onSort ? "cursor-pointer hover:opacity-80" : ""}
                  `}
                  style={{ color: "var(--text-muted)", width: col.width }}
                  onClick={() => handleSort(col)}
                >
                  {col.label}
                  {col.sortable && onSort && <SortIcon columnKey={col.key} sortConfig={sortConfig} />}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visible.length}
                  className="px-4 py-12 text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-xs font-medium">No data available</p>
                    <p className="text-[10px]">Try adjusting your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="transition-colors duration-100"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: ri % 2 === 0 ? "transparent" : "var(--hover-bg-sm)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = ri % 2 === 0 ? "transparent" : "var(--hover-bg-sm)")}
                >
                  {visible.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 whitespace-nowrap
                        ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                      `}
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatCell(row[col.key], col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && meta && meta.total_pages > 1 && (
        <div
          className="flex items-center justify-between px-3 py-2.5 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Page {meta.page} of {meta.total_pages} · {meta.total_records.toLocaleString()} records
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(meta.page - 1)}
              disabled={meta.page <= 1}
              className="px-2.5 py-1 text-[10px] rounded border transition-colors disabled:opacity-30"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, meta.total_pages) }, (_, i) => {
              let p: number;
              if (meta.total_pages <= 5) p = i + 1;
              else if (meta.page <= 3) p = i + 1;
              else if (meta.page >= meta.total_pages - 2) p = meta.total_pages - 4 + i;
              else p = meta.page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p)}
                  className="px-2.5 py-1 text-[10px] rounded border transition-colors"
                  style={{
                    borderColor: p === meta.page ? "#3b82f6" : "var(--border)",
                    background: p === meta.page ? "rgba(59,130,246,0.15)" : "transparent",
                    color: p === meta.page ? "#60a5fa" : "var(--text-secondary)",
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(meta.page + 1)}
              disabled={meta.page >= meta.total_pages}
              className="px-2.5 py-1 text-[10px] rounded border transition-colors disabled:opacity-30"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Record count */}
      {rows.length > 0 && (!showPagination || !meta || meta.total_pages <= 1) && (
        <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {rows.length.toLocaleString()} record{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
