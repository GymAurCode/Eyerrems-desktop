import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart2, Search, Star, FileText, Eye, Download,
  Users, Building2, Wallet, Home, HardHat, UserCog,
  UserCheck, X, ChevronRight, Wrench, Settings, ArrowRight,
  LayoutGrid, Sliders, ToggleLeft, ToggleRight,
} from "lucide-react";
import BulkImportTab from "../../components/import/BulkImportTab";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Report {
  key: string;
  name: string;
  subtitle: string;
  group: string;
}

// ── Report groups — only real, working reports ────────────────────────────────
const GROUPS: {
  id: string;
  label: string;
  icon: React.ElementType;
  accent: string;
  bg: string;
  reports: Report[];
}[] = [
  {
    id: "client",
    label: "Client & Booking",
    icon: UserCheck,
    accent: "#3b82f6",
    bg: "rgba(59,130,246,0.10)",
    reports: [
      { key: "installment_plan",     name: "Installment Plan",     subtitle: "Enterprise financial plan with full schedule, signatures & declaration",  group: "client" },
      { key: "booking_form",         name: "Booking Form",         subtitle: "Official booking form with applicant, nominee, property & payment plan",   group: "client" },
      { key: "customer_profile",     name: "Customer Profile",     subtitle: "Client details, CNIC, contact, nominee & booking info",                    group: "client" },
      { key: "customer_ledger",      name: "Customer Ledger",      subtitle: "Debit, credit, balance & full payment history",                            group: "client" },
      { key: "installment_schedule", name: "Installment Schedule", subtitle: "Payment schedule, installments, outstanding & totals",                     group: "client" },
      { key: "outstanding_report",   name: "Outstanding Payments", subtitle: "Overdue installments with aging and due dates",                            group: "client" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    accent: "#6366f1",
    bg: "rgba(99,102,241,0.10)",
    reports: [
      { key: "lead_summary",  name: "CRM Summary",  subtitle: "Total leads, converted, pending & closed",          group: "crm" },
      { key: "lead_summary",  name: "Leads List",   subtitle: "Lead names, phone, source, assigned user & status", group: "crm" },
    ],
  },
  {
    id: "property",
    label: "Property",
    icon: Building2,
    accent: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    reports: [
      { key: "inventory_report", name: "Property Inventory",  subtitle: "Total units — available, sold & reserved",    group: "property" },
      { key: "available_units",  name: "Available Properties", subtitle: "All units currently available for sale/rent", group: "property" },
      { key: "floor_wise_report", name: "Floor Wise Report",  subtitle: "Unit distribution and status by floor",       group: "property" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    accent: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    reports: [
      { key: "cash_flow",          name: "Cash Flow",          subtitle: "Inflows vs outflows with running balance",    group: "finance" },
      { key: "daily_collection",   name: "Daily Collection",   subtitle: "Payment collections by date range",           group: "finance" },
      { key: "monthly_collection", name: "Monthly Collection", subtitle: "Monthly collection summary for a year",       group: "finance" },
      { key: "expense_report",     name: "Expense Report",     subtitle: "All expenses with account breakdown",         group: "finance" },
    ],
  },
  {
    id: "tenant",
    label: "Tenant",
    icon: Home,
    accent: "#f97316",
    bg: "rgba(249,115,22,0.10)",
    reports: [
      { key: "tenant_profile",          name: "Tenant Profile",    subtitle: "Tenant details, lease info & payment history", group: "tenant" },
      { key: "rent_ledger",             name: "Rent Ledger",       subtitle: "Rent payment history with running balance",    group: "tenant" },
      { key: "rent_due_report",         name: "Rent Due Report",   subtitle: "All pending and overdue rent records",         group: "tenant" },
      { key: "security_deposit_report", name: "Security Deposits", subtitle: "Security deposits held for all tenants",       group: "tenant" },
    ],
  },
  {
    id: "hr",
    label: "HR",
    icon: UserCog,
    accent: "#8b5cf6",
    bg: "rgba(139,92,246,0.10)",
    reports: [
      { key: "lead_summary", name: "Employees List",   subtitle: "All employees with department and position",  group: "hr" },
      { key: "lead_summary", name: "Salary Report",    subtitle: "Payroll summary with allowances & deductions", group: "hr" },
      { key: "lead_summary", name: "Attendance Report", subtitle: "Daily attendance records by employee",        group: "hr" },
    ],
  },
  {
    id: "construction",
    label: "Construction",
    icon: HardHat,
    accent: "#14b8a6",
    bg: "rgba(20,184,166,0.10)",
    reports: [
      { key: "material_usage",          name: "Material Usage",          subtitle: "Materials consumed per project phase",       group: "construction" },
      { key: "expense_report", name: "Construction Expense",  subtitle: "All construction costs and expenses",        group: "construction" },
      { key: "work_progress",   name: "Work Progress Summary",   subtitle: "Phase completion status and progress",       group: "construction" },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    accent: "#ec4899",
    bg: "rgba(236,72,153,0.10)",
    reports: [
      { key: "complaint_report",     name: "Complaint Report",     subtitle: "All maintenance complaints and status",    group: "maintenance" },
      { key: "expense_report", name: "Maintenance Expense", subtitle: "Maintenance costs and expense breakdown", group: "maintenance" },
      { key: "pending_requests",     name: "Pending Requests",     subtitle: "Open and unresolved maintenance requests", group: "maintenance" },
    ],
  },
];

// Keys that have a real backend endpoint
const LIVE_KEYS = new Set([
  "installment_plan", "booking_form",
  "customer_profile", "customer_ledger", "installment_schedule", "outstanding_report",
  "lead_summary", "inventory_report", "available_units", "floor_wise_report",
  "category_wise_report", "daily_collection", "monthly_collection", "expense_report",
  "cash_flow", "tenant_profile", "rent_ledger", "rent_due_report", "security_deposit_report",
]);

// Enterprise document reports that have dedicated pages
const ENTERPRISE_ROUTES: Record<string, string> = {
  "installment_plan": "/reports/installment-plan",
  "booking_form":     "/reports/booking-form",
};

// Enterprise badge keys
const ENTERPRISE_KEYS = new Set(["installment_plan", "booking_form"]);

// Flat list for search
const ALL_REPORTS: Report[] = GROUPS.flatMap((g) => g.reports);

// ── Report Card (Unified layout) ──────────────────────────────────────────────
function ReportCard({ report, accent, bg, icon: Icon, isFav, onToggleFav, onOpen }: {
  report: Report;
  accent: string;
  bg: string;
  icon: React.ElementType;
  isFav: boolean;
  onToggleFav: (key: string) => void;
  onOpen: (key: string) => void;
}) {
  const isLive = LIVE_KEYS.has(report.key);

  return (
    <div
      className="group relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 hover:border-blue-500/30 hover:shadow-md"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)", transform: "translateY(0)" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          {/* Icon + Title */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: bg }}
            >
              <Icon size={13} style={{ color: accent }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-primary leading-tight">{report.name}</span>
                {ENTERPRISE_KEYS.has(report.key) && (
                  <span className="shrink-0 text-[8px] font-extrabold px-1 py-0.5 rounded"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                    ENTERPRISE
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Star Favorite Action */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav(report.key);
            }}
            className={`p-1 rounded transition-colors ${isFav ? "text-yellow-400" : "text-muted hover:text-yellow-400"}`}
          >
            <Star size={12} fill={isFav ? "currentColor" : "none"} />
          </button>
        </div>

        <p className="text-[10px] text-muted mt-2 line-clamp-2 h-7">{report.subtitle}</p>
      </div>

      {/* Footer / Actions */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between gap-1.5" style={{ borderColor: "var(--border)" }}>
        {isLive ? (
          <>
            <button
              onClick={() => onOpen(report.key)}
              className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold rounded-lg transition-colors border"
              style={{ background: "rgba(59,130,246,0.06)", color: "#60a5fa", borderColor: "rgba(59,130,246,0.15)" }}
            >
              <Eye size={10} />
              Preview
            </button>
            <button
              onClick={() => onOpen(report.key)}
              className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold rounded-lg transition-colors border"
              style={{ background: "rgba(16,185,129,0.06)", color: "#34d399", borderColor: "rgba(16,185,129,0.15)" }}
            >
              <Download size={10} />
              Export
            </button>
          </>
        ) : (
          <span className="text-[10px] text-muted italic">Under Development</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportsCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "reports";

  const [search, setSearch] = useState("");

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("report_favorites") || "[]"); }
    catch { return []; }
  });

  // Accordion layout preferences: "single" or "multi" expand
  const [accordionMode, setAccordionMode] = useState<"single" | "multi">((() => {
    return (localStorage.getItem("reports_accordion_mode") as "single" | "multi") || "single";
  }));

  // Expanded categories
  const [expandedCategories, setExpandedCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("reports_expanded_categories");
      if (saved) return JSON.parse(saved);
      // Default first one open
      return [GROUPS[0].id];
    } catch {
      return [GROUPS[0].id];
    }
  });

  // Persist preferences
  const saveAccordionPref = (mode: "single" | "multi") => {
    setAccordionMode(mode);
    localStorage.setItem("reports_accordion_mode", mode);
  };

  const toggleCategory = (groupId: string) => {
    setExpandedCategories((prev) => {
      let next: string[];
      if (accordionMode === "single") {
        next = prev.includes(groupId) ? [] : [groupId];
      } else {
        next = prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId];
      }
      localStorage.setItem("reports_expanded_categories", JSON.stringify(next));
      return next;
    });
  };

  const toggleFav = useCallback((key: string) => {
    setFavorites((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem("report_favorites", JSON.stringify(next));
      return next;
    });
  }, []);

  const openReport = useCallback((key: string) => {
    const recent: string[] = JSON.parse(localStorage.getItem("report_recent") || "[]");
    localStorage.setItem("report_recent", JSON.stringify([key, ...recent.filter((k) => k !== key)].slice(0, 10)));
    if (ENTERPRISE_ROUTES[key]) {
      navigate(ENTERPRISE_ROUTES[key]);
    } else {
      navigate(`/reports/run/${key}`);
    }
  }, [navigate]);

  // Search: flat list across all groups
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return ALL_REPORTS.filter(
      (r) => r.name.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q) || r.group.includes(q)
    );
  }, [search]);

  const totalReports = ALL_REPORTS.length;

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--bg-base)" }}>
      <div className="w-full px-6 py-6 space-y-6">

        {/* ── Tabs header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b pb-1" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSearchParams({ tab: "reports" })}
              className={`pb-3 text-sm font-bold relative transition-colors ${
                activeTab === "reports" ? "text-primary" : "text-muted hover:text-primary"
              }`}
            >
              Reports Center
              {activeTab === "reports" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setSearchParams({ tab: "import" })}
              className={`pb-3 text-sm font-bold relative transition-colors ${
                activeTab === "import" ? "text-primary" : "text-muted hover:text-primary"
              }`}
            >
              Bulk Import Center
              {activeTab === "import" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,#f97316,#6366f1)" }}
            >
              <BarChart2 size={13} className="text-white" />
            </div>
            <span className="text-[10px] text-muted font-semibold">
              {activeTab === "import" ? "Import Logs & Wizards" : `${totalReports} Reports Available`}
            </span>
          </div>
        </div>

        {/* ── REPORTS TAB CONTENT ────────────────────────────────────────── */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Search */}
              <div className="relative w-64 shrink-0">
                <Search size={13} className="absolute left-3 top-2.5 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search reports..."
                  className="w-full pl-8 pr-7 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-2.5 text-muted hover:text-secondary">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Mode Toggles */}
              {search === "" && (
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1"><Sliders size={12} /> Accordion Pref:</span>
                  <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={() => saveAccordionPref("single")}
                      className={`px-2.5 py-1 text-[10px] font-bold transition-all ${
                        accordionMode === "single" ? "bg-blue-500/10 text-blue-400 font-extrabold" : "hover:bg-neutral-800/10"
                      }`}
                    >
                      Single Open
                    </button>
                    <button
                      onClick={() => saveAccordionPref("multi")}
                      className={`px-2.5 py-1 text-[10px] font-bold transition-all ${
                        accordionMode === "multi" ? "bg-blue-500/10 text-blue-400 font-extrabold" : "hover:bg-neutral-800/10"
                      }`}
                    >
                      Multi Open
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Search results ──────────────────────────────────────────────── */}
            {searchResults !== null && (
              <div>
                <p className="text-xs text-muted mb-3">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for
                  <span className="text-primary font-medium ml-1">"{search}"</span>
                </p>
                {searchResults.length === 0 ? (
                  <div
                    className="rounded-xl border p-10 text-center"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
                  >
                    <FileText size={24} className="text-muted mx-auto mb-2" />
                    <p className="text-sm text-muted">No reports match your search</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.map((r, i) => {
                      const grp = GROUPS.find((g) => g.id === r.group) ?? GROUPS[0];
                      return (
                        <ReportCard
                          key={`${r.key}-${i}`}
                          report={r}
                          accent={grp.accent}
                          bg={grp.bg}
                          icon={grp.icon}
                          isFav={favorites.includes(r.key)}
                          onToggleFav={toggleFav}
                          onOpen={openReport}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Collapsible Categories Accordions list ────────────────────────── */}
            {searchResults === null && (
              <div className="space-y-3">
                {GROUPS.map((group) => {
                  const Icon = group.icon;
                  const isExpanded = expandedCategories.includes(group.id);

                  return (
                    <div
                      key={group.id}
                      className="rounded-xl border overflow-hidden transition-all duration-200"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--bg-surface)",
                        boxShadow: isExpanded ? "0 2px 8px -1px rgba(0,0,0,0.04)" : "none",
                      }}
                    >
                      {/* Accordion header */}
                      <button
                        onClick={() => toggleCategory(group.id)}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-neutral-800/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: group.bg }}
                          >
                            <Icon size={13} style={{ color: group.accent }} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-primary">{group.label}</span>
                            <span className="text-[10px] text-muted ml-2">({group.reports.length} reports)</span>
                          </div>
                        </div>

                        {/* Chevron Indicator */}
                        <div
                          className="text-muted transition-transform duration-200"
                          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                        >
                          <ChevronRight size={15} />
                        </div>
                      </button>

                      {/* Accordion expanded content */}
                      {isExpanded && (
                        <div className="p-4 border-t space-y-1.5" style={{ borderColor: "var(--border)", background: "var(--bg-base)" }}>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {group.reports.map((r, i) => (
                              <ReportCard
                                key={`${r.key}-${i}`}
                                report={r}
                                accent={group.accent}
                                bg={group.bg}
                                icon={group.icon}
                                isFav={favorites.includes(r.key)}
                                onToggleFav={toggleFav}
                                onOpen={openReport}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── BULK IMPORT TAB CONTENT ────────────────────────────────────── */}
        {activeTab === "import" && (
          <div className="space-y-6">
            <BulkImportTab />
          </div>
        )}

      </div>
    </div>
  );
}
