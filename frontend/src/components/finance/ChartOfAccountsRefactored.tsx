/**
 * ChartOfAccounts - Refactored with DataTable Container
 * Example of how to migrate existing tables to the new system
 */

import { useEffect, useState, useMemo } from "react";
import { Plus, Edit2, Trash2, BookOpen, ToggleLeft, ToggleRight } from "lucide-react";
import { DataTable, TableColumn, TableFilter, TableAction, TableToolbarAction } from "../data-table";
import { formatCurrency } from "../../lib/currency";
import { accountsApi, type AccountTreeNode, type AccountUpdate } from "../../lib/financeApi";
import { AccountDialog, ConfirmDeleteDialog } from "./AccountDialogs";
import AccountDetailPanel, { type AccountPanelView } from "./AccountDetailPanel";

// Type colors for account types
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
    <span className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap"
      style={{ background: bg, color }}>
      {type}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
      isActive 
        ? 'bg-green-600/20 text-green-400' 
        : 'bg-gray-600/20 text-muted'
    }`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export interface ChartOfAccountsProps {
  readOnly?: boolean;
}

export default function ChartOfAccountsRefactored({ readOnly = false }: ChartOfAccountsProps) {
  // State
  const [accounts, setAccounts] = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [panelView, setPanelView] = useState<AccountPanelView>("summary");
  const [showInactive, setShowInactive] = useState(false);
  const [dlg, setDlg] = useState<"create" | "edit" | "delete" | null>(null);
  const [dlgParent, setDlgParent] = useState<AccountTreeNode | null>(null);

  // Flatten tree structure for table display
  const flattenAccounts = (nodes: AccountTreeNode[], level = 0): (AccountTreeNode & { level: number })[] => {
    const result: (AccountTreeNode & { level: number })[] = [];
    
    for (const node of nodes) {
      result.push({ ...node, level });
      if (node.children.length > 0) {
        result.push(...flattenAccounts(node.children, level + 1));
      }
    }
    
    return result;
  };

  const flatAccounts = useMemo(() => flattenAccounts(accounts), [accounts]);

  // Filter accounts based on showInactive
  const displayAccounts = useMemo(() => {
    return flatAccounts.filter(account => showInactive || account.is_active);
  }, [flatAccounts, showInactive]);

  // Load accounts
  const loadAccounts = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const data = await accountsApi.tree();
      setAccounts(data);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      let errMsg = "Failed to load accounts";
      if (status === 401) errMsg = "Session expired — please log in again";
      else if (status === 403) errMsg = `Access denied: ${detail ?? "insufficient permissions"}`;
      else if (status === 500) errMsg = `Server error: ${detail ?? "internal server error"}`;
      else if (detail) errMsg = detail;
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Table columns
  const columns: TableColumn<AccountTreeNode & { level: number }>[] = [
    {
      key: 'code',
      label: 'Code',
      width: 100,
      render: (value, row) => (
        <div className="flex items-center gap-2" style={{ paddingLeft: `${row.level * 20}px` }}>
          <span className="font-mono text-xs text-muted">{value}</span>
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Account Name',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${row.is_active ? 'text-primary' : 'text-muted'}`}>
            {value}
          </span>
        </div>
      ),
    },
    {
      key: 'account_type',
      label: 'Type',
      width: 120,
      align: 'center',
      render: (value) => <TypeBadge type={value} />,
    },
    {
      key: 'balance',
      label: 'Balance',
      width: 120,
      align: 'right',
      render: (value) => (
        value !== 0 ? (
          <span className="font-mono text-sm font-semibold text-blue-400">
            {formatCurrency(Math.abs(value))}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      width: 100,
      align: 'center',
      render: (value) => <StatusBadge isActive={value} />,
    },
  ];

  // Table filters
  const filters: TableFilter[] = [
    {
      key: 'account_type',
      label: 'Account Type',
      type: 'select',
      options: [
        { label: 'Asset', value: 'Asset' },
        { label: 'Liability', value: 'Liability' },
        { label: 'Income', value: 'Income' },
        { label: 'Expense', value: 'Expense' },
        { label: 'Equity', value: 'Equity' },
      ],
    },
    {
      key: 'is_active',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Active', value: true },
        { label: 'Inactive', value: false },
      ],
    },
  ];

  // Row actions
  const rowActions: TableAction<AccountTreeNode & { level: number }>[] = [
    {
      key: 'add-child',
      label: 'Add Child',
      icon: Plus,
      variant: 'primary',
      onClick: (row) => {
        setDlgParent(row);
        setSelected(null);
        setDlg("create");
      },
      permission: 'finance:manage',
    },
    {
      key: 'edit',
      label: 'Edit',
      icon: Edit2,
      variant: 'secondary',
      onClick: (row) => {
        setSelected(row);
        setDlg("edit");
      },
      permission: 'finance:manage',
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'danger',
      onClick: (row) => {
        setSelected(row);
        setDlg("delete");
      },
      permission: 'finance:manage',
    },
  ];

  // Toolbar actions
  const toolbarActions: TableToolbarAction[] = [
    {
      key: 'add-root',
      label: 'Add Account',
      icon: Plus,
      variant: 'primary',
      onClick: () => {
        setDlgParent(null);
        setSelected(null);
        setDlg("create");
      },
      disabled: readOnly,
      permission: 'finance:manage',
    },
    {
      key: 'toggle-inactive',
      label: showInactive ? 'Hide Inactive' : 'Show Inactive',
      icon: showInactive ? ToggleRight : ToggleLeft,
      variant: 'secondary',
      onClick: () => setShowInactive(!showInactive),
    },
  ];

  // Event handlers
  const handleRowClick = (row: AccountTreeNode & { level: number }) => {
    setSelected(row);
    setPanelView("summary");
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
      await loadAccounts();
    } catch (e: any) {
      throw e;
    }
  };

  const handleConfirmDelete = async () => {
    if (!selected) return;
    try {
      await accountsApi.delete(selected.id);
      setSelected(null);
      setDlg(null);
      await loadAccounts();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Cannot delete this account");
      setDlg(null);
    }
  };

  const handleToggleActive = async (node: AccountTreeNode) => {
    try {
      const patch: AccountUpdate = { is_active: !node.is_active };
      await accountsApi.update(node.id, patch);
      await loadAccounts();
      setSelected(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to update account");
    }
  };

  // Summary stats
  const stats = useMemo(() => ({
    total: flatAccounts.length,
    active: flatAccounts.filter(n => n.is_active).length,
    withBalance: flatAccounts.filter(n => n.balance !== 0).length,
  }), [flatAccounts]);

  return (
    <div className="flex h-full gap-4">
      {/* Main table */}
      <div className="flex-1">
        <DataTable
          title="Chart of Accounts"
          subtitle={`${stats.active}/${stats.total} accounts active • ${stats.withBalance} with balance`}
          data={displayAccounts}
          columns={columns}
          loading={loading}
          error={error}
          searchable={true}
          searchPlaceholder="Search accounts..."
          filters={filters}
          rowActions={readOnly ? [] : rowActions}
          toolbarActions={toolbarActions}
          onRowClick={handleRowClick}
          striped={true}
          hoverable={true}
          stickyHeader={true}
          emptyTitle="No accounts found"
          emptyDescription="Create your first account to get started with your chart of accounts."
          emptyIcon={BookOpen}
        />
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-96 flex-shrink-0">
          <AccountDetailPanel
            account={selected}
            panelView={panelView}
            onViewChange={setPanelView}
            onEdit={(account) => {
              setSelected(account);
              setDlg("edit");
            }}
            onDelete={(account) => {
              setSelected(account);
              setDlg("delete");
            }}
            onToggleActive={handleToggleActive}
          />
        </div>
      )}

      {/* Dialogs */}
      {(dlg === "create" || dlg === "edit") && (
        <AccountDialog
          mode={dlg}
          initial={dlg === "edit" ? selected : null}
          parentAccount={dlgParent}
          onClose={() => {
            setDlg(null);
            setDlgParent(null);
          }}
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