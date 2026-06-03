import { useState } from "react";
import { Download, Filter } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import { DataTable } from "../data-table";

interface GeneralLedgerProps {
  accountId: number;
  accountCode: string;
  accountName: string;
  entries: Array<{
    id: number;
    date: string;
    reference_type: string;
    reference_id: string | null;
    description: string | null;
    debit: string;
    credit: string;
    balance: string;
  }>;
  openingBalance: string;
  closingBalance: string;
  onRefresh?: () => Promise<void>;
}

export default function GeneralLedger({
  accountId,
  accountCode,
  accountName,
  entries,
  openingBalance,
  closingBalance,
  onRefresh,
}: GeneralLedgerProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [refTypeFilter, setRefTypeFilter] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredEntries = entries.filter(
    (entry) => !refTypeFilter || entry.reference_type === refTypeFilter
  );

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    // Create CSV
    const csv = [
      [`General Ledger - ${accountCode} ${accountName}`],
      ["Opening Balance:", openingBalance],
      [],
      ["Date", "Reference Type", "Reference ID", "Description", "Debit", "Credit", "Balance"],
      ...filteredEntries.map((e) => [
        new Date(e.date).toLocaleDateString(),
        e.reference_type,
        e.reference_id || "",
        e.description || "",
        e.debit,
        e.credit,
        e.balance,
      ]),
      [],
      ["Closing Balance:", closingBalance],
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    // Download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${accountCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card-dark p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-primary">
            {accountCode} - {accountName}
          </h3>
          <p className="text-xs text-muted mt-1">
            Opening: {formatCurrency(openingBalance)} | Closing: {formatCurrency(closingBalance)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 hover:bg-secondary rounded text-muted hover:text-primary transition-colors"
            title="Toggle filters"
          >
            <Filter size={16} />
          </button>
          <button
            onClick={handleExport}
            className="p-2 hover:bg-secondary rounded text-muted hover:text-primary transition-colors"
            title="Export CSV"
          >
            <Download size={16} />
          </button>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 hover:bg-secondary rounded text-muted hover:text-primary transition-colors disabled:opacity-50"
              title="Refresh"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 p-3 bg-secondary/50 rounded space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              Filter by Reference Type
            </label>
            <select
              value={refTypeFilter}
              onChange={(e) => setRefTypeFilter(e.target.value)}
              className="input-field w-full px-3 py-2 rounded text-sm"
            >
              <option value="">All Types</option>
              <option value="invoice">Invoice</option>
              <option value="payment">Payment</option>
              <option value="commission">Commission</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>
      )}

      <DataTable
        data={filteredEntries}
        columns={[
          { key: 'date', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
          { key: 'reference_type', label: 'Type', render: (val) => <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>{val}</span> },
          { key: 'reference_id', label: 'Reference', render: (val) => val || "-" },
          { key: 'description', label: 'Description', render: (val) => <span style={{ color: 'var(--text-muted)' }}>{val || "-"}</span> },
          { key: 'debit', label: 'Debit', align: 'right', render: (val) => val && Number(val) > 0 ? <span className="text-blue-400">{formatCurrency(val)}</span> : "-" },
          { key: 'credit', label: 'Credit', align: 'right', render: (val) => val && Number(val) > 0 ? <span className="text-red-400">{formatCurrency(val)}</span> : "-" },
          { key: 'balance', label: 'Balance', align: 'right', render: (val) => <span className="font-semibold">{formatCurrency(val)}</span> },
        ]}
        searchable={false}
        sortable={false}
      />
    </div>
  );
}
