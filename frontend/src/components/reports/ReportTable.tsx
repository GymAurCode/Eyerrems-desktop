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
import { DataTable } from "../data-table";
import type { TableColumn, PaginationConfig, SortConfig as DTSortConfig } from "../data-table";

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

  const dtColumns: TableColumn[] = visible.map((col) => ({
    key: col.key,
    label: col.label,
    sortable: col.sortable,
    align: (col.align || 'left') as 'left' | 'center' | 'right',
    width: col.width,
    render: (val: any) => formatCell(val, col),
  }));

  const handleSort = (config: DTSortConfig) => {
    const order = config.direction === 'desc' ? 'desc' : 'asc';
    onSort?.(config.key, order);
  };

  const handlePaginationChange = (config: PaginationConfig) => {
    onPageChange?.(config.page);
  };

  const dtSortConfig: DTSortConfig | undefined = sortConfig ? { key: sortConfig.key, direction: sortConfig.order } : undefined;

  return (
    <DataTable
      data={rows}
      columns={dtColumns}
      loading={loading}
      sortable={true}
      sortConfig={dtSortConfig}
      onSort={handleSort}
      searchable={false}
      pagination={meta ? { page: meta.page, pageSize: meta.page_size || 25, total: meta.total_records } : undefined}
      onPaginationChange={handlePaginationChange}
      emptyTitle="No data available"
      emptyDescription="Try adjusting your filters"
      bordered={false}
      striped={true}
    />
  );
}
