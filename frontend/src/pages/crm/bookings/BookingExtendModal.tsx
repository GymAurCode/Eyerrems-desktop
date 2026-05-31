import { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, Timer } from "lucide-react";
import AttachmentsButton from "../../../components/attachments/AttachmentsButton";
import { bookingApi } from "../../../lib/bookingApi";

type Props = {
  bookingId: number;
  bookingRef: string;
  onClose: () => void;
  onDone: () => void;
};

export default function BookingExtendModal({ bookingId, bookingRef, onClose, onDone }: Props) {
  const [days, setDays]     = useState("7");
  const [notes, setNotes]   = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const handleSave = async () => {
    const d = Number(days);
    if (!d || d < 1 || d > 90) { setError("Days must be between 1 and 90"); return; }
    setSaving(true);
    setError("");
    try {
      await bookingApi.extend(bookingId, d, notes || undefined);
      onDone();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to extend booking");
    } finally {
      setSaving(false);
    }
  };

  const newExpiry = days
    ? new Date(Date.now() + Number(days) * 86400000).toLocaleDateString("en-PK", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 0.18s ease-out both" }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: "min(400px, 90vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
          animation: "modalSlideUp 0.2s ease-out both",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(251,191,36,0.15)" }}
            >
              <Timer size={15} style={{ color: "#fbbf24" }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary">Extend Booking</h2>
              <p className="text-[10px] text-muted">{bookingRef}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Additional Days (1–90)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              className="input-dark w-full px-3 py-2.5 text-sm"
              value={days}
              onChange={e => setDays(e.target.value)}
            />
          </div>

          {newExpiry && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}
            >
              <Timer size={13} style={{ color: "#fbbf24" }} />
              <div>
                <p className="text-[10px] text-muted">New expiry date (approx.)</p>
                <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>{newExpiry}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Reason / Notes (optional)
            </label>
            <textarea
              className="input-dark w-full px-3 py-2.5 text-sm resize-none"
              rows={2}
              placeholder="Reason for extension…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <AttachmentsButton module="booking" recordId={bookingId} />
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl disabled:opacity-40 transition-all"
            style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}
          >
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" /> Extending…</>
              : <><Timer size={13} /> Extend Booking</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
