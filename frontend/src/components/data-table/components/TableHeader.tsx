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
      ? <ArrowUp size={12} style={{ color: 'var(--table-header-text)' }} />
      : <ArrowDown size={12} style={{ color: 'var(--table-header-text)' }} />;
  };

  const headerBase: React.CSSProperties = {
    padding: '0 16px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--table-header-text)',
    background: 'var(--table-header-bg)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    height: 44,
  };

  return (
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
        {selectable && (
          <th style={{ ...headerBase, width: 48 }}>
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(input) => {
                if (input) input.indeterminate = isPartiallySelected;
              }}
              onChange={handleSelectAll}
            />
          </th>
        )}

        {columns.map((column) => {
          const isSortable = column.sortable !== false && !!onSort;
          return (
            <th
              key={column.key}
              style={{
                ...headerBase,
                width: column.width,
                textAlign: column.align || 'left',
                cursor: isSortable ? 'pointer' : undefined,
                userSelect: 'none',
                background: sortConfig?.key === column.key ? 'var(--table-row-hover)' : undefined,
              }}
              onClick={isSortable ? () => handleSort(column.key) : undefined}
              onMouseEnter={e => { if (isSortable) e.currentTarget.style.background = 'var(--table-row-hover)' }}
              onMouseLeave={e => { if (isSortable) e.currentTarget.style.background = sortConfig?.key === column.key ? 'var(--table-row-hover)' : '' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{column.label}</span>
                {isSortable && getSortIcon(column.key)}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
