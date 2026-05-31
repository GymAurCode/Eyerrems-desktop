import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Phone, Mail, Building, MapPin, MessageSquare, Briefcase, Edit2, Plus, User, Info, Zap, Clock, Paperclip } from "lucide-react";
import { crmApi, Client, Deal, Communication } from "../../lib/crmApi";
import ClientForm from "../../components/crm/ClientForm";
import CommunicationForm from "../../components/crm/CommunicationForm";
import QuickActionsPanel from "../../components/crm/QuickActionsPanel";
import AttachmentPanel from "../../components/attachments/AttachmentPanel";
import RecordHistory from "../../components/RecordHistory";
import {
  DetailPage, DetailHeader, DetailBody, DetailSection,
  InfoGrid, DataTable, StatusBadge, MonoId,
} from "../../components/detail";

const COMM_COLORS: Record<string, string> = {
  call: "#3b82f6", sms: "#8b5cf6", email: "#f59e0b", meeting: "#10b981",
};

const TABS = ["Overview", "Quick Actions", "History"] as const;
type Tab = typeof TABS[number];

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient]     = useState<Client | null>(null);
  const [deals, setDeals]       = useState<Deal[]>([]);
  const [comms, setComms]       = useState<Communication[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([crmApi.getClient(Number(id)), crmApi.getDeals()]);
      setClient(cRes.data);
      setDeals(dRes.data.filter(d => d.client_id === Number(id)));
      const commRes = await crmApi.getCommunications(cRes.data.tracking_id);
      setComms(commRes.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>Loading…</div>;
  if (!client) return <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>Client not found.</div>;

  return (
    <DetailPage>
      <DetailHeader
        backTo="/crm"
        title={client.name}
        badge={<StatusBadge status={client.status} />}
        meta={[
          { label: "Tracking", value: <MonoId value={client.tracking_id} /> },
          { label: "ID",       value: <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{client.client_id}</span> },
          ...(client.converted_from_lead ? [{ label: "Lead", value: client.original_lead_id ?? "—" }] : []),
        ]}
        actions={[
          { label: "Edit", icon: Edit2, onClick: () => setEditOpen(true) },
        ]}
      />

      <DetailBody>
        {/* ── Tab Bar ── */}
        <div
          className="flex items-center gap-1 px-6 py-3"
          style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface2)" }}
        >
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={
                activeTab === tab
                  ? { background: "var(--accent)", color: "#fff" }
                  : { color: "var(--text-secondary)" }
              }
              onMouseEnter={e => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
              onMouseLeave={e => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {tab === "Quick Actions" && <Zap size={11} />}
              {tab === "Overview" && <Info size={11} />}
              {tab === "History" && <Clock size={11} />}
              {tab}
            </button>
          ))}
        </div>

        {/* ── Quick Actions Tab ── */}
        {activeTab === "Quick Actions" && (
          <div className="px-6 py-5">
            <QuickActionsPanel
              entityType="client"
              entityId={client.id}
              name={client.name}
              phone={client.phone}
              email={client.email}
            />
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === "History" && (
          <div className="px-6 py-5">
            <RecordHistory module="crm" recordId={String(client.id)} />
          </div>
        )}

        {/* ── Overview Tab ── */}
        {activeTab === "Overview" && (
          <>
            {/* ── Section 1: Contact & Identifiers ── */}
            <DetailSection title="Client Information" icon={Info}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Contact</p>
                  <div className="space-y-2">
                    {client.phone && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Phone size={12} style={{ color: "var(--text-muted)" }} /> {client.phone}
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Mail size={12} style={{ color: "var(--text-muted)" }} /> {client.email}
                      </div>
                    )}
                    {client.company_name && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Building size={12} style={{ color: "var(--text-muted)" }} /> {client.company_name}
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <MapPin size={12} className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} /> {client.address}
                      </div>
                    )}
                  </div>
                </div>
                <InfoGrid items={[
                  { label: "Tracking ID", value: <MonoId value={client.tracking_id} /> },
                  { label: "Client ID",   value: <span className="font-mono text-xs">{client.client_id}</span> },
                  { label: "CNIC",        value: client.cnic ? <span className="font-mono text-xs">{client.cnic}</span> : "—" },
                  { label: "Dealer",      value: client.dealer_name ?? "—" },
                  { label: "Status",      value: <StatusBadge status={client.status} /> },
                  { label: "Created",     value: new Date(client.created_at).toLocaleDateString() },
                ]} />
              </div>
              {client.notes && (
                <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Notes</p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{client.notes}</p>
                </div>
              )}
            </DetailSection>

            {/* ── Section 2: Deals ── */}
            <DetailSection title="Associated Deals" icon={Briefcase}>
              <DataTable
                emptyText="No deals yet."
                columns={[
                  { key: "deal_id", label: "Deal ID" },
                  { key: "title",   label: "Title" },
                  { key: "value",   label: "Value", align: "right" },
                  { key: "status",  label: "Status" },
                  { key: "date",    label: "Date" },
                ]}
                rows={deals.map(d => ({
                  deal_id: <MonoId value={d.deal_id} />,
                  title:   <span style={{ color: "var(--text-secondary)" }}>{d.deal_title ?? "—"}</span>,
                  value:   <span className="font-semibold">{Number(d.deal_value).toLocaleString()}</span>,
                  status:  <StatusBadge status={d.status} />,
                  date:    <span style={{ color: "var(--text-muted)" }}>{d.deal_date ?? "—"}</span>,
                }))}
                onRowClick={(_, i) => navigate(`/crm/deals/${deals[i].id}`)}
              />
            </DetailSection>

            {/* ── Section 3: Communications ── */}
            <DetailSection
              title="Communications"
              icon={MessageSquare}
              action={
                <button onClick={() => setCommOpen(true)}
                  className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                  <Plus size={12} /> Log
                </button>
              }
            >
              {comms.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No communications logged.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-3.5 top-0 bottom-0 w-px" style={{ background: "var(--border)" }} />
                  <div className="space-y-4">
                    {comms.map(c => {
                      const color = COMM_COLORS[c.type] ?? "#94a3b8";
                      return (
                        <div key={c.id} className="flex gap-4 relative">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold text-white"
                            style={{ background: color }}>
                            {c.type.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-primary">{c.subject ?? c.type}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                style={{ background: `${color}20`, color }}>{c.type}</span>
                            </div>
                            {c.description && (
                              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{c.description}</p>
                            )}
                            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                              {c.comm_date ?? new Date(c.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </DetailSection>

            {/* ── Section 4: Attachments ── */}
            <DetailSection title="Attachments" icon={Paperclip}>
              <AttachmentPanel module="client" recordId={client.id} />
            </DetailSection>
          </>
        )}
      </DetailBody>

      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} initial={client}
        onSaved={c => { setClient(c); setEditOpen(false); }} />
      <CommunicationForm open={commOpen} onClose={() => setCommOpen(false)} preselectedClient={client}
        onSaved={() => { setCommOpen(false); crmApi.getCommunications(client.tracking_id).then(r => setComms(r.data)); }} />
    </DetailPage>
  );
}
