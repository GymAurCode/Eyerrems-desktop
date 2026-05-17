/**
 * Report System Types — Shared type definitions for the reporting module.
 */

export interface ReportColumn {
  key: string;
  label: string;
  data_type: "string" | "number" | "date" | "currency" | "percentage" | "badge";
  width?: string;
  align: "left" | "center" | "right";
  sortable: boolean;
  visible: boolean;
  format?: string;
  badge_map?: Record<string, string>;
}

export interface ReportSummary {
  label: string;
  value: string | number;
  sub_label?: string;
  color: "blue" | "green" | "red" | "yellow" | "purple" | "gray";
  icon?: string;
  format: "number" | "currency" | "percentage" | "text";
}

export interface ReportMeta {
  title: string;
  subtitle?: string;
  category: string;
  generated_at: string;
  generated_by: string;
  company_name: string;
  filters_applied: Record<string, string>;
  total_records: number;
  page: number;
  total_pages: number;
  report_id?: string;
}

export interface ReportResult {
  meta: ReportMeta;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary: ReportSummary[];
  sub_tables?: Record<string, { columns?: ReportColumn[]; rows: Record<string, any>[] }>;
  chart_data?: any;
  generation_time_ms: number;
  error?: string;
}

export interface ReportRequest {
  date_from?: string;
  date_to?: string;
  search?: string;
  status?: string;
  statuses?: string[];
  client_id?: number;
  dealer_id?: number;
  property_id?: number;
  unit_id?: number;
  project_id?: number;
  town_id?: number;
  block_id?: number;
  tenant_id?: number;
  booking_id?: number;
  employee_id?: number;
  account_id?: number;
  category?: string;
  property_type?: string;
  payment_method?: string;
  lead_source?: string;
  amount_min?: number;
  amount_max?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  page_size?: number;
  export_mode?: boolean;
  extra?: Record<string, any>;
}

export interface ExportRequest extends ReportRequest {
  format: "pdf" | "excel";
}

export interface ReportCatalogItem {
  key: string;
  name: string;
  category: string;
  type: "tabular" | "ledger" | "profile" | "financial_statement" | "summary";
}

export interface ReportCatalog {
  catalog: Record<string, ReportCatalogItem[]>;
}

export type SortOrder = "asc" | "desc";

export interface SortConfig {
  key: string;
  order: SortOrder;
}
