import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  X, AlertCircle, ArrowRightCircle, CheckCircle2,
  Building2, User, DollarSign, Calendar,
} from "lucide-react";
import { bookingApi, BookingDetail } from "../../../lib/bookingApi";
import { formatCurrency } from "../../../lib/currency";

type Props = {
  booking: BookingDetail;
  onClose: () => void;
  onDone: () => void;
};

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs font-semibold text-primary">{value}</span>
    </div>
  );
}

export default function BookingConvertModal({ booking, onClose, onDone }: Props) {
  const navigate  = useNavigate();
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const totalPayable = booking.total_payable
    ?? (Number(booking.final_price ?? booking.property_price)
        + Number(booking.processing_fee ?? 0)
        + Number(booking.possession_charges ?? 0)
        + Number(booking.development_charges ?? 0));

  const remaining = totalPayable - Number(booking.down_payment ?? 0);

  const handleConvert = async () => {
    setSaving(true);
    setError("");
    try {
      await bookingApi.convertToSale(booking.id);
      setSuccess(true);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to convert booking. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleGoToPayments = () => {
    onDone();
    // Navigate to the booking detail — the payment plan section is there
    navigate(`/crm/bookings/${booking.id}`);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 0.18s ease-out both" }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        onClick={success ? handleGoToPayments : onClose}
      />
      <div
        className="relative w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: "min(500px, 92vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "18px",
          boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
          animation: "modalSlideUp 0.22s ease-out both",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(167,139,250,0.15)" }}
            >
              <ArrowRightCircle size={15} style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary">Convert to Sale</h2>
              <p className="text-[10px] text-muted font-mono">{booking.booking_id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={success ? handleGoToPayments : onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--border)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-5 space-y-4">
          {success ? (
            /* ── Success state ── */
            <div className="text-center py-4 space-y-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "rgba(52,211,153,0.15)" }}
              >
                <CheckCircle2 size={32} style={{ color: "#34d399" }} />
              </div>
              <div>
                <p className="text-base font-bold text-primary">Sale Confirmed!</p>
                <p className="text-xs text-muted mt-1">
                  Booking <span className="font-mono text-blue-400">{booking.booking_id}</span> has been converted.
                  The unit is now marked as <span className="text-green-400 font-semibold">Sold</span>.
                </p>
              </div>

              {/* Next step hint */}
              <div
                className="px-4 py-3 rounded-xl text-left space-y-1"
                style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}
              >
                <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>Next Step</p>
                <p className="text-[11px] text-muted">
                  Set up the installment payment plan to start tracking payments.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoToPayments}
                className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
              >
                <DollarSign size={14} /> Go to Payment Plan
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
                  style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              {/* Warning banner */}
              <div
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}
              >
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>
                  This action is <strong>irreversible</strong>. The booking will be marked as completed
                  and the unit will be locked as sold.
                </span>
              </div>

              {/* Booking summary — read-only, no re-entry */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: "1px solid var(--border)" }}
              >
                <div
                  className="px-3 py-2 flex items-center gap-2"
                  style={{ background: "var(--bg-surface2)", borderBottom: "1px solid var(--border)" }}
                >
                  <Building2 size={12} className="text-muted" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Sale Summary</span>
                </div>
                <div className="px-3 py-1">
                  <SummaryRow label="Client"         value={booking.client_name ?? "—"} />
                  <SummaryRow
                    label="Property"
                    value={
                      booking.property_name
                        ? `${booking.property_name}${booking.unit_number ? ` · Unit ${booking.unit_number}` : ""}`
                        : "—"
                    }
                  />
                  <SummaryRow label="Final Price"    value={formatCurrency(booking.final_price ?? booking.property_price)} />
                  {Number(booking.discount ?? 0) > 0 && (
                    <SummaryRow label="Discount"     value={<span style={{ color: "#34d399" }}>- {formatCurrency(booking.discount)}</span>} />
                  )}
                  {Number(booking.processing_fee ?? 0) > 0 && (
                    <SummaryRow label="Processing Fee" value={formatCurrency(booking.processing_fee)} />
                  )}
                  {Number(booking.possession_charges ?? 0) > 0 && (
                    <SummaryRow label="Possession"   value={formatCurrency(booking.possession_charges)} />
                  )}
                  {Number(booking.development_charges ?? 0) > 0 && (
                    <SummaryRow label="Development"  value={formatCurrency(booking.development_charges)} />
                  )}
                  <SummaryRow
                    label="Total Payable"
                    value={<span className="text-blue-400 font-bold">{formatCurrency(totalPayable)}</span>}
                  />
                  <SummaryRow
                    label="Down Payment"
                    value={
                      <span style={{ color: Number(booking.down_payment) > 0 ? "#34d399" : "var(--text-muted)" }}>
                        {formatCurrency(booking.down_payment)}
                        {booking.down_payment_status === "paid" && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>
                            Paid
                          </span>
                        )}
                      </span>
                    }
                  />
                  <SummaryRow
                    label="Remaining (Installments)"
                    value={<span className="text-purple-400 font-bold">{formatCurrency(remaining)}</span>}
                  />
                </div>
              </div>

              {/* Assignment */}
              {(booking.dealer_name || booking.nominee_name) && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <div
                    className="px-3 py-2 flex items-center gap-2"
                    style={{ background: "var(--bg-surface2)", borderBottom: "1px solid var(--border)" }}
                  >
                    <User size={12} className="text-muted" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Assignment</span>
                  </div>
                  <div className="px-3 py-1">
                    {booking.dealer_name && <SummaryRow label="Dealer"  value={booking.dealer_name} />}
                    {booking.nominee_name && <SummaryRow label="Nominee" value={booking.nominee_name} />}
                  </div>
                </div>
              )}

              {/* Booking date */}
              <div className="flex items-center gap-2 text-xs text-muted">
                <Calendar size={11} />
                <span>
                  Booked on {new Date(booking.booking_date).toLocaleDateString("en-PK", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {!success && (
          <div
            className="flex items-center justify-end gap-3 px-5 py-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConvert}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl disabled:opacity-40 transition-all"
              style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)" }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.25)"; }}
              onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.15)"; }}
            >
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> Converting…</>
                : <><ArrowRightCircle size={14} /> Confirm Sale</>}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
