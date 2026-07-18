import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Phone, Mail, Building, MapPin, MessageSquare, Briefcase, Edit2, Plus,
  User, Info, Zap, Clock, Paperclip, Target, DollarSign, FileText,
  Receipt, ArrowLeftRight, Home, TicketCheck, ExternalLink, Search,
} from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import { crmApi, Client, Deal, Communication, Installment, Payment, TimelineEntry } from "../../lib/crmApi";
import { pipelineApi, Contract, ReceiptVoucher, Transfer, Handover, AfterSalesTicket, ClientPipelineSummary } from "../../lib/pipelineApi";
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
import { PipelineStepper, getPipelineStages } from "../../components/crm/PipelineStepper";

const COMM_COLORS: Record<string, string> = {
  call: "#3b82f6", sms: "#8b5cf6", email: "#f59e0b", meeting: "#10b981",
};

const TABS = [
  "Profile", "Deals & Bookings", "Documents", "Ledger",
  "Communication", "History",
] as const;
type Tab = typeof TABS[number];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
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
  const [pipeline, setPipeline] = useState<ClientPipelineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Profile");
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const cRes = await crmApi.getClient(id);
      setClient(cRes);
      const nid = cRes.id;

      const [dRes, pipelineRes] = await Promise.all([
        crmApi.getDeals().catch(() => [] as Deal[]),
        pipelineApi.getClientSummary(nid).catch(() => null),
      ]);

      const clientDeals: Deal[] = dRes ? dRes.filter((d: Deal) => d.client_id === nid) : [];
      setDeals(clientDeals);
      setPipeline(pipelineRes);

      const dealIds = clientDeals.map((d: Deal) => d.id);
      if (dealIds.length > 0) {
        const allInst: Installment[] = [];
        for (const did of dealIds) {
          try { allInst.push(...(await crmApi.getInstallmentSchedule(did))); } catch {}
        }
        setInstallments(allInst);
      }

      const [commRes, tlRes, pRes] = await Promise.all([
        crmApi.getCommunications(cRes.tracking_id).catch(() => [] as Communication[]),
        crmApi.getTimeline("client", nid, 50).catch(() => [] as TimelineEntry[]),
        crmApi.getPayments({ client_id: nid }).catch(() => ({ items: [] })),
      ]);
      setComms(commRes ?? []);
      setTimeline(tlRes ?? []);
      setPayments(pRes.items ?? []);
    } catch {
      setClient(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  const totalDealValue = deals.reduce((s, d) => s + Number(d.deal_value || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const overdueInst = installments.filter((i: Installment) => i.status === "overdue").length;

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
          { label: "ID", value: <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{client.client_id}</span> },
          { label: "CNIC", value: client.cnic ? <span className="font-mono text-xs">{client.cnic}</span> : "—" },
          ...(client.converted_from_lead ? [{ label: "Lead", value: client.original_lead_id ?? "—" }] : []),
        ]}
        actions={[
          { label: "Edit", icon: Edit2, onClick: () => setEditOpen(true) },
        ]}
      />

      <DetailBody>
        <ModuleTabs
          tabs={[
            { label: "Profile", value: "Profile", icon: Info },
            { label: "Deals & Bookings", value: "Deals & Bookings", icon: Briefcase },
            { label: "Documents", value: "Documents", icon: Paperclip },
            { label: "Ledger", value: "Ledger", icon: DollarSign },
            { label: "Communication", value: "Communication", icon: MessageSquare },
            { label: "History", value: "History", icon: Clock },
          ]}
          activeTab={activeTab}
          onChange={(v) => setActiveTab(v as Tab)}
          moduleColor={MODULE_COLORS.crm.primary}
        />

        {/* ══════════ PROFILE TAB ══════════ */}
        {activeTab === "Profile" && (
          <>
            <DetailSection title="Client Information" icon={Info}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Contact</p>
                  <div className="space-y-2">
                    {client.phone && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Phone size={12} className="shrink-0" style={{ color: "var(--text-muted)" }} /> <span className="truncate">{client.phone}</span>
                      </div>
                    )}
                    {client.whatsapp && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <MessageSquare size={12} className="shrink-0" style={{ color: "var(--text-muted)" }} /> <span className="truncate">{client.whatsapp}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Mail size={12} className="shrink-0" style={{ color: "var(--text-muted)" }} /> <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.company_name && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Building size={12} className="shrink-0" style={{ color: "var(--text-muted)" }} /> <span className="truncate">{client.company_name}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-start gap-2 text-xs min-w-0" style={{ color: "var(--text-secondary)" }}>
                        <MapPin size={12} className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} /> <span className="break-words min-w-0">{client.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>KYC / Identity</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span className="font-medium" style={{ color: "var(--text-muted)" }}>CNIC:</span>
                      <span className="font-mono">{client.cnic || "—"}</span>
                    </div>
                    {client.next_of_kin_name && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span className="font-medium" style={{ color: "var(--text-muted)" }}>Nominee:</span>
                        {client.next_of_kin_name} ({client.next_of_kin_phone || "—"})
                      </div>
                    )}
                    {client.next_of_kin_cnic && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span className="font-medium" style={{ color: "var(--text-muted)" }}>Nominee CNIC:</span>
                        <span className="font-mono">{client.next_of_kin_cnic}</span>
                      </div>
                    )}
                  </div>
                </div>

                <InfoGrid items={[
                  { label: "Tracking ID", value: <MonoId value={client.tracking_id} /> },
                  { label: "Client ID", value: <span className="font-mono text-xs">{client.client_id}</span> },
                  { label: "Status", value: <StatusBadge status={client.status} /> },
                  { label: "Source Lead", value: client.original_lead_id ?? "Direct" },
                  { label: "Dealer", value: client.dealer_name ?? "—" },
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
                  <p className="text-base font-bold mt-1" style={{ color: "#3b82f6" }}>{formatCurrency(totalDealValue)}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Total Paid</p>
                  <p className="text-base font-bold mt-1" style={{ color: "#10b981" }}>{formatCurrency(totalPaid)}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Deals</p>
                  <p className="text-base font-bold mt-1" style={{ color: "#f59e0b" }}>{deals.length}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Overdue</p>
                  <p className="text-base font-bold mt-1" style={{ color: overdueInst > 0 ? "#ef4444" : "#10b981" }}>{overdueInst}</p>
                </div>
              </div>
            </DetailSection>
          </>
        )}

        {/* ══════════ DEALS & BOOKINGS TAB ══════════ */}
        {activeTab === "Deals & Bookings" && (
          <>
            {(!deals || deals.length === 0) ? (
              <div className="px-6 py-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No deals yet. Create a deal for this client to get started.
              </div>
            ) : (
              deals.map((deal) => {
                const booking = pipeline?.bookings?.find((b: any) => b.deal_id === deal.id);
                const contract = pipeline?.contracts?.find((c: any) => c.booking_id === booking?.id);
                const plan = booking?.installment_plan;
                const dealInstallments = installments.filter((i: Installment) => {
                  const plan_id = plan?.id;
                  return plan_id ? String((i as any).plan_id) === String(plan_id) : false;
                });
                const dealTransfers = pipeline?.transfers?.filter((t: any) =>
                  booking ? t.booking_id === booking.id : false
                ) ?? [];
                const handover = pipeline?.handovers?.find((h: any) =>
                  booking ? h.booking_id === booking.id : false
                );
                const tickets = pipeline?.tickets?.filter((t: any) =>
                  booking ? t.booking_id === booking.id : false
                ) ?? [];
                const stages = getPipelineStages(booking, contract, plan, dealInstallments, dealTransfers, handover, tickets);

                return (
                  <DetailSection
                    key={deal.id}
                    title={`Deal ${deal.deal_id}`}
                    icon={Briefcase}
                    action={
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[10px] font-medium hover:opacity-75"
                        style={{ color: "var(--accent-yellow, #f6ce3a)" }}
                        onClick={() => navigate(`/crm/deals/${deal.deal_id}`)}
                      >
                        <ExternalLink size={10} /> Open Deal
                      </button>
                    }
                  >
                    {/* Pipeline Stepper */}
                    <div className="mb-4 p-3 rounded-xl" style={{ background: "var(--bg-base)" }}>
                      <PipelineStepper stages={stages} compact />
                    </div>

                    {/* Deal Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                      <div className="p-3 rounded-lg" style={{ background: "rgba(59,130,246,0.06)" }}>
                        <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Value</p>
                        <p className="text-sm font-semibold mt-0.5">{formatCurrency(deal.deal_value)}</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: "rgba(16,185,129,0.06)" }}>
                        <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Status</p>
                        <p className="mt-0.5"><StatusBadge status={deal.status} /></p>
                      </div>
                      {booking && (
                        <>
                          <div className="p-3 rounded-lg" style={{ background: "rgba(245,158,11,0.06)" }}>
                            <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Booking</p>
                            <p className="text-sm font-semibold mt-0.5 font-mono">{booking.booking_id}</p>
                          </div>
                          <div className="p-3 rounded-lg" style={{ background: "rgba(99,102,241,0.06)" }}>
                            <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Booking Status</p>
                            <p className="mt-0.5"><StatusBadge status={booking.status} /></p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Contract & Installments Quick View */}
                    <div className="space-y-3">
                      {contract && (
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-base)" }}>
                          <div className="flex items-center gap-2">
                            <FileText size={14} style={{ color: "#f59e0b" }} />
                            <div>
                              <p className="text-xs font-medium">Contract {contract.contract_id}</p>
                              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                {contract.signed_date ? `Signed ${timeAgo(contract.signed_date)}` : contract.status}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={contract.status} />
                        </div>
                      )}

                      {dealInstallments.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                            Installments ({dealInstallments.filter((i: Installment) => i.status === "paid").length}/{dealInstallments.length} paid)
                          </p>
                          <div className="space-y-1.5">
                            {dealInstallments.slice(0, 5).map((inst: any) => (
                              <div key={inst.id} className="flex items-center justify-between p-2 rounded-lg text-xs"
                                style={{ background: "var(--bg-base)" }}>
                                <div className="flex items-center gap-2">
                                  <span style={{ color: "var(--text-muted)" }}>
                                    Due {new Date(inst.due_date).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{formatCurrency(inst.amount)}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    inst.status === "paid" ? "text-green-500 bg-green-500/10" :
                                    inst.status === "overdue" ? "text-red-500 bg-red-500/10" :
                                    "text-yellow-500 bg-yellow-500/10"
                                  }`}>{inst.status}</span>
                                </div>
                              </div>
                            ))}
                            {dealInstallments.length > 5 && (
                              <p className="text-[10px] text-center pt-1" style={{ color: "var(--text-muted)" }}>
                                +{dealInstallments.length - 5} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Transfers */}
                      {dealTransfers.length > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: "var(--bg-base)" }}>
                          <ArrowLeftRight size={12} style={{ color: "#ec4899" }} />
                          <span>{dealTransfers.length} transfer(s) — last: {new Date(dealTransfers[0].transfer_date).toLocaleDateString()}</span>
                        </div>
                      )}

                      {/* Handover */}
                      {handover && (
                        <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: "var(--bg-base)" }}>
                          <Home size={12} style={{ color: "#06b6d4" }} />
                          <span>Handover {handover.status === "completed" ? "completed" : "pending"} on {new Date(handover.possession_date).toLocaleDateString()}</span>
                        </div>
                      )}

                      {/* Tickets */}
                      {tickets.length > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: "var(--bg-base)" }}>
                          <TicketCheck size={12} style={{ color: "#f97316" }} />
                          <span>{tickets.filter((t: any) => t.status !== "closed").length} open after-sales tickets</span>
                        </div>
                      )}
                    </div>
                  </DetailSection>
                );
              })
            )}
          </>
        )}

        {/* ══════════ DOCUMENTS TAB ══════════ */}
        {activeTab === "Documents" && (
          <DetailSection title="Client Documents" icon={Paperclip}>
            <AttachmentPanel module="client" recordId={client.id} />
          </DetailSection>
        )}

        {/* ══════════ LEDGER TAB ══════════ */}
        {activeTab === "Ledger" && (
          <LedgerTabView clientId={client.id} receipts={pipeline?.receipts ?? []} />
        )}

        {/* ══════════ COMMUNICATION TAB ══════════ */}
        {activeTab === "Communication" && (
          <div className="px-6 py-5">
            <div className="mb-4">
              <QuickActionsPanel
                entityType="client"
                entityId={client.id}
                name={client.name}
                phone={client.phone}
                email={client.email}
              />
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Communication Log</h3>
              <button onClick={() => setCommOpen(true)}
                className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                <Plus size={12} /> Log Communication
              </button>
            </div>

            {comms.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No communications logged.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-0 bottom-0 w-px" style={{ background: "var(--border)" }} />
                <div className="space-y-4">
                  {comms.map((c, idx) => {
                    const color = COMM_COLORS[c.type] ?? "#94a3b8";
                    return (
                      <div key={c.id ?? idx} className="flex gap-4 relative">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold text-white"
                          style={{ background: color }}>
                          {c.type?.charAt(0).toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{c.subject ?? c.type}</span>
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
          </div>
        )}

        {/* ══════════ HISTORY TAB ══════════ */}
        {activeTab === "History" && (
          <div className="px-6 py-5">
            <RecordHistory module="crm" recordId={String(client.id)} />
          </div>
        )}
      </DetailBody>

      <ClientFormDialog open={editOpen} onClose={() => setEditOpen(false)} initial={client}
        onSaved={(c: any) => { setClient(c); setEditOpen(false); }} />
      <CommunicationForm open={commOpen} onClose={() => setCommOpen(false)} preselectedClient={client}
        onSaved={() => { setCommOpen(false); crmApi.getCommunications(client.tracking_id).then((r: any) => setComms(r)).catch(() => {}); }} />
    </DetailPage>
  );
}

/* ── Ledger Tab Sub-Component ─────────────────────────────────────────────── */

function LedgerTabView({ clientId, receipts }: { clientId: number; receipts: ReceiptVoucher[] }) {
  const [ledgerMode, setLedgerMode] = useState<"subsidiary" | "general">("subsidiary");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    import("../../lib/ledgerApi").then(({ ledgerApi }) => {
      ledgerApi.getClientLedger(clientId).then((data: any) => {
        setEntries(data.entries ?? data ?? []);
      }).catch(() => setEntries([]))
      .finally(() => setLoading(false));
    });
  }, [clientId]);

  return (
    <div className="px-6 py-5">
      {/* Toggle */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
            ledgerMode === "subsidiary"
              ? "text-white" : "text-muted hover:text-primary"
          }`}
          style={{
            background: ledgerMode === "subsidiary" ? "#3b82f6" : "var(--bg-surface)",
            border: ledgerMode === "subsidiary" ? "none" : "1px solid var(--border)",
          }}
          onClick={() => setLedgerMode("subsidiary")}
        >
          Subsidiary Ledger
        </button>
        <button
          type="button"
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
            ledgerMode === "general"
              ? "text-white" : "text-muted hover:text-primary"
          }`}
          style={{
            background: ledgerMode === "general" ? "#8b5cf6" : "var(--bg-surface)",
            border: ledgerMode === "general" ? "none" : "1px solid var(--border)",
          }}
          onClick={() => setLedgerMode("general")}
        >
          General Ledger
        </button>
      </div>

      {ledgerMode === "subsidiary" && (
        <>
          {/* Receipt Vouchers */}
          {receipts.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Receipt Vouchers ({receipts.length})
              </p>
              <div className="space-y-1.5">
                {receipts.slice(0, 20).map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg text-xs"
                    style={{ background: "var(--bg-base)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <Receipt size={12} style={{ color: "#10b981" }} />
                      <span className="font-mono font-medium shrink-0">{r.voucher_no}</span>
                      <span className="truncate min-w-0" style={{ color: "var(--text-secondary)" }}>{r.description}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-medium">{formatCurrency(r.amount)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                        r.payment_mode === "bank" || r.payment_mode === "cheque"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-green-500/10 text-green-400"
                      }`}>{r.payment_mode}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(r.payment_date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ledger Entries */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Client Ledger Entries
            </p>
            {loading ? (
              <div className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>Loading ledger…</div>
            ) : entries.length === 0 ? (
              <div className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>No ledger entries yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: "var(--text-muted)" }}>Description</th>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: "var(--text-muted)" }}>Ref</th>
                      <th className="text-right py-2 pr-3 font-medium" style={{ color: "var(--text-muted)" }}>Debit</th>
                      <th className="text-right py-2 pr-3 font-medium" style={{ color: "var(--text-muted)" }}>Credit</th>
                      <th className="text-right py-2 font-medium" style={{ color: "var(--text-muted)" }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(entries as any[]).map((e: any, idx: number) => (
                      <tr key={e.id ?? idx}
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-2 pr-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {new Date(e.entry_date ?? e.date ?? e.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3" style={{ color: "var(--text-primary)" }}>
                          {e.description}
                        </td>
                        <td className="py-2 pr-3 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {e.reference_no ?? e.tid ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-right font-medium" style={{ color: "#ef4444" }}>
                          {Number(e.debit) > 0 ? formatCurrency(e.debit) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right font-medium" style={{ color: "#10b981" }}>
                          {Number(e.credit) > 0 ? formatCurrency(e.credit) : "—"}
                        </td>
                        <td className="py-2 text-right font-semibold">
                          <span style={{
                            color: Number(e.running_balance ?? e.balance) >= 0 ? "var(--text-primary)" : "#ef4444"
                          }}>
                            {formatCurrency(e.running_balance ?? e.balance ?? 0)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {ledgerMode === "general" && (
        <div className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>
          General Ledger view — shows how this client's entries rolled into GL control accounts.
          <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--bg-base)" }}>
            <p className="font-medium mb-2">Account Postings Summary</p>
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
              Receipts are posted to: Cash/Bank (Dr) · Customer Advance / Fee Income / Sales Revenue (Cr)
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-secondary)" }}>
              Installment payments reduce: Cash/Bank (Dr) · Accounts Receivable (Cr)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
