import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowLeft, CheckCircle2, Clock, XCircle, ArrowRightCircle,
  User, Building2, Calendar, DollarSign, FileText, AlertCircle,
  RefreshCw, ChevronRight, Timer, Paperclip, MoreHorizontal,
  Plus, CreditCard, TrendingUp, X,
} from "lucide-react";
import { bookingApi, BookingDetail as BookingDetailType, BookingLog, InstallmentPlan, InstallmentItem } from "../../../lib/bookingApi";
import { formatCurrency } from "../../../lib/currency";
import { BookingStatusBadge, BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL } from "./BookingList";
import AttachmentPanel from "../../../components/attachments/AttachmentPanel";
import RecordHistory from "../../../components/RecordHistory";
import BookingExtendModal from "./BookingExtendModal";
import BookingConvertModal from "./BookingConvertModal";

// ── Status tracker ────────────────────────────────────────────────────────────

const LIFECYCLE = [
  { key: "pending",   label: "Pending",   icon: Clock },
  { key: "reserved",  label: "Reserved",  icon: CheckCircle2 },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "active",    label: "Active",    icon: CheckCircle2 },
  { key: "completed", label: "Sold",      icon: ArrowRightCircle },
] as const;

const TERMINAL = ["cancelled", "expired", "refunded"];

