import { useEffect, useState, useRef, memo, useMemo, useCallback, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Search, Circle, Eye, Edit2, Trash2, Printer, FileText, MessageCircle, AlertTriangle, UserX, Building2, FileBarChart } from "lucide-react";
import ReportModal from "../components/reports/ReportModal";
import { useLookup } from "../hooks/useLookup";
import { QuickRowActions, printRecord } from "../components/actions";
import { crmApi, Lead, Client, Dealer, Deal } from "../lib/crmApi";
import ClientFormDialog from "../components/crm/ClientFormDialog";
import DealerForm from "../components/crm/DealerForm";
import DealForm from "../components/crm/DealForm";
import LeadFormDialog from "../components/crm/LeadFormDialog";
import { FormField } from "../components/crm/FormField";
import BookingList from "./crm/bookings/BookingList";
import CRMDashboard from "./crm/CRMDashboard";
import FollowUps from "./crm/FollowUps";
import SiteVisits from "./crm/SiteVisits";
import Payments from "./crm/Payments";
import { api } from "../lib/api";
import { AppTable, removeEmptyParams } from "../components/data-table";
import ModuleTabs from "../components/ui/ModuleTabs";
import AppDialog from "../components/ui/AppDialog";
import { DialogCancelButton, DialogSubmitButton } from "../components/ui/DialogButtons";
import { MODULE_COLORS } from "../config/moduleColors";
import { useNotifStore } from "../store/notifications";
import ConfirmDialog from "../components/actions/ConfirmDialog";

