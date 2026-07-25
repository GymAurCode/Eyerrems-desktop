import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { downloadBlob } from "../utils/fileHelpers";
import {
  Building2, Users, CreditCard, UserCheck, LayoutDashboard, Home, Briefcase,
  FileText, FileSpreadsheet, Printer, Loader2, RefreshCw, ArrowLeft, ChevronRight,
  PanelRightClose, PanelRightOpen, Search, Settings,
} from "lucide-react";
import ReportSettingsModal from "../components/reports/ReportSettingsModal";

interface ModuleDef {
  key: string;
  label: string;
  icon: any;
  iconClass: string;
  reports: ReportDef[];
}

interface ReportDef {
  key: string;
  label: string;
  description: string;
  behavior: "list" | "profile";
  entityLabel?: string;
}

const MODULES: ModuleDef[] = [
  {
    key: "property",
    label: "Property",
    icon: Building2,
    iconClass: "ti-building",
    reports: [
      { key: "property_listing", label: "Property Listing", description: "All properties with details and prices", behavior: "list" },
      { key: "unit_listing", label: "Unit Listing", description: "All units with type, size, price, and status", behavior: "list" },
      { key: "available_units", label: "Available Units", description: "Available units filterable by project and specification", behavior: "list" },
      { key: "occupied_units", label: "Occupied Units", description: "Booked, sold, rented, and occupied units", behavior: "list" },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    icon: Users,
    iconClass: "ti-users",
    reports: [
      { key: "leads_list", label: "Lead List", description: "All CRM leads filterable by status and source", behavior: "list" },
      { key: "clients_list", label: "Client List", description: "All registered clients with contact info", behavior: "list" },
      { key: "customer_portfolio_summary", label: "Client Portfolio", description: "Customer portfolio with booking statistics", behavior: "list" },
      { key: "booking_statement", label: "Client Statement", description: "Full statement for a single booking", behavior: "profile", entityLabel: "Booking ID" },
      { key: "customers_register", label: "Customers Register", description: "List of all registered customers", behavior: "list" },
    ],
  },
  {
    key: "tenant",
    label: "Tenant",
    icon: Home,
    iconClass: "ti-home",
    reports: [
      { key: "tenant_list", label: "Tenant List", description: "All registered tenants with contact info", behavior: "list" },
      { key: "tenant_profile", label: "Tenant Profile", description: "Full picture of a single tenant with rent records", behavior: "profile", entityLabel: "Tenant ID" },
    ],
  },
  {
    key: "bookings",
    label: "Bookings / Deals",
    icon: LayoutDashboard,
    iconClass: "ti-dashboard",
    reports: [
      { key: "sales_summary", label: "Sales Summary", description: "Aggregated sales by project, period, and agent", behavior: "list" },
      { key: "bookings_register", label: "Booking Report", description: "Filterable register of all bookings", behavior: "list" },
      { key: "booking_detail", label: "Booking Detail", description: "Full breakdown of a single booking", behavior: "profile", entityLabel: "Booking ID" },
      { key: "pipeline_summary", label: "Pipeline Summary", description: "Deals grouped by stage with total values", behavior: "list" },
      { key: "deals_register", label: "Deal Report", description: "Filterable register of all deals", behavior: "list" },
      { key: "deal_detail", label: "Deal Detail", description: "Full breakdown of a single deal", behavior: "profile", entityLabel: "Deal ID" },
      { key: "commission_report", label: "Commission Summary", description: "Agent commissions by period and status", behavior: "list" },
      { key: "agent_commission_detail", label: "Agent Commission", description: "Per-deal breakdown for one agent", behavior: "profile", entityLabel: "Agent ID" },
      { key: "agents_register", label: "Agents Register", description: "List of all agents with commission totals", behavior: "list" },
      { key: "cancellation_report", label: "Cancellations Summary", description: "Aggregated cancellations by period", behavior: "list" },
      { key: "cancellation_detail", label: "Cancellation Detail", description: "Full trail of a single cancellation", behavior: "profile", entityLabel: "Booking ID" },
    ],
  },
  {
    key: "hr",
    label: "HR",
    icon: Briefcase,
    iconClass: "ti-briefcase",
    reports: [
      { key: "employee_list", label: "Employee List", description: "All registered employees with department and position", behavior: "list" },
      { key: "employee_profile", label: "Employee Profile", description: "Full employee details with salary structure", behavior: "profile", entityLabel: "Employee ID" },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    icon: CreditCard,
    iconClass: "ti-credit-card",
    reports: [
      { key: "payment_history", label: "Payment History", description: "All payments across the system filterable by date and method", behavior: "list" },
      { key: "due_payments", label: "Due / Pending", description: "Overdue and pending payments requiring follow-up", behavior: "list" },
      { key: "collections_summary", label: "Collections Summary", description: "Aggregated collections by period and project", behavior: "list" },
      { key: "payment_ledger", label: "Payment Ledger", description: "Full payment history for a single client", behavior: "profile", entityLabel: "Client ID" },
      { key: "outstanding_dues", label: "Outstanding Dues", description: "Overdue installments register", behavior: "list" },
    ],
  },
];

const REPORT_LOOKUP = new Map<string, { mod: ModuleDef; rep: ReportDef }>();
for (const mod of MODULES) {
  for (const rep of mod.reports) {
    REPORT_LOOKUP.set(rep.key, { mod, rep });
  }
}

interface ParamField {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "date_range";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

const PARAM_SCHEMAS: Record<string, ParamField[]> = {
  // Property
  property_listing: [],
  unit_listing: [
    { key: "property_id", label: "Project ID", type: "number", required: false, placeholder: "Filter by project" },
    { key: "unit_type", label: "Unit Type", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Apartment", value: "apartment" },
      { label: "Villa", value: "villa" }, { label: "Shop", value: "shop" },
      { label: "Office", value: "office" }, { label: "Plot", value: "plot" },
    ]},
  ],
  available_units: [
    { key: "property_id", label: "Project ID", type: "number", required: false, placeholder: "Filter by project" },
    { key: "unit_type", label: "Unit Type", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Apartment", value: "apartment" },
      { label: "Villa", value: "villa" }, { label: "Shop", value: "shop" },
      { label: "Office", value: "office" }, { label: "Plot", value: "plot" },
    ]},
  ],
  occupied_units: [
    { key: "property_id", label: "Project ID", type: "number", required: false, placeholder: "Filter by project" },
    { key: "unit_type", label: "Unit Type", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Apartment", value: "apartment" },
      { label: "Villa", value: "villa" }, { label: "Shop", value: "shop" },
      { label: "Office", value: "office" }, { label: "Plot", value: "plot" },
    ]},
  ],
  // CRM
  leads_list: [
    { key: "status", label: "Status", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "New", value: "new" },
      { label: "Contacted", value: "contacted" }, { label: "Qualified", value: "qualified" },
      { label: "Follow Up", value: "follow_up" }, { label: "Site Visit", value: "site_visit" },
      { label: "Negotiation", value: "negotiation" }, { label: "Deal Won", value: "deal_won" },
      { label: "Converted", value: "converted" }, { label: "Lost", value: "lost" },
    ]},
    { key: "source", label: "Source", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Website", value: "website" },
      { label: "Referral", value: "referral" }, { label: "Campaign", value: "campaign" },
      { label: "Walk-in", value: "walk_in" }, { label: "Phone", value: "phone" },
      { label: "Social Media", value: "social_media" }, { label: "Other", value: "other" },
    ]},
    { key: "date_from", label: "From Date", type: "date", required: false },
    { key: "date_to", label: "To Date", type: "date", required: false },
  ],
  clients_list: [],
  customer_portfolio_summary: [],
  booking_statement: [
    { key: "entity_id", label: "Booking ID", type: "number", required: true, placeholder: "Enter Booking ID" },
  ],
  customers_register: [],
  // Tenant
  tenant_list: [
    { key: "status", label: "Status", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Active", value: "active" }, { label: "Inactive", value: "inactive" },
    ]},
    { key: "search", label: "Search Name", type: "text", required: false, placeholder: "Search by name" },
  ],
  tenant_profile: [
    { key: "entity_id", label: "Tenant ID", type: "number", required: true, placeholder: "Enter Tenant ID" },
  ],
  // Bookings / Deals
  sales_summary: [
    { key: "date_from", label: "From Date", type: "date", required: false },
    { key: "date_to", label: "To Date", type: "date", required: false },
    { key: "project_id", label: "Project ID", type: "number", required: false, placeholder: "Filter by project" },
    { key: "dealer_id", label: "Agent ID", type: "number", required: false, placeholder: "Filter by agent" },
  ],
  bookings_register: [
    { key: "date_from", label: "From Date", type: "date", required: false },
    { key: "date_to", label: "To Date", type: "date", required: false },
    { key: "project_id", label: "Project ID", type: "number", required: false, placeholder: "Filter by project" },
    { key: "status", label: "Status", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Active", value: "active" },
      { label: "Confirmed", value: "confirmed" }, { label: "Cancelled", value: "cancelled" },
    ]},
  ],
  booking_detail: [
    { key: "entity_id", label: "Booking ID", type: "number", required: true, placeholder: "Enter Booking ID" },
  ],
  pipeline_summary: [
    { key: "dealer_id", label: "Agent ID", type: "number", required: false, placeholder: "Filter by agent" },
  ],
  deals_register: [
    { key: "status", label: "Status", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Draft", value: "draft" },
      { label: "Negotiation", value: "negotiation" }, { label: "Won", value: "won" },
      { label: "Lost", value: "lost" }, { label: "Cancelled", value: "cancelled" },
    ]},
    { key: "dealer_id", label: "Agent ID", type: "number", required: false, placeholder: "Filter by agent" },
    { key: "date_from", label: "From Date", type: "date", required: false },
    { key: "date_to", label: "To Date", type: "date", required: false },
  ],
  deal_detail: [
    { key: "entity_id", label: "Deal ID", type: "number", required: true, placeholder: "Enter Deal ID" },
  ],
  commission_report: [
    { key: "dealer_id", label: "Agent ID", type: "number", required: false, placeholder: "Filter by agent" },
    { key: "date_from", label: "From Date", type: "date", required: false },
    { key: "date_to", label: "To Date", type: "date", required: false },
  ],
  agent_commission_detail: [
    { key: "entity_id", label: "Agent ID", type: "number", required: true, placeholder: "Enter Agent ID" },
  ],
  agents_register: [],
  cancellation_report: [
    { key: "date_from", label: "From Date", type: "date", required: false },
    { key: "date_to", label: "To Date", type: "date", required: false },
    { key: "status", label: "Status", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Cancelled", value: "cancelled" },
      { label: "Refunded", value: "refunded" },
    ]},
  ],
  cancellation_detail: [
    { key: "entity_id", label: "Booking ID", type: "number", required: true, placeholder: "Enter Booking ID" },
  ],
  // HR
  employee_list: [
    { key: "department_id", label: "Department ID", type: "number", required: false, placeholder: "Filter by department" },
    { key: "employment_status", label: "Status", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Active", value: "Active" },
      { label: "Inactive", value: "Inactive" }, { label: "Resigned", value: "Resigned" },
    ]},
  ],
  employee_profile: [
    { key: "entity_id", label: "Employee ID", type: "number", required: true, placeholder: "Enter Employee ID" },
  ],
  // Payments
  payment_history: [
    { key: "date_from", label: "From Date", type: "date", required: false },
    { key: "date_to", label: "To Date", type: "date", required: false },
    { key: "payment_method", label: "Method", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Cash", value: "cash" },
      { label: "Bank Transfer", value: "bank_transfer" }, { label: "Cheque", value: "cheque" },
      { label: "Online", value: "online" },
    ]},
  ],
  due_payments: [
    { key: "date_from", label: "From Date", type: "date", required: false },
    { key: "date_to", label: "To Date", type: "date", required: false },
  ],
  collections_summary: [
    { key: "date_from", label: "From Date", type: "date", required: false },
    { key: "date_to", label: "To Date", type: "date", required: false },
    { key: "project_id", label: "Project ID", type: "number", required: false, placeholder: "Filter by project" },
  ],
  payment_ledger: [
    { key: "entity_id", label: "Client ID", type: "number", required: true, placeholder: "Enter Client ID" },
  ],
  outstanding_dues: [
    { key: "client_id", label: "Client ID", type: "number", required: false, placeholder: "Filter by client" },
    { key: "project_id", label: "Project ID", type: "number", required: false, placeholder: "Filter by project" },
  ],
};

