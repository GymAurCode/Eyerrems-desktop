/**
 * UnifiedLedgersTab — all ledger types in Finance module (no routing).
 * Filters: All | Accounts | Clients | Dealers | Properties
 */
import { useCallback, useEffect, useState } from "react";
import {
  BookOpen, Users, Building2, Briefcase, RefreshCw, Scale, LayoutGrid,
} from "lucide-react";
import {
  accountsApi,
  journalsApi,
  mapLedgerEntriesForGeneralLedger,
  type Account,
  type LedgerResponse,
} from "../../lib/financeApi";
import { ledgerApi } from "../../lib/ledgerApi";
import GeneralLedger from "./GeneralLedger";
import ClientLedger from "../../pages/ledger/ClientLedger";
import DealerLedger from "../../pages/ledger/DealerLedger";
import PropertyLedger from "../../pages/ledger/PropertyLedger";

export type LedgerFilter = "all" | "accounts" | "client" | "dealer" | "property";

const FILTERS: { id: LedgerFilter; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: "all",       label: "All",        icon: LayoutGrid,  color: "#94a3b8", desc: "Overview of all ledger types" },
  { id: "accounts",  label: "Accounts",   icon: Scale,       color: "#6366f1", desc: "General ledger by account" },
  { id: "client",    label: "Clients",    icon: Users,       color: "#3b82f6", desc: "Client financial activity" },
  { id: "dealer",    label: "Dealers",    icon: Briefcase,   color: "#f59e0b", desc: "Commission & payout tracking" },
  { id: "property",  label: "Properties", icon: Building2,   color: "#10b981", desc: "Property financial history" },
];

function AccountsLedgerSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [accsLoaded, setAccsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await accountsApi.list();
        if (!cancelled) {
          setAccounts(data);
          setAccsLoaded(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadLedger = useCallback(async (id: number, s?: string, e?: string) => {
    setLoading(true);
    try {
      const data = await journalsApi.ledger(id, { start_date: s, end_date: e });
      setLedger(data);
    } catch (err) {
      console.error(err);
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectAccount = (id: number) => {
    setSelectedId(id);
    void loadLedger(id, startDate, endDate);
  };

  const handleDateChange = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
    if (selectedId) void loadLedger(selectedId, s, e);
  };

  const handleRefresh = useCallback(async () => {
    if (selectedId) await loadLedger(selectedId, startDate, endDate);
  }, [selectedId, startDate, endDate, loadLedger]);

  return (
    <div className="space-y-4">
      <div className="detail-container">
        <div className="detail-section">
          <p className="detail-section-title">Account Ledger</p>
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
              onClick={() => void handleRefresh()}
              disabled={!selectedId || loading}
              className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Load
            </button>
          </div>
        </div>
      </div>

      {!selectedId && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
            <Scale size={24} style={{ color: "#6366f1" }} />
          </div>
          <p className="text-sm font-medium text-primary">Select an account to view its ledger</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Choose an account from the dropdown above
          </p>
        </div>
      )}

      {loading && selectedId && !ledger && (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg" style={{ background: "var(--hover-bg-sm)" }} />
          ))}
        </div>
      )}

      {ledger && (
        <GeneralLedger
          accountId={ledger.account_id}
          accountCode={ledger.code}
          accountName={ledger.name}
          entries={mapLedgerEntriesForGeneralLedger(ledger.entries ?? [])}
          openingBalance={String(ledger.opening_balance ?? 0)}
          closingBalance={String(ledger.closing_balance ?? 0)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}

function AllLedgersOverview({ onSelect }: { onSelect: (f: LedgerFilter) => void }) {
  const [counts, setCounts] = useState({ accounts: 0, clients: 0, dealers: 0, properties: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [accs, clients, dealers, props] = await Promise.allSettled([
          accountsApi.list(),
          ledgerApi.clientList(),
          ledgerApi.dealerList(),
          ledgerApi.propertyList(),
        ]);
        if (!cancelled) {
          setCounts({
            accounts: accs.status === "fulfilled" ? accs.value.length : 0,
            clients: clients.status === "fulfilled" ? clients.value.length : 0,
            dealers: dealers.status === "fulfilled" ? dealers.value.length : 0,
            properties: props.status === "fulfilled" ? props.value.length : 0,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    { filter: "accounts" as const, label: "Account Ledger", count: counts.accounts, icon: Scale, color: "#6366f1" },
    { filter: "client" as const, label: "Client Ledger", count: counts.clients, icon: Users, color: "#3b82f6" },
    { filter: "dealer" as const, label: "Dealer Ledger", count: counts.dealers, icon: Briefcase, color: "#f59e0b" },
    { filter: "property" as const, label: "Property Ledger", count: counts.properties, icon: Building2, color: "#10b981" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Unified ledger workspace — select a type below or use the filters.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ filter, label, count, icon: Icon, color }) => (
          <button
            key={filter}
            type="button"
            onClick={() => onSelect(filter)}
            className="detail-container text-left p-4 transition-all hover:scale-[1.01]"
            style={{ borderColor: `${color}30` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">{label}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {loading ? "…" : `${count} records`}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-medium" style={{ color }}>Open →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function UnifiedLedgersTab() {
  const [filter, setFilter] = useState<LedgerFilter>("all");

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center gap-2 flex-wrap">
        <BookOpen size={16} style={{ color: "#60a5fa" }} />
        <p className="text-sm font-semibold text-primary">Ledger Management</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
          Unified
        </span>
      </div>

      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex gap-0 overflow-x-auto">
          {FILTERS.map(({ id, label, icon: Icon, color }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap"
                style={{
                  borderBottomColor: active ? color : "transparent",
                  color: active ? color : "var(--text-muted)",
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {filter === "all" && <AllLedgersOverview onSelect={setFilter} />}
        {filter === "accounts" && <AccountsLedgerSection />}
        {filter === "client" && <ClientLedger />}
        {filter === "dealer" && <DealerLedger />}
        {filter === "property" && <PropertyLedger />}
      </div>
    </div>
  );
}