const TABS = ["Dashboard", "Leads", "Clients", "Dealers", "Deals", "Bookings", "Follow Ups", "Site Visits", "Payments"];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new:       { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  contacted: { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  qualified: { bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  lost:      { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  active:    { bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  inactive:  { bg: "rgba(148,163,184,0.1)",  text: "#94a3b8" },
  potential: { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  pending:   { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  closed:    { bg: "rgba(99,102,241,0.12)",  text: "#6366f1" },
  cancelled: { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
};

function statusStyle(code: string) {
  return STATUS_COLORS[code.toLowerCase()] ?? { bg: "rgba(148,163,184,0.1)", text: "#94a3b8" };
}

function Badge({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.text }}>
      <Circle size={5} fill={s.text} stroke="none" />
      {status}
    </span>
  );
}

const MemoCRMDashboard = memo(CRMDashboard);
const MemoBookingList = memo(BookingList);
const MemoFollowUps = memo(FollowUps);
const MemoSiteVisits = memo(SiteVisits);
const MemoPayments = memo(Payments);

interface LeadsTabProps {
  leads: Lead[];
  leadsLoading: boolean;
  leadsErr: string | null;
  leadsTotal: number;
  leadsParams: typeof defaultParams;
  navigate: (path: string) => void;
  onRefresh: () => void;
  onPageChange: (config: any) => void;
  onFilterChange: (filters: any) => void;
}

const LeadsTab = memo(function LeadsTab({ leads, leadsLoading, leadsErr, leadsTotal, leadsParams, navigate, onRefresh, onPageChange, onFilterChange }: LeadsTabProps) {
  const leadColumns = useMemo(() => [
    { key: "lead_id", label: "Lead ID", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    { key: "name", label: "Name", sortable: true, className: "font-medium text-primary" },
    { key: "phone", label: "Phone", sortable: true },
    { key: "source", label: "Source", sortable: true },
    { key: "status", label: "Status", render: (val: string) => <Badge status={val} /> }
  ], []);

  const leadActions = useMemo(() => [
    { key: "view", label: "View", icon: Eye, onClick: (row: Lead) => navigate(`/crm/leads/${row.lead_id}`) },
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, onClick: (row: Lead) => {
      if (row.phone) window.open(`https://web.whatsapp.com/send?phone=${row.phone.replace(/[^0-9]/g, "")}`, "_blank");
    }},
    { key: "print", label: "Print", icon: Printer, onClick: (row: Lead) => printRecord(`Lead ${row.lead_id}`, [
      { label: "Name", value: row.name }, { label: "Phone", value: row.phone ?? "—" }, { label: "Status", value: row.status },
    ]) }
  ], [navigate]);

  return (
    <AppTable
      storageKey="rems_crm_leads_table"
      title="Leads"
      subtitle="Track and manage prospective customer leads"
      data={leads}
      columns={leadColumns}
      rowActions={leadActions}
      loading={leadsLoading}
      error={leadsErr}
      onRetry={onRefresh}
      pagination={{ page: leadsParams.page, pageSize: leadsParams.pageSize, total: leadsTotal }}
      onPageChange={onPageChange}
      onFilterChange={onFilterChange}
      showTypeFilter={false}
      showStatusFilter={false}
    />
  );
});

interface ClientsTabProps {
  clients: Client[];
  clientsLoading: boolean;
  clientsErr: string | null;
  clientsTotal: number;
  clientsParams: typeof defaultParams;
  navigate: (path: string) => void;
  onRefresh: () => void;
  onPageChange: (config: any) => void;
  onFilterChange: (filters: any) => void;
  onReport: (report: { open: boolean; reportType: string; filters: Record<string, unknown>; title?: string }) => void;
}

const ClientsTab = memo(function ClientsTab({ clients, clientsLoading, clientsErr, clientsTotal, clientsParams, navigate, onRefresh, onPageChange, onFilterChange, onReport }: ClientsTabProps) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const firstDayOfYear = useMemo(() => new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0], []);

  const clientColumns = useMemo(() => [
    { key: "tracking_id", label: "Tracking ID", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    { key: "client_id", label: "Client ID", sortable: true, className: "font-mono text-xs" },
    { key: "name", label: "Name", sortable: true, className: "font-medium text-primary" },
    { key: "phone", label: "Phone", sortable: true },
    { key: "status", label: "Status", render: (val: string) => <Badge status={val} /> }
  ], []);

  const clientActions = useMemo(() => [
    { key: "view", label: "View", icon: Eye, onClick: (row: Client) => navigate(`/crm/clients/${row.client_id}`) },
    { key: "print", label: "Print", icon: Printer, onClick: (row: Client) => printRecord(`Client ${row.client_id}`, [
      { label: "Name", value: row.name }, { label: "Phone", value: row.phone ?? "—" }, { label: "Status", value: row.status },
    ]) },
    { key: "customer_profile", label: "Customer Profile", icon: FileText, onClick: (row: Client) => onReport({ open: true, reportType: "customer_profile", filters: { client_id: row.id }, title: "Customer Profile" }), variant: "secondary" },
    { key: "customer_ledger", label: "Customer Ledger", icon: FileText, onClick: (row: Client) => onReport({ open: true, reportType: "customer_ledger", filters: { client_id: row.id, date_from: firstDayOfYear, date_to: today }, title: "Customer Ledger" }), variant: "secondary" },
    { key: "outstanding_payments", label: "Outstanding Payments", icon: FileText, onClick: (row: Client) => onReport({ open: true, reportType: "outstanding_payments", filters: { client_id: row.id }, title: "Outstanding Payments" }), variant: "secondary" },
  ], [today, firstDayOfYear, navigate, onReport]);

  return (
    <AppTable
      storageKey="rems_crm_clients_table"
      title="Clients"
      subtitle="View and manage converted leads and clients"
      data={clients}
      columns={clientColumns}
      rowActions={clientActions}
      loading={clientsLoading}
      error={clientsErr}
      onRetry={onRefresh}
      pagination={{ page: clientsParams.page, pageSize: clientsParams.pageSize, total: clientsTotal }}
      onPageChange={onPageChange}
      onFilterChange={onFilterChange}
      showTypeFilter={false}
      showStatusFilter={false}
    />
  );
});

interface DealersTabProps {
  dealers: Dealer[];
  dealersLoading: boolean;
  dealersErr: string | null;
  dealersTotal: number;
  dealersParams: typeof defaultParams;
  navigate: (path: string) => void;
  onRefresh: () => void;
  onPageChange: (config: any) => void;
  onFilterChange: (filters: any) => void;
  onEdit: (dealer: Dealer) => void;
}

interface DeleteConflict {
  dealer: Dealer;
  leads: { id: number; lead_id: string; name: string }[];
  clients: { id: number; client_id: string; name: string }[];
  deals: { id: number; deal_title: string | null; status: string }[];
}

const DealersTab = memo(function DealersTab({ dealers, dealersLoading, dealersErr, dealersTotal, dealersParams, navigate, onRefresh, onPageChange, onFilterChange, onEdit }: DealersTabProps) {
  const pushToast = useNotifStore((s) => s.pushToast);
  const [deleteConflict, setDeleteConflict] = useState<DeleteConflict | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; item: any } | null>(null);

  const dealerColumns = useMemo(() => [
    { key: "dealer_id", label: "Dealer ID", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    { key: "name", label: "Name", sortable: true, className: "font-medium" },
    { key: "phone", label: "Phone", sortable: true },
    { key: "company", label: "Company", sortable: true },
    { key: "commission_rate", label: "Commission", render: (val: any, row: Dealer) => row.commission_rate ? `${row.commission_rate}${row.commission_type === "percentage" ? "%" : " (fixed)"}` : "—" }
  ], []);

  const handleDeleteDealer = (row: Dealer) => {
    setDeleteTarget({ type: "dealer", item: row });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, item } = deleteTarget;
    try {
      if (type === "dealer") {
        await crmApi.deleteDealer(item.id);
        pushToast({ title: "Success", message: "Dealer deleted successfully", type: "success" });
      }
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      setDeleteTarget(null);
      if (err?.response?.status === 409) {
        const detail = err.response.data?.detail;
        if (detail?.leads || detail?.clients || detail?.deals || detail?.properties || detail?.bookings || detail?.commissions) {
          setDeleteConflict({ dealer: item, leads: detail.leads ?? [], clients: detail.clients ?? [], deals: detail.deals ?? [] });
          return;
        }
      }
      const msg = err?.response?.data?.detail ?? "Failed to delete dealer";
      pushToast({ title: "Error", message: msg, priority: "urgent" });
    }
  };

  const handleForceDelete = async () => {
    if (!deleteConflict) return;
    setDeleting(true);
    try {
      await crmApi.deleteDealer(deleteConflict.dealer.id, true);
      setDeleteConflict(null);
      pushToast({ title: "Success", message: "Dealer deleted successfully", type: "success" });
      onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Failed to force delete dealer";
      pushToast({ title: "Error", message: msg, priority: "urgent" });
    } finally {
      setDeleting(false);
    }
  };

  const dealerActions = useMemo(() => [
    { key: "view", label: "View", icon: Eye, onClick: (row: Dealer) => navigate(`/crm/dealers/${row.id}`) },
    { key: "edit", label: "Edit", icon: Edit2, onClick: (row: Dealer) => onEdit(row), permission: "crm:manage" },
    { key: "print", label: "Print", icon: Printer, onClick: (row: Dealer) => printRecord(`Dealer ${row.dealer_id}`, [
      { label: "Name", value: row.name }, { label: "Company", value: row.company ?? "—" },
    ]) },
    { key: "delete", label: "Delete", icon: Trash2, onClick: (row: Dealer) => handleDeleteDealer(row), variant: "danger" }
  ], [navigate, onEdit, onRefresh]);

  return (
    <>
      <AppTable
        storageKey="rems_crm_dealers_table"
        title="Dealers"
        subtitle="Manage agent/dealer partnerships and commission structures"
        data={dealers}
        columns={dealerColumns}
        rowActions={dealerActions}
        loading={dealersLoading}
        error={dealersErr}
        onRetry={onRefresh}
        pagination={{ page: dealersParams.page, pageSize: dealersParams.pageSize, total: dealersTotal }}
        onPageChange={onPageChange}
        onFilterChange={onFilterChange}
        showTypeFilter={false}
        showStatusFilter={false}
      />

      {deleteConflict && (
        <AppDialog
          isOpen={true}
          title="Cannot Delete Dealer"
          subtitle={`${deleteConflict.dealer.name} (${deleteConflict.dealer.dealer_id})`}
          size="md"
          icon={<AlertTriangle size={18} />}
          onClose={() => setDeleteConflict(null)}
          footer={
            <>
              <DialogCancelButton onClick={() => setDeleteConflict(null)} label="Cancel" disabled={deleting} />
              <DialogSubmitButton onClick={handleForceDelete} label="Unassign All & Delete"
                loading={deleting} variant="danger" />
            </>
          }
        >
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            This dealer is assigned to the following records. Unassign them to proceed.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
            {deleteConflict.leads.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                  <UserX size={14} /> Leads ({deleteConflict.leads.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {deleteConflict.leads.map(l => (
                    <div key={l.id} style={{ padding: "6px 10px", borderRadius: "6px", background: "var(--bg-muted, #F8FAFC)", fontSize: "12px", display: "flex", gap: "8px" }}>
                      <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{l.lead_id}</span>
                      <span style={{ color: "var(--text-primary)" }}>{l.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {deleteConflict.clients.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                  <Building2 size={14} /> Clients ({deleteConflict.clients.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {deleteConflict.clients.map(c => (
                    <div key={c.id} style={{ padding: "6px 10px", borderRadius: "6px", background: "var(--bg-muted, #F8FAFC)", fontSize: "12px", display: "flex", gap: "8px" }}>
                      <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{c.client_id}</span>
                      <span style={{ color: "var(--text-primary)" }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {deleteConflict.deals.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                  <FileBarChart size={14} /> Deals ({deleteConflict.deals.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {deleteConflict.deals.map(d => (
                    <div key={d.id} style={{ padding: "6px 10px", borderRadius: "6px", background: "var(--bg-muted, #F8FAFC)", fontSize: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ color: "var(--text-primary)", flex: 1 }}>{d.deal_title ?? "Untitled"}</span>
                      <Badge status={d.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AppDialog>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === "dealer" ? "Delete Dealer" : "Delete"}
        message={
          deleteTarget?.type === "dealer"
            ? `Are you sure you want to delete dealer "${deleteTarget?.item?.name || deleteTarget?.item?.id}"? This action cannot be undone.`
            : "Are you sure?"
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
});

interface DealsTabProps {
  deals: Deal[];
  dealsLoading: boolean;
  dealsErr: string | null;
  dealsTotal: number;
  dealsParams: typeof defaultParams;
  navigate: (path: string) => void;
  onRefresh: () => void;
  onPageChange: (config: any) => void;
  onFilterChange: (filters: any) => void;
  onReport: (report: { open: boolean; reportType: string; filters: Record<string, unknown>; title?: string }) => void;
}

const DealsTab = memo(function DealsTab({ deals, dealsLoading, dealsErr, dealsTotal, dealsParams, navigate, onRefresh, onPageChange, onFilterChange, onReport }: DealsTabProps) {
  const dealColumns = useMemo(() => [
    { key: "tracking_id", label: "Tracking ID", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    { key: "deal_id", label: "Deal ID", sortable: true, className: "font-mono text-xs" },
    { key: "deal_title", label: "Title", sortable: true },
    { key: "client_name", label: "Client", sortable: true },
    { key: "deal_value", label: "Value", sortable: true, className: "font-medium text-primary", render: (val: number) => Number(val).toLocaleString() },
    { key: "status", label: "Status", render: (val: string) => <Badge status={val} /> }
  ], []);

  const dealActions = useMemo(() => [
    { key: "view", label: "View", icon: Eye, onClick: (row: Deal) => navigate(`/crm/deals/${row.deal_id}`) },
    { key: "print", label: "Print", icon: Printer, onClick: (row: Deal) => printRecord(`Deal ${row.deal_id}`, [
      { label: "Title", value: row.deal_title ?? "—" }, { label: "Client", value: row.client_name ?? "—" }, { label: "Value", value: String(row.deal_value) }, { label: "Status", value: row.status },
    ]) },
    { key: "deal_summary", label: "Deal Summary", icon: FileText, onClick: (row: Deal) => onReport({ open: true, reportType: "deal_report", filters: { deal_id: row.id }, title: "Deal Summary Report" }) },
    { key: "booking_form", label: "Booking Form", icon: FileText, onClick: (row: Deal) => onReport({ open: true, reportType: "booking_form", filters: { deal_id: row.id }, title: "Booking Form" }), variant: "secondary" },
  ], [navigate, onReport]);

  return (
    <AppTable
      storageKey="rems_crm_deals_table"
      title="Deals"
      subtitle="Track client transactions, bookings, and pipeline progress"
      data={deals}
      columns={dealColumns}
      rowActions={dealActions}
      loading={dealsLoading}
      error={dealsErr}
      onRetry={onRefresh}
      pagination={{ page: dealsParams.page, pageSize: dealsParams.pageSize, total: dealsTotal }}
      onPageChange={onPageChange}
      onFilterChange={onFilterChange}
      showTypeFilter={false}
      showStatusFilter={false}
    />
  );
});

const defaultParams = {
  page: 1,
  pageSize: 10,
  search: "",
  filter: "",
  startDate: "",
  endDate: "",
  propertyType: "",
  status: "",
};

const MemoCRMPage = memo(function CRMPage() {
  const navigate = useNavigate();
  const { options: LEAD_STATUS_OPTS } = useLookup('lead_status');
  const [tab, setTab] = useState(0);
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [deals, setDeals]     = useState<Deal[]>([]);

  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsErr, setLeadsErr] = useState<string | null>(null);
  const [leadsParams, setLeadsParams] = useState(defaultParams);

  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsErr, setClientsErr] = useState<string | null>(null);
  const [clientsParams, setClientsParams] = useState(defaultParams);

  const [dealersTotal, setDealersTotal] = useState(0);
  const [dealersLoading, setDealersLoading] = useState(false);
  const [dealersErr, setDealersErr] = useState<string | null>(null);
  const [dealersParams, setDealersParams] = useState(defaultParams);

  const [reportModal, setReportModal] = useState<{
    open: boolean;
    reportType: string;
    filters: Record<string, unknown>;
    title?: string;
  }>({ open: false, reportType: "", filters: {} });

  const [dealsTotal, setDealsTotal] = useState(0);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsErr, setDealsErr] = useState<string | null>(null);
  const [dealsParams, setDealsParams] = useState(defaultParams);

  // Modals
  const [leadModal, setLeadModal]     = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [dealerModal, setDealerModal] = useState(false);
  const [dealModal, setDealModal]     = useState(false);
  const [editDealer, setEditDealer]   = useState<Dealer | null>(null);

  // Search
  const [searchQ, setSearchQ] = useState("");

  const fetchLeads = useCallback(async (params: typeof defaultParams) => {
    setLeadsLoading(true);
    setLeadsErr(null);
    try {
      const sanitized = removeEmptyParams({
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
        search: params.search,
        filter: params.filter,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      const res = await api.get<any>("/crm/leads", { params: sanitized });
      setLeads(res.data.items || []);
      setLeadsTotal(Number(res.data.total ?? 0));
    } catch (e: any) {
      setLeadsErr(e.message || "Failed to load leads");
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const refreshLeads = useCallback(() => {
    void fetchLeads(leadsParams);
  }, [fetchLeads, leadsParams]);

  const fetchClients = useCallback(async (params: typeof defaultParams) => {
    setClientsLoading(true);
    setClientsErr(null);
    try {
      const sanitized = removeEmptyParams({
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
        search: params.search,
        filter: params.filter,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      const res = await api.get<any>("/crm/clients", { params: sanitized });
      setClients(res.data.items || []);
      setClientsTotal(Number(res.data.total ?? 0));
    } catch (e: any) {
      setClientsErr(e.message || "Failed to load clients");
    } finally {
      setClientsLoading(false);
    }
  }, []);

  const refreshClients = useCallback(() => {
    void fetchClients(clientsParams);
  }, [fetchClients, clientsParams]);

  const fetchDealers = useCallback(async (params: typeof defaultParams) => {
    setDealersLoading(true);
    setDealersErr(null);
    try {
      const sanitized = removeEmptyParams({
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
        search: params.search,
        filter: params.filter,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      const res = await api.get<any>("/crm/dealers", { params: sanitized });
      setDealers(res.data.items || []);
      setDealersTotal(Number(res.data.total ?? 0));
    } catch (e: any) {
      setDealersErr(e.message || "Failed to load dealers");
    } finally {
      setDealersLoading(false);
    }
  }, []);

  const refreshDealers = useCallback(() => {
    void fetchDealers(dealersParams);
  }, [fetchDealers, dealersParams]);

  const fetchDeals = useCallback(async (params: typeof defaultParams) => {
    setDealsLoading(true);
    setDealsErr(null);
    try {
      const sanitized = removeEmptyParams({
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
        search: params.search,
        filter: params.filter,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      const res = await api.get<any>("/crm/deals", { params: sanitized });
      setDeals(res.data.items || []);
      setDealsTotal(Number(res.data.total ?? 0));
    } catch (e: any) {
      setDealsErr(e.message || "Failed to load deals");
    } finally {
      setDealsLoading(false);
    }
  }, []);

  const refreshDeals = useCallback(() => {
    void fetchDeals(dealsParams);
  }, [fetchDeals, dealsParams]);

  useEffect(() => {
    void fetchLeads(leadsParams);
  }, [fetchLeads, leadsParams]);

  useEffect(() => {
    void fetchClients(clientsParams);
  }, [fetchClients, clientsParams]);

  useEffect(() => {
    void fetchDealers(dealersParams);
  }, [fetchDealers, dealersParams]);

  useEffect(() => {
    void fetchDeals(dealsParams);
  }, [fetchDeals, dealsParams]);

  const doSearch = useCallback(async () => {
    if (!searchQ.trim()) return;
    try {
      const results = await crmApi.searchClients(searchQ.trim());
      if (results.length > 0) {
        navigate(`/crm/clients/${results[0].client_id}`);
      } else {
        alert("No clients found for: " + searchQ);
      }
    } catch {
      alert("Search failed. Please try again.");
    }
  }, [searchQ, navigate]);

  const onLeadsPageChange = useCallback((config: any) => setLeadsParams((prev) => ({ ...prev, ...config })), []);
  const onLeadsFilterChange = useCallback((filters: any) => setLeadsParams((prev) => ({ ...prev, ...filters })), []);
  const onClientsPageChange = useCallback((config: any) => setClientsParams((prev) => ({ ...prev, ...config })), []);
  const onClientsFilterChange = useCallback((filters: any) => setClientsParams((prev) => ({ ...prev, ...filters })), []);
  const onDealersPageChange = useCallback((config: any) => setDealersParams((prev) => ({ ...prev, ...config })), []);
  const onDealersFilterChange = useCallback((filters: any) => setDealersParams((prev) => ({ ...prev, ...filters })), []);
  const onDealsPageChange = useCallback((config: any) => setDealsParams((prev) => ({ ...prev, ...config })), []);
  const onDealsFilterChange = useCallback((filters: any) => setDealsParams((prev) => ({ ...prev, ...filters })), []);

  const handleSetReportModal = useCallback((report: { open: boolean; reportType: string; filters: Record<string, unknown>; title?: string }) => {
    setReportModal(report);
  }, []);

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">CRM</h1>
          <p className="text-xs text-muted mt-0.5">
            {leads.length} leads · {clients.length} clients · {deals.length} deals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input className="input-dark px-3 py-2 text-sm w-64" placeholder="Search client by name, CNIC, phone, or ID"
              value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()} />
            <button onClick={doSearch} className="btn-primary px-3 py-2 text-sm">
              <Search size={14} />
            </button>
          </div>
          {tab === 1 && <button type="button" onClick={() => navigate("/spreadsheet")} className="btn-ghost flex items-center gap-2 px-4 py-2.5 text-sm">
            <FileText size={15} /> Spreadsheet
          </button>}
          {tab !== 0 && <button type="button" onClick={() => {
            if (tab === 1) setLeadModal(true);
            else if (tab === 2) setClientModal(true);
            else if (tab === 3) setDealerModal(true);
            else if (tab === 4) setDealModal(true);
          }} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus size={15} /> New
          </button>}
        </div>
      </div>

      {/* Tabs */}
      <ModuleTabs
        tabs={TABS}
        activeTab={TABS[tab]}
        onChange={(v) => setTab(TABS.indexOf(v))}
        moduleColor={MODULE_COLORS.crm.primary}
      />

      {tab === 0 && <MemoCRMDashboard />}
      {tab === 1 && (
        <LeadsTab
          leads={leads}
          leadsLoading={leadsLoading}
          leadsErr={leadsErr}
          leadsTotal={leadsTotal}
          leadsParams={leadsParams}
          navigate={navigate}
          onRefresh={refreshLeads}
          onPageChange={onLeadsPageChange}
          onFilterChange={onLeadsFilterChange}
        />
      )}
      {tab === 2 && (
        <ClientsTab
          clients={clients}
          clientsLoading={clientsLoading}
          clientsErr={clientsErr}
          clientsTotal={clientsTotal}
          clientsParams={clientsParams}
          navigate={navigate}
          onRefresh={refreshClients}
          onPageChange={onClientsPageChange}
          onFilterChange={onClientsFilterChange}
          onReport={handleSetReportModal}
        />
      )}
      {tab === 3 && (
        <DealersTab
          dealers={dealers}
          dealersLoading={dealersLoading}
          dealersErr={dealersErr}
          dealersTotal={dealersTotal}
          dealersParams={dealersParams}
          navigate={navigate}
          onRefresh={refreshDealers}
          onPageChange={onDealersPageChange}
          onFilterChange={onDealersFilterChange}
          onEdit={setEditDealer}
        />
      )}
      {tab === 4 && (
        <DealsTab
          deals={deals}
          dealsLoading={dealsLoading}
          dealsErr={dealsErr}
          dealsTotal={dealsTotal}
          dealsParams={dealsParams}
          navigate={navigate}
          onRefresh={refreshDeals}
          onPageChange={onDealsPageChange}
          onFilterChange={onDealsFilterChange}
          onReport={handleSetReportModal}
        />
      )}
      {tab === 5 && <MemoBookingList />}
      {tab === 6 && <MemoFollowUps />}
      {tab === 7 && <MemoSiteVisits />}
      {tab === 8 && <MemoPayments />}

      {/* Modals */}
      <LeadFormDialog
        open={leadModal}
        onClose={() => setLeadModal(false)}
        onSaved={(lead) => {
          setLeadModal(false);
          setLeads((prev) => [lead, ...prev]);
          setLeadsTotal((t) => t + 1);
          pushToast({ title: "Lead Created", message: `Lead "${lead.name}" added successfully`, type: "success" });
        }}
      />
      <ClientFormDialog
        open={clientModal}
        onClose={() => setClientModal(false)}
        onSaved={() => { setClientModal(false); refreshClients(); }}
      />
      <DealerForm
        open={dealerModal}
        onClose={() => setDealerModal(false)}
        onSaved={() => { setDealerModal(false); refreshDealers(); }}
      />
      <DealerForm
        open={!!editDealer}
        onClose={() => setEditDealer(null)}
        initial={editDealer}
        onSaved={() => { setEditDealer(null); refreshDealers(); }}
      />
      <DealForm
        open={dealModal}
        onClose={() => setDealModal(false)}
        onSaved={() => { setDealModal(false); refreshDeals(); }}
      />
      <ReportModal
        open={reportModal.open}
        onClose={() => setReportModal({ open: false, reportType: "", filters: {} })}
        reportType={reportModal.reportType}
        filters={reportModal.filters}
        title={reportModal.title}
      />
    </div>
  );
});

export default MemoCRMPage;

// ── Table helpers ─────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children, mono, blue, bold }: {
  children: React.ReactNode; mono?: boolean; blue?: boolean; bold?: boolean;
}) {
  return (
    <td className={`px-5 py-3.5 ${mono ? "font-mono text-xs" : "text-sm"} ${
      blue ? "text-blue-400" : bold ? "text-primary font-medium" : "text-secondary"
    }`}>
      {children}
    </td>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="p-12 text-center">
      <Users size={32} className="text-muted mx-auto mb-3" />
      <p className="text-secondary text-sm">{label}</p>
    </div>
  );
}
