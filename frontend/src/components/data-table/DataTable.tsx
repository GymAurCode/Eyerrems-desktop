import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { TableColumn, SortConfig, PaginationConfig } from './types';
import TableHeader from './components/TableHeader';
import TableRow from './components/TableRow';
import EmptyState from './components/EmptyState';
import LoadingState from './components/LoadingState';

interface DataTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];

  // Core
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;

  // Search
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  // Sorting
  sortable?: boolean;
  sortConfig?: SortConfig;
  onSort?: (config: SortConfig) => void;

  // Pagination
  pagination?: PaginationConfig;
  onPaginationChange?: (config: PaginationConfig) => void;

  // Selection
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (rows: T[]) => void;
  getRowId?: (row: T) => string | number;

  // Filters
  filters?: any[];
  filterValues?: Record<string, any>;
  onFilterChange?: (filters: Record<string, any>) => void;

  // Row actions (old API — array or function)
  rowActions?: any[] | ((row: T) => any[]);
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;

  // Row actions (new API)
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onPrint?: (row: T) => void;

  // Toolbar actions
  toolbarActions?: any[];
  bulkActions?: any[];
  customToolbar?: React.ReactNode;
  customFooter?: React.ReactNode;

  // Styling (accepted but may be ignored)
  variant?: string;
  striped?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
  stickyHeader?: boolean;

  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ComponentType<{ size?: number; className?: string }>;

  // Extra actions
  extraActions?: { label: string; icon: React.ElementType; onClick: (row: T) => void; color?: string }[];
}

