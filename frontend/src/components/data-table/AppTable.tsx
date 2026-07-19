import React, { useState, useEffect, useRef } from 'react';
import DataTable from './DataTable';
import { TableColumn, TableAction } from './types';
import { Search, Calendar, RefreshCw, X, AlertTriangle } from 'lucide-react';

export interface AppTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  onPageChange: (config: { page: number; pageSize: number }) => void;
  onFilterChange: (filters: {
    search: string;
    filter: string;
    startDate: string;
    endDate: string;
    propertyType: string;
    status: string;
  }) => void;
  
  title?: string;
  subtitle?: string;
  storageKey?: string;
  rowActions?: TableAction<T>[];
  onRowClick?: (row: T) => void;
  toolbarActions?: React.ReactNode;
  
  showDateFilter?: boolean;
  showStatusFilter?: boolean;
  statusOptions?: { label: string; value: string }[];
  showTypeFilter?: boolean;
  typeOptions?: { label: string; value: string }[];
}

export function removeEmptyParams(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(([_, v]) =>
      v !== "" && v !== null && v !== undefined
    )
  );
}

export default function AppTable<T = any>({
  columns,
  data,
  loading = false,
  error = null,
  onRetry,
  pagination,
  onPageChange,
  onFilterChange,
  title,
  subtitle,
  storageKey,
  rowActions = [],
  onRowClick,
  toolbarActions,
  showDateFilter = true,
  showStatusFilter = false,
  statusOptions = [],
  showTypeFilter = false,
  typeOptions = [],
}: AppTableProps<T>) {
  
  // Initialize local filter state from storage or defaults
  const getInitialState = () => {
    if (storageKey) {
      try {
        const cached = localStorage.getItem(`app-table:${storageKey}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            search: parsed.search || '',
            filter: parsed.filter || '',
            startDate: parsed.startDate || '',
            endDate: parsed.endDate || '',
            propertyType: parsed.propertyType || '',
            status: parsed.status || '',
          };
        }
      } catch (e) {
        console.error('Failed to parse cached table state:', e);
      }
    }
    return {
      search: '',
      filter: '',
      startDate: '',
      endDate: '',
      propertyType: '',
      status: '',
    };
  };

  const [state, setState] = useState(getInitialState);
  const [searchInput, setSearchInput] = useState(state.search);
  const isFirstRender = useRef(true);

  // Sync state to localStorage
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`app-table:${storageKey}`, JSON.stringify(state));
    }
  }, [state, storageKey]);

  // Debounced search logic (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (state.search !== searchInput) {
        setState((prev) => ({ ...prev, search: searchInput }));
        onPageChange({ page: 1, pageSize: pagination.pageSize });
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, state.search, pagination.pageSize, onPageChange]);

  // Trigger onFilterChange on filter criteria changes (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onFilterChange(state);
  }, [
    state.search,
    state.filter,
    state.startDate,
    state.endDate,
    state.propertyType,
    state.status,
  ]);

  const handlePageChange = (config: { page: number; pageSize: number }) => {
    onPageChange(config);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    const resetVal = {
      search: '',
      filter: '',
      startDate: '',
      endDate: '',
      propertyType: '',
      status: '',
    };
    setState(resetVal);
    onPageChange({ page: 1, pageSize: pagination.pageSize });
  };

  return (
    <div className="w-full space-y-4 rounded-xl p-4 border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--card-shadow)" }}>
      {/* Header / Toolbar */}
      {(title || subtitle || toolbarActions) && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <div>
            {title && <h2 className="text-lg font-semibold text-primary">{title}</h2>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {toolbarActions && <div className="flex gap-2 items-center">{toolbarActions}</div>}
        </div>
      )}

      {/* Filter panel */}
      <div className="flex flex-wrap items-center gap-3 py-1 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {/* Search */}
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          </span>
          <input
            type="text"
            placeholder="Search records..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-dark w-full pl-9 pr-4 py-1.5 text-xs"
            style={{ color: "var(--text-primary)" }}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Date Filter */}
        {showDateFilter && (
          <div className="flex items-center gap-2">
            <select
              value={state.filter}
              onChange={(e) => {
                const val = e.target.value;
                setState((prev) => ({
                  ...prev,
                  filter: val,
                  startDate: val === 'custom' ? prev.startDate : '',
                  endDate: val === 'custom' ? prev.endDate : '',
                }));
                onPageChange({ page: 1, pageSize: pagination.pageSize });
              }}
              className="select-dark py-1.5 px-3 text-xs"
              style={{ color: "var(--text-primary)" }}
            >
              <option value="">All Time</option>
              <option value="today">Today</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="custom">Custom Range</option>
            </select>

            {state.filter === 'custom' && (
              <div className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 animate-fadeIn" style={{ backgroundColor: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                <input
                  type="date"
                  value={state.startDate}
                  onChange={(e) => {
                    setState((prev) => ({ ...prev, startDate: e.target.value }));
                    onPageChange({ page: 1, pageSize: pagination.pageSize });
                  }}
                  className="border-0 text-xs py-1 focus:ring-0 focus:outline-none cursor-pointer"
                  style={{ backgroundColor: "transparent", color: "var(--text-primary)" }}
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>-</span>
                <input
                  type="date"
                  value={state.endDate}
                  onChange={(e) => {
                    setState((prev) => ({ ...prev, endDate: e.target.value }));
                    onPageChange({ page: 1, pageSize: pagination.pageSize });
                  }}
                  className="border-0 text-xs py-1 focus:ring-0 focus:outline-none cursor-pointer"
                  style={{ backgroundColor: "transparent", color: "var(--text-primary)" }}
                />
              </div>
            )}
          </div>
        )}

        {/* Property Type Filter */}
        {showTypeFilter && typeOptions.length > 0 && (
          <select
            value={state.propertyType}
            onChange={(e) => {
              setState((prev) => ({ ...prev, propertyType: e.target.value }));
              onPageChange({ page: 1, pageSize: pagination.pageSize });
            }}
            className="select-dark py-1.5 px-3 text-xs"
            style={{ color: "var(--text-primary)" }}
          >
            <option value="">All Property Types</option>
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Status Filter */}
        {showStatusFilter && statusOptions.length > 0 && (
          <select
            value={state.status}
            onChange={(e) => {
              setState((prev) => ({ ...prev, status: e.target.value }));
              onPageChange({ page: 1, pageSize: pagination.pageSize });
            }}
            className="select-dark py-1.5 px-3 text-xs"
            style={{ color: "var(--text-primary)" }}
          >
            <option value="">All Statuses</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Reset Filters */}
        {(state.search || state.filter || state.propertyType || state.status) && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors ml-auto font-medium"
            title="Reset Filters"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Main Table Area / Error States / Loading States */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-red-500/20 bg-red-950/15 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center text-red-400 mb-3 animate-pulse">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-primary mb-1">Failed to load data</h3>
          <p className="text-xs text-muted max-w-md mb-4">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium shadow-md hover:shadow-lg"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry Request</span>
            </button>
          )}
        </div>
      ) : (
        <DataTable
          data={data}
          columns={columns}
          loading={loading}
          selectable={false}
          searchable={false}
          filters={[]}
          pagination={{
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            pageSizeOptions: [10, 25, 50, 100],
          }}
          onPaginationChange={(config) => handlePageChange({ page: config.page, pageSize: config.pageSize })}
          rowActions={rowActions}
          onRowClick={onRowClick}
          variant="comfortable"
        />
      )}
    </div>
  );
}
