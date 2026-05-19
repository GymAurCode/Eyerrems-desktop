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
import { SmartTable } from "../components/data-table";

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
  const leadsParamsRef = useRef<any>(null);

  // Clients pagination & query state
  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsLoading, setClientsLoading] = useState(false);
  const clientsParamsRef = useRef<any>(null);

  // Dealers pagination & query state
  const [dealersTotal, setDealersTotal] = useState(0);
  const [dealersLoading, setDealersLoading] = useState(false);
  const dealersParamsRef = useRef<any>(null);

  // Deals pagination & query state
  const [dealsTotal, setDealsTotal] = useState(0);
  const [dealsLoading, setDealsLoading] = useState(false);
  const dealsParamsRef = useRef<any>(null);

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

  const fetchLeads = async (params: any) => {
    leadsParamsRef.current = params;
    setLeadsLoading(true);
    try {
      const res = await api.get<Lead[]>("/crm/leads", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          filter: params.filter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      setLeads(res.data);
      setLeadsTotal(Number(res.headers["x-total-count"] || res.data.length));
    } catch (e) {
      console.error(e);
    } finally {
      setLeadsLoading(false);
    }
  };

  const refreshLeads = () => {
    if (leadsParamsRef.current) {
      void fetchLeads(leadsParamsRef.current);
    }
  };

  const fetchClients = async (params: any) => {
    clientsParamsRef.current = params;
    setClientsLoading(true);
    try {
      const res = await api.get<Client[]>("/crm/clients", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          filter: params.filter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      setClients(res.data);
      setClientsTotal(Number(res.headers["x-total-count"] || res.data.length));
    } catch (e) {
      console.error(e);
    } finally {
      setClientsLoading(false);
    }
  };

  const refreshClients = () => {
    if (clientsParamsRef.current) {
      void fetchClients(clientsParamsRef.current);
    }
  };

  const fetchDealers = async (params: any) => {
    dealersParamsRef.current = params;
    setDealersLoading(true);
    try {
      const res = await api.get<Dealer[]>("/crm/dealers", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          filter: params.filter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      setDealers(res.data);
      setDealersTotal(Number(res.headers["x-total-count"] || res.data.length));
    } catch (e) {
      console.error(e);
    } finally {
      setDealersLoading(false);
    }
  };

  const refreshDealers = () => {
    if (dealersParamsRef.current) {
      void fetchDealers(dealersParamsRef.current);
    }
  };

  const fetchDeals = async (params: any) => {
    dealsParamsRef.current = params;
    setDealsLoading(true);
    try {
      const res = await api.get<Deal[]>("/crm/deals", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          filter: params.filter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      setDeals(res.data);
      setDealsTotal(Number(res.headers["x-total-count"] || res.data.length));
    } catch (e) {
      console.error(e);
    } finally {
      setDealsLoading(false);
    }
  };

  const refreshDeals = () => {
    if (dealsParamsRef.current) {
      void fetchDeals(dealsParamsRef.current);
    }
  };

  const load = async () => {
    refreshLeads();
    refreshClients();
    refreshDealers();
    refreshDeals();
  };

  useEffect(() => { void load(); }, []);

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
          <SmartTable
            storageKey="rems_crm_leads_table"
            data={leads}
            columns={leadColumns}
            rowActions={leadActions}
            loading={leadsLoading}
            total={leadsTotal}
            onParamsChange={fetchLeads}
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
          <SmartTable
            storageKey="rems_crm_clients_table"
            data={clients}
            columns={clientColumns}
            rowActions={clientActions}
            loading={clientsLoading}
            total={clientsTotal}
            onParamsChange={fetchClients}
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
          <SmartTable
            storageKey="rems_crm_dealers_table"
            data={dealers}
            columns={dealerColumns}
            rowActions={dealerActions}
            loading={dealersLoading}
            total={dealersTotal}
            onParamsChange={fetchDealers}
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
          <SmartTable
            storageKey="rems_crm_deals_table"
            data={deals}
            columns={dealColumns}
            rowActions={dealActions}
            loading={dealsLoading}
            total={dealsTotal}
            onParamsChange={fetchDeals}
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