function getReportBackendType(reportKey: string): string {
  if (reportKey === "available_units") return "unit_listing";
  if (reportKey === "occupied_units") return "unit_listing";
  return reportKey;
}

const VIRTUAL_REPORT_FILTERS: Record<string, Record<string, any>> = {
  available_units: { status: "available" },
  occupied_units: { status_in: "booked,reserved,sold,occupied,rented" },
};

const VIRTUAL_REPORT_TITLES: Record<string, string> = {
  available_units: "Available Units",
  occupied_units: "Occupied Units",
};

interface WBField { key: string; label: string; type: "text" | "textarea"; section: string; }
const WORKBENCH_FIELDS: WBField[] = [
  { key: "company_name", label: "Company Name", type: "text", section: "Company Details" },
  { key: "tagline", label: "Tagline / Slogan", type: "text", section: "Company Details" },
  { key: "address", label: "Address", type: "textarea", section: "Company Details" },
  { key: "phone", label: "Phone", type: "text", section: "Contact" },
  { key: "email", label: "Email", type: "text", section: "Contact" },
  { key: "whatsapp", label: "WhatsApp", type: "text", section: "Contact" },
  { key: "uan_helpline", label: "UAN / Helpline", type: "text", section: "Contact" },
  { key: "report_reference_no", label: "Report Reference No.", type: "text", section: "Report Info" },
  { key: "prepared_for", label: "Prepared For", type: "text", section: "Report Info" },
  { key: "prepared_by", label: "Prepared By", type: "text", section: "Report Info" },
  { key: "footer_note", label: "Notes / Disclaimers", type: "textarea", section: "Notes" },
];
const WORKBENCH_SECTIONS = ["Company Details", "Contact", "Report Info", "Notes"];

