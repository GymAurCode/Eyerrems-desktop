import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen, Plus, Clock, CheckCircle, XCircle, AlertCircle,
  TrendingUp, X, ChevronDown, RefreshCw, Calendar,
} from "lucide-react";
import { bookingApi, BookingListItem, BookingStats } from "../lib/bookingApi";
import { formatCurrency } from "../lib/currency";
import { RowActions, ActionsCell, printRecord } from "../components/actions";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending:           "#fbbf24",
  reserved:          "#60a5fa",
  confirmed:         "#34d399",
  cancelled:         "#f87171",
  expired:           "#94a3b8",
  converted_to_sale: "#a78bfa",
};

const STATUS_LABEL: Record<string, string> = {
  pending:           "Pending",
  reserved:          "Reserved",
  confirmed:         "Confirmed",
  cancelled:         "Cancelled",
  expired:           "Expired",
  converted_to_sale: "Converted",
};

function StatusBadge({ status, isExpired }: { status: string; isExpired?: boolean }) {
  const key = isExpired && status === "pending" ? "expired" : status;
  const color = STATUS_COLOR[key] ?? "#94a3b8";
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: `${color}18`, color }}
    >
      {STATUS_LABEL[key] ?? key}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: string; icon: React.ElementType; color: string;
}) {
  return (
    <div
      className="card-dark flex items-center gap-4 px-4 py-3"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
        <p className="text-base font-semibold text-primary truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Status update modal ───────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending:  ["reserved", "confirmed", "cancelled"],
  reserved: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
  expired:   [],
  converted_to_sale: [],
};

function StatusModal({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingListItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus]   = useState("");
  const [notes, setNotes]     = useState("");
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const transitions = ALLOWED_TRANSITIONS[booking.status] ?? [];

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
      onDone();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

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
          maxWidth: "min(420px, 90vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
          animation: "modalSlideUp 0.2s ease-out both",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2 className="text-sm font-semibold text-primary">Update Status</h2>
            <p className="text-xs text-muted mt-0.5">{booking.booking_id}</p>
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
              className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {transitions.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">
              No status transitions available for <strong>{booking.status}</strong>.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted uppercase tracking-wider font-semibold">New Status</label>
                <div className="relative">
                  <select
                    className="select-dark w-full px-3 py-2.5 text-sm appearance-none pr-8"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                  >
                    <option value="">Select status…</option>
                    {transitions.map(s => (
                      <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>

              {status === "cancelled" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted uppercase tracking-wider font-semibold">Cancellation Reason</label>
                  <input
                    className="input-dark w-full px-3 py-2.5 text-sm"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Reason for cancellation…"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted uppercase tracking-wider font-semibold">Notes (optional)</label>
                <textarea
                  className="input-dark w-full px-3 py-2.5 text-sm resize-none"
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional notes…"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {transitions.length > 0 && (
          <div
            className="flex items-center justify-end gap-3 px-5 py-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!status || saving}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
            >
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                : "Update Status"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Extend modal ──────────────────────────────────────────────────────────────

function ExtendModal({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingListItem;
  onClose: () => void;
  onDone: () => void;
}) {
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
      await bookingApi.extend(booking.id, d, notes || undefined);
      onDone();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to extend booking");
    } finally {
      setSaving(false); }
  };

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
          maxWidth: "min(380px, 90vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.45)",
          animation: "modalSlideUp 0.2s ease-out both",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2 className="text-sm font-semibold text-primary">Extend Booking</h2>
            <p className="text-xs text-muted mt-0.5">{booking.booking_id}</p>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "var(--text-secondary)" }}>
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted uppercase tracking-wider font-semibold">Additional Days (1–90)</label>
            <input
              type="number"
              min={1}
              max={90}
              className="input-dark w-full px-3 py-2.5 text-sm"
              value={days}
              onChange={e => setDays(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted uppercase tracking-wider font-semibold">Notes (optional)</label>
            <textarea
              className="input-dark w-full px-3 py-2.5 text-sm resize-none"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason for extension…"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
          >
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
              : "Extend"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["all", "pending", "reserved", "confirmed", "cancelled", "expired", "converted_to_sale"];

export default function BookingsPage() {
  const [bookings, setBookings]         = useState<BookingListItem[]>([]);
  const [stats, setStats]               = useState<BookingStats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusModal, setStatusModal]   = useState<BookingListItem | null>(null);
  const [extendModal, setExtendModal]   = useState<BookingListItem | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? { status: statusFilter } : undefined;
      const [bRes, sRes] = await Promise.all([
        bookingApi.list(params),
        bookingApi.stats(),
      ]);
      setBookings(bRes && Array.isArray(bRes.items) ? bRes.items : (Array.isArray(bRes) ? bRes : []));
      setStats(sRes.data ?? null);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = bookings.filter(b => {
    const q = search.toLowerCase();
    return (
      b.booking_id.toLowerCase().includes(q) ||
      (b.client_name ?? "").toLowerCase().includes(q) ||
      (b.property_name ?? "").toLowerCase().includes(q) ||
      (b.unit_number ?? "").toLowerCase().includes(q)
    );
  });

  const daysLabel = (b: BookingListItem) => {
    if (b.is_expired) return <span className="text-red-400 text-xs">Expired</span>;
    if (b.days_remaining === null) return <span className="text-muted text-xs">—</span>;
    if (b.days_remaining <= 1)
      return <span className="text-red-400 text-xs font-medium">&lt;1 day</span>;
    return <span className="text-xs text-secondary">{b.days_remaining}d left</span>;
  };

  const canExtend = (b: BookingListItem) =>
    ["pending", "reserved", "confirmed"].includes(b.status) && !b.is_expired;

  const canChangeStatus = (b: BookingListItem) =>
    (ALLOWED_TRANSITIONS[b.status] ?? []).length > 0;

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Bookings</h1>
          <p className="text-xs text-muted mt-0.5">Track property reservations and booking lifecycle</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface2)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Bookings"  value={String(stats.total_bookings)}                    icon={BookOpen}    color="bg-blue-500" />
          <StatCard label="Confirmed"       value={String(stats.confirmed_bookings)}                icon={CheckCircle} color="bg-green-500" />
          <StatCard label="Expiring Soon"   value={String(stats.expiring_soon)}                     icon={Clock}       color="bg-yellow-500" />
          <StatCard label="Booking Value"   value={formatCurrency(stats.total_booking_amount)}      icon={TrendingUp}  color="bg-purple-500" />
        </div>
      )}

      {/* Status summary pills */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          {[
            { key: "pending",           label: "Pending",    count: stats.pending_bookings,   color: "#fbbf24" },
            { key: "reserved",          label: "Reserved",   count: stats.reserved_bookings,  color: "#60a5fa" },
            { key: "confirmed",         label: "Confirmed",  count: stats.confirmed_bookings, color: "#34d399" },
            { key: "cancelled",         label: "Cancelled",  count: stats.cancelled_bookings, color: "#f87171" },
            { key: "expired",           label: "Expired",    count: stats.expired_bookings,   color: "#94a3b8" },
            { key: "converted_to_sale", label: "Converted",  count: stats.converted_bookings, color: "#a78bfa" },
          ].map(({ key, label, count, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all"
              style={{
                background: statusFilter === key ? `${color}22` : "var(--bg-surface2)",
                color: statusFilter === key ? color : "var(--text-muted)",
                border: `1px solid ${statusFilter === key ? color + "44" : "var(--border)"}`,
              }}
            >
              {label}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: `${color}22`, color }}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="input-dark px-3 py-2 text-sm"
          style={{ maxWidth: "280px" }}
          placeholder="Search by ID, client, property…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="relative">
          <select
            className="select-dark px-3 py-2 text-sm appearance-none pr-8"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTERS.map(s => (
              <option key={s} value={s}>
                {s === "all" ? "All Statuses" : STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={32} className="text-muted mx-auto mb-3" />
            <p className="text-secondary text-sm">No bookings found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Booking ID", "Client", "Property / Unit", "Booking Amt", "Expiry", "Status", "Actions"].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr
                    key={b.id}
                    className="transition-colors row-hover"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-blue-400 whitespace-nowrap">
                      {b.booking_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-primary font-medium text-xs">{b.client_name ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-secondary text-xs">
                        {b.property_name ?? "—"}
                        {b.unit_number && (
                          <span className="text-muted ml-1">· Unit {b.unit_number}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary text-xs whitespace-nowrap">
                      {formatCurrency(b.booking_amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-secondary flex items-center gap-1">
                          <Calendar size={10} className="text-muted" />
                          {new Date(b.expiry_date).toLocaleDateString()}
                        </span>
                        {daysLabel(b)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} isExpired={b.is_expired} />
                    </td>
                    <ActionsCell className="px-4 py-3">
                      <RowActions
                        row={b}
                        compact
                        actions={[
                          ...(canChangeStatus(b) ? [{ type: "edit" as const, label: "Status", handler: () => setStatusModal(b) }] : []),
                          ...(canExtend(b) ? [{ type: "custom" as const, label: "Extend", icon: Clock, handler: () => setExtendModal(b) }] : []),
                          { type: "print", handler: () => printRecord(`Booking ${b.booking_id}`, [
                            { label: "Client", value: b.client_name ?? "—" },
                            { label: "Amount", value: formatCurrency(b.booking_amount) },
                            { label: "Status", value: b.status },
                            { label: "Expiry", value: new Date(b.expiry_date).toLocaleDateString() },
                          ]) },
                        ]}
                      />
                    </ActionsCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {statusModal && (
        <StatusModal
          booking={statusModal}
          onClose={() => setStatusModal(null)}
          onDone={() => { setStatusModal(null); load(); }}
        />
      )}
      {extendModal && (
        <ExtendModal
          booking={extendModal}
          onClose={() => setExtendModal(null)}
          onDone={() => { setExtendModal(null); load(); }}
        />
      )}
    </div>
  );
}
