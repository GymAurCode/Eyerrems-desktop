/**
 * AccountDetailPanel — right-side drill-down for Chart of Accounts.
 * Views: summary → details → ledgers (no routing).
 */
import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft, BookOpen, ChevronRight, Edit2, Trash2,
  ToggleLeft, ToggleRight, AlertCircle, CheckCircle2,
  FileText, Layers,
} from "lucide-react";
import {
  journalsApi,
  mapLedgerEntriesForGeneralLedger,
  type AccountTreeNode,
  type LedgerResponse,
} from "../../lib/financeApi";
import { formatCurrency } from "../../lib/currency";
import GeneralLedger from "./GeneralLedger";

export type AccountPanelView = "summary" | "details" | "ledgers";

const TYPE_COLOR: Record<string, [string, string]> = {
  Asset:     ["rgba(59,130,246,0.12)",  "#3b82f6"],
  Liability: ["rgba(239,68,68,0.12)",   "#ef4444"],
  Income:    ["rgba(16,185,129,0.12)",  "#10b981"],
  Expense:   ["rgba(245,158,11,0.12)",  "#f59e0b"],
  Equity:    ["rgba(139,92,246,0.12)",  "#8b5cf6"],
};

function TypeBadge({ type }: { type: string }) {
  const [bg, color] = TYPE_COLOR[type] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: bg, color }}>
      {type}
    </span>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-5 w-2/3 rounded-lg" style={{ background: "var(--hover-bg)" }} />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-8 rounded-lg" style={{ background: "var(--hover-bg-sm)" }} />
      ))}
    </div>
  );
}

export interface AccountDetailPanelProps {
  account: AccountTreeNode | null;
  panelView: AccountPanelView;
  onViewChange: (view: AccountPanelView) => void;
  onEdit: (a: AccountTreeNode) => void;
  onDelete: (a: AccountTreeNode) => void;
  onToggleActive: (a: AccountTreeNode) => void;
}