function StatusTracker({ status }: { status: string }) {
  if (TERMINAL.includes(status)) {
    const color = BOOKING_STATUS_COLOR[status];
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: `${color}0d`, border: `1px solid ${color}33` }}
      >
        <XCircle size={16} style={{ color }} />
        <div>
          <p className="text-xs font-semibold" style={{ color }}>
            Booking {BOOKING_STATUS_LABEL[status]}
          </p>
          <p className="text-[10px] text-muted">This booking is no longer active.</p>
        </div>
      </div>
    );
  }

  const currentIdx = LIFECYCLE.findIndex(s => s.key === status);

  return (
    <div className="flex items-center gap-0">
      {LIFECYCLE.map((step, idx) => {
        const done    = idx < currentIdx;
        const current = idx === currentIdx;
        const future  = idx > currentIdx;
        const color   = done || current ? BOOKING_STATUS_COLOR[step.key] ?? "#60a5fa" : undefined;
        const Icon    = step.icon;

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: done
                    ? "#34d39922"
                    : current
                    ? `${color}22`
                    : "var(--bg-surface2)",
                  border: done
                    ? "2px solid #34d399"
                    : current
                    ? `2px solid ${color}`
                    : "2px solid var(--border)",
                }}
              >
                <Icon
                  size={14}
                  style={{
                    color: done ? "#34d399" : current ? color : "var(--text-muted)",
                  }}
                />
              </div>
              <span
                className="text-[10px] font-semibold text-center leading-tight"
                style={{
                  color: done ? "#34d399" : current ? color : "var(--text-muted)",
                }}
              >
                {step.label}
              </span>
            </div>
            {idx < LIFECYCLE.length - 1 && (
              <div
                className="h-0.5 flex-1 mx-1 mb-5 rounded-full transition-all"
                style={{
                  background: done ? "#34d39966" : "var(--border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline log ──────────────────────────────────────────────────────────────

const LOG_ICON: Record<string, React.ElementType> = {
  created:        CheckCircle2,
  status_changed: ArrowRightCircle,
  extended:       Timer,
  assigned:       User,
  updated:        FileText,
  cancelled:      XCircle,
  converted:      ArrowRightCircle,
};

const LOG_COLOR: Record<string, string> = {
  created:        "#34d399",
  status_changed: "#60a5fa",
  extended:       "#fbbf24",
  assigned:       "#a78bfa",
  updated:        "#94a3b8",
  cancelled:      "#f87171",
  converted:      "#a78bfa",
};

function TimelineEntry({ log, isLast }: { log: BookingLog; isLast: boolean }) {
  const Icon  = LOG_ICON[log.action] ?? FileText;
  const color = LOG_COLOR[log.action] ?? "#94a3b8";

  return (
    <div className="flex gap-3">
      {/* Line + dot */}
      <div className="flex flex-col items-center">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${color}1a`, border: `1px solid ${color}33` }}
        >
          <Icon size={12} style={{ color }} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-1" style={{ background: "var(--border-subtle)", minHeight: 20 }} />
        )}
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-primary capitalize">
              {log.action.replace(/_/g, " ")}
            </p>
            {(log.old_value || log.new_value) && (
              <p className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
                {log.old_value && <span className="line-through">{log.old_value}</span>}
                {log.old_value && log.new_value && <ChevronRight size={9} />}
                {log.new_value && <span className="font-semibold" style={{ color }}>{log.new_value}</span>}
              </p>
            )}
            {log.notes && (
              <p className="text-[10px] text-muted mt-0.5 italic">"{log.notes}"</p>
            )}
            {log.performed_by_name && (
              <p className="text-[10px] text-muted mt-0.5">by {log.performed_by_name}</p>
            )}
          </div>
          <span className="text-[10px] text-muted whitespace-nowrap shrink-0">
            {new Date(log.created_at).toLocaleString("en-PK", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-start justify-between py-2.5 gap-4"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <span className="text-xs text-muted shrink-0 w-32">{label}</span>
      <span className="text-xs font-medium text-primary text-right flex-1">{value ?? "—"}</span>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({
  title, icon: Icon, children, action,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "var(--bg-surface2)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-muted" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{title}</span>
        </div>
        {action}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({
  label, color, onClick, disabled, icon: Icon,
}: {
  label: string; color: string; onClick: () => void; disabled?: boolean; icon: React.ElementType;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
      style={{
        background: `${color}15`,
        color,
        border: `1px solid ${color}33`,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = `${color}25`; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = `${color}15`; }}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

// ── Status update inline ──────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending:   ["reserved", "confirmed", "cancelled"],
  reserved:  ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
};

function QuickStatusUpdate({
  booking,
  onDone,
}: {
  booking: BookingDetailType;
  onDone: () => void;
}) {
  const [status, setStatus]   = useState("");
  const [notes, setNotes]     = useState("");
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [open, setOpen]       = useState(false);

  const transitions = ALLOWED_TRANSITIONS[booking.status] ?? [];
  if (transitions.length === 0) return null;

  const handleSave = async () => {
    if (!status) return;
    setSaving(true);
    setError("");
    try {
      await bookingApi.updateStatus(booking.id, {
        status,
        notes: notes || undefined,
        cancellation_reason: status === "cancelled" ? reason || undefined : undefined,
      });
      setOpen(false);
      onDone();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.2)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.12)"; }}
      >
        <MoreHorizontal size={14} /> Update Status
      </button>
    );
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}
    >
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">New Status</label>
          <select
            className="select-dark w-full px-3 py-2 text-sm"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">Select…</option>
            {transitions.map(s => (
              <option key={s} value={s}>{BOOKING_STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Notes</label>
          <input
            className="input-dark w-full px-3 py-2 text-sm"
            placeholder="Optional…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>
      {status === "cancelled" && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Cancellation Reason</label>
          <input
            className="input-dark w-full px-3 py-2 text-sm"
            placeholder="Reason for cancellation…"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!status || saving}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
        >
          {saving
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
            : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setStatus(""); setNotes(""); setReason(""); }}
          className="text-sm px-3 py-2 rounded-lg text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [booking, setBooking]     = useState<BookingDetailType | null>(null);
  const [loading, setLoading]     = useState(true);
  const [showExtend, setExtend]   = useState(false);
  const [showConvert, setConvert] = useState(false);
  const [showPlanForm, setPlanForm] = useState(false);
  const [payingInst, setPayingInst] = useState<InstallmentItem | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await bookingApi.get(Number(id));
      setBooking(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm text-muted">Loading booking…</span>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={32} className="text-muted mx-auto mb-3" />
        <p className="text-sm text-secondary">Booking not found.</p>
        <button
          type="button"
          onClick={() => navigate("/crm")}
          className="mt-3 text-xs text-blue-400 hover:underline"
        >
          Back to CRM
        </button>
      </div>
    );
  }

  const canExtend  = ["pending", "reserved", "confirmed"].includes(booking.status) && !booking.is_expired;
  const canConvert = ["confirmed", "active"].includes(booking.status);
  const isTerminal = ["cancelled", "expired", "completed"].includes(booking.status);

  return (
    <div className="p-6 space-y-5 animate-slide-up max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate("/crm")}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-primary">{booking.booking_id}</h1>
                <BookingStatusBadge status={booking.status} isExpired={booking.is_expired} />
                {booking.is_expired && booking.status !== "expired" && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}
                  >
                    Expired
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-muted">
                  Client: <span className="text-secondary font-medium">{booking.client_name ?? "—"}</span>
                </span>
                <span className="text-xs text-muted">
                  Created: <span className="text-secondary">{new Date(booking.created_at).toLocaleDateString("en-PK")}</span>
                </span>
                {booking.days_remaining !== null && !isTerminal && (
                  <span
                    className="text-xs font-semibold"
                    style={{ color: (booking.days_remaining ?? 99) <= 2 ? "#f87171" : "#fbbf24" }}
                  >
                    {booking.days_remaining === 0 ? "< 1 day left" : `${booking.days_remaining} days left`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Status tracker ── */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-4">Booking Lifecycle</p>
        <StatusTracker status={booking.status} />
      </div>

      {/* ── Actions ── */}
      {!isTerminal && (
        <div
          className="rounded-xl px-5 py-4 space-y-3"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Actions</p>
          <div className="flex flex-wrap gap-2">
            <QuickStatusUpdate booking={booking} onDone={load} />
            {canExtend && (
              <ActionBtn
                label="Extend Booking"
                color="#fbbf24"
                icon={Timer}
                onClick={() => setExtend(true)}
              />
            )}
            {canConvert && (
              <ActionBtn
                label="Convert to Sale"
                color="#a78bfa"
                icon={ArrowRightCircle}
                onClick={() => setConvert(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left col — details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Property snapshot */}
          <Section title="Property Details" icon={Building2}>
            <InfoRow label="Property"    value={booking.property_name} />
            <InfoRow label="Unit"        value={booking.unit_number ? `Unit ${booking.unit_number}` : "Full Property"} />
            <InfoRow label="Property Price" value={formatCurrency(booking.property_price)} />
            <InfoRow label="Booking Amount" value={
              <span className="font-bold text-green-400">{formatCurrency(booking.booking_amount)}</span>
            } />
          </Section>

          {/* Assigned people */}
          <Section title="Assignment" icon={User}>
            <InfoRow label="Dealer"      value={booking.dealer_name} />
            <InfoRow label="Staff"       value={booking.staff_name} />
            <InfoRow label="Nominee"     value={booking.nominee_name} />
            <InfoRow label="Nominee Phone" value={booking.nominee_phone} />
            <InfoRow label="Nominee CNIC"  value={booking.nominee_cnic} />
          </Section>

          {/* Notes */}
          {(booking.notes || booking.cancellation_reason) && (
            <Section title="Notes" icon={FileText}>
              {booking.notes && (
                <p className="text-xs text-secondary leading-relaxed">{booking.notes}</p>
              )}
              {booking.cancellation_reason && (
                <div
                  className="mt-3 px-3 py-2.5 rounded-xl text-xs"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <strong>Cancellation reason:</strong> {booking.cancellation_reason}
                </div>
              )}
            </Section>
          )}

          {/* Attachments */}
          <Section title="Attachments" icon={Paperclip}>
            <AttachmentPanel module="booking" recordId={booking.id} />
          </Section>

          {/* History */}
          <Section title="History" icon={Clock}>
            <RecordHistory module="crm" recordId={String(booking.id)} />
          </Section>
        </div>

        {/* Right col — timeline + dates */}
        <div className="space-y-5">
          {/* Key dates */}
          <Section title="Key Dates" icon={Calendar}>
            <InfoRow label="Booked On"   value={new Date(booking.booking_date).toLocaleDateString("en-PK")} />
            <InfoRow label="Expires On"  value={
              <span style={{ color: booking.is_expired ? "#f87171" : undefined }}>
                {new Date(booking.expiry_date).toLocaleDateString("en-PK")}
              </span>
            } />
            <InfoRow label="Holding Days" value={`${booking.holding_days} days`} />
            {booking.confirmed_at && (
              <InfoRow label="Confirmed"  value={new Date(booking.confirmed_at).toLocaleDateString("en-PK")} />
            )}
            {booking.cancelled_at && (
              <InfoRow label="Cancelled"  value={new Date(booking.cancelled_at).toLocaleDateString("en-PK")} />
            )}
            {booking.converted_at && (
              <InfoRow label="Converted"  value={new Date(booking.converted_at).toLocaleDateString("en-PK")} />
            )}
          </Section>

          {/* Client info */}
          <Section title="Client" icon={User}>
            <InfoRow label="Name"  value={booking.client_name} />
            <InfoRow label="Phone" value={booking.client_phone} />
          </Section>

          {/* Timeline */}
          <Section title="Activity Timeline" icon={Clock}>
            {booking.logs.length === 0 ? (
              <p className="text-xs text-muted">No activity yet.</p>
            ) : (
              <div>
                {booking.logs.map((log, i) => (
                  <TimelineEntry
                    key={log.id}
                    log={log}
                    isLast={i === booking.logs.length - 1}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ── Payment Plan section (shown when booking is completed or has a plan) ── */}
      {(booking.status === "completed" || booking.installment_plan) && (
        <PaymentPlanSection
          booking={booking}
          onPlanCreated={load}
          showPlanForm={showPlanForm}
          setShowPlanForm={setPlanForm}
          payingInst={payingInst}
          setPayingInst={setPayingInst}
          onPaymentDone={load}
        />
      )}

      {/* ── Modals ── */}
      {showExtend && (
        <BookingExtendModal
          bookingId={booking.id}
          bookingRef={booking.booking_id}
          onClose={() => setExtend(false)}
          onDone={() => { setExtend(false); load(); }}
        />
      )}
      {showConvert && (
        <BookingConvertModal
          booking={booking}
          onClose={() => setConvert(false)}
          onDone={() => { setConvert(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Payment Plan Section ──────────────────────────────────────────────────────

const INST_STATUS_COLOR: Record<string, string> = {
  pending: "#fbbf24",
  partial: "#60a5fa",
  paid:    "#34d399",
  overdue: "#f87171",
};

function PaymentPlanSection({
  booking, onPlanCreated, showPlanForm, setShowPlanForm,
  payingInst, setPayingInst, onPaymentDone,
}: {
  booking: BookingDetailType;
  onPlanCreated: () => void;
  showPlanForm: boolean;
  setShowPlanForm: (v: boolean) => void;
  payingInst: InstallmentItem | null;
  setPayingInst: (v: InstallmentItem | null) => void;
  onPaymentDone: () => void;
}) {
  const plan = booking.installment_plan;
  const totalPaid = plan
    ? plan.installments.reduce((s, i) => s + i.paid_amount, 0)
    : 0;
  const paidCount = plan ? plan.installments.filter(i => i.status === "paid").length : 0;
  const overdueCount = plan ? plan.installments.filter(i => i.status === "overdue").length : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-purple-400" />
          <h2 className="text-sm font-bold text-primary">Payment Plan</h2>
        </div>
        {!plan && (
          <button
            type="button"
            onClick={() => setShowPlanForm(true)}
            className="btn-primary flex items-center gap-2 px-3 py-2 text-xs"
          >
            <Plus size={12} /> Create Plan
          </button>
        )}
      </div>

      {!plan ? (
        /* No plan yet */
        <div
          className="rounded-xl px-5 py-8 text-center"
          style={{ border: "2px dashed var(--border)" }}
        >
          <DollarSign size={28} className="text-muted mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium text-secondary">No payment plan yet</p>
          <p className="text-xs text-muted mt-1">Create an installment plan to start tracking payments.</p>
          <button
            type="button"
            onClick={() => setShowPlanForm(true)}
            className="btn-primary mt-4 px-4 py-2 text-sm inline-flex items-center gap-2"
          >
            <Plus size={13} /> Create Installment Plan
          </button>
        </div>
      ) : (
        <>
          {/* Plan summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total",    value: plan.total_amount,    color: "#60a5fa" },
              { label: "Paid",     value: totalPaid,            color: "#34d399" },
              { label: "Remaining", value: plan.remaining_amount - totalPaid, color: "#a78bfa" },
              { label: "Down Pmt", value: plan.down_payment,   color: "#fbbf24" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl px-3 py-3"
                style={{ background: `${color}0d`, border: `1px solid ${color}22` }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
                <p className="text-sm font-bold" style={{ color }}>
                  {new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(Number(value))}
                </p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {plan.total_count && plan.total_count > 0 && (
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted">{paidCount} of {plan.total_count} installments paid</span>
                <div className="flex items-center gap-3">
                  {overdueCount > 0 && (
                    <span style={{ color: "#f87171" }}>{overdueCount} overdue</span>
                  )}
                  <span className="text-muted">{Math.round((paidCount / plan.total_count) * 100)}%</span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-surface2)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(paidCount / plan.total_count) * 100}%`,
                    background: "linear-gradient(90deg, #34d399, #60a5fa)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Installment table */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ background: "var(--bg-surface2)", borderBottom: "1px solid var(--border)" }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Installment Schedule
              </span>
              <span className="text-[10px] text-muted">{plan.frequency} · {plan.total_count} installments</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["#", "Due Date", "Amount", "Paid", "Remaining", "Status", ""].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.installments.map((inst, idx) => {
                    const color = INST_STATUS_COLOR[inst.status] ?? "#94a3b8";
                    const canPay = inst.status !== "paid";
                    return (
                      <tr
                        key={inst.id}
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        className="transition-colors row-hover"
                      >
                        <td className="px-3 py-2.5 text-muted">{inst.installment_number ?? idx + 1}</td>
                        <td className="px-3 py-2.5 font-mono text-secondary whitespace-nowrap">
                          {new Date(inst.due_date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">
                          {Number(inst.amount).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-secondary whitespace-nowrap">
                          {Number(inst.paid_amount).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: inst.remaining > 0 ? "#a78bfa" : "#34d399" }}>
                          {Number(inst.remaining).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize"
                            style={{ background: `${color}1a`, color }}
                          >
                            {inst.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {canPay && (
                            <button
                              type="button"
                              onClick={() => setPayingInst(inst)}
                              className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg transition-colors"
                              style={{ color: "#34d399" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.1)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            >
                              <CreditCard size={10} /> Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Create plan form modal */}
      {showPlanForm && (
        <CreatePlanModal
          booking={booking}
          onClose={() => setShowPlanForm(false)}
          onCreated={() => { setShowPlanForm(false); onPlanCreated(); }}
        />
      )}

      {/* Pay installment modal */}
      {payingInst && (
        <PayInstallmentModal
          booking={booking}
          installment={payingInst}
          onClose={() => setPayingInst(null)}
          onPaid={() => { setPayingInst(null); onPaymentDone(); }}
        />
      )}
    </div>
  );
}

// ── Create Plan Modal ─────────────────────────────────────────────────────────

function CreatePlanModal({
  booking, onClose, onCreated,
}: {
  booking: BookingDetailType;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "half_yearly" | "yearly">("monthly");
  const [count, setCount]         = useState("12");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });
  const [dueDay, setDueDay]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const totalPayable = booking.total_payable
    ?? Number(booking.final_price ?? booking.property_price);
  const remaining = totalPayable - Number(booking.down_payment ?? 0);
  const perInst = count && Number(count) > 0
    ? Math.ceil(remaining / Number(count))
    : 0;

  const handleCreate = async () => {
    const c = Number(count);
    if (!c || c < 1) { setError("Count must be at least 1"); return; }
    if (!startDate) { setError("Start date is required"); return; }
    setSaving(true);
    setError("");
    try {
      await bookingApi.createInstallmentPlan(booking.id, {
        frequency,
        count: c,
        start_date: startDate,
        due_day: dueDay ? Number(dueDay) : undefined,
      });
      onCreated();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to create plan");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 0.18s ease-out both" }}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <div className="relative w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: "min(460px, 92vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
          animation: "modalSlideUp 0.2s ease-out both",
        }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-sm font-bold text-primary">Create Installment Plan</h2>
            <p className="text-[10px] text-muted mt-0.5">Remaining: <span className="text-purple-400 font-semibold">{remaining.toLocaleString()}</span></p>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "var(--text-secondary)" }}>
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Frequency</label>
              <select className="select-dark w-full px-3 py-2.5 text-sm" value={frequency}
                onChange={e => setFrequency(e.target.value as any)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half_yearly">Half Yearly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">No. of Installments</label>
              <input type="number" min={1} max={600} className="input-dark w-full px-3 py-2.5 text-sm"
                value={count} onChange={e => setCount(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">First Due Date</label>
              <input type="date" className="input-dark w-full px-3 py-2.5 text-sm"
                value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Due Day (1–28, optional)</label>
              <input type="number" min={1} max={28} className="input-dark w-full px-3 py-2.5 text-sm"
                placeholder="e.g. 5" value={dueDay} onChange={e => setDueDay(e.target.value)} />
            </div>
          </div>

          {perInst > 0 && (
            <div className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8" }}>
              <TrendingUp size={13} />
              Approx. <strong>{perInst.toLocaleString()}</strong> per installment
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-lg"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button type="button" onClick={handleCreate} disabled={saving}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
              : <><Plus size={13} /> Generate Plan</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Pay Installment Modal ─────────────────────────────────────────────────────

function PayInstallmentModal({
  booking, installment, onClose, onPaid,
}: {
  booking: BookingDetailType;
  installment: InstallmentItem;
  onClose: () => void;
  onPaid: () => void;
}) {
  const remaining = installment.remaining;
  const [method, setMethod]   = useState<"cash" | "bank" | "cheque" | "online">("bank");
  const [amount, setAmount]   = useState(String(remaining));
  const [ref, setRef]         = useState("");
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const handlePay = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > remaining) { setError(`Cannot exceed remaining balance (${remaining.toLocaleString()})`); return; }
    setSaving(true);
    setError("");
    try {
      await bookingApi.payInstallment(booking.id, installment.id, {
        installment_id:   installment.id,
        method,
        amount:           amt,
        reference_number: ref || undefined,
        notes:            notes || undefined,
      });
      onPaid();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 0.18s ease-out both" }}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <div className="relative w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: "min(400px, 92vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
          animation: "modalSlideUp 0.2s ease-out both",
        }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-sm font-bold text-primary">Record Payment</h2>
            <p className="text-[10px] text-muted mt-0.5">
              Installment #{installment.installment_number} · Due {new Date(installment.due_date).toLocaleDateString("en-PK")} · Balance {remaining.toLocaleString()}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "var(--text-secondary)" }}>
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Method</label>
            <div className="grid grid-cols-4 gap-2">
              {(["bank", "cash", "cheque", "online"] as const).map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className="py-2 rounded-lg text-xs font-semibold capitalize transition-all"
                  style={method === m
                    ? { background: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.4)" }
                    : { background: "var(--bg-surface2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Amount</label>
            <input type="number" className="input-dark w-full px-3 py-2.5 text-sm"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Reference (optional)</label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" value={ref}
              onChange={e => setRef(e.target.value)} placeholder="Cheque / TXN no." />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Notes (optional)</label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" value={notes}
              onChange={e => setNotes(e.target.value)} placeholder="Any notes…" />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm rounded-xl"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button type="button" onClick={handlePay} disabled={saving || !amount}
            className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
              : <><CreditCard size={13} /> Confirm Payment</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
