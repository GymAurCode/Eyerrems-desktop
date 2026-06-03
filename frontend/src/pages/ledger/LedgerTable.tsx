/**
 * LedgerTable — Professional accounting-style table component.
 * Features: sticky header, running balance, debit/credit coloring,
 * zebra rows, right-aligned amounts, clickable rows.
 */
import { Eye, Printer } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import { printRecord } from "../../components/actions";
import DataTable from "../../components/data-table/DataTable";
import type { TableColumn, TableAction } from "../../components/data-table/types";

export interface LedgerRow {
  id:              number;
  tid:             string;
  entry_date:      string;
  description:     string;
  reference_no:    string | null;
  entry_type:      string;
  debit:           number;
  credit:          number;
  running_balance: number;
  status:          string;
  // optional extras shown in sub-ledgers
  client_name?:    string | null;
  dealer_name?:    string | null;
  property_name?:  string | null;
  payment_method?: string | null;
  deal_ref?:       string | null;
}

type SortKey = "entry_date" | "debit" | "credit" | "running_balance";
type SortDir = "asc" | "desc";

interface Props {
  rows:        LedgerRow[];
  onRowClick:  (row: LedgerRow) => void;
  showEntity?: "client" | "dealer" | "property"; // show entity name column
  sortKey?:    SortKey;
  sortDir?:    SortDir;
  onSort?:     (key: SortKey) => void;
  loading?:    boolean;
}

const ENTRY_TYPE_COLORS: Record<string, [string, string]> = {
  booking:            ["rgba(59,130,246,0.12)",  "#3b82f6"],
  installment:        ["rgba(16,185,129,0.12)",  "#10b981"],
  refund:             ["rgba(239,68,68,0.12)",   "#ef4444"],
  discount:           ["rgba(245,158,11,0.12)",  "#f59e0b"],
  tax:                ["rgba(139,92,246,0.12)",  "#8b5cf6"],
  adjustment:         ["rgba(6,182,212,0.12)",   "#06b6d4"],
  penalty:            ["rgba(239,68,68,0.12)",   "#ef4444"],
  transfer:           ["rgba(99,102,241,0.12)",  "#6366f1"],
  commission:         ["rgba(59,130,246,0.12)",  "#3b82f6"],
  payout:             ["rgba(16,185,129,0.12)",  "#10b981"],
  bonus:              ["rgba(245,158,11,0.12)",  "#f59e0b"],
  transfer_fee:       ["rgba(139,92,246,0.12)",  "#8b5cf6"],
  development:        ["rgba(6,182,212,0.12)",   "#06b6d4"],
  ownership_transfer: ["rgba(99,102,241,0.12)",  "#6366f1"],
};

const STATUS_COLORS: Record<string, [string, string]> = {
  posted:   ["rgba(16,185,129,0.12)",  "#10b981"],
  pending:  ["rgba(245,158,11,0.12)",  "#f59e0b"],
  reversed: ["rgba(239,68,68,0.12)",   "#ef4444"],
};

function TypeBadge({ type }: { type: string }) {
  const [bg, color] = ENTRY_TYPE_COLORS[type] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
      style={{ background: bg, color }}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const [bg, color] = STATUS_COLORS[status] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
      style={{ background: bg, color }}>
      {status}
    </span>
  );
}

