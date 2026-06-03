/**
 * SmartTable Component
 * Reusable, enterprise-grade table system with server-side filters and localStorage state persistence.
 */

import React, { useState, useEffect, useRef } from 'react';
import DataTable from './DataTable';
import { TableColumn, PaginationConfig, TableAction } from './types';
import { Search, Calendar, RefreshCw, X } from 'lucide-react';

interface SmartTableProps<T> {
  // Data & Columns
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  total: number;
  
  // Storage Key for State Persistence
  storageKey: string;
  
  // Title & Subtitle
  title?: string;
  subtitle?: string;
  
  // Action configurations
  rowActions?: TableAction<T>[];
  onRowClick?: (row: T) => void;
  toolbarActions?: React.ReactNode;
  
  // Filter visibility & options
  showDateFilter?: boolean;
  showTypeFilter?: boolean;
  typeOptions?: { label: string; value: string }[];
  showStatusFilter?: boolean;
  statusOptions?: { label: string; value: string }[];
  
  // Parameters change callback (called on filter/pagination changes)
  onParamsChange: (params: {
    page: number;
    pageSize: number;
    search: string;
    filter: string; // today, weekly, monthly, yearly, custom
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    propertyType: string;
    status: string;
  }) => void;
}

export default function SmartTable<T = any>({
  data,
  columns,
  loading = false,
  total,
  storageKey,
  title,
  subtitle,
  rowActions = [],
  onRowClick,
  toolbarActions,
  showDateFilter = true,
  showTypeFilter = false,
  typeOptions = [],
  showStatusFilter = true,
  statusOptions = [],
  onParamsChange,
}: SmartTableProps<T>) {
  
  // Synchronously initialize state from localStorage if exists
  const getInitialState = () => {
    try {
      const cached = localStorage.getItem(`smart-table:${storageKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          page: parsed.page || 1,
          pageSize: parsed.pageSize || 10,
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
    return {
      page: 1,
      pageSize: 10,
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

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`smart-table:${storageKey}`, JSON.stringify(state));
  }, [state, storageKey]);

  // Trigger search update after 300ms debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (state.search !== searchInput) {
        setState((prev) => ({ ...prev, search: searchInput, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, state.search]);

  // Watch for parameter changes to invoke callback
  useEffect(() => {
    onParamsChange({
      page: state.page,
      pageSize: state.pageSize,
      search: state.search,
      filter: state.filter,
      startDate: state.startDate,
      endDate: state.endDate,
      propertyType: state.propertyType,
      status: state.status,
    });
  }, [
    state.page,
    state.pageSize,
    state.search,
    state.filter,
    state.startDate,
    state.endDate,
    state.propertyType,
    state.status,
  ]);

  const handlePageChange = (config: PaginationConfig) => {
    setState((prev) => ({
      ...prev,
      page: config.page,
      pageSize: config.pageSize,
    }));
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setState({
      page: 1,
      pageSize: state.pageSize,
      search: '',
      filter: '',
      startDate: '',
      endDate: '',
      propertyType: '',
      status: '',
    });
  };

  return (
    <div className="w-full space-y-4 prop-card p-4">
      {/* Header & Title */}
      {(title || subtitle || toolbarActions) && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <div>
            {title && <h2 className="text-lg font-semibold text-primary">{title}</h2>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {toolbarActions && <div className="flex gap-2 items-center">{toolbarActions}</div>}
        </div>
      )}

      {/* Standardized Filter Panel */}
      <div className="flex flex-wrap items-center gap-3 py-1 pb-4 border-b border-theme">
        {/* Search Field */}
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

        {/* Date Filter Dropdown */}
        {showDateFilter && (
          <div className="flex items-center gap-2">
            <select
              value={state.filter}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  filter: e.target.value,
                  page: 1,
                  startDate: e.target.value === 'custom' ? prev.startDate : '',
                  endDate: e.target.value === 'custom' ? prev.endDate : '',
                }))
              }
              className="select-dark py-1.5 px-3 text-xs"
              style={{ color: "var(--text-primary)" }}
            >
              <option value="">All Time</option>
              <option value="today">Today</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom Range</option>
            </select>

            {/* Custom Range Picker */}
            {state.filter === 'custom' && (
              <div className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 animate-fadeIn" style={{ backgroundColor: "var(--bg-surface2)", border: "1px solid var(--border)" }}>
                <input
                  type="date"
                  value={state.startDate}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, startDate: e.target.value, page: 1 }))
                  }
                  className="border-0 text-xs py-1 focus:ring-0 focus:outline-none cursor-pointer"
                  style={{ backgroundColor: "transparent", color: "var(--text-primary)" }}
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>-</span>
                <input
                  type="date"
                  value={state.endDate}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, endDate: e.target.value, page: 1 }))
                  }
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
            onChange={(e) =>
              setState((prev) => ({ ...prev, propertyType: e.target.value, page: 1 }))
            }
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
            onChange={(e) =>
              setState((prev) => ({ ...prev, status: e.target.value, page: 1 }))
            }
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

        {/* Reset Button */}
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

      {/* Reusable DataTable Component */}
      <DataTable
        data={data}
        columns={columns}
        loading={loading}
        selectable={false}
        searchable={false} // Disable internal search toolbar as we use the standardized SmartTable bar
        filters={[]} // Disable internal filter toolbar
        pagination={{
          page: state.page,
          pageSize: state.pageSize,
          total: total,
          pageSizeOptions: [10, 25, 50, 100],
        }}
        onPaginationChange={handlePageChange}
        rowActions={rowActions}
        onRowClick={onRowClick}
        variant="comfortable"
      />
    </div>
  );
}
