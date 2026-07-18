import { useState, useEffect, useCallback } from "react";
import { Eye, FileText } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import { api } from "../../lib/api";
import {
  type Journal, type Account,
} from "../../lib/financeApi";
import { AppTable, removeEmptyParams } from "../data-table";
import JournalDetailView from "./JournalDetailView";

function StatusBadge({ status, variant }: { status: string; variant?: string }) {
  const map: Record<string, [string, string]> = {
    paid: ["rgba(16,185,129,0.15)", "#10b981"],
    unpaid: ["rgba(239,68,68,0.15)", "#ef4444"],
    partial: ["rgba(59,130,246,0.15)", "#3b82f6"],
    pending: ["rgba(245,158,11,0.15)", "#f59e0b"],
    overdue: ["rgba(239,68,68,0.15)", "#ef4444"],
    earned: ["rgba(59,130,246,0.15)", "#3b82f6"],
    approved: ["rgba(16,185,129,0.15)", "#10b981"],
    submitted: ["rgba(245,158,11,0.15)", "#f59e0b"],
    active: ["rgba(16,185,129,0.15)", "#10b981"],
    inactive: ["rgba(148,163,184,0.1)", "#94a3b8"],
    MANUAL: ["rgba(148,163,184,0.15)", "#94a3b8"],
    CRM: ["rgba(59,130,246,0.15)", "#3b82f6"],
    PROPERTY: ["rgba(16,185,129,0.15)", "#10b981"],
    EXPENSE: ["rgba(239,68,68,0.15)", "#ef4444"],
    PAYROLL: ["rgba(139,92,246,0.15)", "#8b5cf6"],
  };
  const key = variant && map[variant] ? variant : Object.keys(map).find(k => status?.toLowerCase().includes(k)) || status;
  const [bg, color] = map[key] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ background: bg, color }}>{status}</span>
  );
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source || source === "MANUAL") return null;
  return <StatusBadge status={source} variant={source} />;
}

interface Props {
  accounts: Account[];
}

export default function JournalsTab({ accounts }: Props) {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewJournalId, setViewJournalId] = useState<number | null>(null);
  const [params, setParams] = useState({ page: 1, pageSize: 10, search: "", filter: "", startDate: "", endDate: "", propertyType: "", status: "", source: "" });

  const fetchJournals = useCallback(async (currentParams: typeof params) => {
    setLoading(true); setError(null);
    try {
      const sanitized = removeEmptyParams({ limit: currentParams.pageSize, skip: (currentParams.page - 1) * currentParams.pageSize, source: currentParams.source, start_date: currentParams.startDate, end_date: currentParams.endDate });
      const res = await api.get<Journal[]>("/finance/journals", { params: sanitized });
      setJournals(res.data);
      setTotal(res.data.length < currentParams.pageSize ? (currentParams.page - 1) * currentParams.pageSize + res.data.length : 1000);
    } catch (e: any) { setError(e.message || "Failed to load journals"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchJournals(params); }, [params, fetchJournals]);

  const journalColumns = [
    { key: "id", label: "JE-ID", sortable: true, className: "font-mono text-[10px] text-blue-400 font-semibold", render: (val: number) => `JE-${String(val).padStart(4, "0")}` },
    { key: "date", label: "Date", sortable: true, render: (val: string) => new Date(val).toLocaleDateString() },
    { key: "reference_type", label: "Type", render: (val: string) => <StatusBadge status={val} /> },
    { key: "description", label: "Description", className: "text-xs max-w-[200px] truncate" },
    { key: "source", label: "Source", render: (val?: string) => <SourceBadge source={val || "MANUAL"} /> },
    { key: "dr_total", label: "DR Total", className: "text-right text-xs", render: (val: any, row: Journal) => formatCurrency(row.dr_total || 0) },
    { key: "cr_total", label: "CR Total", className: "text-right text-xs", render: (val: any, row: Journal) => formatCurrency(row.cr_total || 0) },
    { key: "balanced", label: "Status", render: (val: any, row: Journal) => row.balanced ? <span className="text-emerald-400 text-[10px]">✓ Balanced</span> : <span className="text-red-400 text-[10px]">✗ Unbalanced</span> },
    { key: "_lines", label: "Lines", render: (val: any, row: Journal) => `${row.entries?.length || 0} lines` },
  ];

  const sourceOptions = [
    { label: "All Sources", value: "" },
    { label: "Manual", value: "MANUAL" },
    { label: "CRM", value: "CRM" },
    { label: "Property", value: "PROPERTY" },
    { label: "Expense", value: "EXPENSE" },
    { label: "Payroll", value: "PAYROLL" },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <select className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          value={params.source} onChange={e => setParams(p => ({ ...p, source: e.target.value, page: 1 }))}>
          {sourceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <AppTable
        storageKey="rems_finance_journals"
        title="Journal Entries"
        subtitle="Double-entry ledger journal postings"
        data={journals}
        columns={journalColumns}
        rowActions={[{ key: "view", label: "View Detail", icon: Eye, onClick: (row: Journal) => setViewJournalId(row.id) }]}
        loading={loading} error={error}
        onRetry={() => fetchJournals(params)}
        pagination={{ page: params.page, pageSize: params.pageSize, total }}
        onPageChange={(config) => setParams((prev) => ({ ...prev, ...config }))}
        onFilterChange={(filters) => setParams((prev) => ({ ...prev, ...filters }))}
        showDateFilter={false} showStatusFilter={false} showTypeFilter={false}
      />

      {viewJournalId && (
        <JournalDetailView
          isOpen={!!viewJournalId}
          onClose={() => setViewJournalId(null)}
          journalId={viewJournalId}
          onRefresh={() => fetchJournals(params)}
        />
      )}
    </div>
  );
}
