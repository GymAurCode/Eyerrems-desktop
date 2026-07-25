import {
  Building2, Users, Home, LayoutDashboard, Briefcase, CreditCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  format?: "text" | "currency" | "date" | "status";
  width?: string;
}

export interface ParamField {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "date_range" | "multi_select";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface ReportDef {
  key: string;
  label: string;
  description: string;
  behavior: "list" | "profile";
  entityLabel?: string;
  columns?: ReportColumn[];
}

export interface ModuleDef {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  colorSoft: string;
  reports: ReportDef[];
}

export const MODULE_COLORS: Record<string, { color: string; soft: string }> = {
  property:  { color: "#0E7C66", soft: "#E4F1EE" },
  crm:       { color: "#B8860B", soft: "#F8F0E0" },
  tenant:    { color: "#A0473D", soft: "#F3E8E6" },
  bookings:  { color: "#2E5FA3", soft: "#E4EBF5" },
  hr:        { color: "#5B6472", soft: "#ECEDEF" },
  payments:  { color: "#2E5FA3", soft: "#E4EBF5" },
};

const COLUMNS: Record<string, ReportColumn[]> = {
  property_listing: [
    { key: "title", label: "Property", width: "25%" },
    { key: "type", label: "Type", width: "12%" },
    { key: "location", label: "Location", width: "25%" },
    { key: "units", label: "Units", align: "right", width: "10%" },
    { key: "price_range", label: "Price Range", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "13%" },
  ],
  unit_listing: [
    { key: "unit_no", label: "Unit #", width: "12%" },
    { key: "property", label: "Project", width: "20%" },
    { key: "type", label: "Type", width: "12%" },
    { key: "size", label: "Size", align: "right", width: "10%" },
    { key: "price", label: "Price", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "13%" },
  ],
  available_units: [
    { key: "unit_no", label: "Unit #", width: "12%" },
    { key: "property", label: "Project", width: "20%" },
    { key: "type", label: "Type", width: "12%" },
    { key: "size", label: "Size", align: "right", width: "10%" },
    { key: "price", label: "Price", format: "currency", align: "right", width: "15%" },
  ],
  occupied_units: [
    { key: "unit_no", label: "Unit #", width: "12%" },
    { key: "property", label: "Project", width: "18%" },
    { key: "client", label: "Client", width: "18%" },
    { key: "type", label: "Type", width: "10%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
    { key: "move_in", label: "Move-in", format: "date", width: "12%" },
  ],
  leads_list: [
    { key: "name", label: "Name", width: "18%" },
    { key: "source", label: "Source", width: "12%" },
    { key: "contact", label: "Contact", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
    { key: "assigned_to", label: "Assigned To", width: "15%" },
    { key: "created", label: "Created", format: "date", width: "12%" },
  ],
  clients_list: [
    { key: "name", label: "Name", width: "20%" },
    { key: "contact", label: "Contact", width: "18%" },
    { key: "email", label: "Email", width: "22%" },
    { key: "deals", label: "Deals", align: "right", width: "10%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  customer_portfolio_summary: [
    { key: "customer", label: "Customer", width: "20%" },
    { key: "bookings", label: "Bookings", align: "right", width: "10%" },
    { key: "total_value", label: "Total Value", format: "currency", align: "right", width: "15%" },
    { key: "paid", label: "Paid", format: "currency", align: "right", width: "15%" },
    { key: "balance", label: "Balance", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  booking_statement: [
    { key: "date", label: "Date", format: "date", width: "12%" },
    { key: "description", label: "Description", width: "35%" },
    { key: "debit", label: "Debit", format: "currency", align: "right", width: "13%" },
    { key: "credit", label: "Credit", format: "currency", align: "right", width: "13%" },
    { key: "balance", label: "Balance", format: "currency", align: "right", width: "13%" },
  ],
  customers_register: [
    { key: "name", label: "Name", width: "20%" },
    { key: "cnic", label: "CNIC", width: "18%" },
    { key: "contact", label: "Contact", width: "15%" },
    { key: "bookings", label: "Bookings", align: "right", width: "10%" },
    { key: "total", label: "Total Value", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "10%" },
  ],
  tenant_list: [
    { key: "name", label: "Name", width: "20%" },
    { key: "unit", label: "Unit", width: "12%" },
    { key: "contact", label: "Contact", width: "18%" },
    { key: "lease_start", label: "Lease Start", format: "date", width: "12%" },
    { key: "rent", label: "Rent", format: "currency", align: "right", width: "12%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  tenant_profile: [
    { key: "date", label: "Date", format: "date", width: "12%" },
    { key: "description", label: "Description", width: "35%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "15%" },
    { key: "balance", label: "Balance", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  sales_summary: [
    { key: "project", label: "Project", width: "20%" },
    { key: "deals", label: "Deals", align: "right", width: "10%" },
    { key: "total_value", label: "Total Sales", format: "currency", align: "right", width: "18%" },
    { key: "collections", label: "Collected", format: "currency", align: "right", width: "18%" },
    { key: "outstanding", label: "Outstanding", format: "currency", align: "right", width: "18%" },
  ],
  bookings_register: [
    { key: "booking_id", label: "Booking #", format: "text", width: "10%" },
    { key: "client", label: "Client", width: "18%" },
    { key: "property", label: "Property", width: "18%" },
    { key: "date", label: "Date", format: "date", width: "10%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "12%" },
    { key: "status", label: "Status", format: "status", width: "10%" },
  ],
  booking_detail: [
    { key: "item", label: "Item", width: "30%" },
    { key: "detail", label: "Details", width: "25%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  pipeline_summary: [
    { key: "stage", label: "Stage", width: "22%" },
    { key: "deals", label: "Deals", align: "right", width: "10%" },
    { key: "value", label: "Value", format: "currency", align: "right", width: "18%" },
    { key: "weighted", label: "Weighted", format: "currency", align: "right", width: "18%" },
    { key: "probability", label: "Probability", align: "right", width: "12%" },
  ],
  deals_register: [
    { key: "title", label: "Deal", width: "20%" },
    { key: "client", label: "Client", width: "18%" },
    { key: "value", label: "Value", format: "currency", align: "right", width: "12%" },
    { key: "stage", label: "Stage", width: "14%" },
    { key: "agent", label: "Agent", width: "14%" },
    { key: "status", label: "Status", format: "status", width: "10%" },
  ],
  deal_detail: [
    { key: "item", label: "Item", width: "25%" },
    { key: "description", label: "Description", width: "30%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  commission_report: [
    { key: "agent", label: "Agent", width: "20%" },
    { key: "deals", label: "Deals", align: "right", width: "10%" },
    { key: "total_commission", label: "Commission", format: "currency", align: "right", width: "18%" },
    { key: "paid", label: "Paid", format: "currency", align: "right", width: "15%" },
    { key: "pending", label: "Pending", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "10%" },
  ],
  agent_commission_detail: [
    { key: "deal", label: "Deal", width: "20%" },
    { key: "client", label: "Client", width: "20%" },
    { key: "commission", label: "Commission", format: "currency", align: "right", width: "15%" },
    { key: "paid_date", label: "Paid Date", format: "date", width: "12%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  agents_register: [
    { key: "name", label: "Name", width: "20%" },
    { key: "contact", label: "Contact", width: "18%" },
    { key: "deals", label: "Deals", align: "right", width: "10%" },
    { key: "commission", label: "Commission", format: "currency", align: "right", width: "18%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  cancellation_report: [
    { key: "booking", label: "Booking #", width: "12%" },
    { key: "client", label: "Client", width: "20%" },
    { key: "property", label: "Property", width: "20%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "12%" },
    { key: "date", label: "Date", format: "date", width: "10%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  cancellation_detail: [
    { key: "item", label: "Item", width: "30%" },
    { key: "detail", label: "Details", width: "25%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  employee_list: [
    { key: "name", label: "Name", width: "20%" },
    { key: "department", label: "Department", width: "18%" },
    { key: "position", label: "Position", width: "18%" },
    { key: "contact", label: "Contact", width: "15%" },
    { key: "salary", label: "Salary", format: "currency", align: "right", width: "12%" },
    { key: "status", label: "Status", format: "status", width: "10%" },
  ],
  employee_profile: [
    { key: "item", label: "Item", width: "25%" },
    { key: "detail", label: "Details", width: "35%" },
    { key: "value", label: "Value", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  payment_history: [
    { key: "date", label: "Date", format: "date", width: "12%" },
    { key: "client", label: "Client", width: "18%" },
    { key: "description", label: "Description", width: "20%" },
    { key: "method", label: "Method", width: "12%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "12%" },
    { key: "status", label: "Status", format: "status", width: "10%" },
  ],
  due_payments: [
    { key: "client", label: "Client", width: "20%" },
    { key: "description", label: "Description", width: "25%" },
    { key: "due_date", label: "Due Date", format: "date", width: "12%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "12%" },
    { key: "days_overdue", label: "Overdue", align: "right", width: "10%" },
    { key: "status", label: "Status", format: "status", width: "10%" },
  ],
  collections_summary: [
    { key: "period", label: "Period", width: "15%" },
    { key: "project", label: "Project", width: "20%" },
    { key: "collected", label: "Collected", format: "currency", align: "right", width: "18%" },
    { key: "target", label: "Target", format: "currency", align: "right", width: "15%" },
    { key: "achievement", label: "% Achieved", align: "right", width: "12%" },
  ],
  payment_ledger: [
    { key: "date", label: "Date", format: "date", width: "12%" },
    { key: "description", label: "Description", width: "30%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "15%" },
    { key: "balance", label: "Balance", format: "currency", align: "right", width: "15%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
  outstanding_dues: [
    { key: "client", label: "Client", width: "20%" },
    { key: "project", label: "Project", width: "18%" },
    { key: "due_date", label: "Due Date", format: "date", width: "12%" },
    { key: "amount", label: "Amount", format: "currency", align: "right", width: "12%" },
    { key: "overdue_days", label: "Overdue Days", align: "right", width: "12%" },
    { key: "status", label: "Status", format: "status", width: "12%" },
  ],
};

export const MODULES: ModuleDef[] = [
  {
    key: "property",
    label: "Property",
    icon: Building2,
    color: "#0E7C66",
    colorSoft: "#E4F1EE",
    reports: [
      { key: "property_listing", label: "Property Listing", description: "All properties with details and prices", behavior: "list", columns: COLUMNS.property_listing },
      { key: "unit_listing", label: "Unit Listing", description: "All units with type, size, price, and status", behavior: "list", columns: COLUMNS.unit_listing },
      { key: "available_units", label: "Available Units", description: "Available units filterable by project and specification", behavior: "list", columns: COLUMNS.available_units },
      { key: "occupied_units", label: "Occupied Units", description: "Booked, sold, rented, and occupied units", behavior: "list", columns: COLUMNS.occupied_units },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    icon: Users,
    color: "#B8860B",
    colorSoft: "#F8F0E0",
    reports: [
      { key: "leads_list", label: "Lead List", description: "All CRM leads filterable by status and source", behavior: "list", columns: COLUMNS.leads_list },
      { key: "clients_list", label: "Client List", description: "All registered clients with contact info", behavior: "list", columns: COLUMNS.clients_list },
      { key: "customer_portfolio_summary", label: "Client Portfolio", description: "Customer portfolio with booking statistics", behavior: "list", columns: COLUMNS.customer_portfolio_summary },
      { key: "booking_statement", label: "Client Statement", description: "Full statement for a single booking", behavior: "profile", entityLabel: "Booking ID", columns: COLUMNS.booking_statement },
      { key: "customers_register", label: "Customers Register", description: "List of all registered customers", behavior: "list", columns: COLUMNS.customers_register },
    ],
  },
  {
    key: "tenant",
    label: "Tenant",
    icon: Home,
    color: "#A0473D",
    colorSoft: "#F3E8E6",
    reports: [
      { key: "tenant_list", label: "Tenant List", description: "All registered tenants with contact info", behavior: "list", columns: COLUMNS.tenant_list },
      { key: "tenant_profile", label: "Tenant Profile", description: "Full picture of a single tenant with rent records", behavior: "profile", entityLabel: "Tenant ID", columns: COLUMNS.tenant_profile },
    ],
  },
  {
    key: "bookings",
    label: "Bookings / Deals",
    icon: LayoutDashboard,
    color: "#2E5FA3",
    colorSoft: "#E4EBF5",
    reports: [
      { key: "sales_summary", label: "Sales Summary", description: "Aggregated sales by project, period, and agent", behavior: "list", columns: COLUMNS.sales_summary },
      { key: "bookings_register", label: "Booking Report", description: "Filterable register of all bookings", behavior: "list", columns: COLUMNS.bookings_register },
      { key: "booking_detail", label: "Booking Detail", description: "Full breakdown of a single booking", behavior: "profile", entityLabel: "Booking ID", columns: COLUMNS.booking_detail },
      { key: "pipeline_summary", label: "Pipeline Summary", description: "Deals grouped by stage with total values", behavior: "list", columns: COLUMNS.pipeline_summary },
      { key: "deals_register", label: "Deal Report", description: "Filterable register of all deals", behavior: "list", columns: COLUMNS.deals_register },
      { key: "deal_detail", label: "Deal Detail", description: "Full breakdown of a single deal", behavior: "profile", entityLabel: "Deal ID", columns: COLUMNS.deal_detail },
      { key: "commission_report", label: "Commission Summary", description: "Agent commissions by period and status", behavior: "list", columns: COLUMNS.commission_report },
      { key: "agent_commission_detail", label: "Agent Commission", description: "Per-deal breakdown for one agent", behavior: "profile", entityLabel: "Agent ID", columns: COLUMNS.agent_commission_detail },
      { key: "agents_register", label: "Agents Register", description: "List of all agents with commission totals", behavior: "list", columns: COLUMNS.agents_register },
      { key: "cancellation_report", label: "Cancellations Summary", description: "Aggregated cancellations by period", behavior: "list", columns: COLUMNS.cancellation_report },
      { key: "cancellation_detail", label: "Cancellation Detail", description: "Full trail of a single cancellation", behavior: "profile", entityLabel: "Booking ID", columns: COLUMNS.cancellation_detail },
    ],
  },
  {
    key: "hr",
    label: "HR",
    icon: Briefcase,
    color: "#5B6472",
    colorSoft: "#ECEDEF",
    reports: [
      { key: "employee_list", label: "Employee List", description: "All registered employees with department and position", behavior: "list", columns: COLUMNS.employee_list },
      { key: "employee_profile", label: "Employee Profile", description: "Full employee details with salary structure", behavior: "profile", entityLabel: "Employee ID", columns: COLUMNS.employee_profile },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    icon: CreditCard,
    color: "#2E5FA3",
    colorSoft: "#E4EBF5",
    reports: [
      { key: "payment_history", label: "Payment History", description: "All payments across the system filterable by date and method", behavior: "list", columns: COLUMNS.payment_history },
      { key: "due_payments", label: "Due / Pending", description: "Overdue and pending payments requiring follow-up", behavior: "list", columns: COLUMNS.due_payments },
      { key: "collections_summary", label: "Collections Summary", description: "Aggregated collections by period and project", behavior: "list", columns: COLUMNS.collections_summary },
      { key: "payment_ledger", label: "Payment Ledger", description: "Full payment history for a single client", behavior: "profile", entityLabel: "Client ID", columns: COLUMNS.payment_ledger },
      { key: "outstanding_dues", label: "Outstanding Dues", description: "Overdue installments register", behavior: "list", columns: COLUMNS.outstanding_dues },
    ],
  },
];

export const PARAM_SCHEMAS: Record<string, ParamField[]> = {
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
  tenant_list: [
    { key: "status", label: "Status", type: "select", required: false, options: [
      { label: "All", value: "" }, { label: "Active", value: "active" }, { label: "Inactive", value: "inactive" },
    ]},
    { key: "search", label: "Search Name", type: "text", required: false, placeholder: "Search by name" },
  ],
  tenant_profile: [
    { key: "entity_id", label: "Tenant ID", type: "number", required: true, placeholder: "Enter Tenant ID" },
  ],
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

export const REPORT_LOOKUP = new Map<string, { mod: ModuleDef; rep: ReportDef }>();
for (const mod of MODULES) {
  for (const rep of mod.reports) {
    REPORT_LOOKUP.set(rep.key, { mod, rep });
  }
}

export function getReportBackendType(reportKey: string): string {
  if (reportKey === "available_units" || reportKey === "occupied_units") return "unit_listing";
  return reportKey;
}

export const VIRTUAL_REPORT_FILTERS: Record<string, Record<string, any>> = {
  available_units: { status: "available" },
  occupied_units: { status_in: "booked,reserved,sold,occupied,rented" },
};

export const VIRTUAL_REPORT_TITLES: Record<string, string> = {
  available_units: "Available Units",
  occupied_units: "Occupied Units",
};
