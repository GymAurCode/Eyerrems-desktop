import { api } from "./api";

// ── Core Types ────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_projects: number; active_projects: number; completed_projects: number;
  delayed_projects: number; total_budget: number; total_expenses: number;
  remaining_budget: number; workers_on_site: number; equipment_active: number;
  purchase_orders_pending: number; invoices_pending: number;
  quality_failures: number; safety_incidents: number;
  avg_progress_pct: number; budget_used_pct: number; budget_remaining_pct: number;
  material_consumption_pct: number; task_completion_pct: number;
  outstanding_vendor_payments: number;
}

export interface Project {
  id: number; name: string; project_code?: string; status: string;
  current_phase: string; location: string; start_date: string;
  expected_end?: string; actual_end?: string; total_budget: number;
  description?: string; actual_cost?: number; progress_percentage?: number;
  phase_count?: number; contractor_count?: number; task_count?: number;
  completed_tasks?: number; delayed_tasks?: number;
  active_workers?: number; active_equipment?: number;
  material_consumption_pct?: number; purchase_orders_pending?: number;
  outstanding_vendor_payments?: number; safety_incidents?: number;
  quality_issues?: number; [key: string]: any;
}

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";

export interface Phase {
  id: number; project_id: number; name: string; status: string;
  start_date: string; end_date?: string; order_index: number;
  progress_pct?: number; description?: string; [key: string]: any;
}

export interface Task {
  id: number; project_id: number; phase_id: number; name: string;
  status: string; priority: string; estimated_cost?: number;
  start_date?: string; end_date?: string; progress_pct: number;
  is_delayed: boolean; phase_name?: string;
  task_number?: string; description?: string; estimated_duration?: number;
  actual_start_date?: string; actual_end_date?: string;
  assigned_engineer_id?: number; assigned_supervisor_id?: number;
  assigned_workers?: number; risk_level?: string; remarks?: string;
  delay_reason?: string; dependencies?: any[];
  assigned_engineer?: { id: number; full_name: string };
  assigned_supervisor?: { id: number; full_name: string };
  [key: string]: any;
}

export interface Budget {
  id: number; project_id: number; status: string;
  material_cost: number; labor_cost: number; equipment_cost: number;
  machinery_cost: number; contractor_cost: number; utility_cost: number;
  transport_cost: number; permit_fees: number; govt_charges: number;
  misc_cost: number; total_cost: number;
  material_actual?: number; labor_actual?: number; equipment_actual?: number;
  machinery_actual?: number; contractor_actual?: number; utility_actual?: number;
  transport_actual?: number; permit_actual?: number; govt_actual?: number;
  misc_actual?: number; [key: string]: any;
}

export interface BudgetCategory {
  key: string; label: string; estimated: number; approved: number;
  actual: number; variance: number; remaining: number;
}

export interface ResourceItem {
  id: number; type: string; name: string; code?: string;
  category?: string; availability: string; unit_cost?: number;
  current_stock?: number; min_stock_level?: number;
  reorder_point?: number; unit?: string; description?: string;
  is_active?: boolean; [key: string]: any;
}

export interface ResourceAllocation {
  id: number; project_id: number; resource_id: number;
  task_id?: number; quantity: number; status: string;
  start_date?: string; end_date?: string; notes?: string;
  resource?: ResourceItem; task?: Task; [key: string]: any;
}

export interface Contractor {
  id: number; name: string; contract_type: string; rate: number;
  company?: string; phone?: string; email?: string;
  specialization?: string; is_active?: boolean; notes?: string;
  [key: string]: any;
}

export interface ProjectContractor {
  id: number; project_id: number; contractor_id: number;
  role?: string; contract_value?: number; status: string;
  start_date?: string; end_date?: string;
  contractor: Contractor; [key: string]: any;
}

export interface Vendor {
  id: number; name: string; contact_person?: string;
  phone?: string; email?: string; address?: string;
  payment_terms?: string; performance_rating?: number;
  is_active?: boolean; [key: string]: any;
}

export interface PurchaseRequest {
  id: number; project_id: number; pr_number?: string;
  title: string; status: string; description?: string;
  total_amount?: number; requested_by?: number; approved_by?: number;
  notes?: string; created_at?: string;
  items?: PurchaseRequestItem[]; [key: string]: any;
}

