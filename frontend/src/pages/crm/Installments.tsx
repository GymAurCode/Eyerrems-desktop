import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, Clock, AlertCircle, Calendar, Printer, FileText } from "lucide-react";
import DataTable from '../../components/data-table/DataTable';
import ReportModal from "../../components/reports/ReportModal";
import { crmApi, Installment } from "../../lib/crmApi";

type DisplayStatus = "paid" | "due_today" | "overdue" | "upcoming";

const DISPLAY_CONFIG: Record<DisplayStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  paid:      { label: "Paid",      color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: CheckCircle2 },
  due_today: { label: "Due Today", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: Calendar },
  overdue:   { label: "Overdue",   color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: AlertCircle },
  upcoming:  { label: "Upcoming",  color: "#94a3b8", bg: "rgba(148,163,184,0.12)", icon: Clock },
};

function computeDisplayStatus(inst: Installment): DisplayStatus {
  if (inst.status === "paid" || inst.status === "partial") return "paid";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(inst.due_date + "T00:00:00");
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due_today";
  return "upcoming";
}

function StatusBadge({ inst }: { inst: Installment }) {
  const ds = computeDisplayStatus(inst);
  const cfg = DISPLAY_CONFIG[ds];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

export default function Installments() {
  const [items, setItems] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | DisplayStatus>("all");

  // Report modal state
  const [reportModal, setReportModal] = useState<{
    open: boolean;
    reportType: string;
    filters: Record<string, unknown>;
    title?: string;
  }>({ open: false, reportType: "", filters: {} });

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getInstallmentSchedule();
      setItems(Array.isArray(res) ? res : []);
    } catch { setItems([]); } finally { setLoading(false); }
  };

  useEffect(() => { void fetch(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(i => computeDisplayStatus(i) === filter);
  }, [items, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {filtered.length} installment{filtered.length !== 1 ? "s" : ""}
            {filter !== "all" && ` (${filter.replace("_", " ")})`}
          </p>
        </div>
        <select
          className="px-3 py-1.5 text-xs rounded-xl"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          value={filter}
          onChange={e => setFilter(e.target.value as typeof filter)}
        >
          <option value="all">All Status</option>
          <option value="upcoming">Upcoming</option>
          <option value="due_today">Due Today</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <DataTable
        data={filtered}
        loading={loading}
        searchable={false}
        extraActions={[]}
        columns={[
          {
            key: 'id',
            label: 'INS-ID',
            width: 90,
            render: (value: number) => (
              <span className="font-mono text-xs" style={{ color: "#60a5fa" }}>INS-{String(value).padStart(4, "0")}</span>
            ),
          },
          {
            key: 'client_name',
            label: 'Client',
            render: (value: string) => (
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{value ?? "—"}</span>
            ),
          },
          {
            key: 'deal_ref',
            label: 'Deal Ref',
            width: 120,
            render: (value: string) => (
              <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{value ?? "—"}</span>
            ),
          },
          {
            key: 'property',
            label: 'Property',
            width: 140,
            render: (value: string) => (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{value ?? "—"}</span>
            ),
          },
          {
            key: 'unit',
            label: 'Unit',
            width: 80,
            render: (value: string) => (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{value ?? "—"}</span>
            ),
          },
          {
            key: 'due_date',
            label: 'Due Date',
            width: 110,
            render: (value: string) => (
              <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                {new Date(value + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            ),
          },
          {
            key: 'amount',
            label: 'Amount',
            width: 110,
            align: 'right',
            render: (value: number) => (
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {Number(value).toLocaleString()}
              </span>
            ),
          },
          {
            key: 'paid_date',
            label: 'Paid Date',
            width: 110,
            render: (value: string | null) => {
              if (!value) return <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>;
              return (
                <span className="text-xs font-mono" style={{ color: "#10b981" }}>
                  {new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </span>
              );
            },
          },
          {
            key: 'status',
            label: 'Status',
            width: 110,
            align: 'center',
            render: (_value: string, row: Installment) => <StatusBadge inst={row} />,
          },
          {
            key: 'action',
            label: 'Actions',
            width: 100,
            align: 'right',
            render: (_value: string, row: Installment) => {
              const ds = computeDisplayStatus(row);
              return (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    title="Print Instalment Schedule"
                    onClick={(e) => { e.stopPropagation(); setReportModal({ open: true, reportType: "installment_schedule", filters: { deal_ref: row.deal_ref, client_name: row.client_name }, title: "Instalment Schedule" }); }}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg transition-all"
                    style={{ color: "#34d399" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <Printer size={14} />
                  </button>
                  {ds === "paid" && (
                    <button
                      type="button"
                      title="Print Payment Receipt"
                      onClick={(e) => { e.stopPropagation(); setReportModal({ open: true, reportType: "payment_receipt", filters: { instalment_id: row.id }, title: "Payment Receipt" }); }}
                      className="w-7 h-7 inline-flex items-center justify-center rounded-lg transition-all"
                      style={{ color: "#60a5fa" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.15)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <FileText size={14} />
                    </button>
                  )}
                </div>
              );
            },
          },
        ]}
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