export default function AccountDetailPanel({
  account,
  panelView,
  onViewChange,
  onEdit,
  onDelete,
  onToggleActive,
}: AccountDetailPanelProps) {
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => {
    if (!account || (panelView !== "details" && panelView !== "ledgers")) {
      setLedger(null);
      return;
    }
    let cancelled = false;
    setLedgerLoading(true);
    journalsApi.ledger(account.id)
      .then(data => { if (!cancelled) setLedger(data as LedgerResponse); })
      .catch(() => { if (!cancelled) setLedger(null); })
      .finally(() => { if (!cancelled) setLedgerLoading(false); });
    return () => { cancelled = true; };
  }, [account?.id, panelView]);

  const refreshLedger = async () => {
    if (!account) return;
    setLedgerLoading(true);
    try {
      const data = await journalsApi.ledger(account.id);
      setLedger(data as LedgerResponse);
    } catch {
      setLedger(null);
    } finally {
      setLedgerLoading(false);
    }
  };

  const txSummary = useMemo(() => {
    if (!ledger?.entries?.length) return null;
    const entries = ledger.entries;
    const debit = entries.reduce((s, e) => s + Number(e.debit || 0), 0);
    const credit = entries.reduce((s, e) => s + Number(e.credit || 0), 0);
    return { count: entries.length, debit, credit };
  }, [ledger]);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6"
        style={{ color: "var(--text-muted)" }}>
        <BookOpen size={32} style={{ opacity: 0.3 }} />
        <p className="text-xs text-center">Select an account from the chart to view summary and ledgers</p>
      </div>
    );
  }

  const [, color] = TYPE_COLOR[account.account_type] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  const childCount = account.children?.length ?? 0;

  const goBack = () => {
    if (panelView === "ledgers") onViewChange("summary");
    else if (panelView === "details") onViewChange("summary");
  };

  const headerTitle =
    panelView === "summary" ? account.name :
    panelView === "details" ? "Account Details" :
    "Account Ledger";

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2 mb-2">
          {panelView !== "summary" && (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <ArrowLeft size={12} /> Back
            </button>
          )}
          <span className="text-[10px] uppercase tracking-widest font-semibold ml-auto"
            style={{ color: "var(--text-muted)" }}>
            {panelView === "summary" ? "Summary" : panelView === "details" ? "Details" : "Ledger"}
          </span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-primary truncate">{headerTitle}</h3>
            <p className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>{account.code}</p>
          </div>
          <TypeBadge type={account.account_type} />
        </div>
      </div>

      {panelView === "summary" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="p-4 rounded-xl text-center"
              style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                Current Balance
              </p>
              <p className="text-2xl font-bold" style={{ color }}>{formatCurrency(account.balance)}</p>
            </div>

            {account.description && (
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {account.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <StatPill label="Type" value={account.account_type} />
              <StatPill label="Sub-accounts" value={String(childCount)} />
              <StatPill label="Status" value={account.is_active ? "Active" : "Inactive"} />
              <StatPill label="Code" value={account.code} mono />
            </div>
          </div>

          <div className="px-5 py-4 space-y-2 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <button
              type="button"
              onClick={() => onViewChange("details")}
              className="w-full flex items-center justify-between gap-2 py-2.5 px-3 text-xs font-medium rounded-lg transition-colors"
              style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
            >
              <span className="flex items-center gap-2"><Layers size={13} /> More</span>
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => onViewChange("ledgers")}
              className="w-full flex items-center justify-between gap-2 py-2.5 px-3 text-xs font-medium rounded-lg transition-colors"
              style={{ background: "var(--bg-surface2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              <span className="flex items-center gap-2"><BookOpen size={13} /> View Ledgers</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {panelView === "details" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {ledgerLoading && !ledger ? (
              <PanelSkeleton />
            ) : (
              <>
                <DetailRow label="Account Code" value={<span className="font-mono text-xs" style={{ color: "#60a5fa" }}>{account.code}</span>} />
                <DetailRow label="Account Type" value={<TypeBadge type={account.account_type} />} />
                <DetailRow
                  label="Status"
                  value={
                    account.is_active
                      ? <span className="flex items-center gap-1 text-xs" style={{ color: "#10b981" }}><CheckCircle2 size={12} /> Active</span>
                      : <span className="flex items-center gap-1 text-xs" style={{ color: "#94a3b8" }}><AlertCircle size={12} /> Inactive</span>
                  }
                />
                <DetailRow label="Balance" value={<span className="font-bold text-sm" style={{ color }}>{formatCurrency(account.balance)}</span>} />
                <DetailRow
                  label="Description"
                  value={account.description || <span style={{ color: "var(--text-muted)" }}>—</span>}
                />

                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                    Transactions Summary
                  </p>
                  {txSummary ? (
                    <div className="grid grid-cols-3 gap-2">
                      <StatPill label="Entries" value={String(txSummary.count)} />
                      <StatPill label="Debit" value={formatCurrency(txSummary.debit)} />
                      <StatPill label="Credit" value={formatCurrency(txSummary.credit)} />
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No posted transactions yet.</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="px-5 py-4 space-y-2 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <button type="button" onClick={() => onViewChange("ledgers")}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs rounded-lg"
              style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
              <BookOpen size={12} /> View Ledgers
            </button>
            <button type="button" onClick={() => onEdit(account)}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs rounded-lg"
              style={{ background: "var(--bg-surface2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              <Edit2 size={12} /> Edit Account
            </button>
            <button type="button" onClick={() => onToggleActive(account)}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs rounded-lg"
              style={{ background: "var(--bg-surface2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {account.is_active ? <><ToggleRight size={12} /> Deactivate</> : <><ToggleLeft size={12} /> Activate</>}
            </button>
            <button type="button" onClick={() => onDelete(account)}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}>
              <Trash2 size={12} /> Delete Account
            </button>
          </div>
        </div>
      )}

      {panelView === "ledgers" && (
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {ledgerLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: "var(--hover-bg-sm)" }} />
              ))}
            </div>
          ) : ledger ? (
            <GeneralLedger
              accountId={account.id}
              accountCode={account.code}
              accountName={account.name}
              entries={mapLedgerEntriesForGeneralLedger(ledger.entries)}
              openingBalance={String(ledger.opening_balance ?? 0)}
              closingBalance={String(ledger.closing_balance ?? 0)}
              onRefresh={refreshLedger}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <FileText size={24} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No ledger entries for this account.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="p-2.5 rounded-lg" style={{ background: "var(--hover-bg-sm)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className={`text-xs font-semibold text-primary truncate ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 gap-3"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="text-xs shrink-0 w-28" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-xs font-medium text-right flex-1">{value}</span>
    </div>
  );
}