export interface PurchaseRequestItem {
  id: number; request_id: number; material_id?: number;
  name: string; description?: string; quantity: number;
  unit?: string; estimated_cost?: number; total_cost?: number;
  [key: string]: any;
}

export interface PurchaseOrder {
  id: number; project_id: number; po_number?: string;
  request_id?: number; vendor_id?: number; vendor_name?: string;
  title: string; status: string; order_date?: string;
  delivery_date?: string; delivery_address?: string;
  terms?: string; subtotal?: number; tax_amount?: number;
  total_amount?: number; notes?: string;
  items?: PurchaseOrderItem[]; [key: string]: any;
}

export interface PurchaseOrderItem {
  id: number; order_id: number; material_id?: number;
  name: string; quantity: number; unit?: string;
  unit_price?: number; total_price?: number; received_qty?: number;
  [key: string]: any;
}

export interface GoodsReceiptNote {
  id: number; project_id: number; grn_number?: string;
  po_id?: number; received_date: string; received_by?: number;
  vendor_name?: string; notes?: string; status: string;
  items?: GRNItem[]; [key: string]: any;
}

export interface GRNItem {
  id: number; grn_id: number; material_id?: number;
  name: string; quantity: number; unit?: string;
  unit_price?: number; total_price?: number; condition?: string;
  [key: string]: any;
}

export interface DailyProgress {
  id: number; project_id: number; date: string;
  work_done: string; progress_percentage: number;
  workers_count?: number; weather?: string; issues?: string;
  accidents?: string; delay_reasons?: string; site_notes?: string;
  phase_id?: number; task_id?: number; reported_by?: number;
  [key: string]: any;
}

export interface ConstructionExpense {
  id: number; project_id: number; amount: number;
  expense_type: string; description: string; date: string;
  reference_id?: string; expense_id?: number; [key: string]: any;
}

export interface VendorPayment {
  id: number; project_id: number; vendor_id?: number;
  vendor_name?: string; amount: number; payment_date: string;
  payment_method?: string; reference?: string; notes?: string;
  status: string; [key: string]: any;
}

export interface QualityInspection {
  id: number; project_id: number; inspection_type: string;
  inspection_date: string; inspector_name?: string;
  inspector_id?: number; result: string; remarks?: string;
  status: string; phase_id?: number; task_id?: number;
  checklist?: string; photos?: string; [key: string]: any;
}

export interface InspectionChecklistItem {
  id: number; inspection_id: number; item_name: string;
  is_checked: boolean; remarks?: string; [key: string]: any;
}

export interface SafetyIncident {
  id: number; project_id: number; incident_type: string;
  title: string; description?: string; incident_date: string;
  severity?: string; reported_by?: number; location?: string;
  affected_persons?: number; corrective_action?: string;
  status: string; closed_at?: string; [key: string]: any;
}

export interface Document {
  id: number; project_id: number; name: string;
  file_url: string; doc_type: string; folder?: string;
  file_size?: number; version: number; tags?: string;
  uploaded_by?: number; created_at?: string; [key: string]: any;
}

export interface Milestone {
  id: number; project_id: number; name: string;
  description?: string; milestone_type: string;
  target_date?: string; completed_date?: string;
  status: string; order_index: number; [key: string]: any;
}

export interface Notification {
  id: number; project_id: number; title: string;
  message?: string; notification_type: string;
  is_read: boolean; created_at: string;
  reference_type?: string; reference_id?: number; [key: string]: any;
}

export interface ActivityLog {
  id: number; user_name: string; action: string;
  module: string; old_value?: string; new_value?: string;
  ip_address?: string; device?: string; created_at: string;
  [key: string]: any;
}

export interface CompletionCheck {
  tasks_completed: boolean; inspections_passed: boolean;
  no_pending_orders: boolean; no_pending_payments: boolean;
  no_quality_issues: boolean; no_safety_issues: boolean;
  docs_uploaded: boolean; completion_approved: boolean;
  all_checks_passed: boolean; total_checks: number; passed_checks: number;
}

