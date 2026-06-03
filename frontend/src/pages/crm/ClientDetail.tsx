import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Phone, Mail, Building, MapPin, MessageSquare, Briefcase, Edit2, Plus,
  User, Info, Zap, Clock, Paperclip, Target, DollarSign,
} from "lucide-react";
import { crmApi, Client, Deal, Communication, Installment, Payment, TimelineEntry } from "../../lib/crmApi";
import ClientFormDialog from "../../components/crm/ClientFormDialog";
import CommunicationForm from "../../components/crm/CommunicationForm";
import QuickActionsPanel from "../../components/crm/QuickActionsPanel";
import AttachmentPanel from "../../components/attachments/AttachmentPanel";
import RecordHistory from "../../components/RecordHistory";
import {
  DetailPage, DetailHeader, DetailBody, DetailSection,
  InfoGrid, DataTable, StatusBadge, MonoId,
} from "../../components/detail";
import ModuleTabs from "../../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../../config/moduleColors";
import { ClientJourneyTracker } from "../../components/crm/JourneyTracker";

const COMM_COLORS: Record<string, string> = {
  call: "#3b82f6", sms: "#8b5cf6", email: "#f59e0b", meeting: "#10b981",
};

const TIMELINE_ACTIONS: Record<string, string> = {
  lead_created: "#3b82f6", converted: "#8b5cf6", deal_created: "#f59e0b",
  booking_created: "#6366f1", payment_received: "#10b981",
};

