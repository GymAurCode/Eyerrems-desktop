import { useEffect, useState, useMemo } from "react";
import {
  ChevronRight, ChevronDown, Plus, Edit2, Trash2,
  Search, ToggleLeft, ToggleRight, BookOpen,
  AlertCircle, CheckCircle2, RefreshCw
} from "lucide-react";
import { RowActions } from "../../components/actions";
import type { ActionConfig } from "../../components/actions";
import { accountsApi, type AccountTreeNode, type AccountUpdate } from "../../lib/financeApi";
import { formatCurrency } from "../../lib/currency";
import { AccountDialog, ConfirmDeleteDialog } from "./AccountDialogs";
import AccountDetailPanel, { type AccountPanelView } from "./AccountDetailPanel";

// â”€â”€ Type colours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Tree Node â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TreeNode({
  node, level, selectedId, onSelect, onAdd, onEdit, onDelete, showInactive,
}: {
  node: AccountTreeNode; level: number; selectedId: number | null;
  onSelect: (n: AccountTreeNode) => void;
  onAdd: (parent: AccountTreeNode) => void;
  onEdit: (n: AccountTreeNode) => void;
  onDelete: (n: AccountTreeNode) => void;
  showInactive: boolean;
}) {
  const [open, setOpen] = useState(level < 1);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const [, color] = TYPE_COLOR[node.account_type] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];

  if (!showInactive && !node.is_active) return null;

  // Build actions for this account node
  const getActions = (account: AccountTreeNode): ActionConfig<AccountTreeNode>[] => [
    {
      type: "custom",
      label: "Add Child",
      icon: Plus,
      color: "#60a5fa",
      tooltip: "Add child account",
      handler: (r) => onAdd(r),
      permission: "finance:manage",
    },
    {
      type: "edit",
      handler: (r) => onEdit(r),
      permission: "finance:manage",
    },
    {
      type: "delete",
      handler: (r) => onDelete(r),
      permission: "finance:manage",
      confirmMessage: `Are you sure you want to delete account "${account.name}"? This action cannot be undone.`,
    },
  ];

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all"
        style={{
          paddingLeft: `${level * 14 + 8}px`,
          background: isSelected ? `${color}18` : "transparent",
          border: isSelected ? `1px solid ${color}30` : "1px solid transparent",
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        onClick={() => onSelect(node)}>
        {/* Expand toggle */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
          className="w-4 h-4 flex items-center justify-center shrink-0 rounded transition-colors"
          style={{ color: "var(--text-muted)" }}>
          {hasChildren
            ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : <span className="w-3 h-3 rounded-full inline-block" style={{ background: `${color}50` }} />}
        </button>

        {/* Code + Name */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-mono text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>{node.code}</span>
          <span className="text-xs font-medium truncate"
            style={{ color: node.is_active ? "var(--text-primary)" : "var(--text-muted)" }}>
            {node.name}
          </span>
          {!node.is_active && (
            <span className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8" }}>
              Inactive
            </span>
          )}
        </div>

        {/* Balance */}
        {node.balance !== 0 && (
          <span className="text-[11px] font-semibold shrink-0 mr-1" style={{ color }}>
            {formatCurrency(Math.abs(node.balance))}
          </span>
        )}

        {/* Actions - Replace legacy hover buttons with RowActions */}
        <div className="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
          <RowActions
            row={node}
            actions={getActions(node)}
            variant="icon-only"
            compact
          />
        </div>
      </div>

      {open && hasChildren && node.children.map(child => (
        <TreeNode key={child.id} node={child} level={level + 1}
          selectedId={selectedId} onSelect={onSelect} onAdd={onAdd}
          onEdit={onEdit} onDelete={onDelete} showInactive={showInactive} />
      ))}
    </div>
  );
}

// â”€â”€ Main Component (detail panel in AccountDetailPanel.tsx) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface ChartOfAccountsProps {
  readOnly?: boolean;
}


export default function ChartOfAccounts({ readOnly = false }: ChartOfAccountsProps) {
  const [tree, setTree]       = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [panelView, setPanelView] = useState<AccountPanelView>("summary");
  const [search, setSearch]   = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [showInactive, setShowInactive] = useState(false);
  const [dlg, setDlg]         = useState<"create" | "edit" | "delete" | null>(null);
  const [dlgParent, setDlgParent] = useState<AccountTreeNode | null>(null);
  const [err, setErr]         = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await accountsApi.tree();
      setTree(data);
      console.log(`[ChartOfAccounts] Loaded ${data.length} root accounts successfully`);
    } catch (e: any) {
      const status  = e?.response?.status;
      const detail  = e?.response?.data?.detail;
      const message = e?.message ?? "";
      let errMsg = "Failed to load accounts";
      if (status === 401)                                    errMsg = "Session expired â€” please log in again";
      else if (status === 403)                               errMsg = `Access denied: ${detail ?? "insufficient permissions"}`;
      else if (status === 500)                               errMsg = `Server error: ${detail ?? "internal server error"}`;
      else if (!status && message.toLowerCase().includes("network")) errMsg = "Cannot reach server â€” check your connection";
      else if (detail)                                       errMsg = detail;
      console.error("[ChartOfAccounts] Load failed:", { status, detail, message });
      setErr(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    setPanelView("summary");
  }, [selected?.id]);

  // Flatten tree for search
  const flat = useMemo(() => {
    const result: AccountTreeNode[] = [];
    const walk = (nodes: AccountTreeNode[]) => {
      for (const n of nodes) { result.push(n); walk(n.children); }
    };
    walk(tree);
    return result;
  }, [tree]);

  const filtered = useMemo(() => {
    if (!search && filterType === "All") return tree;
    const q = search.toLowerCase();
    const matchIds = new Set(
      flat.filter(n =>
        (filterType === "All" || n.account_type === filterType) &&
        (!q || n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q))
      ).map(n => n.id)
    );
    const filterTree = (nodes: AccountTreeNode[]): AccountTreeNode[] =>
      nodes
        .filter(n => matchIds.has(n.id) || filterTree(n.children).length > 0)
        .map(n => ({ ...n, children: filterTree(n.children) }));
    return filterTree(tree);
  }, [tree, flat, search, filterType]);

  const handleSelect = (node: AccountTreeNode) => {
    setSelected(node);
    setPanelView("summary");
  };

  const handleAdd = (parent: AccountTreeNode | null) => {
    setDlgParent(parent);
    setSelected(null);
    setDlg("create");
  };

  const handleEdit = (node: AccountTreeNode) => {
    setSelected(node);
    setDlg("edit");
  };

  const handleDelete = (node: AccountTreeNode) => {
    setSelected(node);
    setDlg("delete");
  };

  const handleToggleActive = async (node: AccountTreeNode) => {
    try {
      const patch: AccountUpdate = { is_active: !node.is_active };
      await accountsApi.update(node.id, patch);
      await load();
      setSelected(null);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to update account");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selected) return;
    try {
      await accountsApi.delete(selected.id);
      setSelected(null);
      setDlg(null);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Cannot delete this account");
      setDlg(null);
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (dlg === "create") {
        await accountsApi.create({ ...data, parent_id: dlgParent?.id ?? null });
      } else if (dlg === "edit" && selected) {
        await accountsApi.update(selected.id, data);
      }
      setDlg(null);
      setDlgParent(null);
      await load();
    } catch (e: any) {
      throw e;
    }
  };

  // Summary stats
  const stats = useMemo(() => ({
    total:       flat.length,
    active:      flat.filter(n => n.is_active).length,
    withBalance: flat.filter(n => n.balance !== 0).length,
  }), [flat]);

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", height: "calc(100vh - 280px)", minHeight: "500px" }}>

      {/* Error banner */}
      {err && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs"
          style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", borderBottom: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={12} />
          <span className="flex-1">{err}</span>
          <button onClick={load} className="text-xs underline mr-2">Retry</button>
          <button onClick={() => setErr("")} className="text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="flex h-full">
        {/* â”€â”€ LEFT: Tree Panel â”€â”€ */}
        <div className="flex flex-col" style={{ width: "60%", borderRight: "1px solid var(--border)" }}>
          {/* Toolbar */}
          <div className="px-4 py-3 space-y-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={13} style={{ color: "var(--text-muted)" }} />
                <span className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}>
                  Chart of Accounts
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
                  {stats.active}/{stats.total}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setShowInactive(s => !s)} title="Toggle inactive"
                  className="w-6 h-6 flex items-center justify-center rounded transition-colors"
                  style={{ color: showInactive ? "#60a5fa" : "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  {showInactive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </button>
                <button onClick={load} title="Refresh"
                  className="w-6 h-6 flex items-center justify-center rounded transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <RefreshCw size={13} />
                </button>
                {!readOnly && (
                  <button onClick={() => handleAdd(null)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-colors"
                    style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(59,130,246,0.12)")}>
                    <Plus size={11} /> Add
                  </button>
                )}
              </div>
            </div>

            {/* Search + Filter */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }} />
                <input
                  className="input-dark w-full pl-7 pr-3 py-1.5 text-xs"
                  placeholder="Search accounts..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                className="select-dark px-2 py-1.5 text-xs"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}>
                <option value="All">All Types</option>
                {["Asset", "Liability", "Income", "Expense", "Equity"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-xs"
                style={{ color: "var(--text-muted)" }}>
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-xs"
                style={{ color: "var(--text-muted)" }}>
                <BookOpen size={24} style={{ opacity: 0.3 }} />
                {search ? "No accounts match your search" : "No accounts yet"}
              </div>
            ) : (
              filtered.map(node => (
                <TreeNode key={node.id} node={node} level={0}
                  selectedId={selected?.id ?? null}
                  onSelect={handleSelect} onAdd={handleAdd}
                  onEdit={handleEdit} onDelete={handleDelete}
                  showInactive={showInactive} />
              ))
            )}
          </div>
        </div>

        {/* â”€â”€ RIGHT: Detail Panel â”€â”€ */}
        <div className="flex flex-col min-h-0" style={{ width: "40%", borderLeft: "1px solid var(--border-subtle)" }}>
          <AccountDetailPanel
            account={selected}
            panelView={panelView}
            onViewChange={setPanelView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        </div>
      </div>

      {/* Dialogs */}
      {(dlg === "create" || dlg === "edit") && (
        <AccountDialog
          mode={dlg}
          initial={dlg === "edit" ? selected : null}
          parentAccount={dlgParent}
          onClose={() => { setDlg(null); setDlgParent(null); }}
          onSave={handleSave}
        />
      )}
      {dlg === "delete" && selected && (
        <ConfirmDeleteDialog
          account={selected}
          onClose={() => setDlg(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
