import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Download, FileSpreadsheet, Loader2, AlertCircle, CheckCircle, Hash, Clock, Printer, FileText } from "lucide-react";
import Modal from "../Modal";
import { generateReport, exportReport, downloadBlob } from "../../lib/reportsApi";
import { ReportResult } from "./types";
import ReportSummaryCards from "./ReportSummaryCards";
import ReportTable from "./ReportTable";
import { BookingFormPreview, InstallmentPlanPreview } from "./EnterpriseDocumentPreview";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  reportType: string;
  filters: Record<string, unknown>;
  title?: string;
}

export default function ReportModal({ open, onClose, reportType, filters, title }: ReportModalProps) {
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const generate = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await generateReport(reportType, { ...filtersRef.current, export_mode: false });
      setResult(data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to generate report";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [reportType, open]);

  useEffect(() => {
    if (open) {
      generate();
    } else {
      setResult(null);
      setError(null);
    }
  }, [open, generate]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const blob = await exportReport(reportType, { ...filters, format: "pdf", export_mode: true });
      downloadBlob(blob, `${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const blob = await exportReport(reportType, { ...filters, format: "excel", export_mode: true });
      downloadBlob(blob, `${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Excel export failed");
    } finally {
      setExporting(false);
    }
  };

  const isEnterpriseDoc = reportType === "booking_form" || reportType === "installment_plan";
  const docData = result?.sub_tables?.document_data as Record<string, any> | undefined;
  const companyName = result?.meta?.company_name || "Real Estate Management System";

  const previewData = docData
    ? {
        ...docData,
        meta: {
          company_name: companyName,
          report_id: result?.meta?.report_id || "",
          generated_at: result?.meta?.generated_at
            ? new Date(result.meta.generated_at).toLocaleString()
            : "",
        },
      }
    : null;

  const showTable = result && !isEnterpriseDoc;

  return (
    <Modal open={open} onClose={onClose} title={title || reportType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} size="2xl">
      {/* Header with export buttons */}
      {result && !loading && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-sm font-bold text-primary">{result.meta.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportExcel} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40"
              style={{ borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: "#34d399" }}>
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button onClick={handleExportPDF} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40"
              style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#f87171" }}>
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              PDF
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 size={28} className="text-blue-400 animate-spin" />
          <p className="text-sm text-muted">Generating report...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg border flex items-center gap-2 text-xs"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#f87171" }}>
          <AlertCircle size={13} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Meta info */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.12)", color: "#34d399" }}>
              {result.meta.total_records.toLocaleString()} records
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <Clock size={10} />
              {new Date(result.meta.generated_at).toLocaleString()}
            </span>
            {result.meta.report_id && (
              <span className="flex items-center gap-1 text-[10px] text-muted font-mono">
                <Hash size={10} />
                {result.meta.report_id}
              </span>
            )}
            {result.generation_time_ms > 0 && (
              <span className="text-[10px] text-muted">{result.generation_time_ms}ms</span>
            )}
          </div>

          {/* Summary cards (tabular reports) */}
          {showTable && result.summary && result.summary.length > 0 && (
            <ReportSummaryCards summary={result.summary} />
          )}

          {/* Enterprise document preview */}
          {isEnterpriseDoc && previewData && (
            <div className="print-area" style={{ background: "#e5e7eb", padding: "12px 0", borderRadius: 8 }}>
              {reportType === "booking_form" ? (
                <BookingFormPreview data={previewData} companyName={companyName} />
              ) : (
                <InstallmentPlanPreview data={previewData} companyName={companyName} />
              )}
            </div>
          )}

          {/* Tabular report table */}
          {showTable && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <ReportTable columns={result.columns} rows={result.rows} meta={result.meta} showPagination />
            </div>
          )}

          {/* Enterprise doc fallback: show table too if there are rows */}
          {isEnterpriseDoc && result.rows && result.rows.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <ReportTable columns={result.columns} rows={result.rows} meta={result.meta} showPagination />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
