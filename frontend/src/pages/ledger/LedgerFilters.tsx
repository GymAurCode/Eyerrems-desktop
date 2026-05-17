/**
 * LedgerFilters — Reusable filter bar for all three ledger types.
 * Includes: search, date range, entry type, status, export buttons.
 */
import { Search, Calendar, Filter, Download, Printer, RefreshCw, X } from "lucide-react";

export interface FilterState {
  search:     string;
  start_date: string;
  end_date:   string;
  entry_type: string;
  status:     string;
}

interface Props {
  filters:       FilterState;
  onChange:      (f: FilterState) => void;
  onRefresh:     () => void;
  onExportPDF?:  () => void;
  onExportExcel?: () => void;
  onPrint?:      () => void;
  entryTypes:    string[];
  loading?:      boolean;
  totalCount?:   number;
}

export default function LedgerFilters({
  filters, onChange, onRefresh, onExportPDF, onExportExcel, onPrint,
  entryTypes, loading, totalCount,
}: Props) {
  const set = (key: keyof FilterState, val: string) =>
    onChange({ ...filters, [key]: val });

  const hasFilters = filters.search || filters.start_date || filters.end_date
    || filters.entry_type || filters.status;

  const clearAll = () => onChange({ search: "", start_date: "", end_date: "", entry_type: "", status: "" });

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-surface2)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: "10px",
    padding: "0.45rem 0.75rem",
    fontSize: "0.8rem",
    outline: "none",
    transition: "border-color 0.2s",
  };

  const btnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.45rem 0.875rem",
    borderRadius: "10px",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-secondary)",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Date Range */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search description, reference, TID…"
            value={filters.search}
            onChange={e => set("search", e.target.value)}
            style={{ ...inputStyle, paddingLeft: "2rem", width: "100%" }}
          />
        </div>

        {/* Date From */}
        <div className="flex items-center gap-1.5">
          <Calendar size={12} style={{ color: "var(--text-muted)" }} />
          <input
            type="date"
            value={filters.start_date}
            onChange={e => set("start_date", e.target.value)}
            style={{ ...inputStyle, width: "140px" }}
          />
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>to</span>
        <input
          type="date"
          value={filters.end_date}
          onChange={e => set("end_date", e.target.value)}
          style={{ ...inputStyle, width: "140px" }}
        />

        {/* Entry Type */}
        <select
          value={filters.entry_type}
          onChange={e => set("entry_type", e.target.value)}
          style={{ ...inputStyle, width: "150px" }}
        >
          <option value="">All Types</option>
          {entryTypes.map(t => (
            <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={e => set("status", e.target.value)}
          style={{ ...inputStyle, width: "130px" }}
        >
          <option value="">All Status</option>
          <option value="posted">Posted</option>
          <option value="pending">Pending</option>
          <option value="reversed">Reversed</option>
        </select>

        {/* Clear filters */}
        {hasFilters && (
          <button onClick={clearAll} style={{ ...btnStyle, color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}>
            <X size={12} /> Clear
          </button>
        )}

        {/* Refresh */}
        <button onClick={onRefresh} disabled={loading} style={btnStyle}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>

        {/* Export buttons */}
        {onExportPDF && (
          <button onClick={onExportPDF} style={btnStyle}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"}>
            <Download size={12} /> PDF
          </button>
        )}
        {onExportExcel && (
          <button onClick={onExportExcel} style={btnStyle}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"}>
            <Download size={12} /> Excel
          </button>
        )}
        {onPrint && (
          <button onClick={onPrint} style={btnStyle}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"}>
            <Printer size={12} /> Print
          </button>
        )}
      </div>

      {/* Result count */}
      {totalCount !== undefined && (
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {totalCount} {totalCount === 1 ? "entry" : "entries"} found
          {hasFilters && " (filtered)"}
        </p>
      )}
    </div>
  );
}
