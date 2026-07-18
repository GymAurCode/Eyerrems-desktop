import { useEffect, useState, useRef } from "react";
import {
  Plus, Printer, Eye, Edit2, Trash2, Calendar, X, ChevronDown, ChevronRight,
  Download, FileText, RotateCcw,
} from "lucide-react";
import AppDialog from "../../ui/AppDialog";
import ReportModal from "../../reports/ReportModal";
import { propApi, Lease, LeaseDetail, LeasePayment } from "../../../lib/propertyApi";
import { syncApi } from "../../../lib/financeApi";
import { formatCurrency } from "../../../lib/currency";
import { printRecord } from "../../actions";
import { SmartTable, DataTable } from "../../data-table";
import { api } from "../../../lib/api";
import { uploadsUrl } from "../../../lib/config";
import { useNotifStore } from "../../../store/notifications";
import AddLeaseDialog from "../dialogs/AddLeaseDialog";

type Props = { refresh: number; onRefresh: () => void };

const STATUS_COLOR: Record<string, string> = {
  active: "#10b981", expired: "#ef4444", terminated: "#94a3b8",
  pending: "#f59e0b", renewed: "#6366f1",
};
const PAY_FREQ = ["monthly", "quarterly", "every_4_months", "bi_annual", "annual"];
const PAY_METHODS = ["cash", "bank_transfer", "cheque", "online"];
const TERM_REASONS = ["tenant_request", "non_payment", "breach", "mutual_agreement", "other"];

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function monthsBetween(start: string, end: string): number {
  const s = new Date(start), e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
}

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Expired", value: "expired" },
  { label: "Terminated", value: "terminated" },
  { label: "Renewed", value: "renewed" },
];

