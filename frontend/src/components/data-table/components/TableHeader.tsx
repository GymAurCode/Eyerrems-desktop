/**
 * TableHeader Component
 * Professional table header with sorting and selection
 */

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableColumn, SortConfig } from '../types';

interface TableHeaderProps<T = any> {
  columns: TableColumn<T>[];
  sortConfig?: SortConfig | null;
  onSort?: (config: SortConfig) => void;
  selectable?: boolean;
  selectedRows?: T[];
  allRows?: T[];
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  stickyHeader?: boolean;
}

export default function TableHeader<T = any>({
  columns,
  sortConfig,
  onSort,
  selectable = false,
  selectedRows = [],
  allRows = [],
  onSelectAll,
  onClearSelection,
  stickyHeader = false,
}: TableHeaderProps<T>) {
  const isAllSelected = allRows.length > 0 && selectedRows.length === allRows.length;
  const isPartiallySelected = selectedRows.length > 0 && selectedRows.length < allRows.length;

  const handleSort = (columnKey: string) => {
    if (!onSort) return;

    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig?.key === columnKey) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }

    onSort({ key: columnKey, direction });
  };

  const handleSelectAll = () => {
    if (isAllSelected || isPartiallySelected) {
      onClearSelection?.();
    } else {
      onSelectAll?.();
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown size={12} className="opacity-40" />;
    }
    
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={12} className="text-blue-400" />
      : <ArrowDown size={12} className="text-blue-400" />;
  };

  const headerClasses = `
    px-4 py-3 text-left text-xs font-bold uppercase tracking-wider
    border-b border-gray-700 bg-gray-800/50 text-gray-400
    ${stickyHeader ? 'sticky top-0 z-10' : ''}
  `.trim();

  return (
    <thead>
      <tr>
        {/* Selection column */}
        {selectable && (
          <th className={`${headerClasses} w-12`}>
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = isPartiallySelected;
                  }
                }}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
            </div>
          </th>
        )}

        {/* Data columns */}
        {columns.map((column) => {
          const isSortable = column.sortable !== false && onSort;
          const width = column.width;
          const align = column.align || 'left';
          
          return (
            <th
              key={column.key}
              className={`
                ${headerClasses} 
                ${column.headerClassName || ''} 
                ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}
                ${isSortable ? 'cursor-pointer hover:bg-gray-700/50 select-none' : ''}
              `.trim()}
              style={{ width }}
              onClick={isSortable ? () => handleSort(column.key) : undefined}
            >
              <div className={`flex items-center gap-2 ${
                align === 'center' ? 'justify-center' : 
                align === 'right' ? 'justify-end' : 'justify-start'
              }`}>
                <span className="truncate">{column.label}</span>
                {isSortable && getSortIcon(column.key)}
              </div>
            </th>
          );
        })}

        {/* Actions column placeholder - will be handled by parent */}
      </tr>
    </thead>
  );
}