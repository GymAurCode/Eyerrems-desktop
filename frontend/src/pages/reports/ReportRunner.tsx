/**
 * ReportRunner — Report generation page.
 *
 * Layout:
 *   - Breadcrumb bar (back to Reports Center)
 *   - Report title + export buttons
 *   - Collapsible inline filter bar (top, NOT a left sidebar)
 *   - Full-width preview area
 *
 * No inner sidebar. No double navigation.
 */
import React, { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, FileSpreadsheet, Printer, RefreshCw,
  Play, SlidersHorizontal, Calendar, Search, X, Loader2,
  FileText, CheckCircle, AlertCircle, Hash, User, Building2,
  Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { generateReport, exportReport, downloadBlob } from "../../lib/reportsApi";
import { ReportRequest, ReportResult } from "../../components/reports/types";
import ReportTable from "../../components/reports/ReportTable";
import ReportSummaryCards from "../../components/reports/ReportSummaryCards";

// Minimal category config for the breadcrumb icon in the runner
import {
  UserCheck, Users, Building2 as Bldg, Wallet, Home,
  UserCog, HardHat, Wrench,
} from "lucide-react";

const CAT_CONFIG: Record<string, { icon: React.ElementType; accent: string; bg: string }> = {
  client:       { icon: UserCheck, accent: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  crm:          { icon: Users,     accent: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  property:     { icon: Bldg,      accent: "#10b981", bg: "rgba(16,185,129,0.12)" },
  finance:      { icon: Wallet,    accent: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  tenant:       { icon: Home,      accent: "#f97316", bg: "rgba(249,115,22,0.12)" },
  hr:           { icon: UserCog,   accent: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  construction: { icon: HardHat,   accent: "#14b8a6", bg: "rgba(20,184,166,0.12)" },
  maintenance:  { icon: Wrench,    accent: "#ec4899", bg: "rgba(236,72,153,0.12)" },
};

// ── Report metadata ───────────────────────────────────────────────────────────
const REPORT_META: Record<string, {
  name: string; description: string;
  filters: string[]; requiresEntity?: string;
}> = {
  customer_profile:         { name: "Customer Profile",         description: "Full customer profile with bookings and documents",  filters: [],                                        requiresEntity: "client"  },
  customer_ledger:          { name: "Customer Ledger",          description: "Debit, credit, balance and payment history",         filters: ["date_range"],                            requiresEntity: "client"  },
  installment_schedule:     { name: "Installment Schedule",     description: "Complete installment schedule for a booking",        filters: [],                                        requiresEntity: "booking" },
  outstanding_report:       { name: "Outstanding Payments",     description: "All overdue and pending installments",               filters: ["date_range", "search"]                                         },
  lead_summary:             { name: "Lead Summary",             description: "All leads with status and source breakdown",         filters: ["search", "date_range", "status", "lead_source"]               },
  inventory_report:         { name: "Property Inventory",       description: "Complete property and unit inventory",               filters: ["search", "status"]                                             },
  available_units:          { name: "Available Units",          description: "All units currently available for sale or rent",     filters: []                                                               },
  floor_wise_report:        { name: "Floor Wise Report",        description: "Unit distribution by floor",                        filters: []                                                               },
  category_wise_report:     { name: "Category Wise Report",     description: "Property distribution by category",                 filters: []                                                               },
  daily_collection:         { name: "Daily Collection",         description: "Payment collections for a date range",              filters: ["date_range", "payment_method"]                                 },
  monthly_collection:       { name: "Monthly Collection",       description: "Monthly collection summary for a year",             filters: []                                                               },
  expense_report:           { name: "Expense Report",           description: "All expenses with account breakdown",               filters: ["date_range", "search", "payment_method"]                       },
  cash_flow:                { name: "Cash Flow",                description: "Inflows vs outflows with running balance",          filters: ["date_range"]                                                   },
  tenant_profile:           { name: "Tenant Profile",           description: "Full tenant profile with lease history",            filters: [],                                        requiresEntity: "tenant"  },
  rent_ledger:              { name: "Rent Ledger",              description: "Rent payment history with running balance",         filters: ["date_range"],                            requiresEntity: "tenant"  },
  rent_due_report:          { name: "Rent Due Report",          description: "All pending and overdue rent records",              filters: ["date_range"]                                                   },
  security_deposit_report:  { name: "Security Deposit",         description: "Security deposits held for all tenants",           filters: ["status"]                                                       },
};

const DEFAULT_FILTERS: ReportRequest = { page: 1, page_size: 100, sort_order: "asc" };

// ── Inline filter bar ─────────────────────────────────────────────────────────
function FilterBar({ filters, onChange, availableFilters, loading, onGenerate, onReset }: {
  filters: ReportRequest;
  onChange: (f: ReportRequest) => void;
  availableFilters: string[];
  loading: boolean;
  onGenerate: () => void;
  onReset: () => void;
}) {
  const set = (key: keyof ReportRequest, val: any) => onChange({ ...filters, [key]: val });

  const inputCls = "px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors";
  const inputStyle = { background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" };

  return (
    <div
      className="flex flex-wrap items-end gap-3 px-5 py-3 border-b"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      {/* Search */}
      {availableFilters.includes("search") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Search</label>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-2 text-muted" />
            <input type="text" value={filters.search || ""} onChange={(e) => set("search", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onGenerate()}
              placeholder="Search..." className={`${inputCls} pl-7 w-44`} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Date From */}
      {availableFilters.includes("date_range") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">From</label>
          <div className="relative">
            <Calendar size={11} className="absolute left-2.5 top-2 text-muted" />
            <input type="date" value={filters.date_from || ""} onChange={(e) => set("date_from", e.target.value)}
              className={`${inputCls} pl-7 w-36`} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Date To */}
      {availableFilters.includes("date_range") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">To</label>
          <div className="relative">
            <Calendar size={11} className="absolute left-2.5 top-2 text-muted" />
            <input type="date" value={filters.date_to || ""} onChange={(e) => set("date_to", e.target.value)}
              className={`${inputCls} pl-7 w-36`} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Status */}
      {availableFilters.includes("status") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Status</label>
          <select value={filters.status || ""} onChange={(e) => set("status", e.target.value)}
            className={`${inputCls} w-32`} style={inputStyle}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="available">Available</option>
            <option value="sold">Sold</option>
            <option value="booked">Booked</option>
          </select>
        </div>
      )}

      {/* Payment Method */}
      {availableFilters.includes("payment_method") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Method</label>
          <select value={filters.payment_method || ""} onChange={(e) => set("payment_method", e.target.value)}
            className={`${inputCls} w-28`} style={inputStyle}>
            <option value="">All</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
          </select>
        </div>
      )}

      {/* Lead Source */}
      {availableFilters.includes("lead_source") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Source</label>
          <select value={filters.lead_source || ""} onChange={(e) => set("lead_source", e.target.value)}
            className={`${inputCls} w-32`} style={inputStyle}>
            <option value="">All</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="social_media">Social Media</option>
            <option value="walk_in">Walk-in</option>
            <option value="other">Other</option>
          </select>
        </div>
      )}

      {/* Client ID */}
      {availableFilters.includes("client_id") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Client ID</label>
          <input type="number" value={filters.client_id || ""} placeholder="ID..."
            onChange={(e) => set("client_id", e.target.value ? parseInt(e.target.value) : undefined)}
            className={`${inputCls} w-24`} style={inputStyle} />
        </div>
      )}

      {/* Tenant ID */}
      {availableFilters.includes("tenant_id") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Tenant ID</label>
          <input type="number" value={filters.tenant_id || ""} placeholder="ID..."
            onChange={(e) => set("tenant_id", e.target.value ? parseInt(e.target.value) : undefined)}
            className={`${inputCls} w-24`} style={inputStyle} />
        </div>
      )}

      {/* Booking ID */}
      {availableFilters.includes("booking_id") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Booking ID</label>
          <input type="number" value={filters.booking_id || ""} placeholder="ID..."
            onChange={(e) => set("booking_id", e.target.value ? parseInt(e.target.value) : undefined)}
            className={`${inputCls} w-24`} style={inputStyle} />
        </div>
      )}

      {/* Rows */}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Rows</label>
        <select value={filters.page_size || 100} onChange={(e) => set("page_size", parseInt(e.target.value))}
          className={`${inputCls} w-24`} style={inputStyle}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={250}>250</option>
          <option value={500}>500</option>
        </select>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button onClick={onReset} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-40"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <X size={12} /> Reset
        </button>
        <button onClick={onGenerate} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>
    </div>
  );
}

// ── Preview area ──────────────────────────────────────────────────────────────
function PreviewArea({ result, loading, onExportPDF, onExportExcel, onPrint, exporting }: {
  result?: ReportResult; loading: boolean;
  onExportPDF: () => void; onExportExcel: () => void;
  onPrint: () => void; exporting: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(59,130,246,0.12)" }}>
          <Loader2 size={22} className="text-blue-400 animate-spin" />
        </div>
        <p className="text-sm text-muted">Generating report...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(59,130,246,0.06)", border: "1px dashed rgba(59,130,246,0.2)" }}>
          <Play size={24} className="text-blue-400/40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-secondary">Ready to generate</p>
          <p className="text-xs text-muted mt-1">Set your filters above and click Generate</p>
        </div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle size={28} className="text-red-400" />
        <p className="text-sm text-red-400">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Result meta bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={13} className="text-green-400" />
            <span className="text-sm font-bold text-primary">{result.meta.title}</span>
          </div>
          {result.meta.subtitle && (
            <span className="text-xs text-muted">{result.meta.subtitle}</span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "rgba(16,185,129,0.12)", color: "#34d399" }}>
            {result.meta.total_records.toLocaleString()} records
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <Clock size={10} />
            {new Date(result.meta.generated_at).toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <User size={10} />
            {result.meta.generated_by}
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

        {/* Export buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onPrint} disabled={exporting} title="Print"
            className="p-2 rounded-lg border text-muted hover:text-secondary transition-colors disabled:opacity-40"
            style={{ borderColor: "var(--border)" }}>
            <Printer size={14} />
          </button>
          <button onClick={onExportExcel} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40"
            style={{ borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: "#34d399" }}>
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button onClick={onExportPDF} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40"
            style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#f87171" }}>
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            PDF
          </button>
        </div>
      </div>

      {/* Active filters */}
      {Object.keys(result.meta.filters_applied).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted">Filters:</span>
          {Object.entries(result.meta.filters_applied).map(([k, v]) => (
            <span key={k} className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>
              {k}: {v}
            </span>
          ))}
        </div>
      )}

      {/* Summary cards */}
      {result.summary && result.summary.length > 0 && (
        <ReportSummaryCards summary={result.summary} />
      )}

      {/* Data table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <ReportTable columns={result.columns} rows={result.rows} meta={result.meta} showPagination />
      </div>
    </div>
  );
}

// ── Main ReportRunner ─────────────────────────────────────────────────────────
export default function ReportRunner() {
  const { reportKey } = useParams<{ reportKey: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<ReportResult | undefined>();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<ReportRequest>(DEFAULT_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const meta = reportKey ? REPORT_META[reportKey] : undefined;
  // Derive category group from the report key for the breadcrumb icon
  const KEY_TO_GROUP: Record<string, string> = {
    customer_profile: "client", customer_ledger: "client", installment_schedule: "client", outstanding_report: "client",
    lead_summary: "crm",
    inventory_report: "property", available_units: "property", floor_wise_report: "property", category_wise_report: "property",
    cash_flow: "finance", daily_collection: "finance", monthly_collection: "finance", expense_report: "finance",
    tenant_profile: "tenant", rent_ledger: "tenant", rent_due_report: "tenant", security_deposit_report: "tenant",
  };
  const groupId = reportKey ? (KEY_TO_GROUP[reportKey] ?? "client") : "client";
  const cat = CAT_CONFIG[groupId] ?? CAT_CONFIG["client"];
  const CatIcon = cat?.icon ?? FileText;

  // Build filter list
  const availableFilters = [...(meta?.filters ?? [])];
  if (meta?.requiresEntity === "client")  availableFilters.push("client_id");
  if (meta?.requiresEntity === "tenant")  availableFilters.push("tenant_id");
  if (meta?.requiresEntity === "booking") availableFilters.push("booking_id");

  const hasFilters = availableFilters.length > 0;

  const generate = useCallback(async (f: ReportRequest) => {
    if (!reportKey) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateReport(reportKey, f);
      setResult(data);
      // Track recent
      const recent: string[] = JSON.parse(localStorage.getItem("report_recent") || "[]");
      localStorage.setItem("report_recent", JSON.stringify([reportKey, ...recent.filter((k) => k !== reportKey)].slice(0, 10)));
      // Track history
      const hist = JSON.parse(localStorage.getItem("report_history") || "[]");
      hist.unshift({ id: Date.now().toString(), reportKey, reportName: meta?.name ?? reportKey, format: "preview", generatedAt: new Date().toISOString(), recordCount: data.meta.total_records });
      localStorage.setItem("report_history", JSON.stringify(hist.slice(0, 50)));
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [reportKey, meta]);

  const handleReset = () => { setFilters(DEFAULT_FILTERS); setResult(undefined); setError(null); };

  const handleExportPDF = async () => {
    if (!reportKey) return;
    setExporting(true);
    try {
      const blob = await exportReport(reportKey, { ...filters, format: "pdf", export_mode: true });
      downloadBlob(blob, `${reportKey}_${new Date().toISOString().slice(0, 10)}.pdf`);
      // Track history
      const hist = JSON.parse(localStorage.getItem("report_history") || "[]");
      hist.unshift({ id: Date.now().toString(), reportKey, reportName: meta?.name ?? reportKey, format: "pdf", generatedAt: new Date().toISOString(), recordCount: result?.meta.total_records });
      localStorage.setItem("report_history", JSON.stringify(hist.slice(0, 50)));
    } catch (err: any) {
      setError(err?.response?.data?.detail || "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!reportKey) return;
    setExporting(true);
    try {
      const blob = await exportReport(reportKey, { ...filters, format: "excel", export_mode: true });
      downloadBlob(blob, `${reportKey}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      const hist = JSON.parse(localStorage.getItem("report_history") || "[]");
      hist.unshift({ id: Date.now().toString(), reportKey, reportName: meta?.name ?? reportKey, format: "excel", generatedAt: new Date().toISOString(), recordCount: result?.meta.total_records });
      localStorage.setItem("report_history", JSON.stringify(hist.slice(0, 50)));
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Excel export failed");
    } finally {
      setExporting(false);
    }
  };

  if (!reportKey || !meta) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <FileText size={32} className="text-muted" />
        <p className="text-sm text-muted">Report not found</p>
        <button onClick={() => navigate("/reports")}
          className="text-xs text-blue-400 hover:underline">
          ← Back to Reports Center
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ background: "var(--bg-base)" }}>

      {/* ── Top bar: breadcrumb + title + actions ─────────────────────────── */}
      <div className="shrink-0 px-5 py-3 border-b flex items-center gap-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>

        {/* Back */}
        <button onClick={() => navigate("/reports")}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors shrink-0">
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Reports</span>
        </button>

        <span className="text-muted text-xs shrink-0">/</span>

        {/* Report icon + name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: cat?.bg ?? "rgba(59,130,246,0.12)" }}>
            <CatIcon size={12} style={{ color: cat?.accent ?? "#3b82f6" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary truncate leading-none">{meta.name}</p>
            <p className="text-[10px] text-muted truncate mt-0.5 hidden sm:block">{meta.description}</p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {result && (
            <button onClick={() => generate({ ...filters, page: 1 })} disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
          {hasFilters && (
            <button onClick={() => setFiltersOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors"
              style={{
                borderColor: filtersOpen ? "rgba(59,130,246,0.4)" : "var(--border)",
                background: filtersOpen ? "rgba(59,130,246,0.08)" : "transparent",
                color: filtersOpen ? "#60a5fa" : "var(--text-muted)",
              }}>
              <SlidersHorizontal size={12} />
              Filters
              {filtersOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* ── Inline filter bar (collapsible) ──────────────────────────────── */}
      {hasFilters && filtersOpen && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          availableFilters={availableFilters}
          loading={loading}
          onGenerate={() => generate({ ...filters, page: 1 })}
          onReset={handleReset}
        />
      )}

      {/* ── No-filter reports: show generate button inline ────────────────── */}
      {!hasFilters && !result && !loading && (
        <div className="shrink-0 px-5 py-3 border-b flex items-center gap-3"
          style={{ borderColor: "var(--border)" }}>
          <button onClick={() => generate(filters)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Play size={14} /> Generate Report
          </button>
          <p className="text-xs text-muted">No filters required for this report</p>
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="shrink-0 mx-5 mt-3 px-4 py-2.5 rounded-lg border flex items-center gap-2 text-xs"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#f87171" }}>
          <AlertCircle size={13} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      {/* ── Preview area (full width, scrollable) ────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 print-area">
        <PreviewArea
          result={result}
          loading={loading}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onPrint={() => window.print()}
          exporting={exporting}
        />
      </div>
    </div>
  );
}
