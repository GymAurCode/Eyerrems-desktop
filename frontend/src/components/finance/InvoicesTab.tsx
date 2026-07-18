import { useEffect, useState, useCallback } from "react";
import {
  DollarSign, Eye, Printer, Search, X, Filter, Plus, FileText, Loader2
} from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import { api } from "../../lib/api";
import { AppTable, removeEmptyParams } from "../data-table";
import {
  invoicesApi, type Invoice, type Account
} from "../../lib/financeApi";
import { fileService } from "../../services/fileService";
import { MODULE_COLORS } from "../../config/moduleColors";
import CreateInvoiceDialog from "./CreateInvoiceDialog";
import InvoiceDetailView from "./InvoiceDetailView";

const ACCENT = MODULE_COLORS.finance.primary;

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  pending: "#f59e0b",
  sent: "#3b82f6",
  viewed: "#8b5cf6",
  partially_paid: "#f59e0b",
  paid: "#10b981",
  overdue: "#ef4444",
  cancelled: "#6b7280",
  void: "#ef4444",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ background: color + "22", color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function InvoicesTab({ accounts, onRefresh }: { accounts: Account[]; onRefresh: () => Promise<void> }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewInv, setViewInv] = useState<Invoice | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [params, setParams] = useState({
    page: 1, pageSize: 10, search: "", status: "", invoice_type: "",
    party_type: "", startDate: "", endDate: ""
  });

  const fetchInvoices = useCallback(async (p: typeof params) => {
    setLoading(true); setError(null);
    try {
      const sanitized = removeEmptyParams({
        limit: p.pageSize,
        skip: (p.page - 1) * p.pageSize,
        search: p.search,
        status: p.status,
        invoice_type: p.invoice_type,
        party_type: p.party_type,
        start_date: p.startDate,
        end_date: p.endDate,
      });
      const res = await api.get("/finance/invoices", { params: sanitized });
      const data = res.data;
      const items = Array.isArray(data) ? data : data.items ?? [];
      setInvoices(items);
      setTotal(Number(res.headers["x-total-count"] ?? (data.total ?? items.length)));
      if (res.data.length > 0) {
        const ids = res.data.map((inv) => String(inv.id)).join(",");
        fileService.getFileCountsBatch("finance", "invoice", ids).then((data: any) => {
          if (data?.counts) setFileCounts(data.counts);
        }).catch(() => {});
      }
    } catch (e: any) { setError(e.message || "Failed to load invoices"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchInvoices(params); }, [params, fetchInvoices]);

  const invoiceColumns = [
    {
      key: "invoice_number", label: "INV #", sortable: true,
      className: "font-mono text-[10px] text-blue-400 font-semibold",
      render: (val: string, row: Invoice) => val || `INV-${String(row.id).padStart(6, "0")}`
    },
    {
      key: "invoice_date", label: "Date", sortable: true,
      render: (val: string | undefined, row: Invoice) => {
        const d = val || row.created_at;
        return d ? new Date(d).toLocaleDateString() : "—";
      }
    },
    {
      key: "due_date", label: "Due Date", sortable: true,
      render: (val: string) => new Date(val).toLocaleDateString()
    },
    {
      key: "client_name", label: "Party",
      render: (val: string | undefined, row: Invoice) => {
        const name = val || row.client_name || "";
        const type = row.party_type ? <span className="text-[9px] text-muted"> ({row.party_type})</span> : null;
        return <span className="text-xs">{name}{type}</span>;
      }
    },
    {
      key: "invoice_type", label: "Type",
      render: (val: string | undefined) => {
        if (!val) return <span className="text-muted">—</span>;
        return <span className="text-[10px] uppercase tracking-wider text-muted">{val}</span>;
      }
    },
    {
      key: "amount", label: "Amount", sortable: true,
      className: "font-semibold text-right",
      render: (val: number) => formatCurrency(val)
    },
    {
      key: "paid_amount", label: "Paid", className: "text-right",
      render: (val: number | undefined, row: Invoice) => (
        <span className="text-emerald-400">{formatCurrency(row.paid_amount || 0)}</span>
      )
    },
    {
      key: "remaining_amount", label: "Due", className: "text-right",
      render: (val: number | undefined, row: Invoice) => {
        const due = row.remaining_amount ?? row.amount - (row.paid_amount || 0);
        return <span style={{ color: due > 0 ? "#ef4444" : "#10b981" }}>{formatCurrency(due)}</span>;
      }
    },
    {
      key: "status", label: "Status",
      render: (val: string) => <StatusBadge status={val} />
    },
    {
      key: "auto_generated", label: "Source",
      render: (val: boolean, row: Invoice) => {
        if (row.source_module) {
          return <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{row.source_module}</span>;
        }
        return val ? <span className="text-[9px] text-muted">Auto</span> : null;
      }
    },
  ];

  const statusOptions = [
    { label: "All Statuses", value: "" },
    { label: "Draft", value: "draft" },
    { label: "Pending", value: "pending" },
    { label: "Sent", value: "sent" },
    { label: "Viewed", value: "viewed" },
    { label: "Partially Paid", value: "partially_paid" },
    { label: "Paid", value: "paid" },
    { label: "Overdue", value: "overdue" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Void", value: "void" },
  ];

  const typeOptions = [
    { label: "All Types", value: "" },
    { label: "Sale", value: "sale" },
    { label: "Rent", value: "rent" },
    { label: "Maintenance", value: "maintenance" },
    { label: "Construction", value: "construction" },
    { label: "Utility", value: "utility" },
    { label: "Security Deposit", value: "security_deposit" },
    { label: "Manual", value: "manual" },
    { label: "Other", value: "other" },
  ];

  const partyOptions = [
    { label: "All Parties", value: "" },
    { label: "Client", value: "client" },
    { label: "Tenant", value: "tenant" },
    { label: "Vendor", value: "vendor" },
    { label: "Dealer", value: "dealer" },
    { label: "Owner", value: "owner" },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <select className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          value={params.status} onChange={e => setParams(p => ({ ...p, status: e.target.value, page: 1 }))}>
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          value={params.invoice_type} onChange={e => setParams(p => ({ ...p, invoice_type: e.target.value, page: 1 }))}>
          {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          value={params.party_type} onChange={e => setParams(p => ({ ...p, party_type: e.target.value, page: 1 }))}>
          {partyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <AppTable
        storageKey="rems_finance_invoices_v2"
        title="Invoices"
        subtitle="Manage billing, rental invoices, and collection status"
        data={invoices} columns={invoiceColumns}
        rowActions={[
          { key: "view", label: "View", icon: Eye, onClick: (row: Invoice) => setViewInv(row) },
          {
            key: "pay", label: "Record Payment", icon: DollarSign,
            onClick: () => {},
            hidden: (row: Invoice) => row.status === "paid" || row.status === "cancelled" || row.status === "void"
          },
          { key: "print", label: "Print", icon: Printer, onClick: () => window.print() },
        ]}
        loading={loading} error={error} onRetry={() => fetchInvoices(params)}
        pagination={{ page: params.page, pageSize: params.pageSize, total }}
        onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
        onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
        showStatusFilter={false} showTypeFilter={false}
        toolbarActions={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg text-white"
            style={{ background: ACCENT }}>
            <Plus size={13} /> New Invoice
          </button>
        }
      />

      {showCreate && (
        <CreateInvoiceDialog
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); void fetchInvoices(params); void onRefresh(); }}
          accounts={accounts}
        />
      )}

      {viewInv && (
        <InvoiceDetailView
          invoice={viewInv}
          onClose={() => setViewInv(null)}
          onRefresh={() => { void fetchInvoices(params); void onRefresh(); }}
          accounts={accounts}
        />
      )}
    </div>
  );
}
