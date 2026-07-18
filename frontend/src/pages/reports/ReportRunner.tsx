import React, { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, FileSpreadsheet, Printer, RefreshCw,
  Play, SlidersHorizontal, Calendar, Search, X, Loader2,
  FileText, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { generateReport } from "../../lib/reportsApi";
import { ReportRequest } from "../../components/reports/types";
import ReportViewer from "../../components/reports/ReportViewer.jsx";

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
  material_usage:           { name: "Material Usage",           description: "Materials consumed per project phase",             filters: ["date_range", "search"]                                         },
  work_progress:            { name: "Work Progress Summary",    description: "Phase completion status and progress",             filters: ["date_range", "status"]                                         },
  complaint_report:         { name: "Complaint Report",         description: "All maintenance complaints and status",           filters: ["date_range", "search", "status"]                               },
  pending_requests:         { name: "Pending Requests",         description: "Open and unresolved maintenance requests",        filters: ["date_range", "status"]                                         },
  deal_report:              { name: "Deal Summary Report",      description: "Complete deal summary with financial details",    filters: []                                          },
  outstanding_payments:     { name: "Outstanding Payments",     description: "Customer outstanding payment summary",            filters: ["date_range"]                                                   },
  token_receipt:            { name: "Token Receipt",            description: "Booking token payment receipt",                   filters: []                                          },
  unit_statement:           { name: "Unit Statement",           description: "Complete unit financial statement",               filters: ["date_range"]                            },
  tenant_history:           { name: "Tenant History",           description: "Tenant occupancy history for a unit",             filters: []                                          },
  employees_list:           { name: "Employees List",           description: "All employees with department and position",      filters: ["search", "status"] },
  salary_report:            { name: "Salary Report",            description: "Payroll summary with allowances & deductions",    filters: ["search"] },
  attendance_report:        { name: "Attendance Report",        description: "Daily attendance records by employee",            filters: ["date_range", "status"] },
};

const DEFAULT_FILTERS: ReportRequest = { page: 1, page_size: 100, sort_order: "asc" };

