import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Search, Circle, Eye, Edit2, Trash2, Printer } from "lucide-react";
import { QuickRowActions, printRecord } from "../components/actions";
import { crmApi, Lead, Client, Dealer, Deal } from "../lib/crmApi";
import ClientForm from "../components/crm/ClientForm";
import DealerForm from "../components/crm/DealerForm";
import DealForm from "../components/crm/DealForm";
import Modal from "../components/Modal";
import { FormField } from "../components/crm/FormField";
import BookingList from "./crm/bookings/BookingList";
import { api } from "../lib/api";
import { AppTable, removeEmptyParams } from "../components/data-table";

const TABS = ["Leads", "Clients", "Dealers", "Deals", "Bookings"];

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

export default function CRMPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [deals, setDeals]     = useState<Deal[]>([]);

  // Leads pagination & query state
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsErr, setLeadsErr] = useState<string | null>(null);
  const [leadsParams, setLeadsParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
    propertyType: "",
    status: "",
  });

  // Clients pagination & query state
  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsErr, setClientsErr] = useState<string | null>(null);
  const [clientsParams, setClientsParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
    propertyType: "",
    status: "",
  });

  // Dealers pagination & query state
  const [dealersTotal, setDealersTotal] = useState(0);
  const [dealersLoading, setDealersLoading] = useState(false);
  const [dealersErr, setDealersErr] = useState<string | null>(null);
  const [dealersParams, setDealersParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
    propertyType: "",
    status: "",
  });

  // Deals pagination & query state
  const [dealsTotal, setDealsTotal] = useState(0);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsErr, setDealsErr] = useState<string | null>(null);
  const [dealsParams, setDealsParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
    propertyType: "",
    status: "",
  });

  // Modals
  const [leadModal, setLeadModal]     = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [dealerModal, setDealerModal] = useState(false);
  const [dealModal, setDealModal]     = useState(false);
  const [editDealer, setEditDealer]   = useState<Dealer | null>(null);

  // Lead form
  const [leadName, setLeadName]   = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [leadStatus, setLeadStatus] = useState("new");
  const [leadNotes, setLeadNotes] = useState("");
  const [leadErr, setLeadErr]     = useState("");

  // Search
  const [searchQ, setSearchQ] = useState("");

  const fetchLeads = async (params: typeof leadsParams) => {
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
      console.error(e);
      setLeadsErr(e.message || "Failed to load leads");
    } finally {
      setLeadsLoading(false);
    }
  };

  const refreshLeads = () => {
    void fetchLeads(leadsParams);
  };

  const fetchClients = async (params: typeof clientsParams) => {
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
      console.error(e);
      setClientsErr(e.message || "Failed to load clients");
    } finally {
      setClientsLoading(false);
    }
  };

  const refreshClients = () => {
    void fetchClients(clientsParams);
  };

  const fetchDealers = async (params: typeof dealersParams) => {
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
      console.error(e);
      setDealersErr(e.message || "Failed to load dealers");
    } finally {
      setDealersLoading(false);
    }
  };

  const refreshDealers = () => {
    void fetchDealers(dealersParams);
  };

  const fetchDeals = async (params: typeof dealsParams) => {
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
      console.error(e);
      setDealsErr(e.message || "Failed to load deals");
    } finally {
      setDealsLoading(false);
    }
  };

  const refreshDeals = () => {
    void fetchDeals(dealsParams);
  };

  useEffect(() => {
    void fetchLeads(leadsParams);
  }, [leadsParams]);

  useEffect(() => {
    void fetchClients(clientsParams);
  }, [clientsParams]);

  useEffect(() => {
    void fetchDealers(dealersParams);
  }, [dealersParams]);

  useEffect(() => {
    void fetchDeals(dealsParams);
  }, [dealsParams]);

  const createLead = async () => {
    if (!leadName.trim()) { setLeadErr("Name is required"); return; }
    setLeadErr("");
    await crmApi.createLead({
      name: leadName, phone: leadPhone || null,
      email: leadEmail || null, source: leadSource || null,
      notes: leadNotes || null, status: leadStatus,
    });
    setLeadName(""); setLeadPhone(""); setLeadEmail("");
    setLeadSource(""); setLeadNotes(""); setLeadStatus("new");
    setLeadModal(false);
    await load();
  };

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    try {
      const res = await crmApi.search(searchQ.trim());
      if (res.client) navigate(`/crm/clients/${res.client.id}`);
    } catch {
      alert("No results found for: " + searchQ);
    }
  };

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
            <input className="input-dark px-3 py-2 text-sm w-56" placeholder="Search TRX-YYYY-XXXX"
              value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()} />
            <button onClick={doSearch} className="btn-primary px-3 py-2 text-sm">
              <Search size={14} />
            </button>
          </div>
          <button type="button" onClick={() => {
            if (tab === 0) setLeadModal(true);
            else if (tab === 1) setClientModal(true);
            else if (tab === 2) setDealerModal(true);
            else if (tab === 3) setDealModal(true);
            // tab 4 (Bookings) — BookingList manages its own "New Booking" button
          }} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus size={15} /> {tab === 4 ? "New Booking" : "New"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === i ? "text-blue-400 border-b-2 border-blue-400" : "text-muted hover:text-secondary"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && (() => {
        const leadColumns = [
          { key: "lead_id", label: "Lead ID", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
          { key: "name", label: "Name", sortable: true, className: "font-medium text-primary" },
          { key: "phone", label: "Phone", sortable: true },
          { key: "source", label: "Source", sortable: true },
          {
            key: "status",
            label: "Status",
            render: (val: string) => <Badge status={val} />
          }
        ];

        const leadActions = [
          {
            key: "view",
            label: "View",
            icon: Eye,
            onClick: (row: Lead) => navigate(`/crm/leads/${row.id}`),
          },
          {
            key: "print",
            label: "Print",
            icon: Printer,
            onClick: (row: Lead) => printRecord(`Lead ${row.lead_id}`, [
              { label: "Name", value: row.name },
              { label: "Phone", value: row.phone ?? "—" },
              { label: "Status", value: row.status },
            ]),
          }
        ];

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
            onRetry={refreshLeads}
            pagination={{
              page: leadsParams.page,
              pageSize: leadsParams.pageSize,
              total: leadsTotal,
            }}
            onPageChange={(config) => setLeadsParams((prev) => ({ ...prev, ...config }))}
            onFilterChange={(filters) => setLeadsParams((prev) => ({ ...prev, ...filters }))}
            showTypeFilter={false}
            showStatusFilter={false}
          />
        );
      })()}

      {tab === 1 && (() => {
        const clientColumns = [
          { key: "tracking_id", label: "Tracking ID", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
          { key: "client_id", label: "Client ID", sortable: true, className: "font-mono text-xs" },
          { key: "name", label: "Name", sortable: true, className: "font-medium text-primary" },
          { key: "phone", label: "Phone", sortable: true },
          {
            key: "status",
            label: "Status",
            render: (val: string) => <Badge status={val} />
          }
        ];

        const clientActions = [
          {
            key: "view",
            label: "View",
            icon: Eye,
            onClick: (row: Client) => navigate(`/crm/clients/${row.id}`),
          },
          {
            key: "print",
            label: "Print",
            icon: Printer,
            onClick: (row: Client) => printRecord(`Client ${row.client_id}`, [
              { label: "Name", value: row.name },
              { label: "Phone", value: row.phone ?? "—" },
              { label: "Status", value: row.status },
            ]),
          }
        ];

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
            onRetry={refreshClients}
            pagination={{
              page: clientsParams.page,
              pageSize: clientsParams.pageSize,
              total: clientsTotal,
            }}
            onPageChange={(config) => setClientsParams((prev) => ({ ...prev, ...config }))}
            onFilterChange={(filters) => setClientsParams((prev) => ({ ...prev, ...filters }))}
            showTypeFilter={false}
            showStatusFilter={false}
          />
        );
      })()}

      {tab === 2 && (() => {
        const dealerColumns = [
          { key: "dealer_id", label: "Dealer ID", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
          { key: "name", label: "Name", sortable: true, className: "font-medium text-primary" },
          { key: "phone", label: "Phone", sortable: true },
          { key: "company", label: "Company", sortable: true },
          {
            key: "commission_rate",
            label: "Commission",
            render: (val: any, row: Dealer) => row.commission_rate
              ? `${row.commission_rate}${row.commission_type === "percentage" ? "%" : " (fixed)"}`
              : "—"
          }
        ];

        const dealerActions = [
          {
            key: "edit",
            label: "Edit",
            icon: Edit2,
            onClick: (row: Dealer) => setEditDealer(row),
            permission: "crm:manage"
          },
          {
            key: "print",
            label: "Print",
            icon: Printer,
            onClick: (row: Dealer) => printRecord(`Dealer ${row.dealer_id}`, [
              { label: "Name", value: row.name },
              { label: "Company", value: row.company ?? "—" },
            ]),
          }
        ];

        return (
          <AppTable
            storageKey="rems_crm_dealers_table"
            title="Dealers"
            subtitle="Manage agent/dealer partnerships and commission structures"
            data={dealers}
            columns={dealerColumns}
            rowActions={dealerActions}
            loading={dealersLoading}
            error={dealersErr}
            onRetry={refreshDealers}
            pagination={{
              page: dealersParams.page,
              pageSize: dealersParams.pageSize,
              total: dealersTotal,
            }}
            onPageChange={(config) => setDealersParams((prev) => ({ ...prev, ...config }))}
            onFilterChange={(filters) => setDealersParams((prev) => ({ ...prev, ...filters }))}
            showTypeFilter={false}
            showStatusFilter={false}
          />
        );
      })()}

      {tab === 3 && (() => {
        const dealColumns = [
          { key: "tracking_id", label: "Tracking ID", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
          { key: "deal_id", label: "Deal ID", sortable: true, className: "font-mono text-xs" },
          { key: "deal_title", label: "Title", sortable: true },
          { key: "client_name", label: "Client", sortable: true },
          {
            key: "deal_value",
            label: "Value",
            sortable: true,
            className: "font-medium text-primary",
            render: (val: number) => Number(val).toLocaleString()
          },
          {
            key: "status",
            label: "Status",
            render: (val: string) => <Badge status={val} />
          }
        ];

        const dealActions = [
          {
            key: "view",
            label: "View",
            icon: Eye,
            onClick: (row: Deal) => navigate(`/crm/deals/${row.id}`),
          },
          {
            key: "print",
            label: "Print",
            icon: Printer,
            onClick: (row: Deal) => printRecord(`Deal ${row.deal_id}`, [
              { label: "Title", value: row.deal_title ?? "—" },
              { label: "Client", value: row.client_name ?? "—" },
              { label: "Value", value: String(row.deal_value) },
              { label: "Status", value: row.status },
            ]),
          }
        ];

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
            onRetry={refreshDeals}
            pagination={{
              page: dealsParams.page,
              pageSize: dealsParams.pageSize,
              total: dealsTotal,
            }}
            onPageChange={(config) => setDealsParams((prev) => ({ ...prev, ...config }))}
            onFilterChange={(filters) => setDealsParams((prev) => ({ ...prev, ...filters }))}
            showTypeFilter={false}
            showStatusFilter={false}
          />
        );
      })()}

      {tab === 4 && (
        <BookingList />
      )}

      {/* Lead Modal */}
      <Modal open={leadModal} onClose={() => setLeadModal(false)} title="New Lead">
        <div className="space-y-4">
          {leadErr && (
            <p className="text-xs text-red-400 px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)" }}>{leadErr}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name" required>
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={leadName}
                onChange={(e) => setLeadName(e.target.value)} placeholder="Full name" />
            </FormField>
            <FormField label="Phone">
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)} placeholder="Phone" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Email">
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)} placeholder="Email" />
            </FormField>
            <FormField label="Source">
              <input className="input-dark w-full px-3 py-2.5 text-sm" value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)} placeholder="Referral, Website…" />
            </FormField>
          </div>
          <FormField label="Status">
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value)}>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="lost">Lost</option>
            </select>
          </FormField>
          <FormField label="Notes">
            <textarea className="input-dark w-full px-3 py-2.5 text-sm resize-none" rows={2}
              value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} placeholder="Notes…" />
          </FormField>
          <button onClick={createLead} className="btn-primary w-full py-3 text-sm">Save Lead</button>
        </div>
      </Modal>

      {/* Client Modal */}
      <ClientForm
        open={clientModal}
        onClose={() => setClientModal(false)}
        onSaved={() => { setClientModal(false); void load(); }}
      />

      {/* Dealer Modal (new) */}
      <DealerForm
        open={dealerModal}
        onClose={() => setDealerModal(false)}
        onSaved={() => { setDealerModal(false); void load(); }}
      />

      {/* Dealer Edit Modal */}
      <DealerForm
        open={!!editDealer}
        onClose={() => setEditDealer(null)}
        initial={editDealer}
        onSaved={() => { setEditDealer(null); void load(); }}
      />

      {/* Deal Modal */}
      <DealForm
        open={dealModal}
        onClose={() => setDealModal(false)}
        onSaved={() => { setDealModal(false); void load(); }}
      />
    </div>
  );
}

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
