/**
 * ReportViewer — Main report viewer component.
 *
 * Combines: Header + Summary Cards + Filters + Table + Pagination
 * Used as the primary container for all report pages.
 */
import React, { useCallback, useRef } from "react";
import ReportHeader from "./ReportHeader";
import ReportSummaryCards from "./ReportSummaryCards";
import ReportFilters from "./ReportFilters";
import ReportTable from "./ReportTable";
import { ReportResult, ReportRequest, SortConfig } from "./types";

interface Props {
  reportKey: string;
  reportName: string;
  result?: ReportResult;
  loading?: boolean;
  exporting?: boolean;
  filters: ReportRequest;
  availableFilters?: string[];
  sortConfig?: SortConfig;
  onFiltersChange: (filters: ReportRequest) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onSort?: (key: string, order: "asc" | "desc") => void;
  onPageChange?: (page: number) => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onRefresh?: () => void;
  showFilters?: boolean;
  showSummary?: boolean;
  showPagination?: boolean;
  children?: React.ReactNode; // For custom content below table
}

export default function ReportViewer({
  reportKey,
  reportName,
  result,
  loading = false,
  exporting = false,
  filters,
  availableFilters = ["search", "date_range", "status"],
  sortConfig,
  onFiltersChange,
  onApplyFilters,
  onResetFilters,
  onSort,
  onPageChange,
  onExportPDF,
  onExportExcel,
  onRefresh,
  showFilters = true,
  showSummary = true,
  showPagination = true,
  children,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="space-y-0 report-viewer" data-report-key={reportKey}>
      {/* Report Header */}
      <ReportHeader
        meta={result?.meta}
        reportName={reportName}
        onExportPDF={onExportPDF}
        onExportExcel={onExportExcel}
        onPrint={handlePrint}
        onRefresh={onRefresh}
        loading={loading}
        exporting={exporting}
      />

      {/* Filters */}
      {showFilters && (
        <ReportFilters
          filters={filters}
          onChange={onFiltersChange}
          onApply={onApplyFilters}
          onReset={onResetFilters}
          availableFilters={availableFilters}
          loading={loading}
        />
      )}

      {/* Error state */}
      {result?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700 font-medium">Error: {result.error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {showSummary && result?.summary && result.summary.length > 0 && (
        <ReportSummaryCards summary={result.summary} />
      )}

      {/* Main Table */}
      <div ref={printRef} className="print-area">
        <ReportTable
          columns={result?.columns || []}
          rows={result?.rows || []}
          meta={result?.meta}
          loading={loading}
          onSort={onSort}
          onPageChange={onPageChange}
          sortConfig={sortConfig}
          showPagination={showPagination}
        />
      </div>

      {/* Custom children (sub-tables, charts, etc.) */}
      {children}

      {/* Generation time */}
      {result && result.generation_time_ms > 0 && (
        <div className="text-right">
          <span className="text-xs text-gray-400">
            Generated in {result.generation_time_ms}ms
          </span>
        </div>
      )}
    </div>
  );
}