export default function LeaseTab({ refresh, onRefresh }: Props) {
  const [leases, setLeases]         = useState<Lease[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const paramsRef = useRef<any>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  // New lease dialog
  const [leaseOpen, setLeaseOpen] = useState(false);

  // ── Detail modal ──
  const [detailLease, setDetailLease]         = useState<LeaseDetail | null>(null);
  const [detailOpen, setDetailOpen]           = useState(false);
  const [detailTab, setDetailTab]             = useState<"info" | "payments" | "schedule" | "docs">("info");
  const [scheduleData, setScheduleData]       = useState<any[]>([]);

  // Report modal state
  const [reportModal, setReportModal] = useState<{
    open: boolean;
    reportType: string;
    filters: Record<string, unknown>;
    title?: string;
  }>({ open: false, reportType: "", filters: {} });

  const today = new Date().toISOString().split("T")[0];

  const handleLeaseAgreement = async (lease: Lease) => {
    try {
      const detail = await propApi.getLeaseDetail(lease.id);
      const agreement = detail.documents.find(d => d.document_type === "lease_agreement");
      if (agreement) {
        window.open(uploadsUrl(agreement.file_path), '_blank');
      } else {
        alert("No lease agreement uploaded. Upload one in Edit Lease.");
      }
    } catch {
      alert("Failed to load lease details.");
    }
  };

  // ── Action modals ──
  const [renewOpen, setRenewOpen]       = useState(false);
  const [renewLeaseId, setRenewLeaseId] = useState<number>(0);
  const [renewStart, setRenewStart]     = useState("");
  const [renewEnd, setRenewEnd]         = useState("");
  const [renewRent, setRenewRent]       = useState("");
  const [renewFreq, setRenewFreq]       = useState("monthly");

  const [payOpen, setPayOpen]           = useState(false);
  const [payLeaseId, setPayLeaseId]     = useState(0);
  const [payAmount, setPayAmount]       = useState("");
  const [payDate, setPayDate]           = useState("");
  const [payMethodPay, setPayMethodPay] = useState("cash");
  const [payRef, setPayRef]             = useState("");
  const [payNotes, setPayNotes]         = useState("");

  const [termOpen, setTermOpen]           = useState(false);
  const [termLeaseId, setTermLeaseId]     = useState(0);
  const [termDate, setTermDate]           = useState("");
  const [termReason, setTermReason]       = useState("");
  const [termNotes, setTermNotes]         = useState("");

  // ── Fetch data ──
  const fetchLeases = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<Lease[]>("/properties/leases/all", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          property_id: params.propertyId || undefined,
          status: params.status || undefined,
          filter: params.dateFilter || undefined,
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
        }
      });
      setLeases(Array.isArray(res.data) ? res.data : []);
      setTotal(Number(res.headers["x-total-count"] || 0));
    } catch { setLeases([]); setTotal(0); }
    finally { setLoading(false); }
  };

  const refreshTable = () => { if (paramsRef.current) fetchLeases(paramsRef.current); };
  useEffect(() => { refreshTable(); }, [refresh]);
  useEffect(() => {
    propApi.getProperties().then(r => setProperties(Array.isArray(r) ? r : []));
  }, []);

  // ── Action handlers ──
  const openDetail = async (lease: Lease) => {
    try {
      const d = await propApi.getLeaseDetail(lease.id);
      setDetailLease(d);
      setDetailTab("info");
      setDetailOpen(true);
      // Load schedule
      propApi.getRentSchedule(lease.id).then(s => setScheduleData(s || [])).catch(() => setScheduleData([]));
    } catch {}
  };

  const openRenew = (lease: Lease) => {
    setRenewLeaseId(lease.id);
    const nextDay = new Date(lease.end_date || lease.start_date);
    nextDay.setDate(nextDay.getDate() + 1);
    setRenewStart(nextDay.toISOString().split("T")[0]);
    setRenewEnd("");
    setRenewRent(String(lease.monthly_rent));
    setRenewFreq(lease.payment_frequency || "monthly");
    setRenewOpen(true);
  };

  const submitRenew = async () => {
    if (!renewStart || !renewEnd || !renewRent) return;
    await propApi.renewLease(renewLeaseId, {
      new_start_date: renewStart, new_end_date: renewEnd,
      monthly_rent: Number(renewRent), payment_frequency: renewFreq,
    });
    pushToast({ title: "Success", message: "Lease renewed", type: "success" });
    setRenewOpen(false);
    onRefresh();
  };

  const openPay = (lease: Lease) => {
    setPayLeaseId(lease.id);
    setPayAmount(String(lease.monthly_rent));
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethodPay("cash"); setPayRef(""); setPayNotes("");
    setPayOpen(true);
  };

  const submitPay = async () => {
    if (!payAmount || !payDate) return;
    await propApi.recordPayment(payLeaseId, {
      amount: Number(payAmount), payment_date: payDate,
      payment_method: payMethodPay, reference_no: payRef || null, notes: payNotes || null,
    });
    syncApi.rentPayment({
      payment_id: payLeaseId,
      invoice_id: null,
      amount: Number(payAmount),
      tenant_name: "",
      unit_name: "",
    }).catch(() => {});
    pushToast({ title: "Success", message: "Payment recorded", type: "success" });
    setPayOpen(false);
    if (detailOpen && detailLease) openDetail(detailLease);
    refreshTable();
  };

  const openTerm = (lease: Lease) => {
    setTermLeaseId(lease.id);
    setTermDate(new Date().toISOString().split("T")[0]);
    setTermReason(""); setTermNotes("");
    setTermOpen(true);
  };

  const submitTerm = async () => {
    if (!termDate || !termReason) return;
    await propApi.terminateLease(termLeaseId, { termination_date: termDate, reason: termReason, notes: termNotes || null });
    pushToast({ title: "Success", message: "Lease terminated", type: "success" });
    setTermOpen(false);
    onRefresh();
  };

  const openSchedule = async (lease: Lease) => {
    try {
      const s = await propApi.getRentSchedule(lease.id);
      setScheduleData(s || []);
      setDetailLease(null);
      setDetailTab("schedule");
      setDetailOpen(true);
    } catch {}
  };

  const genLeasePdf = (lease: Lease) => {
    printRecord(`Lease ${lease.tid}`, [
      { label: "Tenant", value: lease.tenant_name || "—" },
      { label: "Property", value: lease.property_name || "—" },
      { label: "Unit", value: lease.unit_number || String(lease.unit_id) },
      { label: "Start Date", value: formatDate(lease.start_date) },
      { label: "End Date", value: lease.end_date ? formatDate(lease.end_date) : "—" },
      { label: "Monthly Rent", value: formatCurrency(lease.monthly_rent) },
      { label: "Payment Frequency", value: lease.payment_frequency || "monthly" },
      { label: "Security Deposit", value: lease.security_deposit ? formatCurrency(lease.security_deposit) : "—" },
      { label: "Deposit Status", value: lease.deposit_status || "—" },
      { label: "Payment Method", value: lease.payment_method || "—" },
      { label: "Status", value: lease.status },
    ]);
  };

  // ── Status badge with smart expiry ──
  const renderStatus = (lease: Lease) => {
    const today = new Date();
    let label = lease.status;
    let color = STATUS_COLOR[lease.status] ?? "#94a3b8";

    if (lease.status === "active" && lease.end_date) {
      const end = new Date(lease.end_date);
      const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) { label = "expired"; color = "#ef4444"; }
      else if (diffDays <= 30) { label = "expiring soon"; color = "#f59e0b"; }
    }

    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
        style={{ background: `${color}18`, color }}>{label}</span>
    );
  };

  // ── Columns ──
  const columns = [
    { key: "tid", label: "Lease ID", className: "font-mono text-xs text-blue-400" },
    {
      key: "property_name", label: "Property",
      render: (val: any) => val || "—", className: "text-primary font-medium",
    },
    {
      key: "unit_number", label: "Unit",
      render: (val: any, row: Lease) => val || `Unit #${row.unit_id}`,
      className: "text-secondary",
    },
    {
      key: "tenant_name", label: "Tenant",
      render: (val: any) => val || "—", className: "text-secondary",
    },
    {
      key: "start_date", label: "Start Date",
      render: (val: any) => formatDate(val), className: "text-secondary",
    },
    {
      key: "end_date", label: "End Date",
      render: (val: any) => val ? formatDate(val) : "—", className: "text-secondary",
    },
    {
      key: "monthly_rent", label: "Monthly Rent",
      render: (val: any) => formatCurrency(val), className: "text-secondary",
    },
    { key: "status", label: "Status", render: (_: any, row: Lease) => renderStatus(row) },
    {
      key: "deposit_status", label: "Deposit",
      render: (val: any) => {
        if (!val) return <span className="text-muted text-xs">—</span>;
        const c = val === "received" ? "#10b981" : val === "waived" ? "#6b7280" : "#f59e0b";
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${c}18`, color: c }}>{val}</span>;
      },
    },
  ];

  const rowActions = [
    {
      key: "view", label: "View Lease Details", icon: Eye,
      onClick: (row: Lease) => openDetail(row),
    },
    {
      key: "renew", label: "Renew Lease", icon: RotateCcw,
      onClick: (row: Lease) => openRenew(row),
    },
    {
      key: "payment", label: "Record Payment", icon: Calendar,
      onClick: (row: Lease) => openPay(row),
    },
    {
      key: "terminate", label: "Terminate Lease", icon: X,
      onClick: (row: Lease) => openTerm(row),
    },
    {
      key: "schedule", label: "Generate Rent Schedule", icon: FileText,
      onClick: (row: Lease) => openSchedule(row),
    },
    {
      key: "pdf", label: "Download Lease PDF", icon: Download,
      onClick: (row: Lease) => genLeasePdf(row),
    },
    {
      key: "print", label: "Print", icon: Printer,
      onClick: (row: Lease) => printRecord(`Lease ${row.tid}`, [
        { label: "Tenant", value: row.tenant_name || "—" },
        { label: "Rent", value: formatCurrency(row.monthly_rent) },
        { label: "Status", value: row.status },
        { label: "Start Date", value: row.start_date },
        { label: "End Date", value: row.end_date || "—" },
      ]),
    },
    {
      key: "rent_ledger",
      label: "Rent Ledger",
      icon: FileText,
      onClick: (row: Lease) => setReportModal({ open: true, reportType: "rent_ledger", filters: { tenant_id: row.tenant_id, unit_id: row.unit_id, date_from: row.start_date, date_to: today }, title: "Rent Ledger" }),
      variant: "secondary",
    },
    {
      key: "rent_schedule",
      label: "Rent Schedule",
      icon: FileText,
      onClick: (row: Lease) => setReportModal({ open: true, reportType: "installment_schedule", filters: { lease_id: row.id }, title: "Rent Schedule" }),
      variant: "secondary",
    },
    {
      key: "lease_agreement",
      label: "Lease Agreement PDF",
      icon: Download,
      onClick: (row: Lease) => handleLeaseAgreement(row),
      variant: "secondary",
    },
  ];

  return (
    <>
      {/* ── LEASE LIST TABLE ── */}
      <SmartTable
        storageKey="rems_leases"
        data={leases}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchLeases}
        showStatusFilter={true}
        statusOptions={STATUS_OPTIONS}
        showTypeFilter={true}
        typeOptions={properties.map(p => ({ label: `${p.tid} — ${p.name}`, value: String(p.id) }))}
        showDateFilter={true}
        toolbarActions={
          <button type="button" onClick={() => setLeaseOpen(true)}
            className="btn-property flex items-center gap-2 px-3 py-2 text-xs">
            <Plus size={13} /> New Lease
          </button>
        }
      />

      <AddLeaseDialog
        isOpen={leaseOpen}
        onClose={() => setLeaseOpen(false)}
        onSaved={onRefresh}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1b — LEASE DETAIL MODAL                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AppDialog isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Lease Details" size="2xl">
        {detailLease ? (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 rounded-lg p-0.5" style={{ border: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
              {(["info", "payments", "schedule", "docs"] as const).map(t => (
                <button key={t} type="button" onClick={() => setDetailTab(t)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-md transition-colors capitalize"
                  style={detailTab === t ? { background: "var(--bg-surface)", color: "var(--text-primary)" } : { color: "var(--text-muted)" }}>
                  {t === "info" ? "Details" : t === "docs" ? "Documents" : t}
                </button>
              ))}
            </div>

            {detailTab === "info" && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Lease ID", detailLease.tid],
                  ["Property", detailLease.property_name || "—"],
                  ["Unit", detailLease.unit_number || `#${detailLease.unit_id}`],
                  ["Tenant", detailLease.tenant_name || "—"],
                  ["Tenant Ref", detailLease.tenant_ref || "—"],
                  ["Status", detailLease.status],
                  ["Start Date", formatDate(detailLease.start_date)],
                  ["End Date", detailLease.end_date ? formatDate(detailLease.end_date) : "—"],
                  ["Monthly Rent", formatCurrency(detailLease.monthly_rent)],
                  ["Annual Rent", detailLease.annual_rent ? formatCurrency(detailLease.annual_rent) : "—"],
                  ["Payment Frequency", detailLease.payment_frequency || "—"],
                  ["First Payment Due", detailLease.first_payment_due_date ? formatDate(detailLease.first_payment_due_date) : "—"],
                  ["Security Deposit", detailLease.security_deposit ? formatCurrency(detailLease.security_deposit) : "—"],
                  ["Deposit Status", detailLease.deposit_status || "—"],
                  ["Notice Period", detailLease.notice_period ? `${detailLease.notice_period} days` : "—"],
                  ["Grace Period", detailLease.grace_period ? `${detailLease.grace_period} days` : "—"],
                  ["Late Fee", detailLease.late_fee_type ? `${detailLease.late_fee_type === "fixed" ? "Rs" : ""} ${detailLease.late_fee_value}${detailLease.late_fee_type === "percentage" ? "%" : ""}` : "—"],
                  ["Payment Method", detailLease.payment_method?.replace(/_/g, " ") || "—"],
                  ["Bank", detailLease.bank_name || "—"],
                  ["Auto-Renewal", detailLease.auto_renewal ? `Yes (${detailLease.renewal_duration_months || "?"} mo, +${detailLease.rent_increase_pct || 0}%)` : "No"],
                  ["Termination", detailLease.termination_date ? `${formatDate(detailLease.termination_date)} (${detailLease.termination_reason})` : "—"],
                  ["Notes", detailLease.notes || "—"],
                ].map(([l, v]) => (
                  <div key={l} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted">{l}</span>
                    <span className="text-primary">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "payments" && (
              <div>
                {detailLease.payments.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No payments recorded yet.</p>
                ) : (
                  <>
                    <DataTable
                      data={detailLease.payments}
                      columns={[
                        { key: 'payment_date', label: 'Date', render: (val) => <span className="text-xs text-secondary">{formatDate(val)}</span> },
                        { key: 'amount', label: 'Amount', render: (val) => <span className="text-xs font-medium" style={{ color: "#10b981" }}>{formatCurrency(val)}</span> },
                        { key: 'payment_method', label: 'Method', render: (val) => <span className="text-xs text-secondary">{val?.replace(/_/g, " ") || "—"}</span> },
                        { key: 'reference_no', label: 'Reference', render: (val) => <span className="text-xs text-secondary">{val || "—"}</span> },
                        { key: 'cheque_no', label: 'Cheque No.', render: (val) => <span className="text-xs text-secondary">{val || "—"}</span> },
                        { key: 'notes', label: 'Notes', render: (val) => <span className="text-xs text-secondary">{val || "—"}</span> },
                      ]}
                      searchable={false}
                      sortable={false}
                    />
                    <div className="flex justify-end px-3 py-2 text-xs font-medium" style={{ color: "#10b981" }}>
                      Total: {formatCurrency(detailLease.payments.reduce((s: number, p: LeasePayment) => s + p.amount, 0))}
                    </div>
                  </>
                )}
              </div>
            )}

            {detailTab === "schedule" && (
              <div>
                {scheduleData.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">Schedule not generated.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: "Total Rent", value: formatCurrency(scheduleData.reduce((s: number, r: any) => s + r.amount, 0)), color: "#3b82f6" },
                        { label: "Total Paid", value: formatCurrency(detailLease.payments.reduce((s: number, p: LeasePayment) => s + p.amount, 0)), color: "#10b981" },
                        { label: "Outstanding", value: formatCurrency(Math.max(0, scheduleData.reduce((s: number, r: any) => s + r.amount, 0) - detailLease.payments.reduce((s: number, p: LeasePayment) => s + p.amount, 0))), color: "#f59e0b" },
                        { label: "Next Due", value: scheduleData.find((r: any) => r.status === "upcoming")?.due_date ? formatDate(scheduleData.find((r: any) => r.status === "upcoming").due_date) : "—", color: "#8b5cf6" },
                      ].map(card => (
                        <div key={card.label} className="rounded-lg px-3 py-2.5" style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                          <p className="text-[9px] uppercase tracking-wider text-muted">{card.label}</p>
                          <p className="text-sm font-semibold" style={{ color: card.color }}>{card.value}</p>
                        </div>
                      ))}
                    </div>
                    <DataTable
                      data={scheduleData}
                      columns={[
                        { key: 'instalment_no', label: '#', render: (val) => <span className="text-xs text-muted">{val}</span> },
                        { key: 'due_date', label: 'Due Date', render: (val) => <span className="text-xs text-secondary">{formatDate(val)}</span> },
                        { key: 'amount', label: 'Amount', align: 'right', render: (val) => <span className="text-xs text-secondary">{formatCurrency(val)}</span> },
                        { key: 'status', label: 'Status', render: (_: any, row: any) => {
                          const today = new Date();
                          const due = new Date(row.due_date);
                          const isPaid = detailLease.payments.some((p: LeasePayment) => {
                            const pd = new Date(p.payment_date);
                            return pd.getMonth() === due.getMonth() && pd.getFullYear() === due.getFullYear();
                          });
                          let status = row.status;
                          let sc = "#6b7280";
                          if (isPaid) { status = "paid"; sc = "#10b981"; }
                          else if (due.toDateString() === today.toDateString()) { status = "due today"; sc = "#3b82f6"; }
                          else if (due < today) { status = "overdue"; sc = "#ef4444"; }
                          return (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: `${sc}18`, color: sc }}>{status}</span>
                          );
                        }},
                      ]}
                      searchable={false}
                      sortable={false}
                    />
                  </>
                )}
              </div>
            )}

            {detailTab === "docs" && (
              <div>
                {detailLease.documents.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No documents uploaded.</p>
                ) : (
                  <div className="space-y-1">
                    {detailLease.documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ border: "1px solid var(--border)" }}>
                        <div className="flex items-center gap-2">
                          <FileText size={12} className="text-muted" />
                          <span className="text-xs text-primary">{doc.filename}</span>
                          <span className="text-[9px] text-muted">{doc.document_type?.replace(/_/g, " ")}</span>
                        </div>
                        <a href={uploadsUrl(doc.file_path)} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs" style={{ color: "#60a5fa" }}>
                          <Download size={10} /> Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
        )}
      </AppDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2b — RENEW LEASE MODAL                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AppDialog isOpen={renewOpen} onClose={() => setRenewOpen(false)} title="Renew Lease">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">New Start Date <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={renewStart}
              onChange={(e) => setRenewStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">New End Date <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={renewEnd}
              onChange={(e) => setRenewEnd(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Monthly Rent (Rs) <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={renewRent}
              onChange={(e) => setRenewRent(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Payment Frequency</label>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={renewFreq}
              onChange={(e) => setRenewFreq(e.target.value)}>
              {PAY_FREQ.map(f => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <button className="btn-property w-full py-3 text-sm" type="button" onClick={() => void submitRenew()}>
            Renew Lease
          </button>
        </div>
      </AppDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3b — RECORD PAYMENT MODAL                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AppDialog isOpen={payOpen} onClose={() => setPayOpen(false)} title="Record Payment">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Amount (Rs) <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="number" value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Payment Date <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
              <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={payDate}
                onChange={(e) => setPayDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Payment Method</label>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={payMethodPay}
              onChange={(e) => setPayMethodPay(e.target.value)}>
              {PAY_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Reference No.</label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" value={payRef}
              onChange={(e) => setPayRef(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Notes</label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional" />
          </div>
          <button className="btn-property w-full py-3 text-sm" type="button" onClick={() => void submitPay()}>
            Record Payment
          </button>
        </div>
      </AppDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4b — TERMINATE LEASE MODAL                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AppDialog isOpen={termOpen} onClose={() => setTermOpen(false)} title="Terminate Lease">
        <div className="space-y-4">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            This will mark the lease as terminated and make the unit available.
          </p>
          <div>
            <label className="block text-xs text-muted mb-1">Termination Date <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input className="input-dark w-full px-3 py-2.5 text-sm" type="date" value={termDate}
              onChange={(e) => setTermDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Reason <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <select className="select-dark w-full px-3 py-2.5 text-sm" value={termReason}
              onChange={(e) => setTermReason(e.target.value)}>
              <option value="">— Select reason —</option>
              {TERM_REASONS.map(r => (
                <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Notes</label>
            <textarea className="input-dark w-full px-3 py-2.5 text-sm resize-none" rows={2} value={termNotes}
              onChange={(e) => setTermNotes(e.target.value)} placeholder="Optional" />
          </div>
          <button className="btn-property w-full py-3 text-sm" type="button"
            style={{ background: "#ef4444" }}
            onClick={() => void submitTerm()}>
            Terminate Lease
          </button>
        </div>
      </AppDialog>

      {/* Report Modal */}
      <ReportModal
        open={reportModal.open}
        onClose={() => setReportModal({ open: false, reportType: "", filters: {} })}
        reportType={reportModal.reportType}
        filters={reportModal.filters}
        title={reportModal.title}
      />
    </>
  );
}
