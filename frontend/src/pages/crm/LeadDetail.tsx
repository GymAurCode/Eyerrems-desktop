import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserCheck, Info, Zap, Clock, Paperclip } from "lucide-react";
import Modal from "../../components/Modal";
import RecordHistory from "../../components/RecordHistory";
import { crmApi, Lead } from "../../lib/crmApi";
import {
  DetailPage, DetailHeader, DetailBody, DetailSection,
  InfoGrid, StatusBadge, MonoId,
} from "../../components/detail";
import QuickActionsPanel from "../../components/crm/QuickActionsPanel";
import AttachmentPanel from "../../components/attachments/AttachmentPanel";

const TABS = ["Overview", "Quick Actions", "History"] as const;
type Tab = typeof TABS[number];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead]       = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [convertModal, setConvertModal] = useState(false);

  const [cName, setCName]   = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cNotes, setCNotes] = useState("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await crmApi.getLead(Number(id));
      setLead(res.data);
      setCName(res.data.name);
      setCPhone(res.data.phone ?? "");
      setCEmail(res.data.email ?? "");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  const doConvert = async (e: FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    const res = await crmApi.convertLead(lead.id, {
      lead_id: lead.id, name: cName, phone: cPhone, email: cEmail, notes: cNotes,
    });
    setConvertModal(false);
    navigate(`/crm/clients/${res.data.id}`);
  };

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>Loading…</div>;
  if (!lead)   return <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>Lead not found.</div>;

  return (
    <DetailPage>
      <DetailHeader
        backTo="/crm"
        title={lead.name}
        badge={<StatusBadge status={lead.status} />}
        meta={[{ label: "ID", value: <MonoId value={lead.lead_id} /> }]}
        actions={
          lead.is_converted
            ? [{ label: "Converted", onClick: () => {}, variant: "default" }]
            : [{ label: "Convert to Client", icon: UserCheck, onClick: () => setConvertModal(true), variant: "primary" }]
        }
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

        {/* ── Overview Tab ── */}
        {activeTab === "Overview" && (
          <DetailSection title="Lead Information" icon={Info}>
            <InfoGrid items={[
              { label: "Lead ID",  value: <MonoId value={lead.lead_id} /> },
              { label: "Status",   value: <StatusBadge status={lead.status} /> },
              { label: "Phone",    value: lead.phone ?? "—" },
              { label: "Email",    value: lead.email ?? "—" },
              { label: "Source",   value: lead.source ?? "—" },
              { label: "Converted", value: lead.is_converted ? "Yes" : "No" },
              { label: "Created",  value: new Date(lead.created_at).toLocaleDateString() },
            ]} />
            {lead.notes && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Notes</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{lead.notes}</p>
              </div>
            )}
          </DetailSection>
        )}

        {/* ── Quick Actions Tab ── */}
        {activeTab === "Quick Actions" && (
          <div className="px-6 py-5">
            <QuickActionsPanel
              entityType="lead"
              entityId={lead.id}
              name={lead.name}
              phone={lead.phone}
              email={lead.email}
            />
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === "History" && (
          <div className="px-6 py-5">
            <RecordHistory module="crm" recordId={String(lead.id)} />
          </div>
        )}

        {/* ── Attachments ── */}
        <div className="px-6 py-5">
          <AttachmentPanel module="lead" recordId={lead.id} />
        </div>
      </DetailBody>

      <Modal open={convertModal} onClose={() => setConvertModal(false)} title="Convert Lead to Client">
        <form onSubmit={doConvert} className="space-y-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            A new <span style={{ color: "#60a5fa" }}>LD-CLI-XXXX</span> client ID and tracking ID will be generated.
          </p>
          <input className="input-dark w-full px-4 py-3 text-sm" value={cName}
            onChange={(e) => setCName(e.target.value)} placeholder="Name *" required />
          <input className="input-dark w-full px-4 py-3 text-sm" value={cPhone}
            onChange={(e) => setCPhone(e.target.value)} placeholder="Phone" />
          <input className="input-dark w-full px-4 py-3 text-sm" value={cEmail}
            onChange={(e) => setCEmail(e.target.value)} placeholder="Email" />
          <textarea className="input-dark w-full px-4 py-3 text-sm resize-none" rows={3}
            value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="Notes" />
          <button className="btn-primary w-full py-3 text-sm" type="submit">Convert to Client</button>
        </form>
      </Modal>
    </DetailPage>
  );
}