export default function DataTable<T = any>({
  data,
  columns,
  title,
  subtitle,
  loading = false,
  error,
  searchable = true,
  searchValue: controlledSearchValue,
  onSearchChange: controlledOnSearchChange,
  searchPlaceholder = 'Search...',
  sortable = true,
  sortConfig: controlledSortConfig,
  onSort: controlledOnSort,
  pagination: controlledPagination,
  onPaginationChange: controlledOnPaginationChange,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  getRowId = (row: T) => (row as any)?.id,
  filters = [],
  filterValues,
  onFilterChange,
  rowActions = [],
  onRowClick,
  onRowDoubleClick,
  onView,
  onEdit,
  onDelete,
  onPrint,
  toolbarActions = [],
  bulkActions = [],
  customToolbar,
  customFooter,
  variant,
  striped,
  bordered,
  hoverable,
  stickyHeader,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  extraActions = [],
}: DataTableProps<T>) {
  // Internal state (uncontrolled mode)
  const [internalSearch, setInternalSearch] = useState('');
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(25);
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc' | null>(null);

  // Determine controlled vs uncontrolled
  const isControlledPagination = controlledPagination !== undefined && controlledOnPaginationChange !== undefined;
  const isControlledSearch = controlledSearchValue !== undefined && controlledOnSearchChange !== undefined;
  const isControlledSort = controlledSortConfig !== undefined && controlledOnSort !== undefined;

  const searchValue = isControlledSearch ? controlledSearchValue : internalSearch;
  const setSearchValue = isControlledSearch ? controlledOnSearchChange! : setInternalSearch;

  // Filter & sort data (client-side)
  const filteredData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    let result = [...safeData];

    // Apply search filter
    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      result = result.filter(row =>
        columns.some(col => String((row as any)[col.key] ?? '').toLowerCase().includes(q))
      );
    }

    // Apply sort
    let effectiveSortKey: string | null;
    let effectiveSortDir: 'asc' | 'desc' | null;

    if (isControlledSort && controlledSortConfig) {
      effectiveSortKey = controlledSortConfig.key;
      effectiveSortDir = controlledSortConfig.direction;
    } else {
      effectiveSortKey = internalSortKey;
      effectiveSortDir = internalSortDir;
    }

    if (effectiveSortKey && effectiveSortDir) {
      result.sort((a, b) => {
        const aVal = (a as any)[effectiveSortKey];
        const bVal = (b as any)[effectiveSortKey];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        let cmp = 0;
        if (typeof aVal === 'string') cmp = aVal.localeCompare(bVal);
        else if (typeof aVal === 'number') cmp = aVal - bVal;
        else cmp = String(aVal).localeCompare(String(bVal));
        return effectiveSortDir === 'desc' ? -cmp : cmp;
      });
    }

    return result;
  }, [data, searchValue, columns, isControlledSort, controlledSortConfig, internalSortKey, internalSortDir]);

  // Pagination calculations
  const totalFiltered = filteredData.length;
  const effectivePageSize = internalPageSize === -1 ? totalFiltered || 1 : internalPageSize;

  const currentPagination = isControlledPagination
    ? controlledPagination
    : { page: internalPage, pageSize: effectivePageSize, total: totalFiltered };

  const { page, pageSize, total } = currentPagination;
  const effectiveTotalPages = Math.ceil(total / pageSize);
  const totalPages = effectiveTotalPages || 1;
  const safePage = Math.min(page, totalPages);

  const startItem = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(startItem + pageSize - 1, total);

  const displayData = isControlledPagination
    ? filteredData
    : filteredData.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Handlers
  const handleSearchChange = (val: string) => {
    setSearchValue(val);
    if (!isControlledPagination) setInternalPage(1);
  };

  const handleSortChange = (key: string, dir: 'asc' | 'desc') => {
    if (isControlledSort) {
      controlledOnSort({ key, direction: dir });
    } else {
      setInternalSortKey(key);
      setInternalSortDir(dir);
    }
    if (!isControlledPagination) setInternalPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (isControlledPagination) {
      controlledOnPaginationChange({ ...controlledPagination, page: newPage });
    } else {
      setInternalPage(newPage);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    if (isControlledPagination) {
      controlledOnPaginationChange({ ...controlledPagination, pageSize: newSize, page: 1 });
    } else {
      setInternalPageSize(newSize);
      setInternalPage(1);
    }
  };

  // Check if we need to show toolbar
  const hasToolbarContent = title || subtitle || customToolbar || toolbarActions.length > 0;

  // Check if we need to show search
  const showSearch = searchable;

  if (loading) {
    return (
      <div className="data-table-container">
        {hasToolbarContent && (
          <div className="data-table-toolbar">
            {title && <h2 className="text-sm font-semibold text-primary">{title}</h2>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
            {customToolbar}
          </div>
        )}
        <LoadingState rows={pageSize} columns={columns.length + (selectable ? 1 : 0)} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-table-container">
        <div style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ color: '#EF4444', fontSize: 14, marginBottom: 8 }}>Error loading data</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="data-table-container">
      {/* Toolbar */}
      {(hasToolbarContent || showSearch) && (
        <div className="data-table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && <h2 className="text-sm font-semibold text-primary">{title}</h2>}
              {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {toolbarActions.map((action: any, idx: number) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key || idx}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all font-medium ${
                      action.variant === 'primary'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : action.variant === 'danger'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'border border-border hover:bg-surface text-muted'
                    } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {Icon && <Icon size={14} />}
                    {action.label}
                  </button>
                );
              })}
              {customToolbar}
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      {showSearch && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={e => handleSearchChange(e.target.value)}
              style={{
                height: 36,
                width: '100%',
                paddingLeft: 36,
                paddingRight: 12,
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Table area */}
      <div style={{ overflowX: 'auto' }}>
        {total === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={emptyIcon}
            hasSearch={searchValue.trim().length > 0}
            hasFilters={filterValues ? Object.values(filterValues).some(v => v !== '' && v !== null && v !== undefined) : false}
            onClearSearch={() => handleSearchChange('')}
            onClearFilters={onFilterChange ? () => onFilterChange({}) : undefined}
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <TableHeader
              columns={columns}
              sortConfig={isControlledSort ? controlledSortConfig || null : (internalSortKey ? { key: internalSortKey, direction: internalSortDir! } : null)}
              onSort={sortable ? (config) => handleSortChange(config.key, config.direction) : undefined}
              selectable={selectable}
              selectedRows={selectedRows}
              allRows={displayData}
              onSelectAll={() => onSelectionChange?.(displayData)}
              onClearSelection={() => onSelectionChange?.([])}
              stickyHeader={stickyHeader}
            />
            <tbody>
              {displayData.map((row, index) => {
                const rowId = getRowId(row);
                const key = rowId != null ? rowId : index;
                const isSelected = selectedRows.some(s => getRowId(s) === rowId);

                return (
                  <TableRow
                    key={key}
                    row={row}
                    index={index}
                    columns={columns}
                    selectable={selectable}
                    selected={isSelected}
                    onSelect={onSelectionChange ? (r) => {
                      const exists = selectedRows.some(s => getRowId(s) === getRowId(r));
                      if (exists) {
                        onSelectionChange(selectedRows.filter(s => getRowId(s) !== getRowId(r)));
                      } else {
                        onSelectionChange([...selectedRows, r]);
                      }
                    } : undefined}
                    onRowClick={onRowClick}
                    onRowDoubleClick={onRowDoubleClick}
                    striped={striped}
                    hoverable={hoverable !== false}
                    getRowId={getRowId}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPrint={onPrint}
                    rowActions={typeof rowActions === 'function' ? rowActions(row) : rowActions}
                    extraActions={extraActions}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'var(--table-header-bg)',
          borderTop: '1px solid var(--border-color)',
          borderRadius: '0 0 12px 12px',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Showing {startItem.toLocaleString()}–{endItem.toLocaleString()} of {total.toLocaleString()} results
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rows per page:</span>
            <select
              value={internalPageSize === -1 ? -1 : pageSize}
              onChange={e => handlePageSizeChange(Number(e.target.value))}
              disabled={loading}
              style={{
                height: 32,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
              <option value={-1}>All</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              disabled={safePage <= 1 || loading}
              onClick={() => handlePageChange(1)}
              title="First page"
              style={{
                width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', borderRadius: 6, background: 'transparent',
                color: 'var(--text-secondary)', cursor: safePage <= 1 || loading ? 'default' : 'pointer',
                opacity: safePage <= 1 || loading ? 0.3 : 1, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (safePage > 1 && !loading) e.currentTarget.style.background = 'var(--table-row-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              disabled={safePage <= 1 || loading}
              onClick={() => handlePageChange(safePage - 1)}
              title="Previous page"
              style={{
                width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', borderRadius: 6, background: 'transparent',
                color: 'var(--text-secondary)', cursor: safePage <= 1 || loading ? 'default' : 'pointer',
                opacity: safePage <= 1 || loading ? 0.3 : 1, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (safePage > 1 && !loading) e.currentTarget.style.background = 'var(--table-row-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 8px' }}>
              Page {safePage} of {totalPages || 1}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages || loading}
              onClick={() => handlePageChange(safePage + 1)}
              title="Next page"
              style={{
                width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', borderRadius: 6, background: 'transparent',
                color: 'var(--text-secondary)', cursor: safePage >= totalPages || loading ? 'default' : 'pointer',
                opacity: safePage >= totalPages || loading ? 0.3 : 1, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (safePage < totalPages && !loading) e.currentTarget.style.background = 'var(--table-row-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages || loading}
              onClick={() => handlePageChange(totalPages)}
              title="Last page"
              style={{
                width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', borderRadius: 6, background: 'transparent',
                color: 'var(--text-secondary)', cursor: safePage >= totalPages || loading ? 'default' : 'pointer',
                opacity: safePage >= totalPages || loading ? 0.3 : 1, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (safePage < totalPages && !loading) e.currentTarget.style.background = 'var(--table-row-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}

      {customFooter}
    </div>
  );
}
