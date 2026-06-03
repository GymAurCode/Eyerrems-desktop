import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building, DollarSign, Users, Briefcase, Phone, Mail, CreditCard, MapPin, FileText, ChevronRight } from "lucide-react";
import { crmApi, Dealer, DealerDetail, Deal } from "../../lib/crmApi";
import {
  DetailPage, DetailHeader, DetailBody, DetailSection,
  InfoGrid, DataTable, StatusBadge, MonoId,
} from "../../components/detail";
import { MODULE_COLORS } from "../../config/moduleColors";

const COLORS = MODULE_COLORS.crm ?? { primary: "#3b82f6", secondary: "#1d4ed8", accent: "#60a5fa" };

export default function DealerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DealerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    const entityId: string | number = id.startsWith("DEA-") ? id : Number(id);
    crmApi.getDealerDetail(entityId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DetailPage>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </DetailPage>
    );
  }

  if (!data) {
    return (
      <DetailPage>
        <p className="text-sm text-red-400 text-center py-10">Dealer not found.</p>
      </DetailPage>
    );
  }

  const { dealer } = data;

  return (
    <DetailPage>
      <DetailHeader
        backTo="/crm"
        title={dealer.name}
        subtitle={`${dealer.dealer_id}${dealer.company ? ` · ${dealer.company}` : ""}`}
        badge={<StatusBadge status={dealer.is_active ? "active" : "inactive"} />}
        meta={[
          { label: "Created", value: new Date(dealer.created_at).toLocaleDateString() },
          { label: "Commission", value: dealer.commission_rate
            ? `${dealer.commission_rate}${dealer.commission_type === "percentage" ? "%" : " (fixed)"}`
            : "—" },
        ]}
      />

      <DetailBody>
        {/* ── Card A: Profile Summary ── */}
        <DetailSection title="Profile Summary" icon={Building}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Details */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Contact Details
              </h4>
              <InfoGrid items={[
                { label: "Phone", value: dealer.phone ? (
                  <a href={`tel:${dealer.phone}`} className="hover:underline" style={{ color: COLORS.accent }}>{dealer.phone}</a>
                ) : "—" },
                { label: "Email", value: dealer.email ? (
                  <a href={`mailto:${dealer.email}`} className="hover:underline" style={{ color: COLORS.accent }}>{dealer.email}</a>
                ) : "—" },
                { label: "CNIC", value: dealer.cnic ?? "—" },
                { label: "Company", value: dealer.company ?? "—" },
                { label: "Address", value: dealer.address ?? "—" },
              ]} />
            </div>

            {/* Commission & Status */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Commission & Status
              </h4>
              <InfoGrid items={[
                { label: "Commission Type", value: dealer.commission_type === "percentage" ? "Percentage (%)" : "Fixed Amount" },
                { label: "Commission Rate", value: dealer.commission_rate
                  ? `${dealer.commission_rate}${dealer.commission_type === "percentage" ? "%" : " PKR"}`
                  : "Not set" },
                { label: "Status", value: <StatusBadge status={dealer.is_active ? "active" : "inactive"} /> },
              ]} />

              {/* Contract Attachments */}
              <h4 className="text-[10px] font-bold uppercase tracking-widest mt-5 mb-3" style={{ color: "var(--text-muted)" }}>
                Contract Attachments
              </h4>
              {dealer.attachments?.length > 0 ? (
                <div className="space-y-1">
                  {dealer.attachments.map((att) => (
                    <a key={att.id} href={`/uploads/${att.file_path}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-xs py-1.5 transition-colors"
                      style={{ color: COLORS.accent }}
                    >
                      <FileText size={12} />
                      {att.filename}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No contract attachments.</p>
              )}

              {/* Internal Notes */}
              {dealer.notes && (
                <>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest mt-5 mb-2" style={{ color: "var(--text-muted)" }}>
                    Internal Notes
                  </h4>
                  <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                    {dealer.notes}
                  </p>
                </>
              )}
            </div>
          </div>
        </DetailSection>

        {/* ── Card B: Performance Analytics ── */}
        <DetailSection title="Performance Analytics" icon={DollarSign}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Total Sales Value", value: data.total_sales_value, color: "#10b981", bg: "rgba(16,185,129,0.08)", icon: DollarSign },
              { label: "Total Commission Earned", value: data.total_commission_earned, color: "#3b82f6", bg: "rgba(59,130,246,0.08)", icon: CreditCard },
              { label: "Pending Commission Payout", value: data.pending_commission_payout, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: Clock },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl px-5 py-5 transition-all hover:scale-[1.01]"
                style={{ background: card.bg, border: `1px solid ${card.color}25` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: card.color }}>
                    {card.label}
                  </p>
                  <card.icon size={16} style={{ color: `${card.color}80` }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: card.color }}>
                  {Number(card.value).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </DetailSection>

        {/* ── Card C: Assigned Network ── */}
        <DetailSection title="Assigned Network" icon={Users}>
          {/* Clients Table */}
          <div className="mb-6">
            <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Clients ({data.assigned_clients.length})
            </h4>
            <DataTable
              columns={[
                { key: "client_id", label: "Client ID" },
                { key: "tracking_id", label: "Tracking ID" },
                { key: "name", label: "Name" },
                { key: "phone", label: "Phone" },
                { key: "status", label: "Status" },
              ]}
              rows={data.assigned_clients.map((c) => ({
                client_id: <MonoId value={c.client_id} />,
                tracking_id: <MonoId value={c.tracking_id} />,
                name: c.name,
                phone: c.phone ?? "—",
                status: <StatusBadge status={c.status} />,
                _id: c.id,
              }))}
              onRowClick={(row) => navigate(`/crm/clients/${row._id}`)}
              emptyText="No clients assigned to this dealer."
            />
          </div>

          {/* Deals Table */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Active Deals ({data.active_deals.length})
            </h4>
            <DataTable
              columns={[
                { key: "deal_id", label: "Deal ID" },
                { key: "tracking_id", label: "Tracking ID" },
                { key: "title", label: "Title" },
                { key: "client", label: "Client" },
                { key: "value", label: "Value", align: "right" },
                { key: "status", label: "Status" },
              ]}
              rows={data.active_deals.map((d) => ({
                deal_id: <MonoId value={d.deal_id} />,
                tracking_id: <MonoId value={d.tracking_id} />,
                title: d.deal_title ?? "—",
                client: d.client_name ?? "—",
                value: <span className="font-medium">{Number(d.deal_value).toLocaleString()}</span>,
                status: <StatusBadge status={d.status} />,
                _id: d.id,
              }))}
              onRowClick={(row) => navigate(`/crm/deals/${row._id}`)}
              emptyText="No deals linked to this dealer."
            />
          </div>
        </DetailSection>
      </DetailBody>
    </DetailPage>
  );
}

function Clock(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
