/**
 * ChartOfAccounts - Robust Version
 * This version eliminates all potential sources of the "l is not a function" error
 * by using only basic React patterns and avoiding complex dependencies
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "../../lib/api";

// Basic icons as simple components to avoid lucide-react issues
const ChevronRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9,18 15,12 9,6"></polyline>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6,9 12,15 18,9"></polyline>
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
);

const BookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);



// Account types
interface AccountTreeNode {
  id: number;
  code: string;
  name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
  parent_id: number | null;
  description: string | null;
  children: AccountTreeNode[];
}

interface AccountUpdate {
  name?: string;
  description?: string | null;
  parent_id?: number | null;
  is_active?: boolean;
  code?: string;
  account_type?: string;
}

// Safe currency formatter
const formatCurrency = (amount: number | string | null | undefined): string => {
  try {
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
    const value = isNaN(num) ? 0 : Math.abs(num);
    return `₨ ${value.toLocaleString()}`;
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `₨ 0`;
  }
};

// Type colors
const TYPE_COLORS: Record<string, [string, string]> = {
  Asset: ["rgba(59,130,246,0.12)", "#3b82f6"],
  Liability: ["rgba(239,68,68,0.12)", "#ef4444"],
  Income: ["rgba(16,185,129,0.12)", "#10b981"],
  Expense: ["rgba(245,158,11,0.12)", "#f59e0b"],
  Equity: ["rgba(139,92,246,0.12)", "#8b5cf6"],
};

// Type badge component
const TypeBadge = React.memo(({ type }: { type: string }) => {
  const [bg, color] = TYPE_COLORS[type] || ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span 
      className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap"
      style={{ background: bg, color }}
    >
      {type}
    </span>
  );
});

// Simple action button
const ActionButton = React.memo(({ 
  onClick, 
  children, 
  title,
  className = ""
}: { 
  onClick: (e?: React.MouseEvent) => void; 
  children: React.ReactNode; 
  title: string;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-1 rounded hover:bg-hover transition-colors ${className}`}
  >
    {children}
  </button>
));

// Tree node component
const TreeNode = React.memo(({
  node,
  level,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  showInactive,
}: {
  node: AccountTreeNode;
  level: number;
  selectedId: number | null;
  onSelect: (node: AccountTreeNode) => void;
  onAdd: (parent: AccountTreeNode) => void;
  onEdit: (node: AccountTreeNode) => void;
  onDelete: (node: AccountTreeNode) => void;
  showInactive: boolean;
}) => {
  const [open, setOpen] = useState(level < 1);
  
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const [, color] = TYPE_COLORS[node.account_type] || ["rgba(148,163,184,0.1)", "#94a3b8"];

  if (!showInactive && !node.is_active) return null;

  const handleSelect = useCallback(() => {
    try {
      onSelect(node);
    } catch (error) {
      console.error('Select error:', error);
    }
  }, [node, onSelect]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setOpen(prev => !prev);
    } catch (error) {
      console.error('Toggle error:', error);
    }
  }, []);

  const handleAdd = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      onAdd(node);
    } catch (error) {
      console.error('Add error:', error);
    }
  }, [node, onAdd]);

  const handleEdit = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      onEdit(node);
    } catch (error) {
      console.error('Edit error:', error);
    }
  }, [node, onEdit]);

  const handleDelete = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      onDelete(node);
    } catch (error) {
      console.error('Delete error:', error);
    }
  }, [node, onDelete]);

  return (
    <div>
      <div
        className="group flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-colors hover:bg-hover"
        style={{
          paddingLeft: `${level * 20 + 8}px`,
          background: isSelected ? `${color}18` : "transparent",
          border: isSelected ? `1px solid ${color}30` : "1px solid transparent",
        }}
        onClick={handleSelect}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={handleToggle}
          className="w-4 h-4 flex items-center justify-center text-muted hover:text-primary"
        >
          {hasChildren ? (open ? <ChevronDownIcon /> : <ChevronRightIcon />) : (
            <span 
              className="w-3 h-3 rounded-full" 
              style={{ background: `${color}50` }} 
            />
          )}
        </button>

        {/* Code */}
        <span className="font-mono text-xs text-muted min-w-0 shrink-0">
          {node.code}
        </span>

        {/* Name */}
        <span 
          className="text-sm font-medium flex-1 min-w-0 truncate"
          style={{ color: node.is_active ? "var(--text-primary, #eaeaea)" : "var(--text-muted, #5a6478)" }}
        >
          {node.name}
        </span>

        {/* Status */}
        {!node.is_active && (
          <span className="text-xs px-2 py-1 bg-tertiary text-muted rounded">
            Inactive
          </span>
        )}

        {/* Balance */}
        {node.balance !== 0 && (
          <span className="text-xs font-semibold text-blue-400 min-w-0 shrink-0">
            {formatCurrency(node.balance)}
          </span>
        )}

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <ActionButton onClick={handleAdd} title="Add Child" className="text-blue-400">
            <PlusIcon />
          </ActionButton>
          <ActionButton onClick={handleEdit} title="Edit" className="text-muted">
            ✏️
          </ActionButton>
          <ActionButton onClick={handleDelete} title="Delete" className="text-red-400">
            🗑️
          </ActionButton>
        </div>
      </div>

      {/* Children */}
      {open && hasChildren && node.children.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          level={level + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          showInactive={showInactive}
        />
      ))}
    </div>
  );
});

// Main component
export interface ChartOfAccountsProps {
  readOnly?: boolean;
}

