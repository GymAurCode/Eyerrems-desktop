/**
 * BookingFormReport — Enterprise Booking Form / Client Profile Report page.
 *
 * Flow:
 *   1. User searches for a booking
 *   2. System loads full booking + client + property + plan data
 *   3. Live A4-style booking form preview renders
 *   4. User can export PDF / Excel / Print
 */
import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Download, FileSpreadsheet, Printer,
  Loader2, AlertCircle, X, RefreshCw, FileText, CheckCircle,
  Hash, Clock,
} from "lucide-react";
import { bookingApi, BookingListItem } from "../../lib/bookingApi";
import { generateReport, exportReport, downloadBlob } from "../../lib/reportsApi";
import { ReportResult } from "../../components/reports/types";
import ReportSummaryCards from "../../components/reports/ReportSummaryCards";
import ReportErrorBoundary from "../../components/reports/ReportErrorBoundary";
import { BookingFormPreview } from "../../components/reports/EnterpriseDocumentPreview";

// ── Booking search (reused pattern) ──────────────────────────────────────────
function BookingSearch({ onSelect }: { onSelect: (b: BookingListItem) => void }) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<BookingListItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await bookingApi.list();
      const q = query.toLowerCase();
      const bookings = res.items ?? (Array.isArray(res) ? res : []);
      setResults(
        bookings.filter(
          (b) =>
            b.booking_id.toLowerCase().includes(q) ||
            (b.client_name || "").toLowerCase().includes(q) ||
            (b.property_name || "").toLowerCase().includes(q) ||
            (b.unit_number || "").toLowerCase().includes(q),
        ),
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "var(--bg-base)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-2.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search by Booking ID, Client Name, Property..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={inputStyle}
          />
        </div>
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          Search
        </button>
      </div>

      {searched && results.length === 0 && !loading && (
        <p className="text-xs text-muted text-center py-4">No bookings found</p>
      )}

      {results.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {results.slice(0, 10).map((b) => (
            <button
              key={b.id}
              onClick={() => onSelect(b)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border-b last:border-b-0 hover:bg-blue-500/5 transition-colors"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(59,130,246,0.12)" }}>
                <FileText size={14} style={{ color: "#60a5fa" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">{b.booking_id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>
                    {b.status}
                  </span>
                </div>
                <div className="text-[10px] text-muted truncate mt-0.5">
                  {b.client_name} · {b.property_name} {b.unit_number ? `· Unit ${b.unit_number}` : ""}
                </div>
              </div>
              <div className="text-[10px] text-muted shrink-0">
                {b.booking_date ? new Date(b.booking_date).toLocaleDateString() : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BookingFormReport() {
  const navigate = useNavigate();
  const previewRef = useRef<HTMLDivElement>(null);

  const [selectedBooking, setSelectedBooking] = useState<BookingListItem | null>(null);
  const [result, setResult]     = useState<ReportResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const loadReport = useCallback(async (booking: BookingListItem) => {
    setSelectedBooking(booking);
    setLoading(true);
    setError(null);
    try {
      const data = await generateReport("booking_form", {
        booking_id: booking.id,
        export_mode: false,
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExportPDF = async () => {
    if (!selectedBooking) return;
    setExporting(true);
    try {
      const blob = await exportReport("booking_form", {
        booking_id: selectedBooking.id,
        format: "pdf",
        export_mode: true,
      });
      downloadBlob(blob, `booking_form_${selectedBooking.booking_id}.pdf`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedBooking) return;
    setExporting(true);
    try {
      const blob = await exportReport("booking_form", {
        booking_id: selectedBooking.id,
        format: "excel",
        export_mode: true,
      });
      downloadBlob(blob, `booking_form_${selectedBooking.booking_id}.xlsx`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Excel export failed");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => window.print();

  const docData = result?.sub_tables?.document_data as Record<string, any> | undefined;
  const companyName = result?.meta?.company_name || "Real Estate Management System";

  const previewData = docData
    ? {
        ...docData,
        meta: {
          company_name: companyName,
          report_id:    result?.meta?.report_id || "",
          generated_at: result?.meta?.generated_at
            ? new Date(result.meta.generated_at).toLocaleString()
            : "",
        },
      }
    : null;

  return (
    <ReportErrorBoundary>
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ background: "var(--bg-base)" }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-3 border-b flex items-center gap-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <button onClick={() => navigate("/reports")}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors shrink-0">
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Reports</span>
        </button>
        <span className="text-muted text-xs shrink-0">/</span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "rgba(59,130,246,0.12)" }}>
            <FileText size={12} style={{ color: "#60a5fa" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-primary leading-none">Booking Form Report</p>
            <p className="text-[10px] text-muted mt-0.5 hidden sm:block">
              Enterprise client profile and property booking form
            </p>
          </div>
        </div>

        {/* Export actions */}
        {result && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={handlePrint} disabled={exporting} title="Print"
              className="p-2 rounded-lg border text-muted hover:text-secondary transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--border)" }}>
              <Printer size={14} />
            </button>
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
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-5 py-5 space-y-5">

          {/* Search panel */}
          {!result && (
            <div className="rounded-xl border p-5 space-y-4"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-sm font-bold text-primary">Select Booking</h2>
                <p className="text-xs text-muted mt-0.5">
                  Search for a booking to generate the booking form report
                </p>
              </div>
              <BookingSearch onSelect={loadReport} />
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={28} className="text-blue-400 animate-spin" />
              <p className="text-sm text-muted">Loading booking form...</p>
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
            <>
              {/* Meta bar */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-green-400" />
                    <span className="text-sm font-bold text-primary">{result.meta.title}</span>
                  </div>
                  {result.meta.subtitle && (
                    <span className="text-xs text-muted">{result.meta.subtitle}</span>
                  )}
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
                </div>
                <button
                  onClick={() => { setResult(null); setSelectedBooking(null); setError(null); }}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
                >
                  <RefreshCw size={12} /> Change Booking
                </button>
              </div>

              {/* Summary cards */}
              {result.summary && result.summary.length > 0 && (
                <ReportSummaryCards summary={result.summary} />
              )}

              {/* A4 Document Preview */}
              {previewData && (
                <div className="print-area">
                  <div ref={previewRef} style={{ background: "#e5e7eb", padding: "20px 0" }}>
                    <BookingFormPreview data={previewData} companyName={companyName} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </ReportErrorBoundary>
  );
}
