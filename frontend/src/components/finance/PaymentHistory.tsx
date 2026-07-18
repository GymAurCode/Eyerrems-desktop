import { useState, useCallback, useEffect } from "react";
import {
  DollarSign, CreditCard, Banknote, Check, X, RotateCcw,
  RefreshCw, FileText, Eye, Trash2, Upload, Loader2, Search,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import {
  paymentsApi, type Payment, type PaymentSearchInvoice
} from "../../lib/financeApi";
import { AppTable, removeEmptyParams } from "../data-table";
import { api } from "../../lib/api";
import { MODULE_COLORS } from "../../config/moduleColors";
import ReceiptView from "./ReceiptView";

const ACCENT = MODULE_COLORS.finance.primary;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    completed: ["rgba(16,185,129,0.15)", "#10b981"],
    pending: ["rgba(245,158,11,0.15)", "#f59e0b"],
    failed: ["rgba(239,68,68,0.15)", "#ef4444"],
    cancelled: ["rgba(148,163,184,0.1)", "#94a3b8"],
    refunded: ["rgba(139,92,246,0.15)", "#8b5cf6"],
    reversed: ["rgba(239,68,68,0.15)", "#ef4444"],
  };
  const [bg, color] = map[status] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap capitalize"
      style={{ background: bg, color }}>{status}</span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const icons: Record<string, React.ElementType> = {
    cash: Banknote,
    bank_transfer: CreditCard,
    cheque: FileText,
    credit_card: CreditCard,
    debit_card: CreditCard,
    online: DollarSign,
    jazzcash: DollarSign,
    easypaisa: DollarSign,
    stripe: DollarSign,
    paypal: DollarSign,
  };
  const Icon = icons[method] || DollarSign;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] capitalize">
      <Icon size={10} className="text-muted" />
      {method.replace(/_/g, " ")}
    </span>
  );
}

interface Props {
  onRecordPayment?: () => void;
}