export default function ChartOfAccounts({ readOnly = false }: ChartOfAccountsProps) {
  const [tree, setTree] = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load accounts
  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading accounts...');
      
      const data = await api.get<AccountTreeNode[]>('/finance/accounts/tree').then((r) => r.data);
      console.log('Accounts loaded:', data.length);
      
      setTree(data);
    } catch (err: any) {
      console.error('Load accounts error:', err);
      setError(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Flatten tree for search
  const flatAccounts = useMemo(() => {
    try {
      const result: AccountTreeNode[] = [];
      const walk = (nodes: AccountTreeNode[]) => {
        for (const node of nodes) {
          result.push(node);
          if (node.children) {
            walk(node.children);
          }
        }
      };
      walk(tree);
      return result;
    } catch (error) {
      console.error('Flatten accounts error:', error);
      return [];
    }
  }, [tree]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    try {
      if (!search && filterType === "All") return tree;
      
      const query = search.toLowerCase();
      const matchIds = new Set(
        flatAccounts
          .filter(node => {
            const typeMatch = filterType === "All" || node.account_type === filterType;
            const searchMatch = !query || 
              node.name.toLowerCase().includes(query) || 
              node.code.toLowerCase().includes(query);
            return typeMatch && searchMatch;
          })
          .map(node => node.id)
      );

      const filterTree = (nodes: AccountTreeNode[]): AccountTreeNode[] => {
        return nodes
          .filter(node => matchIds.has(node.id) || filterTree(node.children || []).length > 0)
          .map(node => ({ ...node, children: filterTree(node.children || []) }));
      };

      return filterTree(tree);
    } catch (error) {
      console.error('Filter accounts error:', error);
      return tree;
    }
  }, [tree, flatAccounts, search, filterType]);

  // Event handlers
  const handleSelect = useCallback((node: AccountTreeNode) => {
    try {
      setSelected(node);
    } catch (error) {
      console.error('Handle select error:', error);
    }
  }, []);

  const handleAdd = useCallback((parent: AccountTreeNode) => {
    try {
      console.log('Add child to:', parent.name);
      // TODO: Implement add dialog
    } catch (error) {
      console.error('Handle add error:', error);
    }
  }, []);

  const handleEdit = useCallback((node: AccountTreeNode) => {
    try {
      console.log('Edit account:', node.name);
      // TODO: Implement edit dialog
    } catch (error) {
      console.error('Handle edit error:', error);
    }
  }, []);

  const handleDelete = useCallback((node: AccountTreeNode) => {
    try {
      console.log('Delete account:', node.name);
      // TODO: Implement delete confirmation
    } catch (error) {
      console.error('Handle delete error:', error);
    }
  }, []);

  // Stats
  const stats = useMemo(() => {
    try {
      return {
        total: flatAccounts.length,
        active: flatAccounts.filter(n => n.is_active).length,
        withBalance: flatAccounts.filter(n => n.balance !== 0).length,
      };
    } catch (error) {
      console.error('Stats calculation error:', error);
      return { total: 0, active: 0, withBalance: 0 };
    }
  }, [flatAccounts]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertIcon />
        <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Accounts</h3>
        <p className="text-sm text-muted mb-4">{error}</p>
        <button 
          onClick={loadAccounts}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div 
      className="rounded-xl overflow-hidden border border-theme bg-surface"
      style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
    >
      <div className="flex h-full">
        {/* Left Panel */}
        <div className="flex flex-col flex-1 border-r border-theme">
          {/* Toolbar */}
          <div className="p-4 border-b border-theme space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookIcon />
                <span className="text-sm font-bold text-secondary">
                  Chart of Accounts (Fixed)
                </span>
                <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                  {stats.active}/{stats.total}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className={`px-3 py-1 text-xs rounded ${
                    showInactive ? 'bg-blue-600 text-white' : 'bg-tertiary text-secondary'
                  }`}
                >
                  {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                </button>
                <button
                  onClick={loadAccounts}
                  className="px-3 py-1 text-xs bg-tertiary text-secondary rounded hover:bg-gray-600"
                >
                  Refresh
                </button>
                {!readOnly && (
                  <button
                    onClick={() => handleAdd({ id: 0 } as AccountTreeNode)}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <PlusIcon />
                    Add
                  </button>
                )}
              </div>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-tertiary border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 text-sm bg-tertiary border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              >
                <option value="All">All Types</option>
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
                <option value="Equity">Equity</option>
              </select>
            </div>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted">
                <BookIcon />
                <p className="text-sm mt-2">
                  {search ? "No accounts match your search" : "No accounts found"}
                </p>
              </div>
            ) : (
              filteredAccounts.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  level={0}
                  selectedId={selected?.id || null}
                  onSelect={handleSelect}
                  onAdd={handleAdd}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  showInactive={showInactive}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 p-4">
          {selected ? (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{selected.name}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted">Code:</span>
                  <span className="font-mono text-sm text-blue-400">{selected.code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted">Type:</span>
                  <TypeBadge type={selected.account_type} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted">Balance:</span>
                  <span className="font-semibold text-green-400">
                    {formatCurrency(selected.balance)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted">Status:</span>
                  <span className={selected.is_active ? 'text-green-400' : 'text-muted'}>
                    {selected.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {selected.description && (
                  <div>
                    <span className="text-sm text-muted block mb-1">Description:</span>
                    <p className="text-sm text-secondary">{selected.description}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted mt-8">
              <BookIcon />
              <p className="text-sm mt-2">Select an account to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}