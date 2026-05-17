/**
 * ClientLedger — Client financial activity ledger.
 * Two views: (1) client list with balances, (2) individual client ledger.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { Users, ChevronRight, ArrowLeft, Plus, Search } from "lucide-react";
import {
  ledgerApi,
  type ClientLedgerListItem,
  type ClientLedgerEntry,
  type ClientLedgerResponse,
  type ClientLedgerEntryCreate,
} from "../../lib/ledgerApi";
import { formatCurrency } from "../../lib/currency";
import LedgerTable, { type LedgerRow } from "./LedgerTable";
import LedgerFilters, { type FilterState } from "./LedgerFilters";
import LedgerSummaryCards from "./LedgerSummaryCards";
import LedgerDetailModal, { type LedgerEntryDetail } from "./LedgerDetailModal";
import AddEntryModal from "./AddEntryModal";
import { exportLedgerPDF, exportLedgerExcel, printLedger } from "./ledgerExport";

const CLIENT_ENTRY_TYPES = [
  "booking", "installment", "refund", "discount", "tax",
  "adjustment", "penalty", "transfer",
];

type SortKey = "entry_date" | "debit" | "credit" | "running_balance";
type SortDir = "asc" | "desc";

export default function ClientLedger() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [clients,       setClients]       = useState<ClientLedgerListItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientLedgerListItem | null>(null);
  const [ledger,        setLedger]        = useState<ClientLedgerResponse | null>(null);
  const [allEntries,    setAllEntries]    = useState<ClientLedgerEntry[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [detailEntry,   setDetailEntry]   = useState<LedgerEntryDetail | null>(null);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [clientSearch,  setClientSearch]  = useState("");
  const [sortKey,       setSortKey]       = useState<SortKey>("entry_date");
  const [sortDir,       setSortDir]       = useState<SortDir>("asc");
  const [filters, setFilters] = useState<FilterState>({
    search: "", start_date: "", end_date: "", entry_type: "", status: "",
  });

  // ── Load client list ───────────────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ledgerApi.clientList();
      setClients(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  // ── Load individual client ledger ──────────────────────────────────────────
  const loadClientLedger = useCallback(async (clientId: number, f?: FilterState) => {
    setLoading(true);
    try {
      const data = await ledgerApi.clientLedger(clientId, {
        start_date: f?.start_date || undefined,
        end_date:   f?.end_date   || undefined,
        entry_type: f?.entry_type || undefined,
        status:     f?.status     || undefined,
      });
      setLedger(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  // ── Filter + sort entries ──────────────────────────────────────────────────
  const displayedEntries = useMemo(() => {
    let rows = (ledger?.entries ?? []) as ClientLedgerEntry[];

    // Client-side search on description/reference
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(r =>
        r.description.toLowerCase().includes(q) ||
        (r.reference_no ?? "").toLowerCase().includes(q) ||
        r.tid.toLowerCase().includes(q)
      );
    }

    // Sort
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      const cmp = typeof av === "string"
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [ledger, filters.search, sortKey, sortDir]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectClient = (c: ClientLedgerListItem) => {
    setSelectedClient(c);
    setFilters({ search: "", start_date: "", end_date: "", entry_type: "", status: "" });
    loadClientLedger(c.id);
  };

  const handleBack = () => {
    setSelectedClient(null);
    setLedger(null);
  };

  const handleFilterChange = (f: FilterState) => {
    setFilters(f);
    if (selectedClient) loadClientLedger(selectedClient.id, f);
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
    });
  };

  const handleAddEntry = async (data: ClientLedgerEntryCreate) => {
    await ledgerApi.createClientEntry(data);
    if (selectedClient) await loadClientLedger(selectedClient.id, filters);
    await loadClients();
  };

  const toRows = (entries: ClientLedgerEntry[]): LedgerRow[] =>
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
      payment_method:  e.payment_method,
    }));

  // ── Export helpers ─────────────────────────────────────────────────────────
  const exportTitle = selectedClient
    ? `Client Ledger — ${selectedClient.name} (${selectedClient.client_id})`
    : "Client Ledger";

  // ── Filtered client list ───────────────────────────────────────────────────
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.client_id.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // ── View: Client List ──────────────────────────────────────────────────────
  if (!selectedClient) {
    return (
      <div className="space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search clients…"
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl"
            style={{
              background: "var(--bg-surface2)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>

        <div className="detail-container">
          <div className="detail-section flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} style={{ color: "#3b82f6" }} />
              <p className="detail-section-title mb-0">Clients with Ledger Activity</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
              {filteredClients.length} clients
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-14 rounded-xl" />
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <Users size={20} style={{ color: "#3b82f6" }} />
              </div>
              <p className="text-sm font-medium text-primary">No client ledger entries yet</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Entries are created automatically when bookings and payments are recorded
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface2)" }}>
                    {["Client", "Code", "Total Debit", "Total Credit", "Balance", "Entries", ""].map(h => (
                      <th key={h} style={{
                        padding: "0.625rem 1rem",
                        textAlign: h === "" || h === "Entries" || h.includes("Debit") || h.includes("Credit") || h === "Balance" ? "right" : "left",
                        fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em",
                        textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((c, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg  = isEven ? "transparent" : "rgba(255,255,255,0.015)";
                    return (
                      <tr key={c.id}
                        onClick={() => handleSelectClient(c)}
                        style={{
                          background: rowBg,
                          borderBottom: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--hover-bg-sm)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = rowBg}
                      >
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-primary">{c.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{c.client_id}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs font-semibold" style={{ color: "#f87171" }}>
                            {formatCurrency(c.total_debit)}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs font-semibold" style={{ color: "#34d399" }}>
                            {formatCurrency(c.total_credit)}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs font-bold"
                            style={{ color: c.balance >= 0 ? "#60a5fa" : "#f87171" }}>
                            {c.balance < 0 ? "-" : ""}{formatCurrency(Math.abs(c.balance))}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{c.entry_count}</span>
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

  // ── View: Individual Client Ledger ─────────────────────────────────────────
  const summary = ledger?.summary;

  return (
    <div className="space-y-4">
      {/* Back + Header */}
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
            <h2 className="text-base font-bold text-primary">{selectedClient.name}</h2>
            <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              {selectedClient.client_id}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs">
          <Plus size={13} /> Add Entry
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <LedgerSummaryCards
          totalDebit={Number(summary.total_debit)}
          totalCredit={Number(summary.total_credit)}
          openingBalance={Number(summary.opening_balance)}
          closingBalance={Number(summary.closing_balance)}
          entryCount={summary.entry_count}
        />
      )}

      {/* Filters */}
      <div className="detail-container">
        <div className="detail-section">
          <LedgerFilters
            filters={filters}
            onChange={handleFilterChange}
            onRefresh={() => loadClientLedger(selectedClient.id, filters)}
            onExportPDF={() => exportLedgerPDF(exportTitle, displayedEntries, summary)}
            onExportExcel={() => exportLedgerExcel(exportTitle, displayedEntries)}
            onPrint={() => printLedger(exportTitle, displayedEntries, summary)}
            entryTypes={CLIENT_ENTRY_TYPES}
            loading={loading}
            totalCount={displayedEntries.length}
          />
        </div>

        {/* Table */}
        <LedgerTable
          rows={toRows(displayedEntries)}
          onRowClick={handleRowClick}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          loading={loading}
        />
      </div>

      {/* Detail Modal */}
      <LedgerDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />

      {/* Add Entry Modal */}
      {showAddModal && (
        <AddEntryModal
          type="client"
          entityId={selectedClient.id}
          entityName={selectedClient.name}
          entryTypes={CLIENT_ENTRY_TYPES}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddEntry}
        />
      )}
    </div>
  );
}
