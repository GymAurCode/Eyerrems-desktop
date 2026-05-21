/**
 * TableToolbar Component
 * Professional toolbar with title, search, filters, and actions
 */

import React, { useState } from 'react';
import { Search, Filter, RefreshCw, Download, Upload, Plus, X, ChevronDown } from 'lucide-react';
import { TableFilter, TableToolbarAction, BulkAction } from '../types';

interface TableToolbarProps<T = any> {
  title?: string;
  subtitle?: string;
  
  // Search
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  
  // Filters
  filters?: TableFilter[];
  filterValues?: Record<string, any>;
  onFilterChange?: (filters: Record<string, any>) => void;
  
  // Actions
  toolbarActions?: TableToolbarAction[];
  bulkActions?: BulkAction<T>[];
  selectedRows?: T[];
  
  // State
  loading?: boolean;
  onRefresh?: () => void;
  
  // Custom content
  customContent?: React.ReactNode;
}

export default function TableToolbar<T = any>({
  title,
  subtitle,
  searchable = true,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  filterValues = {},
  onFilterChange,
  toolbarActions = [],
  bulkActions = [],
  selectedRows = [],
  loading = false,
  onRefresh,
  customContent,
}: TableToolbarProps<T>) {
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const hasActiveFilters = Object.values(filterValues).some(value => 
    value !== undefined && value !== null && value !== '' && 
    (!Array.isArray(value) || value.length > 0)
  );

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filterValues, [key]: value };
    onFilterChange?.(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = Object.keys(filterValues).reduce((acc, key) => {
      acc[key] = '';
      return acc;
    }, {} as Record<string, any>);
    onFilterChange?.(clearedFilters);
  };

  const renderFilter = (filter: TableFilter) => {
    const value = filterValues[filter.key] || filter.defaultValue || '';

    switch (filter.type) {
      case 'text':
        return (
          <input
            key={filter.key}
            type="text"
            placeholder={filter.placeholder || filter.label}
            value={value}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            className="input-dark px-3 py-2 text-xs w-full"
          />
        );

      case 'select':
        return (
          <select
            key={filter.key}
            value={value}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            className="select-dark px-3 py-2 text-xs w-full"
          >
            <option value="">{filter.placeholder || `All ${filter.label}`}</option>
            {filter.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            key={filter.key}
            type="date"
            value={value}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            className="input-dark px-3 py-2 text-xs w-full"
          />
        );

      case 'number':
        return (
          <input
            key={filter.key}
            type="number"
            placeholder={filter.placeholder || filter.label}
            value={value}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            className="input-dark px-3 py-2 text-xs w-full"
          />
        );

      case 'boolean':
        return (
          <select
            key={filter.key}
            value={value}
            onChange={(e) => handleFilterChange(filter.key, e.target.value === 'true')}
            className="select-dark px-3 py-2 text-xs w-full"
          >
            <option value="">{filter.placeholder || `All ${filter.label}`}</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      default:
        return null;
    }
  };

  const ActionButton = ({ action }: { action: TableToolbarAction }) => {
    const Icon = action.icon;
    const baseClasses = "flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all font-medium";
    
    let variantClasses = "";
    switch (action.variant) {
      case 'primary':
        variantClasses = "bg-blue-600 hover:bg-blue-700 text-white";
        break;
      case 'danger':
        variantClasses = "bg-red-600 hover:bg-red-700 text-white";
        break;
      case 'success':
        variantClasses = "bg-green-600 hover:bg-green-700 text-white";
        break;
      case 'warning':
        variantClasses = "bg-yellow-600 hover:bg-yellow-700 text-white";
        break;
        default:
          variantClasses = "border border-border hover:bg-surface text-muted";
    }

    return (
      <button
        onClick={action.onClick}
        disabled={action.disabled}
        className={`${baseClasses} ${variantClasses} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {Icon && <Icon size={14} />}
        {action.label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Main toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title and subtitle */}
        <div className="flex-1 min-w-0">
          {title && (
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-primary truncate">{title}</h2>
              {selectedRows.length > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-600/20 text-blue-400">
                  {selectedRows.length} selected
                </span>
              )}
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-muted mt-1">{subtitle}</p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Bulk actions when rows are selected */}
          {selectedRows.length > 0 && bulkActions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-border hover:bg-surface text-muted"
              >
                Bulk Actions
                <ChevronDown size={12} />
              </button>
              
              {showBulkActions && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-50 min-w-48">
                  {bulkActions.map((action) => {
                    const Icon = action.icon;
                    const disabled = action.disabled?.(selectedRows) || false;
                    
                    return (
                      <button
                        key={action.key}
                        onClick={() => {
                          action.onClick(selectedRows);
                          setShowBulkActions(false);
                        }}
                        disabled={disabled}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface first:rounded-t-lg last:rounded-b-lg ${
                          disabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {Icon && <Icon size={14} />}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg border border-border hover:bg-surface text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Filter toggle */}
          {filters.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-border transition-colors ${
                hasActiveFilters || showFilters
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border hover:bg-surface text-foreground'
              }`}
            >
              <Filter size={14} />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-primary rounded-full"></span>
              )}
            </button>
          )}

          {/* Toolbar actions */}
          {toolbarActions.map((action) => (
            <ActionButton key={action.key} action={action} />
          ))}

          {/* Custom content */}
          {customContent}
        </div>
      </div>

      {/* Search bar */}
      {searchable && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="input-dark w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
      )}

      {/* Filters panel */}
      {showFilters && filters.length > 0 && (
        <div className="p-4 rounded-lg border border-border bg-surface space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-primary">Filters</h3>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setShowFilters(false)}
                    className="p-1 hover:bg-surface rounded"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filters.map((filter) => (
              <div key={filter.key} className="space-y-1">
                <label className="text-xs font-medium text-muted uppercase tracking-wider">
                  {filter.label}
                </label>
                {renderFilter(filter)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}