/**
 * LedgerTable — Professional accounting-style table component.
 * Features: sticky header, running balance, debit/credit coloring,
 * zebra rows, right-aligned amounts, clickable rows.
 */
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import { QuickRowActions, ActionsTh, ActionsCell, printRecord } from "../../components/actions";

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

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey?: SortKey; sortDir?: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown size={10} style={{ color: "var(--text-muted)", opacity: 0.5 }} />;
  return sortDir === "asc"
    ? <ArrowUp size={10} style={{ color: "#60a5fa" }} />
    : <ArrowDown size={10} style={{ color: "#60a5fa" }} />;
}

export default function LedgerTable({ rows, onRowClick, showEntity, sortKey, sortDir, onSort, loading }: Props) {
  const thClass = "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap select-none";
  const thStyle = { color: "var(--text-muted)", background: "var(--bg-surface2)" };

  function SortTh({ col, label, right }: { col: SortKey; label: string; right?: boolean }) {
    return (
      <th
        className={`${thClass} ${right ? "text-right" : ""} cursor-pointer hover:text-primary transition-colors`}
        style={thStyle}
        onClick={() => onSort?.(col)}
      >
        <span className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""}`}>
          {label}
          <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
        </span>
      </th>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
          <span className="text-2xl">📒</span>
        </div>
        <p className="text-sm font-medium text-primary">No ledger entries found</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Entries appear automatically when transactions are recorded
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className={thClass} style={thStyle}>#</th>
            <th className={thClass} style={thStyle}>TID</th>
            <SortTh col="entry_date" label="Date" />
            {showEntity === "client"   && <th className={thClass} style={thStyle}>Client</th>}
            {showEntity === "dealer"   && <th className={thClass} style={thStyle}>Dealer</th>}
            {showEntity === "property" && <th className={thClass} style={thStyle}>Property</th>}
            <th className={thClass} style={thStyle}>Description</th>
            <th className={thClass} style={thStyle}>Ref No</th>
            <th className={thClass} style={thStyle}>Type</th>
            <SortTh col="debit"           label="Debit"   right />
            <SortTh col="credit"          label="Credit"  right />
            <SortTh col="running_balance" label="Balance" right />
            <th className={thClass} style={thStyle}>Status</th>
            <ActionsTh className={thClass} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isEven = idx % 2 === 0;
            const rowBg  = isEven ? "transparent" : "rgba(255,255,255,0.015)";
            return (
              <tr
                key={row.id}
                onClick={() => onRowClick(row)}
                style={{
                  background: rowBg,
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--hover-bg-sm)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = rowBg}
              >
                {/* Row # */}
                <td style={{ padding: "0.65rem 0.75rem", color: "var(--text-muted)", fontSize: "0.7rem" }}>
                  {idx + 1}
                </td>
                {/* TID */}
                <td style={{ padding: "0.65rem 0.75rem" }}>
                  <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{row.tid}</span>
                </td>
                {/* Date */}
                <td style={{ padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {new Date(row.entry_date).toLocaleDateString("en-PK", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </span>
                </td>
                {/* Entity name */}
                {showEntity === "client" && (
                  <td style={{ padding: "0.65rem 0.75rem" }}>
                    <span className="text-xs font-medium text-primary">{row.client_name ?? "—"}</span>
                  </td>
                )}
                {showEntity === "dealer" && (
                  <td style={{ padding: "0.65rem 0.75rem" }}>
                    <span className="text-xs font-medium text-primary">{row.dealer_name ?? "—"}</span>
                  </td>
                )}
                {showEntity === "property" && (
                  <td style={{ padding: "0.65rem 0.75rem" }}>
                    <span className="text-xs font-medium text-primary">{row.property_name ?? "—"}</span>
                  </td>
                )}
                {/* Description */}
                <td style={{ padding: "0.65rem 0.75rem", maxWidth: "220px" }}>
                  <span className="text-xs text-primary truncate block" title={row.description}>
                    {row.description}
                  </span>
                </td>
                {/* Ref No */}
                <td style={{ padding: "0.65rem 0.75rem" }}>
                  <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {row.reference_no ?? "—"}
                  </span>
                </td>
                {/* Type */}
                <td style={{ padding: "0.65rem 0.75rem" }}>
                  <TypeBadge type={row.entry_type} />
                </td>
                {/* Debit — red tone */}
                <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", whiteSpace: "nowrap" }}>
                  {row.debit > 0 ? (
                    <span className="text-xs font-semibold" style={{ color: "#f87171" }}>
                      {formatCurrency(row.debit)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>—</span>
                  )}
                </td>
                {/* Credit — green tone */}
                <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", whiteSpace: "nowrap" }}>
                  {row.credit > 0 ? (
                    <span className="text-xs font-semibold" style={{ color: "#34d399" }}>
                      {formatCurrency(row.credit)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>—</span>
                  )}
                </td>
                {/* Running Balance */}
                <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", whiteSpace: "nowrap" }}>
                  <span
                    className="text-xs font-bold"
                    style={{ color: row.running_balance >= 0 ? "#60a5fa" : "#f87171" }}
                  >
                    {row.running_balance < 0 ? "-" : ""}{formatCurrency(Math.abs(row.running_balance))}
                  </span>
                </td>
                {/* Status */}
                <td style={{ padding: "0.65rem 0.75rem" }}>
                  <StatusBadge status={row.status} />
                </td>
                <ActionsCell className="!px-3 !py-2">
                  <QuickRowActions
                    row={row}
                    compact
                    onView={onRowClick}
                    onPrint={(r) => printRecord(`Ledger ${r.tid}`, [
                      { label: "Date", value: r.entry_date },
                      { label: "Description", value: r.description },
                      { label: "Debit", value: r.debit > 0 ? formatCurrency(r.debit) : "—" },
                      { label: "Credit", value: r.credit > 0 ? formatCurrency(r.credit) : "—" },
                      { label: "Balance", value: formatCurrency(Math.abs(r.running_balance)) },
                    ])}
                    hiddenActions={["edit", "delete"]}
                  />
                </ActionsCell>
              </tr>
            );
          })}
        </tbody>
        {/* ── Totals footer ── */}
        {rows.length > 0 && (() => {
          const totalDebit  = rows.reduce((s, r) => s + r.debit,  0);
          const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
          const lastBalance = rows[rows.length - 1]?.running_balance ?? 0;
          return (
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)", background: "var(--bg-surface2)" }}>
                <td colSpan={showEntity ? 8 : 7}
                  style={{ padding: "0.65rem 0.75rem", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Totals
                </td>
                <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", whiteSpace: "nowrap" }}>
                  <span className="text-xs font-bold" style={{ color: "#f87171" }}>{formatCurrency(totalDebit)}</span>
                </td>
                <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", whiteSpace: "nowrap" }}>
                  <span className="text-xs font-bold" style={{ color: "#34d399" }}>{formatCurrency(totalCredit)}</span>
                </td>
                <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", whiteSpace: "nowrap" }}>
                  <span className="text-xs font-bold" style={{ color: lastBalance >= 0 ? "#60a5fa" : "#f87171" }}>
                    {lastBalance < 0 ? "-" : ""}{formatCurrency(Math.abs(lastBalance))}
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          );
        })()}
      </table>
    </div>
  );
}