export default function PaymentHistory({ onRecordPayment }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);
  const [params, setParams] = useState({
    page: 1, pageSize: 10, search: "", filter: "", startDate: "", endDate: "",
    status: "", method: ""
  });

  const fetchPayments = useCallback(async (currentParams: typeof params) => {
    setLoading(true); setError(null);
    try {
      const sanitized = removeEmptyParams({
        limit: currentParams.pageSize, skip: (currentParams.page - 1) * currentParams.pageSize,
        search: currentParams.search, status: currentParams.status, method: currentParams.method,
      });
      const res = await api.get<Payment[]>("/finance/payments", { params: sanitized });
      const data = res.data;
      if (Array.isArray(data)) {
        setPayments(data);
        setTotal(data.length < currentParams.pageSize ? (currentParams.page - 1) * currentParams.pageSize + data.length : 1000);
      } else if (data && typeof data === "object") {
        const items = (data as any).items ?? [];
        setPayments(items);
        setTotal((data as any).total ?? items.length);
      }
    } catch (e: any) { setError(e.message || "Failed to load payments"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchPayments(params); }, [params, fetchPayments]);

  const handleAction = async (id: number, action: string, payload?: any) => {
    setActionLoading(id);
    try {
      if (action === "post") await paymentsApi.postToFinance(id, payload || {});
      if (action === "reverse") await paymentsApi.reverse(id, payload || { reason: "Manual reversal" });
      if (action === "cancel") await paymentsApi.cancel(id);
      await fetchPayments(params);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || `Failed to ${action} payment`);
    } finally { setActionLoading(null); }
  };

  const summary = useCallback(() => {
    const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
    const completed = payments.filter((p) => p.status === "completed").length;
    const pending = payments.filter((p) => p.status === "pending").length;
    return { totalAmount, completed, pending, count: payments.length };
  }, [payments]);

  const columns = [
    {
      key: "payment_number", label: "PAY #", className: "font-mono text-[10px] text-blue-400 font-semibold",
      render: (val: string, row: Payment) => val || `PAY-${String(row.id).padStart(6, "0")}`,
    },
    {
      key: "date", label: "Date", sortable: true,
      render: (val: string) => new Date(val).toLocaleDateString(),
    },
    {
      key: "party_name", label: "Party",
      render: (val: string, row: Payment) => (
        <div>
          <p className="text-xs text-primary">{val || "—"}</p>
          {row.party_phone && <p className="text-[9px] text-muted">{row.party_phone}</p>}
        </div>
      ),
    },
    {
      key: "amount", label: "Amount", className: "font-semibold text-emerald-400 text-right",
      render: (val: number) => formatCurrency(val),
    },
    {
      key: "method", label: "Method",
      render: (val: string) => <MethodBadge method={val} />,
    },
    {
      key: "status", label: "Status",
      render: (val: string) => <StatusBadge status={val} />,
    },
    {
      key: "payment_type", label: "Type",
      render: (val: string) => (
        <span className="text-[10px] capitalize text-muted">{val?.replace(/_/g, " ") || "against_invoice"}</span>
      ),
    },
    {
      key: "reference_number", label: "Ref",
      render: (val: string) => val ? <span className="text-[10px] font-mono">{val}</span> : "—",
    },
    {
      key: "posted_to_finance", label: "Posted",
      render: (val: boolean, row: Payment) => row.posted_to_finance ? (
        <span className="text-emerald-400 text-[10px]">✓ JE-{String(row.finance_journal_id).padStart(4, "0")}</span>
      ) : postingId === row.id ? (
        <span className="text-yellow-400 text-[10px]">⏳ Posting…</span>
      ) : (
        <span className="text-yellow-400 text-[10px]">Pending</span>
      ),
    },
  ];

  const rowActions = [
    {
      key: "receipt", label: "Receipt", icon: FileText,
      onClick: (row: Payment) => setReceiptPaymentId(row.id),
    },
    {
      key: "post", label: "Post", icon: Upload,
      hidden: (row: Payment) => row.posted_to_finance || row.status !== "completed",
      onClick: (row: Payment) => handleAction(row.id, "post"),
    },
    {
      key: "reverse", label: "Reverse", icon: RotateCcw,
      hidden: (row: Payment) => row.status !== "completed" || row.posted_to_finance === false,
      onClick: (row: Payment) => handleAction(row.id, "reverse", { reason: "Manual reversal" }),
    },
    {
      key: "cancel", label: "Cancel", icon: X,
      hidden: (row: Payment) => row.status !== "pending",
      onClick: (row: Payment) => handleAction(row.id, "cancel"),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {payments.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="stat-card p-3">
            <p className="text-[9px] text-muted uppercase tracking-wider">Total</p>
            <p className="text-lg font-bold text-primary">{summary().count}</p>
          </div>
          <div className="stat-card p-3">
            <p className="text-[9px] text-muted uppercase tracking-wider">Completed</p>
            <p className="text-lg font-bold text-emerald-400">{summary().completed}</p>
          </div>
          <div className="stat-card p-3">
            <p className="text-[9px] text-muted uppercase tracking-wider">Pending</p>
            <p className="text-lg font-bold text-yellow-400">{summary().pending}</p>
          </div>
          <div className="stat-card p-3">
            <p className="text-[9px] text-muted uppercase tracking-wider">Total Amount</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(summary().totalAmount)}</p>
          </div>
        </div>
      )}

      <ReceiptView
        isOpen={receiptPaymentId !== null}
        onClose={() => setReceiptPaymentId(null)}
        paymentId={receiptPaymentId ?? 0}
      />
      <AppTable
        storageKey="rems_finance_payments_history"
        title="Payment History"
        subtitle="Complete payment register with status tracking"
        data={payments}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={() => fetchPayments(params)}
        pagination={{ page: params.page, pageSize: params.pageSize, total }}
        onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
        onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
        rowActions={rowActions}
      />
    </div>
  );
}
