/**
 * LedgerDetailModal — Full-detail drawer/modal for any ledger entry.
 * Shows complete transaction metadata, linked entities, notes, audit info.
 */
import { X, Hash, Calendar, FileText, Tag, CreditCard, User, Clock, BookOpen, Link2, StickyNote } from "lucide-react";
import { formatCurrency } from "../../lib/currency";

export interface LedgerEntryDetail {
  id:               number;
  tid:              string;
  entry_date:       string;
  description:      string;
  reference_no:     string | null;
  entry_type:       string;
  debit:            number;
  credit:           number;
  running_balance:  number;
  status:           string;
  notes:            string | null;
  created_by_name:  string | null;
  created_at:       string;
  // Client ledger extras
  client_id?:       number;
  client_name?:     string | null;
  client_code?:     string | null;
  payment_method?:  string | null;
  journal_id?:      number | null;
  // Dealer ledger extras
  dealer_id?:       number;
  dealer_name?:     string | null;
  deal_id?:         number | null;
  deal_ref?:        string | null;
  commission_rate?: number | null;
  gross_commission?: number | null;
  // Property ledger extras
  property_id?:     number;
  property_name?:   string | null;
  property_tid?:    string | null;
}

interface Props {
  entry:   LedgerEntryDetail | null;
  onClose: () => void;
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

function Field({ icon: Icon, label, value, mono, accent }: {
  icon: React.ElementType; label: string; value: React.ReactNode;
  mono?: boolean; accent?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
        <Icon size={12} style={{ color: "var(--text-muted)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
          style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className={`text-sm ${mono ? "font-mono" : "font-medium"}`}
          style={{ color: accent ?? "var(--text-primary)", wordBreak: "break-word" }}>
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

export default function LedgerDetailModal({ entry, onClose }: Props) {
  if (!entry) return null;

  const [typeBg, typeColor] = ENTRY_TYPE_COLORS[entry.entry_type] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  const [statusBg, statusColor] = STATUS_COLORS[entry.status] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];

  const netEffect = entry.debit - entry.credit;

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={onClose}
        style={{ animation: "modalFadeIn 0.2s ease-out" }}
      />

      {/* Drawer — slides in from right */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100vw)",
          zIndex: 51,
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: typeBg, border: `1px solid ${typeColor}30` }}>
              <BookOpen size={15} style={{ color: typeColor }} />
            </div>
            <div>
              <p className="text-sm font-bold text-primary">Transaction Detail</p>
              <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{entry.tid}</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>

          {/* ── Amount Summary Card ── */}
          <div className="rounded-2xl p-4 mb-4" style={{
            background: "var(--bg-surface2)",
            border: "1px solid var(--border)",
          }}>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                  style={{ color: "var(--text-muted)" }}>Debit</p>
                <p className="text-lg font-bold" style={{ color: entry.debit > 0 ? "#f87171" : "var(--text-muted)" }}>
                  {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                </p>
              </div>
              <div className="text-center" style={{ borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                  style={{ color: "var(--text-muted)" }}>Credit</p>
                <p className="text-lg font-bold" style={{ color: entry.credit > 0 ? "#34d399" : "var(--text-muted)" }}>
                  {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                  style={{ color: "var(--text-muted)" }}>Balance</p>
                <p className="text-lg font-bold"
                  style={{ color: entry.running_balance >= 0 ? "#60a5fa" : "#f87171" }}>
                  {entry.running_balance < 0 ? "-" : ""}{formatCurrency(Math.abs(entry.running_balance))}
                </p>
              </div>
            </div>

            {/* Net effect */}
            <div className="mt-3 pt-3 flex items-center justify-between"
              style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}>Net Effect</span>
              <span className="text-sm font-bold"
                style={{ color: netEffect > 0 ? "#f87171" : netEffect < 0 ? "#34d399" : "var(--text-muted)" }}>
                {netEffect > 0 ? "+" : ""}{formatCurrency(netEffect)}
                <span className="text-[10px] ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
                  {netEffect > 0 ? "(Debit)" : netEffect < 0 ? "(Credit)" : ""}
                </span>
              </span>
            </div>
          </div>

          {/* ── Badges ── */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
              style={{ background: typeBg, color: typeColor }}>
              {entry.entry_type.replace(/_/g, " ")}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
              style={{ background: statusBg, color: statusColor }}>
              {entry.status}
            </span>
          </div>

          {/* ── Transaction Details ── */}
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-muted)" }}>Transaction Details</p>

            <Field icon={Hash}     label="Entry ID"     value={`#${entry.id}`} mono />
            <Field icon={Hash}     label="TID"          value={entry.tid} mono />
            <Field icon={Calendar} label="Entry Date"   value={new Date(entry.entry_date).toLocaleString("en-PK", {
              day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
            })} />
            <Field icon={FileText} label="Description"  value={entry.description} />
            {entry.reference_no && (
              <Field icon={Hash} label="Reference No" value={entry.reference_no} mono />
            )}
            {entry.payment_method && (
              <Field icon={CreditCard} label="Payment Method" value={entry.payment_method} />
            )}
          </div>

          {/* ── Linked Entities ── */}
          {(entry.client_name || entry.dealer_name || entry.property_name || entry.deal_ref) && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}>Linked Entities</p>

              {entry.client_name && (
                <Field icon={User}  label="Client"
                  value={`${entry.client_name}${entry.client_code ? ` (${entry.client_code})` : ""}`} />
              )}
              {entry.dealer_name && (
                <Field icon={User}  label="Dealer" value={entry.dealer_name} />
              )}
              {entry.deal_ref && (
                <Field icon={Link2} label="Deal Reference" value={entry.deal_ref} mono />
              )}
              {entry.property_name && (
                <Field icon={BookOpen} label="Property"
                  value={`${entry.property_name}${entry.property_tid ? ` (${entry.property_tid})` : ""}`} />
              )}
            </div>
          )}

          {/* ── Commission Details (Dealer only) ── */}
          {(entry.commission_rate != null || entry.gross_commission != null) && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}>Commission Details</p>
              {entry.commission_rate != null && (
                <Field icon={Tag} label="Commission Rate"
                  value={`${(entry.commission_rate * 100).toFixed(2)}%`} />
              )}
              {entry.gross_commission != null && (
                <Field icon={Tag} label="Gross Commission"
                  value={formatCurrency(entry.gross_commission)} accent="#f59e0b" />
              )}
            </div>
          )}

          {/* ── Journal Link ── */}
          {entry.journal_id && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}>Accounting</p>
              <Field icon={BookOpen} label="Journal ID" value={`#${entry.journal_id}`} mono />
            </div>
          )}

          {/* ── Notes ── */}
          {entry.notes && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}>Notes</p>
              <div className="rounded-xl p-3" style={{
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.15)",
              }}>
                <div className="flex items-start gap-2">
                  <StickyNote size={12} style={{ color: "#f59e0b", marginTop: "2px", flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {entry.notes}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Audit Info ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-muted)" }}>Audit Information</p>
            {entry.created_by_name && (
              <Field icon={User}  label="Created By" value={entry.created_by_name} />
            )}
            <Field icon={Clock} label="Created At" value={new Date(entry.created_at).toLocaleString("en-PK", {
              day: "2-digit", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            })} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "0.875rem 1.25rem",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
          display: "flex",
          justifyContent: "flex-end",
        }}>
          <button onClick={onClose} className="btn-ghost text-xs px-4 py-2">
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
