import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Plus, Clock, CheckCircle2, AlertCircle,
  TrendingUp, RefreshCw, Calendar, Search, Filter,
  ArrowRight, User, Building2, Timer,
} from "lucide-react";
import { bookingApi, BookingListItem, BookingStats } from "../../../lib/bookingApi";
import { formatCurrency } from "../../../lib/currency";
import BookingCreateModal from "./BookingCreateModal";

// ── Status config ─────────────────────────────────────────────────────────────

export const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending:           "#fbbf24",
  reserved:          "#60a5fa",
  confirmed:         "#34d399",
  cancelled:         "#f87171",
  expired:           "#94a3b8",
  converted_to_sale: "#a78bfa",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending:           "Pending",
  reserved:          "Reserved",
  confirmed:         "Confirmed",
  cancelled:         "Cancelled",
  expired:           "Expired",
  converted_to_sale: "Converted",
};

export function BookingStatusBadge({
  status,
  isExpired,
  size = "sm",
}: {
  status: string;
  isExpired?: boolean;
  size?: "xs" | "sm";
}) {
  const key = isExpired && status === "pending" ? "expired" : status;
  const color = BOOKING_STATUS_COLOR[key] ?? "#94a3b8";
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full whitespace-nowrap ${
        size === "xs" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
      style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}
    >
      <span
        className="rounded-full shrink-0"
        style={{ width: 5, height: 5, background: color }}
      />
      {BOOKING_STATUS_LABEL[key] ?? key}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color, active, onClick,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-dark flex items-center gap-3 px-4 py-3 text-left transition-all w-full"
      style={{
        border: `1px solid ${active ? color + "55" : "var(--border)"}`,
        background: active ? `${color}0d` : undefined,
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}22` }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">{label}</p>
        <p className="text-base font-bold text-primary truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted">{sub}</p>}
      </div>
    </button>
  );
}

// ── Days remaining chip ───────────────────────────────────────────────────────

function ExpiryChip({ b }: { b: BookingListItem }) {
  if (["cancelled", "expired", "converted_to_sale"].includes(b.status)) {
    return <span className="text-xs text-muted">—</span>;
  }
  if (b.is_expired) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
        style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
        Expired
      </span>
    );
  }
  if (b.days_remaining === null) return <span className="text-xs text-muted">—</span>;
  const urgent = b.days_remaining <= 2;
  const warn   = b.days_remaining <= 7;
  const color  = urgent ? "#f87171" : warn ? "#fbbf24" : "#94a3b8";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted flex items-center gap-1">
        <Calendar size={9} />
        {new Date(b.expiry_date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
      </span>
      <span className="text-[10px] font-semibold" style={{ color }}>
        {b.days_remaining === 0 ? "< 1 day" : `${b.days_remaining}d left`}
      </span>
    </div>
  );
}

// ── Assignment chips ──────────────────────────────────────────────────────────

function AssignChip({ name, role }: { name: string; role: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}
    >
      <User size={9} />
      {name}
      <span className="opacity-60">· {role}</span>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  "all", "pending", "reserved", "confirmed", "cancelled", "expired", "converted_to_sale",
] as const;

export default function BookingList() {
  const navigate = useNavigate();
  const [bookings, setBookings]       = useState<BookingListItem[]>([]);
  const [stats, setStats]             = useState<BookingStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatus]     = useState("all");
  const [showCreate, setShowCreate]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? { status: statusFilter } : undefined;
      const [bRes, sRes] = await Promise.all([
        bookingApi.list(params),
        bookingApi.stats(),
      ]);
      setBookings(Array.isArray(bRes.data) ? bRes.data : []);
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
      (b.unit_number ?? "").toLowerCase().includes(q) ||
      (b.dealer_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 animate-slide-up">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Bookings</h2>
          <p className="text-xs text-muted mt-0.5">
            Property reservations · {stats?.total_bookings ?? 0} total
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus size={14} /> New Booking
          </button>
        </div>
      </div>

      {/* ── Stats grid ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total" value={stats.total_bookings}
            icon={BookOpen} color="#60a5fa"
            active={statusFilter === "all"} onClick={() => setStatus("all")}
          />
          <StatCard
            label="Confirmed" value={stats.confirmed_bookings}
            sub={`+ ${stats.reserved_bookings} reserved`}
            icon={CheckCircle2} color="#34d399"
            active={statusFilter === "confirmed"} onClick={() => setStatus("confirmed")}
          />
          <StatCard
            label="Expiring Soon" value={stats.expiring_soon}
            sub="within 24 hours"
            icon={Timer} color="#fbbf24"
          />
          <StatCard
            label="Booking Value" value={formatCurrency(stats.total_booking_amount)}
            icon={TrendingUp} color="#a78bfa"
          />
        </div>
      )}

      {/* ── Status filter pills ── */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          {[
            { key: "pending",           count: stats.pending_bookings },
            { key: "reserved",          count: stats.reserved_bookings },
            { key: "confirmed",         count: stats.confirmed_bookings },
            { key: "cancelled",         count: stats.cancelled_bookings },
            { key: "expired",           count: stats.expired_bookings },
            { key: "converted_to_sale", count: stats.converted_bookings },
          ].map(({ key, count }) => {
            const color = BOOKING_STATUS_COLOR[key];
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(active ? "all" : key)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                style={{
                  background: active ? `${color}1a` : "var(--bg-surface2)",
                  color: active ? color : "var(--text-muted)",
                  border: `1px solid ${active ? color + "44" : "var(--border)"}`,
                }}
              >
                {BOOKING_STATUS_LABEL[key]}
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center"
                  style={{ background: `${color}22`, color }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            className="input-dark pl-8 pr-3 py-2 text-sm"
            style={{ minWidth: 240 }}
            placeholder="Search ID, client, property…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Filter size={11} />
          <span>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {loading ? (
          <div className="p-16 text-center">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted mt-3">Loading bookings…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <BookOpen size={36} className="text-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm text-secondary font-medium">No bookings found</p>
            <p className="text-xs text-muted mt-1">
              {search ? "Try a different search term" : "Create your first booking to get started"}
            </p>
            {!search && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="btn-primary mt-4 px-4 py-2 text-sm inline-flex items-center gap-2"
              >
                <Plus size={13} /> New Booking
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
                  {["Booking ID", "Client", "Property / Unit", "Assigned To", "Amount", "Expiry", "Status", ""].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider whitespace-nowrap"
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
                    {/* Booking ID */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-blue-400 font-semibold">{b.booking_id}</span>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}
                        >
                          {(b.client_name ?? "?")[0].toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-primary">{b.client_name ?? "—"}</span>
                      </div>
                    </td>

                    {/* Property / Unit */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={11} className="text-muted shrink-0" />
                        <div>
                          <p className="text-xs text-secondary">{b.property_name ?? "—"}</p>
                          {b.unit_number && (
                            <p className="text-[10px] text-muted">Unit {b.unit_number}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Assigned To */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        {b.dealer_name && <AssignChip name={b.dealer_name} role="Dealer" />}
                        {b.staff_name  && <AssignChip name={b.staff_name}  role="Staff" />}
                        {!b.dealer_name && !b.staff_name && (
                          <span className="text-xs text-muted">Unassigned</span>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-semibold text-primary">{formatCurrency(b.booking_amount)}</p>
                      <p className="text-[10px] text-muted">of {formatCurrency(b.property_price)}</p>
                    </td>

                    {/* Expiry */}
                    <td className="px-4 py-3.5">
                      <ExpiryChip b={b} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <BookingStatusBadge status={b.status} isExpired={b.is_expired} />
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/crm/bookings/${b.id}`)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color: "#60a5fa" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.1)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        View <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <BookingCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
