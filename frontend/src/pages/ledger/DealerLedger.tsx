/**
 * DealerLedger — Dealer commission & payout ledger.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { Briefcase, ArrowLeft, Plus, Search } from "lucide-react";
import DataTable from "../../components/data-table/DataTable";
import type { TableColumn } from "../../components/data-table/types";
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
            <DataTable
              data={filteredDealers}
              columns={[
                { key: 'name', label: 'Dealer', render: (v, row) => (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}>
                      {(v as string).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-primary">{v as string}</span>
                  </div>
                )},
                { key: 'dealer_id', label: 'Code', render: (v) => <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{v}</span> },
                { key: 'total_debit', label: 'Total Commission', align: 'right', render: (v) => <span className="text-xs font-semibold" style={{ color: "#f87171" }}>{formatCurrency(v as number)}</span> },
                { key: 'total_credit', label: 'Total Paid', align: 'right', render: (v) => <span className="text-xs font-semibold" style={{ color: "#34d399" }}>{formatCurrency(v as number)}</span> },
                { key: 'balance', label: 'Remaining', align: 'right', render: (v) => {
                  const bal = v as number;
                  return <span className="text-xs font-bold" style={{ color: bal >= 0 ? "#60a5fa" : "#f87171" }}>{bal < 0 ? "-" : ""}{formatCurrency(Math.abs(bal))}</span>;
                }},
                { key: 'entry_count', label: 'Entries', align: 'right', render: (v) => <span className="text-xs" style={{ color: "var(--text-muted)" }}>{v}</span> },
              ]}
              searchable={false}
              striped={false}
              hoverable
              onRowClick={(row) => handleSelectDealer(row)}
            />
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
