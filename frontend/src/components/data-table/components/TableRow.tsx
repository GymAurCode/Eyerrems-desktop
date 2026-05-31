/**
 * TableRow Component
 * Professional table row with selection and actions
 */

import React from 'react';
import { TableColumn, TableAction } from '../types';
import { RowActions } from '../../actions';

interface TableRowProps<T = any> {
  row: T;
  index: number;
  columns: TableColumn<T>[];
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (row: T) => void;
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;
  rowActions?: TableAction<T>[];
  striped?: boolean;
  hoverable?: boolean;
  getRowId?: (row: T) => string | number;
}

export default function TableRow<T = any>({
  row,
  index,
  columns,
  selectable = false,
  selected = false,
  onSelect,
  onRowClick,
  onRowDoubleClick,
  rowActions = [],
  striped = false,
  hoverable = true,
  getRowId,
}: TableRowProps<T>) {
  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger row click if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"]')) {
      return;
    }
    
    onRowClick?.(row, index);
  };

  const handleRowDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"]')) {
      return;
    }
    
    onRowDoubleClick?.(row, index);
  };

  const handleSelectChange = () => {
    onSelect?.(row);
  };

  const rowClasses = `
    border-b border-border transition-colors
    ${striped && index % 2 === 1 ? 'bg-card/30' : ''}
    ${hoverable ? 'hover:bg-card/70' : ''}
    ${selected ? 'bg-card/60 border-border' : ''}
    ${onRowClick ? 'cursor-pointer' : ''}
  `.trim();

  const cellClasses = "px-4 py-3 text-sm text-foreground whitespace-nowrap";

  // Convert row actions to the format expected by RowActions component
  const actionConfigs = rowActions.map(action => ({
    type: 'custom' as const,
    label: action.label,
    icon: action.icon,
    color: action.variant === 'danger' ? '#ef4444' : 
           action.variant === 'success' ? '#10b981' :
           action.variant === 'warning' ? '#f59e0b' :
           action.variant === 'primary' ? '#3b82f6' : '#6b7280',
    handler: () => action.onClick(row),
    disabled: () => action.disabled?.(row) ?? false,
    hidden: action.hidden?.(row),
    permission: action.permission,
    tooltip: action.label,
  }));

  return (
    <tr 
      className={rowClasses}
      onClick={handleRowClick}
      onDoubleClick={handleRowDoubleClick}
    >
      {/* Selection column */}
      {selectable && (
        <td className={`${cellClasses} w-12`}>
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={handleSelectChange}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-border bg-background text-blue-600 focus:ring-blue-500 focus:ring-2"
            />
          </div>
        </td>
      )}

      {/* Data columns */}
      {columns.map((column) => {
        const value = (row as any)[column.key];
        const align = column.align || 'left';
        
        return (
          <td
            key={column.key}
            className={`
              ${cellClasses} 
              ${column.className || ''} 
              ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}
            `.trim()}
            style={{ width: column.width }}
          >
            {column.render ? column.render(value, row, index) : (
              <span className="truncate block">
                {value === null || value === undefined ? '—' : String(value)}
              </span>
            )}
          </td>
        );
      })}

      {/* Actions column */}
      {rowActions.length > 0 && (
        <td className={`${cellClasses} w-20`}>
          <div className="flex items-center justify-end">
            <RowActions
              row={row}
              actions={actionConfigs}
              variant="icon-only"
              compact
            />
          </div>
        </td>
      )}
    </tr>
  );
}