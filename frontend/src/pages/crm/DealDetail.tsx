import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2, Clock, AlertCircle, Building2,
  Edit2, Plus, CreditCard, DollarSign, Info, Calendar, Paperclip,
} from "lucide-react";
import { crmApi, Deal, InstallmentPlan, Installment } from "../../lib/crmApi";
import { propApi } from "../../lib/propertyApi";
import DealForm from "../../components/crm/DealForm";
import AttachmentPanel from "../../components/attachments/AttachmentPanel";
import RecordHistory from "../../components/RecordHistory";
import {
  DetailPage, DetailHeader, DetailBody, DetailSection,
  InfoGrid, DataTable, SummaryCards, StatusBadge, MonoId,
} from "../../components/detail";
import { useLookup } from "../../hooks/useLookup";

const INST_STATUS: Record<string, { icon: React.ReactNode; color: string }> = {
  paid:    { icon: <CheckCircle2 size={13} />, color: "#10b981" },
  partial: { icon: <Clock size={13} />,        color: "#3b82f6" },
  pending: { icon: <Clock size={13} />,        color: "#f59e0b" },
  overdue: { icon: <AlertCircle size={13} />,  color: "#ef4444" },
};

// ── Pay Dialog ────────────────────────────────────────────────────────────────
function PayDialog({ inst, onClose, onPaid }: { inst: Installment; onClose: () => void; onPaid: () => void }) {
  const { options: PAYMENT_METHOD_OPTS } = useLookup('payment_method');
  const [method, setMethod] = useState("bank");
  const [amount, setAmount] = useState(String(Number(inst.amount) - Number(inst.paid_amount)));
  const [ref, setRef]       = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const submit = async () => {
    setSaving(true); setErr("");
    try {
      await crmApi.payInstallment(inst.id, { installment_id: inst.id, method, amount: Number(amount), reference_number: ref || null });
      onPaid();
    } catch (e: any) { setErr(e?.response?.data?.detail ?? "Payment failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm space-y-4"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <h3 className="text-sm font-semibold text-primary">Pay Installment #{inst.id}</h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Due: {inst.due_date} · Total: {Number(inst.amount).toLocaleString()} · Paid: {Number(inst.paid_amount).toLocaleString()}
        </p>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Method</label>
          <select className="select-dark w-full px-3 py-2 text-sm" value={method}
            onChange={e => setMethod(e.target.value)}>
            {PAYMENT_METHOD_OPTS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Amount</label>
          <input className="input-dark w-full px-3 py-2 text-sm" type="number" value={amount}
            onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Reference (optional)</label>
          <input className="input-dark w-full px-3 py-2 text-sm" value={ref}
            onChange={e => setRef(e.target.value)} placeholder="Cheque / TXN no." />
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm rounded-lg"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={submit} disabled={saving || !amount}
            className="flex-1 btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deal, setDeal]         = useState<Deal | null>(null);
  const [plan, setPlan]         = useState<InstallmentPlan | null>(null);
  const [schedule, setSchedule] = useState<Installment[]>([]);
  const [floors, setFloors]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [payInst, setPayInst]   = useState<Installment | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dRes] = await Promise.all([crmApi.getDeal(Number(id))]);
      const dData = dRes && 'data' in dRes ? (dRes as any).data : dRes;
      setDeal(dData);
      if (dData?.property_id) {
        try {
          const fRes = await propApi.getFloors(dData.property_id);
          const fData = fRes && 'data' in fRes ? (fRes as any).data : fRes;
          setFloors(Array.isArray(fData) ? fData : []);
        } catch {
          setFloors([]);
        }
      }
      try {
        const pRes = await crmApi.getInstallmentPlan(Number(id));
        const pData = pRes && 'data' in pRes ? (pRes as any).data : pRes;
        setPlan(pData || null);
      } catch {
        setPlan(null);
      }
      try {
        const sRes = await crmApi.getInstallmentSchedule(Number(id));
        const sData = sRes && 'data' in sRes ? (sRes as any).data : sRes;
        setSchedule(Array.isArray(sData) ? sData : []);
      } catch {
        setSchedule([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const toggleDP = async () => {
    if (!deal) return;
    const res = await crmApi.updateDeal(deal.id, { down_payment_status: deal.down_payment_status === "paid" ? "pending" : "paid" });
    const data = res && 'data' in res ? (res as any).data : res;
    setDeal(data);
  };

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>Loading…</div>;
  if (!deal)   return <div className="p-8 text-sm" style={{ color: "var(--text-secondary)" }}>Deal not found.</div>;

  const paidCount    = schedule.filter(i => i.status === "paid").length;
  const totalCount   = schedule.length;
  const overdueCount = schedule.filter(i => i.status === "overdue").length;
  const hasPlan      = !!plan;
  const dpDone       = deal.down_payment_status === "paid";
  const totalPaid    = schedule.reduce((s, i) => s + Number(i.paid_amount), 0);
  const remaining    = plan ? Number(plan.remaining_amount) - totalPaid : 0;

  return (
    <DetailPage>
      {payInst && (
        <PayDialog inst={payInst} onClose={() => setPayInst(null)}
          onPaid={async () => { setPayInst(null); await load(); }} />
      )}

      <DetailHeader
        backTo="/crm"
        title={deal.deal_title ?? deal.deal_id}
        badge={<StatusBadge status={deal.status} />}
        meta={[
          { label: "Tracking", value: <MonoId value={deal.tracking_id} /> },
          { label: "ID",       value: <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{deal.deal_id}</span> },
          { label: "Client",   value: deal.client_name ?? "—" },
        ]}
        actions={[{ label: "Edit", icon: Edit2, onClick: () => setEditOpen(true) }]}
      />

      <DetailBody>
        {/* ── Section 1: Deal Info ── */}
        <DetailSection title="Deal Information" icon={Info}>
          <InfoGrid items={[
            { label: "Client",       value: deal.client_name ?? "—" },
            { label: "Client Role",  value: deal.client_role ?? "—" },
            { label: "Dealer",       value: deal.dealer_name ?? "—" },
            { label: "Property",     value: deal.property_name ?? "—" },
            { label: "Deal Value",   value: <span className="font-semibold">{Number(deal.deal_value).toLocaleString()}</span> },
            { label: "Down Payment", value: deal.down_payment ? Number(deal.down_payment).toLocaleString() : "—" },
            { label: "DP Status",    value: <StatusBadge status={deal.down_payment_status} /> },
            { label: "Deal Date",    value: deal.deal_date ?? "—" },
            { label: "Due Date",     value: deal.due_date ?? "—" },
            { label: "Status",       value: <StatusBadge status={deal.status} /> },
          ]} />
          {deal.description && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Description</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{deal.description}</p>
            </div>
          )}
        </DetailSection>

        {/* ── Section 2: Finance Summary ── */}
        {hasPlan && (
          <DetailSection title="Payment Summary" icon={DollarSign}>
            <SummaryCards cards={[
              { label: "Total Amount",  value: Number(plan!.total_amount).toLocaleString(),  color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
              { label: "Down Payment",  value: Number(plan!.down_payment).toLocaleString(),  color: "#10b981", bg: "rgba(16,185,129,0.08)" },
              { label: "Total Paid",    value: totalPaid.toLocaleString(),                   color: "#10b981", bg: "rgba(16,185,129,0.08)" },
              { label: "Remaining",     value: remaining > 0 ? remaining.toLocaleString() : "0", color: remaining > 0 ? "#f59e0b" : "#10b981", bg: remaining > 0 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)" },
            ]} />
            {totalCount > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{paidCount} of {totalCount} installments paid</span>
                  {overdueCount > 0 && <span style={{ color: "#ef4444" }}>{overdueCount} overdue</span>}
                  <span>{Math.round((paidCount / totalCount) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-surface2)" }}>
                  <div className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${(paidCount / totalCount) * 100}%` }} />
                </div>
              </div>
            )}
          </DetailSection>
        )}

        {/* ── Section 3: Down Payment ── */}
        <DetailSection title="Down Payment" icon={CheckCircle2}>
          <div className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-sm font-semibold text-primary">
                {deal.down_payment ? Number(deal.down_payment).toLocaleString() : "Not specified"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Down payment amount</p>
            </div>
            <button onClick={toggleDP}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dpDone ? "" : "btn-primary"}`}
              style={dpDone ? { background: "rgba(16,185,129,0.12)", color: "#10b981" } : {}}>
              {dpDone ? <><CheckCircle2 size={14} /> Paid</> : "Mark as Paid"}
            </button>
          </div>
        </DetailSection>

        {/* ── Section 4: Installment Plan ── */}
        <DetailSection title="Installment Plan" icon={Calendar}>
          {hasPlan ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm" style={{ color: "#10b981" }}>
                <CheckCircle2 size={14} /> Plan active · {totalCount} installments generated
              </div>
              {totalCount === 0 && (
                <button
                  onClick={() => navigate(`/crm/deals/${deal.id}/installment-plan`)}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                  <Plus size={13} /> Create Payment Plan
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No installment plan yet. Create one to generate a payment schedule.
              </p>
              <button
                onClick={() => navigate(`/crm/deals/${deal.id}/installment-plan`)}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                <Plus size={13} /> Create Payment Plan
              </button>
            </div>
          )}
        </DetailSection>

        {/* ── Section 5: Schedule ── */}
        <DetailSection title="Payment Schedule" icon={Calendar} noPad>
          {totalCount === 0 ? (
            <div className="px-6 py-5 text-xs" style={{ color: "var(--text-muted)" }}>No schedule generated yet.</div>
          ) : (
            <DataTable
              columns={[
                { key: "num",    label: "#" },
                { key: "due",    label: "Due Date" },
                { key: "type",   label: "Type" },
                { key: "amount", label: "Amount", align: "right" },
                { key: "paid",   label: "Paid",   align: "right" },
                { key: "status", label: "Status", align: "center" },
                { key: "action", label: "",       align: "right" },
              ]}
              rows={schedule.map((inst, idx) => {
                const s = INST_STATUS[inst.status] ?? INST_STATUS.pending;
                const isPaid = inst.status === "paid";
                return {
                  num:    <span style={{ color: "var(--text-muted)" }}>{idx + 1}</span>,
                  due:    <span className="font-mono text-xs">{inst.due_date}</span>,
                  type:   <span className="capitalize" style={{ color: "var(--text-muted)" }}>{inst.type}</span>,
                  amount: <span className="font-semibold">{Number(inst.amount).toLocaleString()}</span>,
                  paid:   <span style={{ color: "var(--text-muted)" }}>{Number(inst.paid_amount).toLocaleString()}</span>,
                  status: <span className="flex items-center justify-center gap-1 text-xs font-medium" style={{ color: s.color }}>{s.icon} {inst.status}</span>,
                  action: !isPaid ? (
                    <button onClick={() => setPayInst(inst)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg btn-primary">
                      <CreditCard size={11} /> Pay
                    </button>
                  ) : null,
                };
              })}
            />
          )}
        </DetailSection>

        {/* ── Section 6: Property Structure ── */}
        {floors.length > 0 && (
          <DetailSection title="Property Structure" icon={Building2}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {floors.flatMap((floor: any) =>
                floor.units?.map((unit: any) => (
                  <div key={unit.id}
                    className="px-3 py-2 rounded-lg text-xs text-center font-medium"
                    style={deal.unit_id === unit.id
                      ? { background: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }
                      : { background: "var(--bg-surface2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    F{floor.floor_number} · {unit.unit_number}
                  </div>
                ))
              )}
            </div>
          </DetailSection>
        )}

        {/* ── Section 7: Attachments ── */}
        <DetailSection title="Attachments" icon={Paperclip}>
          <AttachmentPanel module="deal" recordId={deal.id} />
        </DetailSection>

        {/* ── Section 8: History ── */}
        <DetailSection title="History" icon={Clock}>
          <RecordHistory module="crm" recordId={String(deal.id)} />
        </DetailSection>
      </DetailBody>

      <DealForm open={editOpen} onClose={() => setEditOpen(false)}
        initial={deal} onSaved={(d) => { setDeal(d); setEditOpen(false); }} />
    </DetailPage>
  );
}