export interface ProjectReport {
  project: Project; budget?: Budget; budget_vs_actual: any;
  phases: Phase[]; tasks: Task[]; contractors: ProjectContractor[];
  recent_progress: DailyProgress[]; procurement_summary: any;
  expense_by_type: any; inspections: any[]; safety_items: any[];
  milestones: Milestone[]; [key: string]: any;
}

export interface ConversionPayload {
  property_name?: string; num_buildings: number;
  floors_per_building: number; units_per_floor: number;
  price_per_unit?: number; building_prefix?: string;
  unit_prefix?: string;
}

export interface RFQ {
  id: number; project_id: number; rfq_number?: string;
  title: string; status: string; notes?: string;
  created_at?: string; [key: string]: any;
}

export interface SupplierQuotation {
  id: number; rfq_id: number; vendor_id: number;
  vendor_name?: string; total_amount: number;
  delivery_days?: number; validity_days?: number;
  status: string; notes?: string; [key: string]: any;
}

function unpack(data: any): any[] {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

export const constructionApi = {
  // ── Dashboard & Stats ─────────────────────────────────────────────────
  stats: async (): Promise<DashboardStats> => {
    const { data } = await api.get("/construction/dashboard/stats");
    return data;
  },
  getDashboardCharts: async (): Promise<any> => {
    const { data } = await api.get("/construction/dashboard/charts");
    return data;
  },
  getRecentActivity: async (limit?: number): Promise<ActivityLog[]> => {
    const { data } = await api.get("/construction/dashboard/activity", { params: { limit } });
    return unpack(data);
  },

  // ── Projects ──────────────────────────────────────────────────────────
  listProjects: async (params?: { status?: string; current_phase?: string; search?: string; page?: number; per_page?: number }): Promise<Project[]> => {
    const { data } = await api.get("/construction/projects", { params });
    return unpack(data);
  },
  getProject: async (id: number): Promise<Project> => {
    const { data } = await api.get(`/construction/projects/${id}`);
    return data;
  },
  createProject: async (payload: any): Promise<Project> => {
    const { data } = await api.post("/construction/projects", payload);
    return data;
  },
  updateProject: async (id: number, payload: any): Promise<Project> => {
    const { data } = await api.put(`/construction/projects/${id}`, payload);
    return data;
  },
  deleteProject: async (id: number): Promise<void> => {
    await api.delete(`/construction/projects/${id}`);
  },
  advancePhase: async (id: number): Promise<any> => {
    const { data } = await api.patch(`/construction/projects/${id}/advance-phase`);
    return data;
  },
  checkCompletion: async (id: number): Promise<CompletionCheck> => {
    const { data } = await api.get(`/construction/projects/${id}/completion-check`);
    return data;
  },
  convertToProperty: async (id: number, payload: ConversionPayload): Promise<any> => {
    const { data } = await api.post(`/construction/projects/${id}/convert-to-property`, payload);
    return data;
  },
  getProjectTimeline: async (id: number): Promise<any> => {
    const { data } = await api.get(`/construction/projects/${id}/timeline`);
    return data;
  },

  // ── Phases ────────────────────────────────────────────────────────────
  listPhases: async (projectId: number): Promise<Phase[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/phases`);
    return unpack(data);
  },
  createPhase: async (payload: any): Promise<Phase> => {
    const { data } = await api.post("/construction/phases", payload);
    return data;
  },
  updatePhase: async (id: number, payload: any): Promise<Phase> => {
    const { data } = await api.put(`/construction/phases/${id}`, payload);
    return data;
  },
  deletePhase: async (id: number): Promise<void> => {
    await api.delete(`/construction/phases/${id}`);
  },
  reorderPhases: async (projectId: number, phaseIds: number[]): Promise<void> => {
    await api.put(`/construction/projects/${projectId}/phases/reorder`, { phase_ids: phaseIds });
  },

  // ── Tasks ─────────────────────────────────────────────────────────────
  listTasks: async (projectId: number, phaseId?: number): Promise<Task[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/tasks`, { params: { phase_id: phaseId } });
    return unpack(data);
  },
  createTask: async (payload: any): Promise<Task> => {
    const { data } = await api.post("/construction/tasks", payload);
    return data;
  },
  updateTask: async (id: number, payload: any): Promise<Task> => {
    const { data } = await api.put(`/construction/tasks/${id}`, payload);
    return data;
  },
  deleteTask: async (id: number): Promise<void> => {
    await api.delete(`/construction/tasks/${id}`);
  },
  updateTaskStatus: async (id: number, status: string): Promise<Task> => {
    const { data } = await api.patch(`/construction/tasks/${id}/status`, { status });
    return data;
  },
  addTaskDependency: async (payload: any): Promise<any> => {
    const { data } = await api.post("/construction/tasks/dependencies", payload);
    return data;
  },
  removeTaskDependency: async (id: number): Promise<void> => {
    await api.delete(`/construction/tasks/dependencies/${id}`);
  },
  getTaskDependencies: async (taskId: number): Promise<any[]> => {
    const { data } = await api.get(`/construction/tasks/${taskId}/dependencies`);
    return unpack(data);
  },

  // ── Budget ────────────────────────────────────────────────────────────
  getBudget: async (projectId: number): Promise<Budget> => {
    const { data } = await api.get(`/construction/projects/${projectId}/budget`);
    return data;
  },
  upsertBudget: async (payload: any): Promise<Budget> => {
    const { data } = await api.post("/construction/budget", payload);
    return data;
  },
  updateBudget: async (projectId: number, payload: any): Promise<Budget> => {
    const { data } = await api.patch(`/construction/budget/${projectId}`, payload);
    return data;
  },
  updateBudgetStatus: async (projectId: number, status: string): Promise<Budget> => {
    const { data } = await api.patch(`/construction/budget/${projectId}/status`, { status });
    return data;
  },
  getBudgetCategories: async (projectId: number): Promise<BudgetCategory[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/budget-categories`);
    return data;
  },

  // ── Resources ─────────────────────────────────────────────────────────
  listResources: async (params?: { type?: string; category?: string; availability?: string }): Promise<ResourceItem[]> => {
    const { data } = await api.get("/construction/resources", { params });
    return unpack(data);
  },
  createResource: async (payload: any): Promise<ResourceItem> => {
    const { data } = await api.post("/construction/resources", payload);
    return data;
  },
  updateResource: async (id: number, payload: any): Promise<ResourceItem> => {
    const { data } = await api.put(`/construction/resources/${id}`, payload);
    return data;
  },
  deleteResource: async (id: number): Promise<void> => {
    await api.delete(`/construction/resources/${id}`);
  },
  updateResourceAvailability: async (id: number, availability: string): Promise<ResourceItem> => {
    const { data } = await api.patch(`/construction/resources/${id}/availability`, { availability });
    return data;
  },
  allocateResource: async (payload: any): Promise<ResourceAllocation> => {
    const { data } = await api.post("/construction/resources/allocate", payload);
    return data;
  },
  releaseResource: async (id: number): Promise<void> => {
    await api.delete(`/construction/resources/allocate/${id}`);
  },
  listProjectResources: async (projectId: number): Promise<ResourceAllocation[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/resources`);
    return unpack(data);
  },
  listResourceUsage: async (projectId: number, resourceId?: number): Promise<any[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/resource-usage`, { params: { resource_id: resourceId } });
    return unpack(data);
  },
  logResourceUsage: async (payload: any): Promise<any> => {
    const { data } = await api.post("/construction/resource-usage", payload);
    return data;
  },

  // ── Contractors ───────────────────────────────────────────────────────
  listContractors: async (): Promise<Contractor[]> => {
    const { data } = await api.get("/construction/contractors");
    return unpack(data);
  },
  createContractor: async (payload: any): Promise<Contractor> => {
    const { data } = await api.post("/construction/contractors", payload);
    return data;
  },
  updateContractor: async (id: number, payload: any): Promise<Contractor> => {
    const { data } = await api.put(`/construction/contractors/${id}`, payload);
    return data;
  },
  deleteContractor: async (id: number): Promise<void> => {
    await api.delete(`/construction/contractors/${id}`);
  },
  projectContractors: async (projectId: number): Promise<ProjectContractor[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/contractors`);
    return unpack(data);
  },
  assignContractor: async (payload: any): Promise<ProjectContractor> => {
    const { data } = await api.post("/construction/contractors/assign", payload);
    return data;
  },
  removeAssignment: async (id: number): Promise<void> => {
    await api.delete(`/construction/contractors/assign/${id}`);
  },

  // ── Procurement (Legacy) ──────────────────────────────────────────────
  listProcurement: async (projectId: number): Promise<any[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/procurement`);
    return unpack(data);
  },
  createProcurement: async (payload: any): Promise<any> => {
    const { data } = await api.post("/construction/procurement", payload);
    return data;
  },
  updateProcurement: async (id: number, payload: any): Promise<any> => {
    const { data } = await api.put(`/construction/procurement/${id}`, payload);
    return data;
  },
  updateProcurementStatus: async (id: number, status: string): Promise<any> => {
    const { data } = await api.patch(`/construction/procurement/${id}/status`, { status });
    return data;
  },
  deleteProcurement: async (id: number): Promise<void> => {
    await api.delete(`/construction/procurement/${id}`);
  },

  // ── Vendors ───────────────────────────────────────────────────────────
  listVendors: async (): Promise<Vendor[]> => {
    const { data } = await api.get("/construction/vendors");
    return unpack(data);
  },
  createVendor: async (payload: any): Promise<Vendor> => {
    const { data } = await api.post("/construction/vendors", payload);
    return data;
  },
  updateVendor: async (id: number, payload: any): Promise<Vendor> => {
    const { data } = await api.put(`/construction/vendors/${id}`, payload);
    return data;
  },
  deleteVendor: async (id: number): Promise<void> => {
    await api.delete(`/construction/vendors/${id}`);
  },
  getVendorPerformance: async (vendorId: number): Promise<any> => {
    const { data } = await api.get(`/construction/vendors/${vendorId}/performance`);
    return data;
  },

  // ── Purchase Requests ─────────────────────────────────────────────────
  listPurchaseRequests: async (projectId: number): Promise<PurchaseRequest[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/purchase-requests`);
    return unpack(data);
  },
  createPurchaseRequest: async (payload: any): Promise<PurchaseRequest> => {
    const { data } = await api.post("/construction/purchase-requests", payload);
    return data;
  },
  updatePurchaseRequest: async (id: number, payload: any): Promise<PurchaseRequest> => {
    const { data } = await api.put(`/construction/purchase-requests/${id}`, payload);
    return data;
  },
  updatePurchaseRequestStatus: async (id: number, status: string): Promise<PurchaseRequest> => {
    const { data } = await api.patch(`/construction/purchase-requests/${id}/status`, { status });
    return data;
  },

  // ── Purchase Orders ───────────────────────────────────────────────────
  listPurchaseOrders: async (projectId: number): Promise<PurchaseOrder[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/purchase-orders`);
    return unpack(data);
  },
  createPurchaseOrder: async (payload: any): Promise<PurchaseOrder> => {
    const { data } = await api.post("/construction/purchase-orders", payload);
    return data;
  },
  updatePurchaseOrder: async (id: number, payload: any): Promise<PurchaseOrder> => {
    const { data } = await api.put(`/construction/purchase-orders/${id}`, payload);
    return data;
  },
  updatePurchaseOrderStatus: async (id: number, status: string): Promise<PurchaseOrder> => {
    const { data } = await api.patch(`/construction/purchase-orders/${id}/status`, { status });
    return data;
  },

  // ── RFQ / Quotations ──────────────────────────────────────────────────
  listRFQs: async (projectId: number): Promise<RFQ[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/rfqs`);
    return unpack(data);
  },
  createRFQ: async (payload: any): Promise<RFQ> => {
    const { data } = await api.post("/construction/rfqs", payload);
    return data;
  },
  updateRFQStatus: async (id: number, status: string): Promise<RFQ> => {
    const { data } = await api.patch(`/construction/rfqs/${id}/status`, { status });
    return data;
  },
  listQuotations: async (rfqId: number): Promise<SupplierQuotation[]> => {
    const { data } = await api.get(`/construction/rfqs/${rfqId}/quotations`);
    return unpack(data);
  },
  createQuotation: async (payload: any): Promise<SupplierQuotation> => {
    const { data } = await api.post("/construction/quotations", payload);
    return data;
  },
  acceptQuotation: async (id: number): Promise<SupplierQuotation> => {
    const { data } = await api.patch(`/construction/quotations/${id}/accept`);
    return data;
  },

  // ── Goods Receipts ───────────────────────────────────────────────────
  listGoodsReceipts: async (projectId: number): Promise<GoodsReceiptNote[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/goods-receipts`);
    return unpack(data);
  },
  createGoodsReceipt: async (payload: any): Promise<GoodsReceiptNote> => {
    const { data } = await api.post("/construction/goods-receipts", payload);
    return data;
  },
  updateGoodsReceipt: async (id: number, payload: any): Promise<GoodsReceiptNote> => {
    const { data } = await api.put(`/construction/goods-receipts/${id}`, payload);
    return data;
  },

  // ── Daily Progress ───────────────────────────────────────────────────
  listProgress: async (projectId: number): Promise<DailyProgress[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/progress`);
    return unpack(data);
  },
  logProgress: async (payload: any): Promise<DailyProgress> => {
    const { data } = await api.post("/construction/progress", payload);
    return data;
  },
  updateProgress: async (id: number, payload: any): Promise<DailyProgress> => {
    const { data } = await api.put(`/construction/progress/${id}`, payload);
    return data;
  },
  deleteProgress: async (id: number): Promise<void> => {
    await api.delete(`/construction/progress/${id}`);
  },

  // ── Expenses ──────────────────────────────────────────────────────────
  listExpenses: async (projectId: number): Promise<ConstructionExpense[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/expenses`);
    return unpack(data);
  },
  addExpense: async (payload: any): Promise<ConstructionExpense> => {
    const { data } = await api.post("/construction/expenses", payload);
    return data;
  },
  updateExpense: async (id: number, payload: any): Promise<ConstructionExpense> => {
    const { data } = await api.put(`/construction/expenses/${id}`, payload);
    return data;
  },
  deleteExpense: async (id: number): Promise<void> => {
    await api.delete(`/construction/expenses/${id}`);
  },

  // ── Vendor Payments ───────────────────────────────────────────────────
  listVendorPayments: async (projectId: number): Promise<VendorPayment[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/vendor-payments`);
    return unpack(data);
  },
  createVendorPayment: async (payload: any): Promise<VendorPayment> => {
    const { data } = await api.post("/construction/vendor-payments", payload);
    return data;
  },
  updateVendorPayment: async (id: number, payload: any): Promise<VendorPayment> => {
    const { data } = await api.put(`/construction/vendor-payments/${id}`, payload);
    return data;
  },
  updateVendorPaymentStatus: async (id: number, status: string): Promise<VendorPayment> => {
    const { data } = await api.patch(`/construction/vendor-payments/${id}/status`, { status });
    return data;
  },

  // ── Quality Inspections ───────────────────────────────────────────────
  listInspections: async (projectId: number): Promise<QualityInspection[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/inspections`);
    return unpack(data);
  },
  createInspection: async (payload: any): Promise<QualityInspection> => {
    const { data } = await api.post("/construction/inspections", payload);
    return data;
  },
  updateInspection: async (id: number, payload: any): Promise<QualityInspection> => {
    const { data } = await api.put(`/construction/inspections/${id}`, payload);
    return data;
  },
  deleteInspection: async (id: number): Promise<void> => {
    await api.delete(`/construction/inspections/${id}`);
  },
  getInspectionChecklist: async (inspectionId: number): Promise<InspectionChecklistItem[]> => {
    const { data } = await api.get(`/construction/inspections/${inspectionId}/checklist`);
    return unpack(data);
  },
  updateChecklistItem: async (id: number, payload: any): Promise<InspectionChecklistItem> => {
    const { data } = await api.patch(`/construction/inspections/checklist/${id}`, payload);
    return data;
  },

  // ── Safety ────────────────────────────────────────────────────────────
  listSafety: async (projectId: number): Promise<SafetyIncident[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/safety`);
    return unpack(data);
  },
  createSafetyIncident: async (payload: any): Promise<SafetyIncident> => {
    const { data } = await api.post("/construction/safety", payload);
    return data;
  },
  updateSafetyIncident: async (id: number, payload: any): Promise<SafetyIncident> => {
    const { data } = await api.put(`/construction/safety/${id}`, payload);
    return data;
  },
  deleteSafetyIncident: async (id: number): Promise<void> => {
    await api.delete(`/construction/safety/${id}`);
  },
  closeSafetyIncident: async (id: number): Promise<SafetyIncident> => {
    const { data } = await api.patch(`/construction/safety/${id}/close`);
    return data;
  },

  // ── Documents ─────────────────────────────────────────────────────────
  listDocuments: async (projectId: number): Promise<Document[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/documents`);
    return unpack(data);
  },
  uploadDocument: async (projectId: number, file: File, docType: string, folder?: string, tags?: string): Promise<Document> => {
    const formData = new FormData();
    formData.append("file", file);
    const params = new URLSearchParams({ doc_type: docType });
    if (folder) params.set("folder", folder);
    if (tags) params.set("tags", tags);
    const { data } = await api.post(`/construction/documents/${projectId}?${params}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  updateDocument: async (id: number, payload: any): Promise<Document> => {
    const { data } = await api.patch(`/construction/documents/${id}`, payload);
    return data;
  },
  deleteDocument: async (id: number): Promise<void> => {
    await api.delete(`/construction/documents/${id}`);
  },
  listDocumentFolders: async (): Promise<string[]> => {
    const { data } = await api.get("/construction/document-folders");
    return data;
  },

  // ── Milestones ────────────────────────────────────────────────────────
  listMilestones: async (projectId: number): Promise<Milestone[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/milestones`);
    return unpack(data);
  },
  createMilestone: async (payload: any): Promise<Milestone> => {
    const { data } = await api.post("/construction/milestones", payload);
    return data;
  },
  updateMilestone: async (id: number, payload: any): Promise<Milestone> => {
    const { data } = await api.put(`/construction/milestones/${id}`, payload);
    return data;
  },
  deleteMilestone: async (id: number): Promise<void> => {
    await api.delete(`/construction/milestones/${id}`);
  },

  // ── Notifications ─────────────────────────────────────────────────────
  listNotifications: async (projectId: number, unreadOnly?: boolean): Promise<Notification[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/notifications`, { params: { unread_only: unreadOnly } });
    return unpack(data);
  },
  markNotificationRead: async (id: number): Promise<Notification> => {
    const { data } = await api.patch(`/construction/notifications/${id}/read`);
    return data;
  },
  markAllNotificationsRead: async (projectId: number): Promise<void> => {
    await api.patch(`/construction/notifications/mark-all-read?project_id=${projectId}`);
  },
  createNotification: async (payload: any): Promise<Notification> => {
    const { data } = await api.post("/construction/notifications", payload);
    return data;
  },

  // ── Reports ───────────────────────────────────────────────────────────
  getReport: async (projectId: number): Promise<ProjectReport> => {
    const { data } = await api.get(`/construction/projects/${projectId}/report`);
    return data;
  },
  exportReport: async (projectId: number, format: string, type: string): Promise<Blob> => {
    const { data } = await api.get(`/construction/projects/${projectId}/export`, {
      params: { format, type },
      responseType: "blob",
    });
    return data;
  },

  // ── Workers / HR ──────────────────────────────────────────────────────
  listProjectWorkers: async (projectId: number): Promise<any[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/workers`);
    return unpack(data);
  },
  assignWorker: async (payload: any): Promise<any> => {
    const { data } = await api.post("/construction/workers/assign", payload);
    return data;
  },
  removeWorker: async (id: number): Promise<void> => {
    await api.delete(`/construction/workers/${id}`);
  },

  // ── Site Diary ────────────────────────────────────────────────────────
  getSiteDiary: async (projectId: number, date?: string): Promise<any> => {
    const { data } = await api.get(`/construction/projects/${projectId}/site-diary`, { params: { date } });
    return data;
  },
  updateSiteDiary: async (id: number, payload: any): Promise<any> => {
    const { data } = await api.put(`/construction/site-diary/${id}`, payload);
    return data;
  },

  // ── Activity Log ──────────────────────────────────────────────────────
  listActivityLog: async (projectId: number): Promise<ActivityLog[]> => {
    const { data } = await api.get(`/construction/projects/${projectId}/activity`);
    return unpack(data);
  },
};
