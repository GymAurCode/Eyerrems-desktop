/**
 * ReportHeader — Professional report header with metadata and export controls.
 */
import React from "react";
import {
  Download,
  FileText,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  Building2,
  Calendar,
  User,
  Hash,
} from "lucide-react";
import { ReportMeta } from "./types";

interface Props {
  meta?: ReportMeta;
  reportName: string;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  exporting?: boolean;
}

export default function ReportHeader({
  meta,
  reportName,
  onExportPDF,
  onExportExcel,
  onPrint,
  onRefresh,
  loading = false,
  exporting = false,
}: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      {/* Top row: title + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={18} className="text-blue-600 shrink-0" />
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {meta?.title || reportName}
            </h1>
          </div>
          {meta?.subtitle && (
            <p className="text-sm text-gray-500 ml-6">{meta.subtitle}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Refresh"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          )}

          {onPrint && (
            <button
              onClick={onPrint}
              disabled={loading || exporting}
              title="Print"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>
          )}

          {onExportExcel && (
            <button
              onClick={onExportExcel}
              disabled={loading || exporting}
              title="Export to Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 border border-green-200 bg-green-50 rounded hover:bg-green-100 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet size={14} />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}

          {onExportPDF && (
            <button
              onClick={onExportPDF}
              disabled={loading || exporting}
              title="Export to PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-700 border border-red-200 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <Download size={14} />
              <span className="hidden sm:inline">PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Metadata row */}
      {meta && (
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          {meta.company_name && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Building2 size={12} className="text-gray-400" />
              <span>{meta.company_name}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar size={12} className="text-gray-400" />
            <span>
              {new Date(meta.generated_at).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {meta.generated_by && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <User size={12} className="text-gray-400" />
              <span>{meta.generated_by}</span>
            </div>
          )}
          {meta.report_id && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Hash size={12} className="text-gray-400" />
              <span className="font-mono">{meta.report_id}</span>
            </div>
          )}
          <div className="ml-auto text-xs text-gray-400">
            {meta.total_records.toLocaleString()} record{meta.total_records !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Active filters */}
      {meta?.filters_applied && Object.keys(meta.filters_applied).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="text-xs text-gray-400">Filters:</span>
          {Object.entries(meta.filters_applied).map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
            >
              <span className="font-medium">{key}:</span>
              <span>{value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Export loading indicator */}
      {exporting && (
        <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
          <RefreshCw size={12} className="animate-spin" />
          <span>Generating export...</span>
        </div>
      )}
    </div>
  );
}
