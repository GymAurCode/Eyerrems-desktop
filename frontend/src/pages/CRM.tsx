import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Search, Circle, Edit2 } from "lucide-react";
import { crmApi, Lead, Client, Dealer, Deal } from "../lib/crmApi";
import ClientForm from "../components/crm/ClientForm";
import DealerForm from "../components/crm/DealerForm";
import DealForm from "../components/crm/DealForm";
import Modal from "../components/Modal";
import { FormField } from "../components/crm/FormField";
import BookingList from "./crm/bookings/BookingList";

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

  const load = async () => {
    const [lRes, cRes, dRes, dealsRes] = await Promise.all([
      crmApi.getLeads(),
      crmApi.getClients(),
      crmApi.getDealers(),
      crmApi.getDeals(),
    ]);
    setLeads(lRes.data);
    setClients(cRes.data);
    setDealers(dRes.data);
    setDeals(dealsRes.data);
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
      if (res.data.client) navigate(`/crm/clients/${res.data.client.id}`);
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
      {tab === 0 && (
        <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {leads.length === 0 ? <Empty label="No leads yet." /> : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <Th>Lead ID</Th><Th>Name</Th><Th>Phone</Th><Th>Source</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="row-hover cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    onClick={() => navigate(`/crm/leads/${l.id}`)}>
                    <Td mono blue>{l.lead_id}</Td>
                    <Td bold>{l.name}</Td>
                    <Td>{l.phone ?? "—"}</Td>
                    <Td>{l.source ?? "—"}</Td>
                    <td className="px-5 py-3.5"><Badge status={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 1 && (
        <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {clients.length === 0 ? <Empty label="No clients yet." /> : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <Th>Tracking ID</Th><Th>Client ID</Th><Th>Name</Th>
                  <Th>Phone</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="row-hover cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    onClick={() => navigate(`/crm/clients/${c.id}`)}>
                    <Td mono blue>{c.tracking_id}</Td>
                    <Td mono>{c.client_id}</Td>
                    <Td bold>{c.name}</Td>
                    <Td>{c.phone ?? "—"}</Td>
                    <td className="px-5 py-3.5"><Badge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 2 && (
        <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {dealers.length === 0 ? <Empty label="No dealers yet." /> : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <Th>Dealer ID</Th><Th>Name</Th><Th>Phone</Th>
                  <Th>Company</Th><Th>Commission</Th><Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((d) => (
                  <tr key={d.id} className="row-hover"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <Td mono blue>{d.dealer_id}</Td>
                    <Td bold>{d.name}</Td>
                    <Td>{d.phone ?? "—"}</Td>
                    <Td>{d.company ?? "—"}</Td>
                    <Td>
                      {d.commission_rate
                        ? `${d.commission_rate}${d.commission_type === "percentage" ? "%" : " (fixed)"}`
                        : "—"}
                    </Td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setEditDealer(d)}
                        className="p-1.5 rounded text-muted hover:text-primary transition-colors">
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 3 && (
        <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {deals.length === 0 ? <Empty label="No deals yet." /> : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <Th>Tracking ID</Th><Th>Deal ID</Th><Th>Title</Th>
                  <Th>Client</Th><Th>Value</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="row-hover cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    onClick={() => navigate(`/crm/deals/${d.id}`)}>
                    <Td mono blue>{d.tracking_id}</Td>
                    <Td mono>{d.deal_id}</Td>
                    <Td>{d.deal_title ?? "—"}</Td>
                    <Td>{d.client_name ?? "—"}</Td>
                    <Td bold>{Number(d.deal_value).toLocaleString()}</Td>
                    <td className="px-5 py-3.5"><Badge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

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