interface SettingsData { [key: string]: any; }

export default function ReportsPage() {
  const { module: routeModule, reportType: routeReport } = useParams();
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportDef | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (routeModule) {
      const mod = MODULES.find((m) => m.key === routeModule);
      if (mod) {
        setSelectedModule(routeModule);
        if (routeReport) {
          const rep = mod.reports.find((r) => r.key === routeReport);
          if (rep) {
            setSelectedReport(rep);
            setSidebarCollapsed(true);
          } else {
            setSelectedReport(null);
            setSidebarCollapsed(false);
          }
        } else {
          setSelectedReport(null);
          setSidebarCollapsed(false);
        }
      }
    } else {
      setSelectedModule(null);
      setSelectedReport(null);
      setSidebarCollapsed(false);
    }
  }, [routeModule, routeReport]);

  const handleModuleClick = (modKey: string) => {
    navigate(`/reports/${modKey}`, { replace: true });
  };

  const handleReportClick = (rep: ReportDef) => {
    navigate(`/reports/${selectedModule}/${rep.key}`, { replace: true });
  };

  const handleBackToModule = () => {
    if (selectedModule) {
      navigate(`/reports/${selectedModule}`, { replace: true });
    }
  };

  const activeMod = selectedModule ? MODULES.find((m) => m.key === selectedModule) ?? null : null;

  return (
    <div className="flex h-full animate-slide-up" style={{ gap: "1px" }}>
      <aside
        className="flex flex-col shrink-0 overflow-hidden rounded-xl transition-all duration-200 ease-in-out"
        style={{
          width: sidebarCollapsed ? "52px" : "200px",
                  background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between px-2 h-10 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          {!sidebarCollapsed && (
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Modules
            </span>
          )}
          <div className="flex items-center gap-1" style={{ marginLeft: sidebarCollapsed ? 0 : "auto" }}>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-muted)" }}
              title="Report Settings"
            >
              <Settings size={12} />
            </button>
            <button
              onClick={() => setSidebarCollapsed((p) => !p)}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-black/5 transition-colors"
              style={{ color: "var(--text-muted)" }}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelRightOpen size={12} /> : <PanelRightClose size={12} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 py-2 px-1.5 space-y-0.5 overflow-y-auto">
          {MODULES.map((mod) => {
            const active = selectedModule === mod.key;
            return (
              <button
                key={mod.key}
                onClick={() => handleModuleClick(mod.key)}
                className="flex items-center gap-2.5 w-full text-left transition-all duration-150"
                style={{
                  padding: sidebarCollapsed ? "8px 0" : "8px 10px",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  background: active ? "color-mix(in srgb, var(--accent-teal) 14%, transparent)" : "transparent",
                  color: active ? "var(--accent-teal)" : "var(--text-secondary)",
                  borderLeft: active ? "2px solid var(--accent-teal)" : "2px solid transparent",
                  borderRadius: sidebarCollapsed ? "8px" : "0 8px 8px 0",
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "color-mix(in srgb, var(--accent-teal) 7%, transparent)"; e.currentTarget.style.color = "var(--accent-teal)"; }}}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
                title={sidebarCollapsed ? mod.label : undefined}
              >
                <mod.icon size={14} className="shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-[11px] font-medium truncate">{mod.label}</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedModule ? (
          <EmptyState />
        ) : !selectedReport ? (
          <div className="animate-fade-in h-full">
            <ReportTable module={activeMod!} onSelect={handleReportClick} />
          </div>
        ) : selectedReport.behavior === "list" ? (
          <div className="animate-fade-in h-full">
            <ListView report={selectedReport} module={activeMod!} onBack={handleBackToModule} onModuleClick={handleModuleClick} />
          </div>
          ) : (
          <div className="animate-fade-in h-full">
            <ReportWorkbench key={selectedReport.key} report={selectedReport} module={activeMod!} onBack={handleBackToModule} onModuleClick={handleModuleClick} />
          </div>
        )}
      </div>

      <ReportSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <FileText size={40} style={{ color: "var(--text-muted)", opacity: 0.25 }} />
        <p className="text-sm font-medium mt-4" style={{ color: "var(--text-secondary)" }}>
          Select a module from the sidebar
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          then choose a report type to generate
        </p>
      </div>
    </div>
  );
}

function ReportTable({ module, onSelect }: { module: ModuleDef; onSelect: (rep: ReportDef) => void }) {
  const Icon = module.icon;
  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2.5 px-4 h-11 shrink-0 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <Icon size={14} style={{ color: "var(--text-secondary)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
          {module.label}
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          — {module.reports.length} reports
        </span>
      </div>

      <div className="flex-1 overflow-auto" style={{ background: "var(--bg-surface)" }}>
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <Th style={{ width: "32%" }}>Report Name</Th>
              <Th style={{ width: "44%" }}>Description</Th>
              <Th style={{ width: "12%", textAlign: "right" }}>Type</Th>
              <Th style={{ width: "12%", textAlign: "right" }} />
            </tr>
          </thead>
          <tbody>
            {module.reports.map((rep) => (
              <tr
                key={rep.key}
                onClick={() => onSelect(rep)}
                className="cursor-pointer"
                style={{ borderBottom: "1px solid var(--border)", transition: "background 0.12s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <Td>
                  <div className="flex items-center gap-2">
                    <i className="ti ti-file-text text-xs" style={{ color: "var(--text-muted)" }} />
                    <span style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 500 }}>{rep.label}</span>
                  </div>
                </Td>
                <Td>
                  <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{rep.description}</span>
                </Td>
                <Td style={{ textAlign: "right" }}>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{
                    background: "var(--bg-tertiary)",
                    color: "var(--text-muted)",
                  }}>
                    {rep.behavior === "profile" ? "Single" : "Filtered"}
                  </span>
                </Td>
                <Td style={{ textAlign: "right" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(rep); }}
                    className="px-3 py-1 rounded-md text-[10px] font-medium transition-colors"
                    style={{
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--border)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                  >
                    Open
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th className="text-[10px] font-semibold uppercase tracking-wider" style={{ padding: "10px 14px", color: "var(--text-muted)", ...style }}>
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 14px", ...style }}>{children}</td>;
}

function ListView({
  report, module, onBack, onModuleClick,
}: {
  report: ReportDef;
  module: ModuleDef;
  onBack: () => void;
  onModuleClick: (modKey: string) => void;
}) {
  const schema = PARAM_SCHEMAS[report.key] || [];
  const backendType = getReportBackendType(report.key);
  const virtualFilters = VIRTUAL_REPORT_FILTERS[report.key] || {};
  const listTitle = VIRTUAL_REPORT_TITLES[report.key] || report.label;

  const [settings, setSettings] = useState<SettingsData>({});
  const [params, setParams] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [error, setError] = useState("");
  const [pageCount, setPageCount] = useState(1);
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    api.get("/reports/settings").then(({ data }) => {
      const s: SettingsData = {};
      for (const f of WORKBENCH_FIELDS) s[f.key] = data[f.key] ?? "";
      setSettings(s);
    }).catch(() => {
      const s: SettingsData = {};
      for (const f of WORKBENCH_FIELDS) s[f.key] = "";
      setSettings(s);
    });
  }, []);

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const field of schema) {
      if (field.type === "date_range" || field.type === "date") continue;
      if (field.type === "select") defaults[field.key] = field.options?.[0]?.value || "";
    }
    setParams(defaults);
    setPreviewHtml(null);
  }, [report.key]);

  useEffect(() => {
    if (!previewHtml) { setPageCount(1); return; }
    const pages = (previewHtml.match(/page-break-after:\s*always/gi) || []).length + 1;
    setPageCount(Math.max(1, pages));
  }, [previewHtml]);

  const updateSetting = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));
  const updateParam = (key: string, value: string) => setParams((prev) => ({ ...prev, [key]: value }));

  const buildPayload = (format: string) => {
    const filters: Record<string, any> = { ...virtualFilters };
    let entity_id: number | undefined;
    for (const field of schema) {
      const val = params[field.key];
      if (!val) continue;
      if (field.key === "entity_id") entity_id = parseInt(val);
      else filters[field.key] = val;
    }
    const p: Record<string, any> = {
      report_type: backendType, entity_id,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      output_format: format,
    };
    const overrides: Record<string, any> = {};
    for (const f of WORKBENCH_FIELDS) overrides[f.key] = settings[f.key] ?? "";
    p.settings_overrides = overrides;
    return p;
  };

  const generatePreview = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/reports/download/html", buildPayload("html"), { responseType: "text" });
      setPreviewHtml(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to generate preview");
    } finally { setLoading(false); }
  };

  const handleExport = async (format: "pdf" | "xlsx") => {
    setExporting(format); setError("");
    try {
      const payload = buildPayload(format);
      const mime = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const { data } = await api.post(`/reports/download/${format}`, payload, { responseType: "blob" });
      downloadBlob(data, `${report.key}_${Date.now()}.${format}`, mime);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Export failed");
    } finally { setExporting(null); }
  };

  const handlePrint = async () => {
    const openAndPrint = (html: string) => {
      const w = window.open("", "_blank", "width=800,height=600");
      if (!w) return;
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { try { w.print(); } catch {} }, 500);
    };
    if (previewHtml) { openAndPrint(previewHtml); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/reports/download/html", buildPayload("html"), { responseType: "text" });
      openAndPrint(data);
    } catch (e: any) { setError(e?.response?.data?.detail ?? e?.message ?? "Print failed");
    } finally { setLoading(false); }
  };

  const ModIcon = module.icon;

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
      {/* Breadcrumb */}
      <div className="flex items-center justify-between px-4 h-11 shrink-0 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <div className="flex items-center gap-1.5 text-xs">
          <button onClick={() => onModuleClick(module.key)} className="flex items-center gap-1 text-muted hover:text-primary transition-colors">
            <ModIcon size={13} />
            <span style={{ color: "var(--text-secondary)" }}>{module.label}</span>
          </button>
          <ChevronRight size={11} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{listTitle}</span>
          <button onClick={onBack} className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={10} /> Back
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ActionBtn onClick={generatePreview} disabled={loading || exporting !== null} title="Generate Preview">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {loading ? "..." : "Generate"}
          </ActionBtn>
          <div className="w-px h-4" style={{ background: "var(--border)" }} />
          <ActionBtn onClick={handlePrint} disabled={loading || exporting !== null} title="Print"><Printer size={12} /> Print</ActionBtn>
          <ActionBtn onClick={() => handleExport("pdf")} disabled={loading || exporting !== null} title="Download PDF">
            {exporting === "pdf" ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            {exporting === "pdf" ? "..." : "PDF"}
          </ActionBtn>
          <ActionBtn onClick={() => handleExport("xlsx")} disabled={loading || exporting !== null} title="Download Excel">
            {exporting === "xlsx" ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
            {exporting === "xlsx" ? "..." : "Excel"}
          </ActionBtn>
        </div>
      </div>

      {/* Filter bar */}
      {schema.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 shrink-0 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <Search size={12} style={{ color: "var(--text-muted)" }} />
          {schema.map((f) => (
            <FilterField key={f.key} field={f} value={params[f.key] || ""} onChange={(v) => updateParam(f.key, v)} />
          ))}
        </div>
      )}

      {/* Preview area */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bg-primary)" }}>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Generating report...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-[11px] px-3 py-2 rounded-lg" style={{ color: "#dc2626", background: "rgba(220,38,38,0.06)", maxWidth: "400px" }}>
                {error}
              </div>
            </div>
          </div>
        ) : previewHtml ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-1.5 shrink-0 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {pageCount > 1 ? `~${pageCount} pages` : "1 page"}
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Preview</span>
            </div>
            <div className="flex-1 overflow-auto p-6 flex justify-center" style={{ background: "var(--bg-tertiary)" }}>
              <div style={{
                width: "210mm", maxWidth: "100%", background: "#fff",
                boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)",
                borderRadius: "2px", overflow: "hidden",
              }}>
                <iframe
                  ref={previewRef}
                  srcDoc={previewHtml}
                  className="w-full border-0"
                  style={{ height: "396mm", background: "#fff" }}
                  title="Report preview"
                  sandbox="allow-same-origin allow-scripts"
                  scrolling="no"
                />
              </div>
            </div>
          </div>
        ) : schema.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText size={36} style={{ color: "var(--text-muted)", opacity: 0.25 }} />
              <p className="text-sm font-medium mt-3" style={{ color: "var(--text-secondary)" }}>
                {listTitle}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Click Generate to view the report
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Search size={36} style={{ color: "var(--text-muted)", opacity: 0.25 }} />
              <p className="text-sm font-medium mt-3" style={{ color: "var(--text-secondary)" }}>
                Filter and Generate
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Set filter criteria above and click Generate
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterField({ field, value, onChange }: { field: ParamField; value: string; onChange: (v: string) => void }) {
  const inputCls = "bg-transparent border rounded-lg px-2 py-1 text-[10px] text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all";
  const borderStyle = { borderColor: "var(--border)", minWidth: "120px" };
  switch (field.type) {
    case "select": return (
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} style={borderStyle}>
        {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    );
    case "date": return <input type="date" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} style={borderStyle} />;
    case "number": return <input type="number" className={inputCls} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...borderStyle, minWidth: "100px" }} />;
    default: return <input type="text" className={inputCls} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...borderStyle, minWidth: "140px" }} />;
  }
}

