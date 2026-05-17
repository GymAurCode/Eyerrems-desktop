/**
 * PropertyLedger — Property financial history ledger.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { Building2, ChevronRight, ArrowLeft, Plus, Search } from "lucide-react";
import {
  ledgerApi,
  type PropertyLedgerListItem,
  type PropertyLedgerEntry,
  type PropertyLedgerResponse,
  type PropertyLedgerEntryCreate,
} from "../../lib/ledgerApi";
import { formatCurrency } from "../../lib/currency";
import LedgerTable, { type LedgerRow } from "./LedgerTable";
import LedgerFilters, { type FilterState } from "./LedgerFilters";
import LedgerSummaryCards from "./LedgerSummaryCards";
import LedgerDetailModal, { type LedgerEntryDetail } from "./LedgerDetailModal";
import AddEntryModal from "./AddEntryModal";
import { exportLedgerPDF, exportLedgerExcel, printLedger } from "./ledgerExport";

const PROPERTY_ENTRY_TYPES = [
  "booking", "installment", "tax", "transfer_fee",
  "development", "refund", "ownership_transfer",
];

type SortKey = "entry_date" | "debit" | "credit" | "running_balance";
type SortDir = "asc" | "desc";

export default function PropertyLedger() {
  const [properties,       setProperties]       = useState<PropertyLedgerListItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyLedgerListItem | null>(null);
  const [ledger,           setLedger]           = useState<PropertyLedgerResponse | null>(null);
  const [loading,          setLoading]          = useState(false);
  const [detailEntry,      setDetailEntry]      = useState<LedgerEntryDetail | null>(null);
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [propSearch,       setPropSearch]       = useState("");
  const [sortKey,          setSortKey]          = useState<SortKey>("entry_date");
  const [sortDir,          setSortDir]          = useState<SortDir>("asc");
  const [filters, setFilters] = useState<FilterState>({
    search: "", start_date: "", end_date: "", entry_type: "", status: "",
  });

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try { setProperties(await ledgerApi.propertyList()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadPropertyLedger = useCallback(async (propertyId: number, f?: FilterState) => {
    setLoading(true);
    try {
      setLedger(await ledgerApi.propertyLedger(propertyId, {
        start_date: f?.start_date || undefined,
        end_date:   f?.end_date   || undefined,
        entry_type: f?.entry_type || undefined,
        status:     f?.status     || undefined,
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  const displayedEntries = useMemo(() => {
    let rows = (ledger?.entries ?? []) as PropertyLedgerEntry[];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(r =>
        r.description.toLowerCase().includes(q) ||
        (r.reference_no ?? "").toLowerCase().includes(q) ||
        r.tid.toLowerCase().includes(q) ||
        (r.client_name ?? "").toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [ledger, filters.search, sortKey, sortDir]);

  const handleSelectProperty = (p: PropertyLedgerListItem) => {
    setSelectedProperty(p);
    setFilters({ search: "", start_date: "", end_date: "", entry_type: "", status: "" });
    loadPropertyLedger(p.id);
  };

  const handleBack = () => { setSelectedProperty(null); setLedger(null); };

  const handleFilterChange = (f: FilterState) => {
    setFilters(f);
    if (selectedProperty) loadPropertyLedger(selectedProperty.id, f);
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
      client_id: entry.client_id ?? undefined,
    });
  };

  const handleAddEntry = async (data: PropertyLedgerEntryCreate) => {
    await ledgerApi.createPropertyEntry(data);
    if (selectedProperty) await loadPropertyLedger(selectedProperty.id, filters);
    await loadProperties();
  };

  const toRows = (entries: PropertyLedgerEntry[]): LedgerRow[] =>
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
      client_name:     e.client_name,
    }));

  const filteredProperties = properties.filter(p =>
    p.name.toLowerCase().includes(propSearch.toLowerCase()) ||
    p.tid.toLowerCase().includes(propSearch.toLowerCase())
  );

  const exportTitle = selectedProperty
    ? `Property Ledger — ${selectedProperty.name} (${selectedProperty.tid})`
    : "Property Ledger";

  // ── Property List View ─────────────────────────────────────────────────────
  if (!selectedProperty) {
    return (
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }} />
          <input type="text" placeholder="Search properties…" value={propSearch}
            onChange={e => setPropSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl"
            style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
        </div>

        <div className="detail-container">
          <div className="detail-section flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={14} style={{ color: "#10b981" }} />
              <p className="detail-section-title mb-0">Properties with Ledger Activity</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
              {filteredProperties.length} properties
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <Building2 size={20} style={{ color: "#10b981" }} />
              </div>
              <p className="text-sm font-medium text-primary">No property ledger entries yet</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Entries are created automatically when property transactions are recorded
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
                    {["Property", "TID", "Total Debit", "Total Credit", "Balance", "Entries", ""].map(h => (
                      <th key={h} style={{
                        padding: "0.625rem 1rem",
                        textAlign: h === "" || h === "Entries" || h.includes("Total") || h === "Balance" ? "right" : "left",
                        fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em",
                        textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.map((p, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg  = isEven ? "transparent" : "rgba(255,255,255,0.015)";
                    return (
                      <tr key={p.id} onClick={() => handleSelectProperty(p)}
                        style={{ background: rowBg, borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", transition: "background 0.12s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--hover-bg-sm)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = rowBg}>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ background: "linear-gradient(135deg,#10b981,#3b82f6)" }}>
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-primary">{p.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{p.tid}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs font-semibold" style={{ color: "#f87171" }}>{formatCurrency(p.total_debit)}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs font-semibold" style={{ color: "#34d399" }}>{formatCurrency(p.total_credit)}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs font-bold" style={{ color: p.balance >= 0 ? "#60a5fa" : "#f87171" }}>
                            {p.balance < 0 ? "-" : ""}{formatCurrency(Math.abs(p.balance))}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{p.entry_count}</span>
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

  // ── Individual Property Ledger View ────────────────────────────────────────
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
            <h2 className="text-base font-bold text-primary">{selectedProperty.name}</h2>
            <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{selectedProperty.tid}</p>
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
            onRefresh={() => loadPropertyLedger(selectedProperty.id, filters)}
            onExportPDF={() => exportLedgerPDF(exportTitle, displayedEntries, summary)}
            onExportExcel={() => exportLedgerExcel(exportTitle, displayedEntries)}
            onPrint={() => printLedger(exportTitle, displayedEntries, summary)}
            entryTypes={PROPERTY_ENTRY_TYPES}
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
          type="property"
          entityId={selectedProperty.id}
          entityName={selectedProperty.name}
          entryTypes={PROPERTY_ENTRY_TYPES}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddEntry}
        />
      )}
    </div>
  );
}