// ── Map report key to its column config ────────────────────────────────────────
const REPORT_COLUMNS: Record<string, any[]> = {
  lead_summary: [
    { key:'id', label:'Lead ID', width:'110px', align:'left', format:'text' },
    { key:'name', label:'Name', align:'left', format:'text' },
    { key:'phone', label:'Phone', width:'130px', align:'left', format:'text' },
    { key:'source', label:'Source', width:'120px', align:'left', format:'text' },
    { key:'assigned_to', label:'Assigned To', align:'left', format:'text' },
    { key:'status', label:'Status', width:'120px', align:'center', format:'badge',
      badgeColors:{ new:'blue', contacted:'amber', converted:'green', negotiation:'blue', lost:'red' }},
    { key:'created_at', label:'Created', width:'110px', align:'center', format:'date' },
  ],
  deal_report: [
    { key:'id', label:'Deal ID', width:'120px', align:'left', format:'text' },
    { key:'title', label:'Deal Title', align:'left', format:'text' },
    { key:'client_name', label:'Client', align:'left', format:'text' },
    { key:'property_name', label:'Property', align:'left', format:'text' },
    { key:'deal_value', label:'Deal Value (PKR)', width:'150px', align:'right', format:'currency' },
    { key:'down_payment', label:'Down Payment', width:'140px', align:'right', format:'currency' },
    { key:'status', label:'Status', width:'110px', align:'center', format:'badge',
      badgeColors:{ active:'blue', won:'green', lost:'red', cancelled:'gray' }},
    { key:'dealer_name', label:'Dealer', align:'left', format:'text' },
    { key:'deal_date', label:'Date', width:'110px', align:'center', format:'date' },
  ],
  customer_ledger: [
    { key:'date', label:'Date', width:'110px', align:'center', format:'date' },
    { key:'description', label:'Description', align:'left', format:'text' },
    { key:'reference', label:'Reference', width:'130px', align:'left', format:'text' },
    { key:'debit', label:'Debit (PKR)', width:'140px', align:'right', format:'currency' },
    { key:'credit', label:'Credit (PKR)', width:'140px', align:'right', format:'currency' },
    { key:'balance', label:'Balance (PKR)', width:'150px', align:'right', format:'currency' },
  ],
  installment_schedule: [
    { key:'installment_no', label:'#', width:'50px', align:'center', format:'number' },
    { key:'description', label:'Description', align:'left', format:'text' },
    { key:'due_date', label:'Due Date', width:'120px', align:'center', format:'date' },
    { key:'amount', label:'Amount (PKR)', width:'140px', align:'right', format:'currency' },
    { key:'paid_amount', label:'Paid (PKR)', width:'130px', align:'right', format:'currency' },
    { key:'outstanding', label:'Outstanding (PKR)', width:'150px', align:'right', format:'currency' },
    { key:'status', label:'Status', width:'110px', align:'center', format:'badge',
      badgeColors:{ paid:'green', pending:'amber', overdue:'red', upcoming:'gray' }},
  ],
  inventory_report: [
    { key:'name', label:'Property', align:'left', format:'text' },
    { key:'category', label:'Type', width:'110px', align:'left', format:'text' },
    { key:'total_units', label:'Total Units', width:'110px', align:'center', format:'number' },
    { key:'available', label:'Available', width:'100px', align:'center', format:'number' },
    { key:'occupied', label:'Occupied', width:'100px', align:'center', format:'number' },
    { key:'reserved', label:'Reserved', width:'100px', align:'center', format:'number' },
    { key:'sold', label:'Sold', width:'80px', align:'center', format:'number' },
    { key:'occupancy_pct', label:'Occupancy %', width:'110px', align:'center', format:'number' },
  ],
  rent_ledger: [
    { key:'month', label:'Month', width:'110px', align:'left', format:'text' },
    { key:'due_date', label:'Due Date', width:'120px', align:'center', format:'date' },
    { key:'amount_due', label:'Amount Due (PKR)', width:'150px', align:'right', format:'currency' },
    { key:'paid_date', label:'Paid Date', width:'120px', align:'center', format:'date' },
    { key:'amount_paid', label:'Amount Paid (PKR)', width:'150px', align:'right', format:'currency' },
    { key:'balance', label:'Balance (PKR)', width:'140px', align:'right', format:'currency' },
    { key:'status', label:'Status', width:'100px', align:'center', format:'badge',
      badgeColors:{ paid:'green', partial:'amber', overdue:'red', pending:'gray' }},
  ],
  salary_report: [
    { key:'emp_id', label:'Emp ID', width:'90px', align:'left', format:'text' },
    { key:'name', label:'Employee', align:'left', format:'text' },
    { key:'department', label:'Department', width:'130px', align:'left', format:'text' },
    { key:'basic_salary', label:'Basic (PKR)', width:'130px', align:'right', format:'currency' },
    { key:'allowances', label:'Allowances (PKR)', width:'140px', align:'right', format:'currency' },
    { key:'deductions', label:'Deductions (PKR)', width:'140px', align:'right', format:'currency' },
    { key:'net_salary', label:'Net (PKR)', width:'130px', align:'right', format:'currency' },
    { key:'status', label:'Status', width:'100px', align:'center', format:'badge',
      badgeColors:{ paid:'green', pending:'amber', hold:'red' }},
  ],
  cash_flow: [
    { key:'date', label:'Date', width:'110px', align:'center', format:'date' },
    { key:'description', label:'Description', align:'left', format:'text' },
    { key:'category', label:'Category', width:'130px', align:'left', format:'text' },
    { key:'inflow', label:'Inflow (PKR)', width:'140px', align:'right', format:'currency' },
    { key:'outflow', label:'Outflow (PKR)', width:'140px', align:'right', format:'currency' },
    { key:'balance', label:'Balance (PKR)', width:'150px', align:'right', format:'currency' },
  ],
};

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

      {availableFilters.includes("date_range") && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">From</label>
            <div className="relative">
              <Calendar size={11} className="absolute left-2.5 top-2 text-muted" />
              <input type="date" value={filters.date_from || ""} onChange={(e) => set("date_from", e.target.value)}
                className={`${inputCls} pl-7 w-36`} style={inputStyle} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">To</label>
            <div className="relative">
              <Calendar size={11} className="absolute left-2.5 top-2 text-muted" />
              <input type="date" value={filters.date_to || ""} onChange={(e) => set("date_to", e.target.value)}
                className={`${inputCls} pl-7 w-36`} style={inputStyle} />
            </div>
          </div>
        </>
      )}

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

      {availableFilters.includes("client_id") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Client ID</label>
          <input type="number" value={filters.client_id || ""} placeholder="ID..."
            onChange={(e) => set("client_id", e.target.value ? parseInt(e.target.value) : undefined)}
            className={`${inputCls} w-24`} style={inputStyle} />
        </div>
      )}

      {availableFilters.includes("tenant_id") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Tenant ID</label>
          <input type="number" value={filters.tenant_id || ""} placeholder="ID..."
            onChange={(e) => set("tenant_id", e.target.value ? parseInt(e.target.value) : undefined)}
            className={`${inputCls} w-24`} style={inputStyle} />
        </div>
      )}

      {availableFilters.includes("booking_id") && (
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-muted uppercase tracking-wider">Booking ID</label>
          <input type="number" value={filters.booking_id || ""} placeholder="ID..."
            onChange={(e) => set("booking_id", e.target.value ? parseInt(e.target.value) : undefined)}
            className={`${inputCls} w-24`} style={inputStyle} />
        </div>
      )}

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

      <div className="flex-1" />

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

