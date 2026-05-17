/**
 * DealerLedger — Dealer commission & payout ledger.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { Briefcase, ChevronRight, ArrowLeft, Plus, Search } from "lucide-react";
import {
  ledgerApi,
  type DealerLedgerListItem,
  type DealerLedgerEntry,
  type DealerLedgerResponse,
  type DealerLedgerEntryCreate,
} from "../../lib/ledgerApi";
import { formatCurrency } from "../../lib/currency";
import LedgerTable, { type LedgerRow } from "./LedgerTable";
import LedgerFilters, { type FilterState } from "./LedgerFilters";
import LedgerSummaryCards from "./LedgerSummaryCards";
import LedgerDetailModal, { type LedgerEntryDetail } from "./LedgerDetailModal";
import AddEntryModal from "./AddEntryModal";
import { exportLedgerPDF, exportLedgerExcel, printLedger } from "./ledgerExport";

const DEALER_ENTRY_TYPES = ["commission", "payout", "adjustment", "bonus", "penalty"];

type SortKey = "entry_date" | "debit" | "credit" | "running_balance";
type SortDir = "asc" | "desc";

export default function DealerLedger() {
  const [dealers,        setDealers]        = useState<DealerLedgerListItem[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<DealerLedgerListItem | null>(null);
  const [ledger,         setLedger]         = useState<DealerLedgerResponse | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [detailEntry,    setDetailEntry]    = useState<LedgerEntryDetail | null>(null);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [dealerSearch,   setDealerSearch]   = useState("");
  const [sortKey,        setSortKey]        = useState<SortKey>("entry_date");
  const [sortDir,        setSortDir]        = useState<SortDir>("asc");
  const [filters, setFilters] = useState<FilterState>({
    search: "", start_date: "", end_date: "", entry_type: "", status: "",
  });

  const loadDealers = useCallback(async () => {
    setLoading(true);
    try { setDealers(await ledgerApi.dealerList()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadDealerLedger = useCallback(async (dealerId: number, f?: FilterState) => {
    setLoading(true);
    try {
      setLedger(await ledgerApi.dealerLedger(dealerId, {
        start_date: f?.start_date || undefined,
        end_date:   f?.end_date   || undefined,
        entry_type: f?.entry_type || undefined,
        status:     f?.status     || undefined,
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDealers(); }, [loadDealers]);

  const displayedEntries = useMemo(() => {
    let rows = (ledger?.entries ?? []) as DealerLedgerEntry[];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(r =>
        r.description.toLowerCase().includes(q) ||
        (r.reference_no ?? "").toLowerCase().includes(q) ||
        r.tid.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [ledger, filters.search, sortKey, sortDir]);

  const handleSelectDealer = (d: DealerLedgerListItem) => {
    setSelectedDealer(d);
    setFilters({ search: "", start_date: "", end_date: "", entry_type: "", status: "" });
    loadDealerLedger(d.id);
  };

  const handleBack = () => { setSelectedDealer(null); setLedger(null); };

  const handleFilterChange = (f: FilterState) => {
    setFilters(f);
    if (selectedDealer) loadDealerLedger(selectedDealer.id, f);
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleRowClick = (row: LedgerRow) => {
    const entry = ledger?.entries.find(e => e.id === row.id);
    if (!entry) return;
    setDetailEntry({
      ...entry,
      debit:  Number(entry.debit),
      credit: Number(entry.credit),
      running_balance: Number(entry.running_balance),
      commission_rate: entry.commission_rate != null ? Number(entry.commission_rate) : null,
      gross_commission: entry.gross_commission != null ? Number(entry.gross_commission) : null,
    });
  };

  const handleAddEntry = async (data: DealerLedgerEntryCreate) => {
    await ledgerApi.createDealerEntry(data);
    if (selectedDealer) await loadDealerLedger(selectedDealer.id, filters);
    await loadDealers();
  };

  const toRows = (entries: DealerLedgerEntry[]): LedgerRow[] =>
    entries.map(e => ({
      id:              e.id,
      tid:             e.tid,
      entry_date:      e.entry_date,
      description:     e.description,
      reference_no:    e.reference_no,
      entry_type:      e.entry_type,
      debit:           Number(e.debit),
      credit:          Number(e.credit),
      running_balance: Number(e.running_balance),
      status:          e.status,
      deal_ref:        e.deal_ref,
    }));

  const filteredDealers = dealers.filter(d =>
    d.name.toLowerCase().includes(dealerSearch.toLowerCase()) ||
    d.dealer_id.toLowerCase().includes(dealerSearch.toLowerCase())
  );

  const exportTitle = selectedDealer
    ? `Dealer Ledger — ${selectedDealer.name} (${selectedDealer.dealer_id})`
    : "Dealer Ledger";

  // ── Dealer List View ───────────────────────────────────────────────────────
  if (!selectedDealer) {
    return (
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }} />
          <input type="text" placeholder="Search dealers…" value={dealerSearch}
            onChange={e => setDealerSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
        </div>

        <div className="detail-container">
          <div className="detail-section flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase size={14} style={{ color: "#f59e0b" }} />
              <p className="detail-section-title mb-0">Dealers with Ledger Activity</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
              {filteredDealers.length} dealers
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : filteredDealers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                <Briefcase size={20} style={{ color: "#f59e0b" }} />
              </div>
              <p className="text-sm font-medium text-primary">No dealer ledger entries yet</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Entries are created automatically when commissions are generated
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
                    {["Dealer", "Code", "Total Commission", "Total Paid", "Remaining", "Entries", ""].map(h => (
                      <th key={h} style={{
                        padding: "0.625rem 1rem",
                        textAlign: h === "" || h === "Entries" || h.includes("Total") || h === "Remaining" ? "right" : "left",
                        fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em",
                        textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDealers.map((d, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg  = isEven ? "transparent" : "rgba(255,255,255,0.015)";
                    return (
                      <tr key={d.id} onClick={() => handleSelectDealer(d)}
                        style={{ background: rowBg, borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", transition: "background 0.12s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--hover-bg-sm)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = rowBg}>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}>
                              {d.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-primary">{d.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{d.dealer_id}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs font-semibold" style={{ color: "#f87171" }}>{formatCurrency(d.total_debit)}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs font-semibold" style={{ color: "#34d399" }}>{formatCurrency(d.total_credit)}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs font-bold" style={{ color: d.balance >= 0 ? "#60a5fa" : "#f87171" }}>
                            {d.balance < 0 ? "-" : ""}{formatCurrency(Math.abs(d.balance))}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{d.entry_count}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Individual Dealer Ledger View ──────────────────────────────────────────
  const summary = ledger?.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={handleBack}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}>
            <ArrowLeft size={12} /> Back
          </button>
          <div>
            <h2 className="text-base font-bold text-primary">{selectedDealer.name}</h2>
            <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{selectedDealer.dealer_id}</p>
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs">
          <Plus size={13} /> Add Entry
        </button>
      </div>

      {summary && (
        <LedgerSummaryCards
          totalDebit={Number(summary.total_debit)}
          totalCredit={Number(summary.total_credit)}
          openingBalance={Number(summary.opening_balance)}
          closingBalance={Number(summary.closing_balance)}
          entryCount={summary.entry_count}
        />
      )}

      <div className="detail-container">
        <div className="detail-section">
          <LedgerFilters
            filters={filters}
            onChange={handleFilterChange}
            onRefresh={() => loadDealerLedger(selectedDealer.id, filters)}
            onExportPDF={() => exportLedgerPDF(exportTitle, displayedEntries, summary)}
            onExportExcel={() => exportLedgerExcel(exportTitle, displayedEntries)}
            onPrint={() => printLedger(exportTitle, displayedEntries, summary)}
            entryTypes={DEALER_ENTRY_TYPES}
            loading={loading}
            totalCount={displayedEntries.length}
          />
        </div>
        <LedgerTable
          rows={toRows(displayedEntries)}
          onRowClick={handleRowClick}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          loading={loading}
        />
      </div>

      <LedgerDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />

      {showAddModal && (
        <AddEntryModal
          type="dealer"
          entityId={selectedDealer.id}
          entityName={selectedDealer.name}
          entryTypes={DEALER_ENTRY_TYPES}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddEntry}
        />
      )}
    </div>
  );
}
