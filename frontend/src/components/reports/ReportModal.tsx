import React, { useState, useEffect, useCallback, useRef } from "react";
import { FileText, AlertCircle } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import ReportViewer from "./ReportViewer";
import { generateReport, exportReport, downloadBlob } from "../../lib/reportsApi";
import { ReportResult, ReportColumn } from "./types";
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

  const handleExportPDF = useCallback(async () => {
    try {
      const blob = await exportReport(reportType, { ...filters, format: "pdf", export_mode: true });
      downloadBlob(blob, `${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      throw new Error(err?.response?.data?.detail || "PDF export failed");
    }
  }, [reportType, filters]);

  const handleExportExcel = useCallback(async () => {
    try {
      const blob = await exportReport(reportType, { ...filters, format: "excel", export_mode: true });
      downloadBlob(blob, `${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      throw new Error(err?.response?.data?.detail || "Excel export failed");
    }
  }, [reportType, filters]);

  const isEnterpriseDoc = reportType === "booking_form" || reportType === "installment_plan";
  const docData = result?.sub_tables?.document_data as Record<string, any> | undefined;

  return (
    <AppDialog isOpen={open} onClose={onClose} title={title || reportType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} subtitle={reportType} size="md" icon={<FileText size={16} />}>
      <div className="space-y-4">
        {/* Enterprise document preview */}
        {isEnterpriseDoc && result && !loading && docData && (
          <div style={{ background: "#e5e7eb", padding: "12px 0", borderRadius: 8 }}>
            {reportType === "booking_form" ? (
              <BookingFormPreview
                data={{
                  ...docData,
                  meta: {
                    company_name: result.meta.company_name,
                    report_id: result.meta.report_id || "",
                    generated_at: result.meta.generated_at
                      ? new Date(result.meta.generated_at).toLocaleString()
                      : "",
                  },
                }}
                companyName={result.meta.company_name}
              />
            ) : (
              <InstallmentPlanPreview
                data={{
                  ...docData,
                  meta: {
                    company_name: result.meta.company_name,
                    report_id: result.meta.report_id || "",
                    generated_at: result.meta.generated_at
                      ? new Date(result.meta.generated_at).toLocaleString()
                      : "",
                  },
                }}
                companyName={result.meta.company_name}
              />
            )}
          </div>
        )}

        {isEnterpriseDoc && result && !loading && !docData && (
          <div style={{
            border: "1px solid #FCA5A5", borderRadius: 8, padding: "12px 16px",
            marginBottom: 16, background: "#FEF2F2", display: "flex",
            alignItems: "center", gap: 8, fontSize: 13, color: "#991B1B",
          }}>
            <AlertCircle size={16} />
            No document data found for this booking.
          </div>
        )}

        {/* Tabular report */}
        <ReportViewer
          reportTitle={result?.meta?.title || ""}
          reportSubtitle={result?.meta?.subtitle || ""}
          companyName={result?.meta?.company_name || ""}
          columns={(result?.columns || []) as ReportColumn[]}
          data={result?.rows || []}
          summaryRows={result?.summary}
          loading={loading}
          error={error}
          onExportPDF={result && !loading ? handleExportPDF : undefined}
          onExportExcel={result && !loading ? handleExportExcel : undefined}
          headerInfo={result?.meta?.filters_applied || undefined}
        />

        {/* Enterprise doc fallback table */}
        {isEnterpriseDoc && result && !loading && result.rows && result.rows.length > 0 && !docData && (
          <div style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 8 }}>
            No document preview available. Tabular data shown above.
          </div>
        )}
      </div>
    </AppDialog>
  );
}