function ReportWorkbench({
  report, module, onBack, onModuleClick,
}: {
  report: ReportDef;
  module: ModuleDef;
  onBack: () => void;
  onModuleClick: (modKey: string) => void;
}) {
  const schema = PARAM_SCHEMAS[report.key] || [];
  const backendType = getReportBackendType(report.key);

  const [settings, setSettings] = useState<SettingsData>({});
  const [params, setParams] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [error, setError] = useState("");
  const [pageCount, setPageCount] = useState(1);
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    api.get("/reports/settings").then(({ data }) => {
      const s: SettingsData = {};
      for (const f of WORKBENCH_FIELDS) s[f.key] = data[f.key] ?? "";
      s.report_reference_no = s.report_reference_no || "";
      s.prepared_for = s.prepared_for || "";
      s.prepared_by = s.prepared_by || "";
      setSettings(s);
    }).catch(() => {
      const s: SettingsData = {};
      for (const f of WORKBENCH_FIELDS) s[f.key] = "";
      setSettings(s);
    });
  }, []);

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const field of schema) {
      if (field.type === "date_range" || field.type === "date") continue;
      if (field.type === "select") defaults[field.key] = field.options?.[0]?.value || "";
    }
    setParams(defaults);
    setPreviewHtml(null);
    setPageCount(1);
  }, [report.key]);

  useEffect(() => {
    if (!previewHtml) { setPageCount(1); return; }
    const pages = (previewHtml.match(/page-break-after:\s*always/gi) || []).length + 1;
    setPageCount(Math.max(1, pages));
  }, [previewHtml]);

  const updateSetting = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));
  const updateParam = (key: string, value: string) => setParams((prev) => ({ ...prev, [key]: value }));

  const buildPayload = (format: string) => {
    const filters: Record<string, any> = {};
    let entity_id: number | undefined;
    for (const field of schema) {
      const val = params[field.key];
      if (!val) continue;
      if (field.key === "entity_id") entity_id = parseInt(val);
      else filters[field.key] = val;
    }
    const p: Record<string, any> = {
      report_type: backendType, entity_id,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      output_format: format,
    };
    const overrides: Record<string, any> = {};
    for (const f of WORKBENCH_FIELDS) overrides[f.key] = settings[f.key] ?? "";
    p.settings_overrides = overrides;
    return p;
  };

  const generatePreview = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/reports/download/html", buildPayload("html"), { responseType: "text" });
      setPreviewHtml(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to generate preview");
    } finally { setLoading(false); }
  };

  const handleExport = async (format: "pdf" | "xlsx") => {
    setExporting(format); setError("");
    try {
      const payload = buildPayload(format);
      const mime = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const { data } = await api.post(`/reports/download/${format}`, payload, { responseType: "blob" });
      downloadBlob(data, `${report.key}_${Date.now()}.${format}`, mime);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Export failed");
    } finally { setExporting(null); }
  };

  const handlePrint = async () => {
    const openAndPrint = (html: string) => {
      const w = window.open("", "_blank", "width=800,height=600");
      if (!w) return;
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { try { w.print(); } catch {} }, 500);
    };
    if (previewHtml) { openAndPrint(previewHtml); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/reports/download/html", buildPayload("html"), { responseType: "text" });
      openAndPrint(data);
    } catch (e: any) { setError(e?.response?.data?.detail ?? e?.message ?? "Print failed");
    } finally { setLoading(false); }
  };

  const ModIcon = module.icon;

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 h-11 shrink-0 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <div className="flex items-center gap-1.5 text-xs">
          <button onClick={() => onModuleClick(module.key)} className="flex items-center gap-1 text-muted hover:text-primary transition-colors">
            <ModIcon size={13} />
            <span style={{ color: "var(--text-secondary)" }}>{module.label}</span>
          </button>
          <ChevronRight size={11} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{report.label}</span>
          <button onClick={onBack} className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={10} /> Back
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ActionBtn onClick={handlePrint} disabled={loading || exporting !== null} title="Print"><Printer size={12} /> Print</ActionBtn>
          <ActionBtn onClick={() => handleExport("pdf")} disabled={loading || exporting !== null} title="Download PDF">
            {exporting === "pdf" ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            {exporting === "pdf" ? "..." : "PDF"}
          </ActionBtn>
          <ActionBtn onClick={() => handleExport("xlsx")} disabled={loading || exporting !== null} title="Download Excel">
            {exporting === "xlsx" ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
            {exporting === "xlsx" ? "..." : "Excel"}
          </ActionBtn>
          <div className="w-px h-4 mx-1" style={{ background: "var(--border)" }} />
          <button
            onClick={generatePreview}
            disabled={loading}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {loading ? "Generating..." : "Generate Preview"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left pane */}
        <div className="w-72 shrink-0 overflow-y-auto border-r" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          {WORKBENCH_SECTIONS.map((section) => {
            const sectionFields = WORKBENCH_FIELDS.filter((f) => f.section === section);
            return (
              <div key={section} className="px-3 pt-3 pb-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  {section}
                </p>
                <div className="space-y-2">
                  {sectionFields.map((f) => (
                    <WbFieldInput key={f.key} field={f} value={settings[f.key] ?? ""} onChange={(v) => updateSetting(f.key, v)} />
                  ))}
                </div>
              </div>
            );
          })}

          {schema.length > 0 && (
            <div className="px-3 pt-1 pb-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                Report Parameters
              </p>
              <div className="space-y-2">
                {schema.map((f) => (
                  <ParamFieldRenderer key={f.key} field={f} value={params[f.key] || ""} onChange={(v) => updateParam(f.key, v)} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mx-3 text-[10px] px-2 py-1.5 rounded-lg" style={{ color: "#dc2626", background: "rgba(220,38,38,0.06)" }}>
              {error}
            </div>
          )}

          <div className="px-3 pb-3">
            <button
              onClick={generatePreview}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {loading ? "Generating..." : "Generate Preview"}
            </button>
          </div>
        </div>

        {/* Right pane */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bg-primary)" }}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Generating report...</p>
              </div>
            </div>
          ) : previewHtml ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-1.5 shrink-0 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {pageCount > 1 ? `~${pageCount} pages` : "1 page"}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Preview</span>
              </div>
              <div className="flex-1 overflow-auto p-6 flex justify-center" style={{ background: "var(--bg-tertiary)" }}>
                <div style={{
                  width: "210mm", maxWidth: "100%", background: "#fff",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)",
                  borderRadius: "2px", minHeight: "297mm", overflow: "hidden",
                }}>
                  <iframe
                    ref={previewRef}
                    srcDoc={previewHtml}
                    className="w-full border-0"
                    style={{ height: "297mm", background: "#fff" }}
                    title="Report preview"
                    sandbox="allow-same-origin allow-scripts"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText size={36} style={{ color: "var(--text-muted)", opacity: 0.25 }} />
                <p className="text-sm font-medium mt-3" style={{ color: "var(--text-secondary)" }}>
                  Report Preview
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Fill in fields and click Generate Preview
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WbFieldInput({ field, value, onChange }: { field: WBField; value: string; onChange: (v: string) => void }) {
  const inputCls = "w-full bg-transparent border rounded-lg px-2.5 py-1.5 text-[11px] text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all";
  const borderStyle = { borderColor: "var(--border)" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "9px", fontWeight: 500, marginBottom: "2px", color: "var(--text-secondary)" };
  if (field.type === "textarea") return (
    <div><label style={labelStyle}>{field.label}</label><textarea className={inputCls} rows={3} value={value} onChange={(e) => onChange(e.target.value)} style={borderStyle} /></div>
  );
  return (
    <div><label style={labelStyle}>{field.label}</label><input type="text" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} style={borderStyle} /></div>
  );
}

function ActionBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-40"
      style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }} title={title}>
      {children}
    </button>
  );
}

function ParamFieldRenderer({ field, value, onChange }: { field: ParamField; value: string; onChange: (v: string) => void }) {
  const inputCls = "w-full bg-transparent border rounded-lg px-2.5 py-1.5 text-[10px] text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all";
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "9px", fontWeight: 500, marginBottom: "2px", color: "var(--text-secondary)" };
  const borderStyle = { borderColor: "var(--border)" };
  const label = <label style={labelStyle}>{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label>;
  switch (field.type) {
    case "select": return (
      <div>{label}<select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} style={borderStyle}>
        {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select></div>
    );
    case "date": return <div>{label}<input type="date" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} style={borderStyle} /></div>;
    case "number": return <div>{label}<input type="number" className={inputCls} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={borderStyle} /></div>;
    default: return <div>{label}<input type="text" className={inputCls} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={borderStyle} /></div>;
  }
}
