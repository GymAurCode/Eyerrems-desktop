/**
 * LedgersPage — Unified Ledger Management.
 * Accessible at /ledger (Finance → Ledger in sidebar).
 *
 * Four sub-tabs:
 *   Accounts  — General Ledger (account-level double-entry view)
 *   Clients   — Client financial activity
 *   Dealers   — Commission & payout tracking
 *   Properties — Property financial history
 */
import { useCallback, useState } from "react";
import { BookOpen, Users, Building2, Briefcase, RefreshCw, Scale } from "lucide-react";
import { accountsApi, journalsApi, type Account, type LedgerResponse } from "../../lib/financeApi";
import GeneralLedger from "../../components/finance/GeneralLedger";
import ClientLedger   from "./ClientLedger";
import DealerLedger   from "./DealerLedger";
import PropertyLedger from "./PropertyLedger";

type LedgerTab = "accounts" | "client" | "dealer" | "property";

const TABS: { id: LedgerTab; label: string; icon: React.ElementType; desc: string; color: string }[] = [
  { id: "accounts",  label: "Accounts",   icon: Scale,     desc: "General ledger by account",    color: "#6366f1" },
  { id: "client",    label: "Clients",    icon: Users,     desc: "Client financial activity",     color: "#3b82f6" },
  { id: "dealer",    label: "Dealers",    icon: Briefcase, desc: "Commission & payout tracking",  color: "#f59e0b" },
  { id: "property",  label: "Properties", icon: Building2, desc: "Property financial history",    color: "#10b981" },
];

// ── Accounts (General Ledger) sub-tab ─────────────────────────────────────────
function AccountsLedgerTab() {
  const [accounts,    setAccounts]    = useState<Account[]>([]);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [ledger,      setLedger]      = useState<LedgerResponse | null>(null);
  const [startDate,   setStartDate]   = useState("");
  const [endDate,     setEndDate]     = useState("");
  const [loading,     setLoading]     = useState(false);
  const [accsLoaded,  setAccsLoaded]  = useState(false);

  // Lazy-load accounts on first render of this tab
  const loadAccounts = useCallback(async () => {
    if (accsLoaded) return;
    setLoading(true);
    try {
      const data = await accountsApi.list();
      setAccounts(data);
      setAccsLoaded(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [accsLoaded]);

  // Run once when tab mounts
  useState(() => { void loadAccounts(); });

  const loadLedger = useCallback(async (id: number, s?: string, e?: string) => {
    setLoading(true);
    try {
      const data = await journalsApi.ledger(id, { start_date: s, end_date: e });
      setLedger(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const handleSelectAccount = (id: number) => {
    setSelectedId(id);
    loadLedger(id, startDate, endDate);
  };

  const handleDateChange = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
    if (selectedId) loadLedger(selectedId, s, e);
  };

  const handleRefresh = useCallback(async () => {
    if (selectedId) await loadLedger(selectedId, startDate, endDate);
  }, [selectedId, startDate, endDate, loadLedger]);

  return (
    <div className="space-y-4">
      {/* Account selector + date range */}
      <div className="detail-container">
        <div className="detail-section">
          <p className="detail-section-title">General Ledger</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--text-muted)" }}>Account</label>
              <select
                className="select-dark px-3 py-2 text-sm w-full"
                value={selectedId ?? ""}
                onChange={e => handleSelectAccount(Number(e.target.value))}
                disabled={loading && !accsLoaded}
              >
                <option value="">
                  {loading && !accsLoaded ? "Loading accounts…" : "Select account…"}
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--text-muted)" }}>From</label>
              <input type="date" className="input-dark px-3 py-2 text-sm"
                value={startDate}
                onChange={e => handleDateChange(e.target.value, endDate)} />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--text-muted)" }}>To</label>
              <input type="date" className="input-dark px-3 py-2 text-sm"
                value={endDate}
                onChange={e => handleDateChange(startDate, e.target.value)} />
            </div>

            <button
              onClick={handleRefresh}
              disabled={!selectedId || loading}
              className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Load
            </button>
          </div>
        </div>
      </div>

      {/* Ledger table */}
      {!selectedId && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
            <Scale size={24} style={{ color: "#6366f1" }} />
          </div>
          <p className="text-sm font-medium text-primary">Select an account to view its ledger</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Choose an account from the dropdown above to load its transaction history
          </p>
        </div>
      )}

      {ledger && (
        <GeneralLedger
          accountId={ledger.account_id}
          accountCode={ledger.code}
          accountName={ledger.name}
          entries={ledger.entries ?? []}
          openingBalance={String(ledger.opening_balance ?? 0)}
          closingBalance={String(ledger.closing_balance ?? 0)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LedgersPage() {
  const [tab, setTab] = useState<LedgerTab>("accounts");

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <BookOpen size={18} style={{ color: "#3b82f6" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Ledger Management</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Accounts · Clients · Dealers · Properties
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex gap-0">
          {TABS.map(({ id, label, icon: Icon, color }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all duration-150 whitespace-nowrap"
                style={{
                  borderBottomColor: active ? color : "transparent",
                  color: active ? color : "var(--text-muted)",
                }}
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                  style={{
                    background: active ? `${color}18` : "transparent",
                  }}
                >
                  <Icon size={12} style={{ color: active ? color : "var(--text-muted)" }} />
                </div>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div>
        {tab === "accounts"  && <AccountsLedgerTab />}
        {tab === "client"    && <ClientLedger />}
        {tab === "dealer"    && <DealerLedger />}
        {tab === "property"  && <PropertyLedger />}
      </div>
    </div>
  );
}