const TABS = ["Overview", "Quick Actions", "Timeline", "History"] as const;
type Tab = typeof TABS[number];

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const color = TIMELINE_ACTIONS[entry.action] ?? "#94a3b8";
  return (
    <div className="flex gap-3 py-2">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
        <Clock size={10} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold capitalize" style={{ color }}>{entry.action.replace(/_/g, " ")}</span>
          {entry.performed_by_name && <span className="text-[10px] text-muted">by {entry.performed_by_name}</span>}
        </div>
        {entry.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{entry.description}</p>}
        <p className="text-[10px] mt-0.5 text-muted">{new Date(entry.created_at).toLocaleString()}</p>
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [comms, setComms] = useState<Communication[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  const load = async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const cRes = await crmApi.getClient(id);
      setClient(cRes);
      const nid = cRes.id;
      try {
        const dRes = await crmApi.getDeals();
        const clientDeals = dRes.filter(d => d.client_id === nid);
        setDeals(clientDeals);
        const dealIds = clientDeals.map(d => d.id);
        if (dealIds.length > 0) {
          const allInst = [];
          for (const did of dealIds) {
            try { allInst.push(...(await crmApi.getInstallmentSchedule(did))); } catch { }
          }
          setInstallments(allInst);
        }
      } catch {
        console.error("Failed to load client deals");
      }
      try {
        const commRes = await crmApi.getCommunications(cRes.tracking_id);
        setComms(commRes);
      } catch {
        console.error("Failed to load communications");
      }
      try {
        const [tlRes, pRes] = await Promise.all([
          crmApi.getTimeline("client", nid, 50),
          crmApi.getPayments({ client_id: nid }),
        ]);
        setTimeline(tlRes ?? []);
        setPayments(pRes.items ?? []);
      } catch {
        console.error("Failed to load timeline/payments");
      }
    } catch {
      setClient(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  const journeyStages: string[] = [];
  if (client) {
    journeyStages.push("lead_created");
    if (client.converted_from_lead) journeyStages.push("converted");
    if (deals.length > 0) journeyStages.push("deal_created");
    if (installments.length > 0) journeyStages.push("booking_created");
    if (payments.length > 0) journeyStages.push("payment_received");
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>Loading…</div>;
  if (!client) return <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>Client not found.</div>;

  const totalDealValue = deals.reduce((s, d) => s + Number(d.deal_value), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const overdueInst = installments.filter(i => i.status === "overdue").length;

  return (
    <DetailPage>
      <DetailHeader
        backTo="/crm"
        title={client.name}
        badge={<StatusBadge status={client.status} />}
        meta={[
          { label: "Tracking", value: <MonoId value={client.tracking_id} /> },
          { label: "ID", value: <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{client.client_id}</span> },
          ...(client.converted_from_lead ? [{ label: "Lead", value: client.original_lead_id ?? "—" }] : []),
        ]}
        actions={[
          { label: "Edit", icon: Edit2, onClick: () => setEditOpen(true) },
        ]}
      />

      <DetailBody>
        <ModuleTabs
          tabs={[
            { label: "Overview", value: "Overview", icon: Info },
            { label: "Quick Actions", value: "Quick Actions", icon: Zap },
            { label: "Timeline", value: "Timeline", icon: Clock },
            { label: "History", value: "History", icon: Clock },
          ]}
          activeTab={activeTab}
          onChange={(v) => setActiveTab(v as Tab)}
          moduleColor={MODULE_COLORS.crm}
        />

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

        {activeTab === "Timeline" && (
          <div className="px-6 py-5">
            {timeline.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">No timeline entries</p>
            ) : (
              <div className="space-y-1">
                {timeline.map((entry, idx) => <TimelineItem key={idx} entry={entry} />)}
              </div>
            )}
          </div>
        )}

        {activeTab === "History" && (
          <div className="px-6 py-5">
            <RecordHistory module="crm" recordId={String(client.id)} />
          </div>
        )}

        {activeTab === "Overview" && (
          <>
            <DetailSection title="Client Journey" icon={Target}>
              <ClientJourneyTracker completedStages={journeyStages} />
            </DetailSection>

            <DetailSection title="Client Information" icon={Info}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  { label: "Client ID", value: <span className="font-mono text-xs">{client.client_id}</span> },
                  { label: "CNIC", value: client.cnic ? <span className="font-mono text-xs">{client.cnic}</span> : "—" },
                  { label: "Dealer", value: client.dealer_name ?? "—" },
                  { label: "Status", value: <StatusBadge status={client.status} /> },
                  { label: "Created", value: new Date(client.created_at).toLocaleDateString() },
                ]} />
              </div>
              {client.notes && (
                <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Notes</p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{client.notes}</p>
                </div>
              )}
            </DetailSection>

            <DetailSection title="Financial Summary" icon={DollarSign}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Deal Value</p>
                  <p className="text-base font-bold mt-1" style={{ color: "#3b82f6" }}>{totalDealValue.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Total Paid</p>
                  <p className="text-base font-bold mt-1" style={{ color: "#10b981" }}>{totalPaid.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Deals Count</p>
                  <p className="text-base font-bold mt-1" style={{ color: "#f59e0b" }}>{deals.length}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Overdue</p>
                  <p className="text-base font-bold mt-1" style={{ color: overdueInst > 0 ? "#ef4444" : "#10b981" }}>{overdueInst}</p>
                </div>
              </div>
            </DetailSection>

            <DetailSection title="Associated Deals" icon={Briefcase}>
              <DataTable
                emptyText="No deals yet."
                columns={[
                  { key: "deal_id", label: "Deal ID" },
                  { key: "title", label: "Title" },
                  { key: "value", label: "Value", align: "right" },
                  { key: "status", label: "Status" },
                  { key: "date", label: "Date" },
                ]}
                rows={deals.map(d => ({
                  deal_id: <MonoId value={d.deal_id} />,
                  title: <span style={{ color: "var(--text-secondary)" }}>{d.deal_title ?? "—"}</span>,
                  value: <span className="font-semibold">{Number(d.deal_value).toLocaleString()}</span>,
                  status: <StatusBadge status={d.status} />,
                  date: <span style={{ color: "var(--text-muted)" }}>{d.deal_date ?? "—"}</span>,
                }))}
                onRowClick={(_, i) => navigate(`/crm/deals/${deals[i].deal_id}`)}
              />
            </DetailSection>

            {payments.length > 0 && (
              <DetailSection title="Recent Payments" icon={DollarSign}>
                <DataTable
                  columns={[
                    { key: "pid", label: "Payment ID" },
                    { key: "amount", label: "Amount", align: "right" },
                    { key: "method", label: "Method" },
                    { key: "date", label: "Date" },
                  ]}
                  rows={payments.slice(0, 5).map(p => ({
                    pid: <MonoId value={p.payment_id} />,
                    amount: <span className="font-semibold">{Number(p.amount).toLocaleString()}</span>,
                    method: <span className="text-xs capitalize text-muted">{p.payment_method.replace("_", " ")}</span>,
                    date: <span className="text-xs text-muted">{new Date(p.payment_date).toLocaleDateString()}</span>,
                  }))}
                />
              </DetailSection>
            )}

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

            <DetailSection title="Attachments" icon={Paperclip}>
              <AttachmentPanel module="client" recordId={client.id} />
            </DetailSection>
          </>
        )}
      </DetailBody>

      <ClientFormDialog open={editOpen} onClose={() => setEditOpen(false)} initial={client}
        onSaved={c => { setClient(c); setEditOpen(false); }} />
      <CommunicationForm open={commOpen} onClose={() => setCommOpen(false)} preselectedClient={client}
        onSaved={() => { setCommOpen(false); crmApi.getCommunications(client.tracking_id).then(r => setComms(r)).catch(() => {}); }} />
    </DetailPage>
  );
}
