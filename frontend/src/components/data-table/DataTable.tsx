/**
 * DataTable Component
 * Professional, reusable data table container for enterprise REMS application
 * 
 * Features:
 * - Professional container/card layout
 * - Integrated search and filters
 * - Pagination with rows per page selector
 * - Sorting and selection
 * - Row actions and bulk actions
 * - Loading and empty states
 * - Responsive design
 * - Dark/light theme support
 */

import React, { useMemo } from 'react';
import { DataTableProps } from './types';
import { useTableState } from './hooks/useTableState';
import TableToolbar from './components/TableToolbar';
import TableHeader from './components/TableHeader';
import TableRow from './components/TableRow';
import TablePagination from './components/TablePagination';
import EmptyState from './components/EmptyState';
import LoadingState from './components/LoadingState';

export default function DataTable<T = any>({
  // Core data
  data,
  columns,
  
  // Table configuration
  title,
  subtitle,
  loading = false,
  error,
  
  // Selection
  selectable = false,
  selectedRows: controlledSelectedRows,
  onSelectionChange,
  getRowId = (row: T) => (row as any).id,
  
  // Sorting
  sortable = true,
  sortConfig: controlledSortConfig,
  onSort,
  
  // Pagination
  pagination: controlledPagination,
  onPaginationChange,
  
  // Filtering
  filters = [],
  filterValues: controlledFilterValues,
  onFilterChange,
  
  // Search
  searchable = true,
  searchValue: controlledSearchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  
  // Actions
  rowActions = [],
  bulkActions = [],
  toolbarActions = [],
  
  // Styling
  variant = 'default',
  stickyHeader = false,
  striped = true,
  bordered = true,
  hoverable = true,
  
  // Responsive
  responsive = true,
  mobileCardView = false,
  
  // Empty state
  emptyTitle,
  emptyDescription,
  emptyIcon,
  
  // Row interaction
  onRowClick,
  onRowDoubleClick,
  
  // Custom renderers
  customToolbar,
  customFooter,
  
  // Performance
  virtualized = false,
  rowHeight = 48,
}: DataTableProps<T>) {
  
  // Determine if we're using controlled or uncontrolled state
  const isControlled = {
    sort: controlledSortConfig !== undefined && onSort !== undefined,
    pagination: controlledPagination !== undefined && onPaginationChange !== undefined,
    filters: controlledFilterValues !== undefined && onFilterChange !== undefined,
    search: controlledSearchValue !== undefined && onSearchChange !== undefined,
    selection: controlledSelectedRows !== undefined && onSelectionChange !== undefined,
  };

  // Initialize table state for uncontrolled mode
  const [tableState, tableActions] = useTableState({
    data,
    initialSort: controlledSortConfig,
    initialFilters: controlledFilterValues || {},
    initialSearch: controlledSearchValue || '',
    initialPageSize: controlledPagination?.pageSize || 20,
    serverSide: isControlled.pagination || isControlled.sort || isControlled.filters,
  });

  // Use controlled values when available, otherwise use internal state
  const currentSortConfig = isControlled.sort ? controlledSortConfig : tableState.sortConfig;
  const currentPagination = isControlled.pagination ? controlledPagination! : tableState.pagination;
  const currentFilterValues = isControlled.filters ? controlledFilterValues! : tableState.filterValues;
  const currentSearchValue = isControlled.search ? controlledSearchValue! : tableState.searchValue;
  const currentSelectedRows = isControlled.selection ? controlledSelectedRows! : tableState.selectedRows;
  
  // Use controlled data when server-side, otherwise use filtered data from state
  const displayData = (isControlled.pagination || isControlled.sort || isControlled.filters) 
    ? data 
    : tableState.filteredData;

  // Event handlers
  const handleSort = (config: any) => {
    if (isControlled.sort) {
      onSort!(config);
    } else {
      tableActions.setSort(config);
    }
  };

  const handlePaginationChange = (config: any) => {
    if (isControlled.pagination) {
      onPaginationChange!(config);
    } else {
      tableActions.setPagination(config);
    }
  };

  const handleFilterChange = (filters: Record<string, any>) => {
    if (isControlled.filters) {
      onFilterChange!(filters);
    } else {
      tableActions.setFilters(filters);
    }
  };

  const handleSearchChange = (value: string) => {
    if (isControlled.search) {
      onSearchChange!(value);
    } else {
      tableActions.setSearch(value);
    }
  };

  const handleSelectionChange = (rows: T[]) => {
    if (isControlled.selection) {
      onSelectionChange!(rows);
    } else {
      tableActions.setSelectedRows(rows);
    }
  };

  const handleRowSelect = (row: T) => {
    if (isControlled.selection) {
      const isSelected = currentSelectedRows.some(selected => 
        getRowId(selected) === getRowId(row)
      );
      const newSelection = isSelected
        ? currentSelectedRows.filter(selected => getRowId(selected) !== getRowId(row))
        : [...currentSelectedRows, row];
      onSelectionChange!(newSelection);
    } else {
      tableActions.toggleRowSelection(row);
    }
  };

  const handleSelectAll = () => {
    if (isControlled.selection) {
      onSelectionChange!(displayData);
    } else {
      tableActions.selectAllRows();
    }
  };

  const handleClearSelection = () => {
    if (isControlled.selection) {
      onSelectionChange!([]);
    } else {
      tableActions.clearSelection();
    }
  };

  // Check if filters or search are active
  const hasActiveFilters = Object.values(currentFilterValues).some(value => 
    value !== undefined && value !== null && value !== '' && 
    (!Array.isArray(value) || value.length > 0)
  );
  const hasActiveSearch = currentSearchValue.trim().length > 0;

  // Clear functions for empty state
  const handleClearFilters = () => {
    const clearedFilters = Object.keys(currentFilterValues).reduce((acc, key) => {
      acc[key] = '';
      return acc;
    }, {} as Record<string, any>);
    handleFilterChange(clearedFilters);
  };

  const handleClearSearch = () => {
    handleSearchChange('');
  };

  // Container classes based on variant
  const containerClasses = useMemo(() => {
    const base = "rounded-xl overflow-hidden border";
    
    switch (variant) {
      case 'compact':
        return `${base} text-xs`;
      case 'comfortable':
        return `${base} text-sm`;
      default:
        return `${base} text-sm`;
    }
  }, [variant]);

  // Container style for theme-aware colors
  const containerStyle = {
    borderColor: "var(--border)",
    backgroundColor: "var(--bg-surface)",
  };

  // Show loading state
  if (loading && displayData.length === 0) {
    return (
      <div className={containerClasses} style={containerStyle}>
        {(title || subtitle || customToolbar || searchable || filters.length > 0 || toolbarActions.length > 0) && (
          <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <TableToolbar
              title={title}
              subtitle={subtitle}
              searchable={searchable}
              searchValue={currentSearchValue}
              onSearchChange={handleSearchChange}
              searchPlaceholder={searchPlaceholder}
              filters={filters}
              filterValues={currentFilterValues}
              onFilterChange={handleFilterChange}
              toolbarActions={toolbarActions}
              bulkActions={bulkActions}
              selectedRows={currentSelectedRows}
              loading={loading}
              customContent={customToolbar}
            />
          </div>
        )}
        <LoadingState rows={currentPagination.pageSize} columns={columns.length} />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={containerClasses} style={containerStyle}>
        <div className="p-8 text-center">
          <div className="text-red-400 mb-2">Error</div>
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses} style={containerStyle}>
      {/* Toolbar */}
      {(title || subtitle || customToolbar || searchable || filters.length > 0 || toolbarActions.length > 0) && (
        <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <TableToolbar
            title={title}
            subtitle={subtitle}
            searchable={searchable}
            searchValue={currentSearchValue}
            onSearchChange={handleSearchChange}
            searchPlaceholder={searchPlaceholder}
            filters={filters}
            filterValues={currentFilterValues}
            onFilterChange={handleFilterChange}
            toolbarActions={toolbarActions}
            bulkActions={bulkActions}
            selectedRows={currentSelectedRows}
            loading={loading}
            onRefresh={tableActions.refresh}
            customContent={customToolbar}
          />
        </div>
      )}

      {/* Table */}
      <div className={`overflow-x-auto ${responsive ? 'min-w-0' : ''}`}>
        {displayData.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={emptyIcon}
            hasFilters={hasActiveFilters}
            hasSearch={hasActiveSearch}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            onClearSearch={hasActiveSearch ? handleClearSearch : undefined}
          />
        ) : (
          <table className="w-full border-collapse">
            <TableHeader
              columns={columns}
              sortConfig={currentSortConfig}
              onSort={sortable ? handleSort : undefined}
              selectable={selectable}
              selectedRows={currentSelectedRows}
              allRows={displayData}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              stickyHeader={stickyHeader}
            />
            <tbody>
              {displayData.map((row, index) => {
                const rowId = getRowId(row);
  const isSelected = currentSelectedRows.some(selected => 
        String(getRowId(selected)) === String(rowId)
      );
                
                return (
                  <TableRow
                    key={rowId}
                    row={row}
                    index={index}
                    columns={columns}
                    selectable={selectable}
                    selected={isSelected}
                    onSelect={handleRowSelect}
                    onRowClick={onRowClick}
                    onRowDoubleClick={onRowDoubleClick}
                    rowActions={rowActions}
                    striped={striped}
                    hoverable={hoverable}
                    getRowId={getRowId}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {displayData.length > 0 && (
        <TablePagination
          pagination={currentPagination}
          onPaginationChange={handlePaginationChange}
          loading={loading}
        />
      )}

      {/* Custom footer */}
      {customFooter}
    </div>
  );
}