// ── Map backend result rows to ReportViewer compatible format ─────────────────
function mapResultToViewer(result: any, columns: any[]) {
  if (!result || !result.rows) return { data: [], summaryRows: [] }
  const data = result.rows.map((row: any) => {
    const mapped: any = {}
    columns.forEach(col => {
      mapped[col.key] = row[col.key]
    })
    return mapped
  })
  const summaryRows = result.summary ? result.summary.map((s: any) => ({ [columns[0]?.key || 'label']: s.label, ...(s.value !== undefined ? { [columns[columns.length-1]?.key || 'value']: s.value } : {}) })) : []
  return { data, summaryRows }
}

export default function ReportRunner() {
  const { reportKey } = useParams<{ reportKey: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportRequest>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const meta = reportKey ? REPORT_META[reportKey] : undefined;
  const columns = reportKey ? (REPORT_COLUMNS[reportKey] || []) : [];

  const KEY_TO_GROUP: Record<string, string> = {
    customer_profile: "client", customer_ledger: "client", installment_schedule: "client", outstanding_report: "client",
    lead_summary: "crm",
    inventory_report: "property", available_units: "property", floor_wise_report: "property", category_wise_report: "property",
    cash_flow: "finance", daily_collection: "finance", monthly_collection: "finance", expense_report: "finance",
    tenant_profile: "tenant", rent_ledger: "tenant", rent_due_report: "tenant", security_deposit_report: "tenant",
    material_usage: "construction", work_progress: "construction",
    complaint_report: "maintenance", pending_requests: "maintenance",
    deal_report: "crm", outstanding_payments: "client", token_receipt: "client",
    unit_statement: "property", tenant_history: "tenant",
    employees_list: "hr", salary_report: "hr", attendance_report: "hr",
  };
  const groupId = reportKey ? (KEY_TO_GROUP[reportKey] ?? "client") : "client";
  const cat = CAT_CONFIG[groupId] ?? CAT_CONFIG["client"];
  const CatIcon = cat?.icon ?? FileText;

  const availableFilters = [...(meta?.filters ?? [])];
  if (meta?.requiresEntity === "client")  availableFilters.push("client_id");
  if (meta?.requiresEntity === "tenant")  availableFilters.push("tenant_id");
  if (meta?.requiresEntity === "booking") availableFilters.push("booking_id");

  const hasFilters = availableFilters.length > 0;

  const generate = useCallback(async (f: ReportRequest) => {
    if (!reportKey) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(
        `/reports/${reportKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(f),
          signal: controller.signal
        }
      )
      clearTimeout(timeout)

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${response.status}`)
      }

      const data = await response.json()
      setResult(data)

      const recent: string[] = JSON.parse(localStorage.getItem("report_recent") || "[]");
      localStorage.setItem("report_recent", JSON.stringify([reportKey, ...recent.filter((k) => k !== reportKey)].slice(0, 10)));
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.')
      } else {
        setError(err?.response?.data?.detail || err?.message || "Failed to generate report")
      }
    } finally {
      setLoading(false);
    }
  }, [reportKey]);

  const handleReset = () => { setFilters(DEFAULT_FILTERS); setResult(null); setError(null); };

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

  // Use backend columns if available, otherwise use our predefined columns
  const viewerColumns = (result?.columns && result.columns.length > 0)
    ? result.columns.map((c: any) => ({
        key: c.key,
        label: c.label,
        align: c.align || 'left',
        format: c.data_type === 'currency' ? 'currency' : c.data_type === 'date' ? 'date' : c.data_type === 'badge' ? 'badge' : c.data_type === 'number' ? 'number' : 'text',
        badgeColors: c.badge_map || undefined,
        width: c.width || undefined,
      }))
    : columns

  const viewerData = result ? result.rows || [] : []

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ background: "var(--bg-base)" }}>
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
            style={{ background: cat?.bg ?? "rgba(59,130,246,0.12)" }}>
            <CatIcon size={12} style={{ color: cat?.accent ?? "#3b82f6" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary truncate leading-none">{meta.name}</p>
            <p className="text-[10px] text-muted truncate mt-0.5 hidden sm:block">{meta.description}</p>
          </div>
        </div>
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

      {!hasFilters && !result && !loading && !error && (
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

      {error && (
        <div className="shrink-0 mx-5 mt-3 px-4 py-2.5 rounded-lg border flex items-center gap-2 text-xs"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#f87171" }}>
          <AlertCircle size={13} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <ReportViewer
          reportTitle={meta.name}
          reportSubtitle={filters.date_from && filters.date_to ? `Period: ${filters.date_from} - ${filters.date_to}` : ''}
          columns={viewerColumns}
          data={viewerData}
          loading={loading && !result}
          error={error}
        />
      </div>
    </div>
  );
}