export default function LedgerTable({ rows, onRowClick, showEntity, sortKey, sortDir, onSort, loading }: Props) {
  const totalDebit  = rows.reduce((s, r) => s + r.debit,  0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const lastBalance = rows[rows.length - 1]?.running_balance ?? 0;

  const dateRender = (v: string) => (
    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
      {new Date(v).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
    </span>
  );

  const columns: TableColumn<LedgerRow>[] = [
    { key: 'idx', label: '#', width: 40, render: (_, __, idx) => <span className="text-xs" style={{ color: "var(--text-muted)" }}>{idx + 1}</span> },
    { key: 'tid', label: 'TID', render: (v) => <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{v}</span> },
    { key: 'entry_date', label: 'Date', sortable: true, render: (v) => dateRender(v) },
    ...(showEntity === "client" ? [{ key: 'client_name' as const, label: 'Client', render: (v: string | null | undefined) => <span className="text-xs font-medium text-primary">{v ?? "—"}</span> }] : []),
    ...(showEntity === "dealer" ? [{ key: 'dealer_name' as const, label: 'Dealer', render: (v: string | null | undefined) => <span className="text-xs font-medium text-primary">{v ?? "—"}</span> }] : []),
    ...(showEntity === "property" ? [{ key: 'property_name' as const, label: 'Property', render: (v: string | null | undefined) => <span className="text-xs font-medium text-primary">{v ?? "—"}</span> }] : []),
    { key: 'description', label: 'Description', render: (v) => <span className="text-xs text-primary truncate block" title={v as string}>{v}</span> },
    { key: 'reference_no', label: 'Ref No', render: (v) => <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{v ?? "—"}</span> },
    { key: 'entry_type', label: 'Type', render: (_, row) => <TypeBadge type={row.entry_type} /> },
    { key: 'debit', label: 'Debit', sortable: true, align: 'right', render: (v) => (v as number) > 0 ? <span className="text-xs font-semibold" style={{ color: "#f87171" }}>{formatCurrency(v as number)}</span> : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span> },
    { key: 'credit', label: 'Credit', sortable: true, align: 'right', render: (v) => (v as number) > 0 ? <span className="text-xs font-semibold" style={{ color: "#34d399" }}>{formatCurrency(v as number)}</span> : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span> },
    { key: 'running_balance', label: 'Balance', sortable: true, align: 'right', render: (v) => {
      const bal = v as number;
      return <span className="text-xs font-bold" style={{ color: bal >= 0 ? "#60a5fa" : "#f87171" }}>{bal < 0 ? "-" : ""}{formatCurrency(Math.abs(bal))}</span>;
    }},
    { key: 'status', label: 'Status', render: (_, row) => <StatusBadge status={row.status} /> },
  ];

  const rowActionsList: TableAction<LedgerRow>[] = [
    {
      key: 'view',
      label: 'View',
      icon: Eye,
      onClick: (row) => onRowClick(row),
    },
    {
      key: 'print',
      label: 'Print',
      icon: Printer,
      onClick: (row) => printRecord(`Ledger ${row.tid}`, [
        { label: "Date", value: row.entry_date },
        { label: "Description", value: row.description },
        { label: "Debit", value: row.debit > 0 ? formatCurrency(row.debit) : "—" },
        { label: "Credit", value: row.credit > 0 ? formatCurrency(row.credit) : "—" },
        { label: "Balance", value: formatCurrency(Math.abs(row.running_balance)) },
      ]),
    },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      loading={loading}
      sortable
      sortConfig={sortKey && sortDir ? { key: sortKey, direction: sortDir } : undefined}
      onSort={(config) => onSort?.(config.key as SortKey)}
      onRowClick={(row) => onRowClick(row)}
      searchable={false}
      striped={false}
      hoverable
      rowActions={rowActionsList}
      emptyTitle="No ledger entries found"
      emptyDescription="Entries appear automatically when transactions are recorded"
      customFooter={
        rows.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderTop: '2px solid var(--border)', background: 'var(--bg-surface2)', fontSize: 13 }}>
            <div style={{ flex: showEntity ? 8 : 7, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
              Totals
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <span className="text-xs font-bold" style={{ color: '#f87171' }}>{formatCurrency(totalDebit)}</span>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <span className="text-xs font-bold" style={{ color: '#34d399' }}>{formatCurrency(totalCredit)}</span>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <span className="text-xs font-bold" style={{ color: lastBalance >= 0 ? '#60a5fa' : '#f87171' }}>
                {lastBalance < 0 ? "-" : ""}{formatCurrency(Math.abs(lastBalance))}
              </span>
            </div>
            <div style={{ flex: 1 }} />
          </div>
        ) : undefined
      }
    />
  );
}
