import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Plus, Clock, CheckCircle2, AlertCircle,
  TrendingUp, RefreshCw, Calendar, Search, Filter,
  ArrowRight, User, Building2, Timer, Eye, Printer, FileText,
} from "lucide-react";
import ReportModal from "../../../components/reports/ReportModal";
import { api } from "../../../lib/api";
import { bookingApi, BookingListItem, BookingStats } from "../../../lib/bookingApi";
import { formatCurrency } from "../../../lib/currency";
import BookingFormDialog from "../../../components/crm/BookingFormDialog";
import AppTable from "../../../components/data-table/AppTable";
import { printRecord } from "../../../components/actions";

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
        {new Date(b.expiry_date || b.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
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

export default function BookingList() {
  const navigate = useNavigate();
  const [bookings, setBookings]       = useState<BookingListItem[]>([]);
  const [stats, setStats]             = useState<BookingStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [statusFilter, setStatus]     = useState("all");
  const [showCreate, setShowCreate]   = useState(false);

  // Report modal state
  const [reportModal, setReportModal] = useState<{
    open: boolean;
    reportType: string;
    filters: Record<string, unknown>;
    title?: string;
  }>({ open: false, reportType: "", filters: {} });

  // AppTable State
  const [params, setParams] = useState({
    page: 1,
    pageSize: 10,
    search: "",
    filter: "",
    startDate: "",
    endDate: "",
  });
  const [total, setTotal] = useState(0);

  const load = async (p: typeof params) => {
    setLoading(true);
    setError(null);
    try {
      const sanitized: Record<string, any> = {
        limit: p.pageSize,
        offset: (p.page - 1) * p.pageSize,
        status: statusFilter !== "all" ? statusFilter : undefined,
      };
      if (p.search) sanitized.search = p.search;
      if (p.filter) sanitized.filter = p.filter;
      if (p.startDate) sanitized.startDate = p.startDate;
      if (p.endDate) sanitized.endDate = p.endDate;

      const [bRes, sRes] = await Promise.all([
        api.get<any>("/crm/bookings", { params: sanitized }),
        bookingApi.stats(),
      ]);
      setBookings(bRes.data.items || []);
      setTotal(bRes.data.total ?? 0);
      setStats(sRes ?? null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load bookings");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(params);
  }, [params, statusFilter]);

  const handlePageChange = (config: { page: number; pageSize: number }) => {
    setParams((prev) => ({ ...prev, ...config }));
  };

  const handleFilterChange = (filters: {
    search: string;
    filter: string;
    startDate: string;
    endDate: string;
  }) => {
    setParams((prev) => ({ ...prev, ...filters, page: 1 }));
  };

  const refresh = () => {
    void load(params);
  };

  const bookingColumns = [
    { key: "booking_id", label: "Booking ID", sortable: true, className: "font-mono text-xs text-blue-400 font-semibold" },
    {
      key: "client_name",
      label: "Client",
      sortable: true,
      render: (val: string, row: BookingListItem) => (
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}
          >
            {(row.client_name ?? "?")[0].toUpperCase()}
          </div>
          <span className="text-xs font-medium text-primary">{row.client_name ?? "—"}</span>
        </div>
      )
    },
    {
      key: "property_name",
      label: "Property / Unit",
      sortable: true,
      render: (val: string, row: BookingListItem) => (
        <div className="flex items-center gap-1.5">
          <Building2 size={11} className="text-muted shrink-0" />
          <div>
            <p className="text-xs text-secondary">{row.property_name ?? "—"}</p>
            {row.unit_number && (
              <p className="text-[10px] text-muted">Unit {row.unit_number}</p>
            )}
          </div>
        </div>
      )
    },
    {
      key: "assigned_to",
      label: "Assigned To",
      render: (val: any, row: BookingListItem) => (
        <div className="flex flex-col gap-1">
          {row.dealer_name && <AssignChip name={row.dealer_name} role="Dealer" />}
          {row.staff_name  && <AssignChip name={row.staff_name}  role="Staff" />}
          {!row.dealer_name && !row.staff_name && (
            <span className="text-xs text-muted">Unassigned</span>
          )}
        </div>
      )
    },
    {
      key: "booking_amount",
      label: "Amount",
      sortable: true,
      render: (val: number, row: BookingListItem) => (
        <div>
          <p className="text-xs font-semibold text-primary">{formatCurrency(row.booking_amount)}</p>
          <p className="text-[10px] text-muted">of {formatCurrency(row.property_price)}</p>
        </div>
      )
    },
    {
      key: "expiry_date",
      label: "Expiry",
      sortable: true,
      render: (val: string, row: BookingListItem) => <ExpiryChip b={row} />
    },
    {
      key: "status",
      label: "Status",
      render: (val: string, row: BookingListItem) => <BookingStatusBadge status={row.status} isExpired={row.is_expired} />
    }
  ];

  const bookingActions = [
    {
      key: "view",
      label: "View",
      icon: Eye,
      onClick: (row: BookingListItem) => navigate(`/crm/bookings/${row.id}`),
    },
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: BookingListItem) => printRecord(`Booking ${row.booking_id}`, [
        { label: "Client", value: row.client_name ?? "—" },
        { label: "Property", value: row.property_name ?? "—" },
        { label: "Amount", value: formatCurrency(row.booking_amount) },
        { label: "Status", value: row.status },
        { label: "Expiry", value: new Date(row.expiry_date).toLocaleDateString() },
      ]),
    },
    {
      key: "booking_form",
      label: "Print Booking Form",
      icon: FileText,
      onClick: (row: BookingListItem) => setReportModal({ open: true, reportType: "booking_form", filters: { booking_id: row.id }, title: "Print Booking Form" }),
      variant: "secondary",
    },
    {
      key: "token_receipt",
      label: "Token Receipt",
      icon: FileText,
      onClick: (row: BookingListItem) => setReportModal({ open: true, reportType: "token_receipt", filters: { booking_id: row.id }, title: "Token Receipt" }),
      variant: "secondary",
    },
    {
      key: "installment_schedule",
      label: "Instalment Schedule",
      icon: FileText,
      onClick: (row: BookingListItem) => setReportModal({ open: true, reportType: "installment_schedule", filters: { booking_id: row.id }, title: "Instalment Schedule" }),
      variant: "secondary",
      hidden: (row: BookingListItem) => !row.has_plan,
    },
  ];

  const toolbarActions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={refresh}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border border-theme bg-transparent text-secondary hover:bg-hover"
      >
        <RefreshCw size={12} />
        <span>Refresh</span>
      </button>
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        className="btn-primary flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-md"
      >
        <Plus size={13} />
        <span>New Booking</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-5 animate-slide-up">
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
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center ml-1"
                  style={{ background: `${color}22`, color }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Main AppTable ── */}
      <AppTable
        storageKey="rems_crm_bookings_table"
        title="Bookings"
        subtitle="Manage and track financial commitments and property holding reservations"
        data={bookings}
        columns={bookingColumns}
        rowActions={bookingActions}
        loading={loading}
        error={error}
        onRetry={refresh}
        toolbarActions={toolbarActions}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total: total,
        }}
        onPageChange={handlePageChange}
        onFilterChange={handleFilterChange}
        showDateFilter={true}
        showStatusFilter={false}
      />

      {/* ── Create modal ── */}
      <BookingFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => { setShowCreate(false); refresh(); }}
      />

      {/* Report Modal */}
      <ReportModal
        open={reportModal.open}
        onClose={() => setReportModal({ open: false, reportType: "", filters: {} })}
        reportType={reportModal.reportType}
        filters={reportModal.filters}
        title={reportModal.title}
      />
    </div>
  );
}
