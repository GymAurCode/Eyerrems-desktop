import React, { memo, useState } from 'react';
import { Eye, Pencil, Printer, Trash2 } from 'lucide-react';
import { TableColumn, TableAction } from '../types';
import { ConfirmDialog } from '../../actions';

interface TableRowProps<T = any> {
  row: T;
  index: number;
  columns: TableColumn<T>[];
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (row: T) => void;
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;
  striped?: boolean;
  hoverable?: boolean;
  getRowId?: (row: T) => string | number;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onPrint?: (row: T) => void;
  rowActions?: TableAction<T>[];
  extraActions?: { label: string; icon: React.ElementType; onClick: (row: T) => void; color?: string }[];
}

const rowStyle: React.CSSProperties = {
  height: 56,
  transition: 'background-color 0.15s ease',
};

const cellStyle: React.CSSProperties = {
  padding: '0 16px',
  fontSize: 14,
  color: 'var(--text-primary)',
};

const actionBtnBase: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const actionBtnHover = (color: string, bg: string): React.CSSProperties => ({
  ...actionBtnBase,
  background: bg,
  color,
});

const ActionBtn = memo(function ActionBtn({ icon: Icon, tooltip, color, hoverBg, onClick }: {
  icon: React.ElementType;
  tooltip: string;
  color: string;
  hoverBg: string;
  onClick: () => void;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      title={tooltip}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={h ? actionBtnHover(color, hoverBg) : actionBtnBase}
    >
      <Icon size={15} />
    </button>
  );
});

function getRecordName<T>(row: T): string {
  const r = row as any;
  return r.name || r.title || r.label || r.code || r.reference || `#${r.id}` || 'Record';
}

const TableRow = memo(function TableRow<T = any>({
  row,
  index,
  columns,
  selectable = false,
  selected = false,
  onSelect,
  onRowClick,
  onRowDoubleClick,
  striped = false,
  hoverable = true,
  getRowId,
  onView,
  onEdit,
  onDelete,
  onPrint,
  rowActions = [],
  extraActions = [],
}: TableRowProps<T>) {
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"]')) return;
    onRowClick?.(row, index);
  };

  const handleRowDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"]')) return;
    onRowDoubleClick?.(row, index);
  };

  const handleDeleteClick = () => setDeleteTarget(row);

  const hasActions = onView || onEdit || onDelete || onPrint || rowActions.length > 0 || extraActions.length > 0;

  return (
    <tr
      style={{
        ...rowStyle,
        borderBottom: '1px solid var(--border-color)',
        background: selected ? 'var(--table-row-hover)' : 'transparent',
        cursor: onRowClick ? 'pointer' : undefined,
      }}
      onClick={handleRowClick}
      onDoubleClick={handleRowDoubleClick}
      onMouseEnter={e => { if (hoverable) e.currentTarget.style.background = 'var(--table-row-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = selected ? 'var(--table-row-hover)' : 'transparent' }}
    >
      {/* Selection column */}
      {selectable && (
        <td style={{ ...cellStyle, width: 48 }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect?.(row)}
            onClick={e => e.stopPropagation()}
            style={{ cursor: 'pointer' }}
          />
        </td>
      )}

      {/* Data columns */}
      {columns.map((col) => {
        const value = (row as any)[col.key];
        return (
          <td
            key={col.key}
            style={{
              ...cellStyle,
              width: col.width,
              textAlign: col.align || 'left',
            }}
          >
            {col.render ? col.render(value, row, index) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                {value === null || value === undefined ? '—' : String(value)}
              </span>
            )}
          </td>
        );
      })}

      {/* Actions column */}
      {hasActions && (
        <td style={{ ...cellStyle, width: 140 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {onView && (
              <ActionBtn icon={Eye} tooltip="View details" color="#3B82F6" hoverBg="rgba(59,130,246,0.1)" onClick={() => onView(row)} />
            )}
            {onEdit && (
              <ActionBtn icon={Pencil} tooltip="Edit" color="#F59E0B" hoverBg="rgba(245,158,11,0.1)" onClick={() => onEdit(row)} />
            )}
            {onPrint && (
              <ActionBtn icon={Printer} tooltip="Print" color="#10B981" hoverBg="rgba(16,185,129,0.1)" onClick={() => onPrint(row)} />
            )}
            {rowActions.map((action, idx) => {
              const Icon = action.icon;
              if (action.hidden?.(row)) return null;
              const variantColors: Record<string, { color: string; bg: string }> = {
                danger: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
                primary: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
                success: { color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
                warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
                secondary: { color: 'var(--text-secondary)', bg: 'rgba(148,163,184,0.1)' },
              };
              const vc = variantColors[action.variant || 'secondary'] || variantColors.secondary;
              return (
                <ActionBtn
                  key={action.key || idx}
                  icon={Icon || Trash2}
                  tooltip={action.label}
                  color={vc.color}
                  hoverBg={vc.bg}
                  onClick={() => action.onClick(row)}
                />
              );
            })}
            {extraActions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <ActionBtn
                  key={`extra-${idx}`}
                  icon={Icon}
                  tooltip={action.label}
                  color={action.color || '#6366F1'}
                  hoverBg={action.color ? `${action.color}1A` : 'rgba(99,102,241,0.1)'}
                  onClick={() => action.onClick(row)}
                />
              );
            })}
            {onDelete && (
              <ActionBtn icon={Trash2} tooltip="Delete" color="#EF4444" hoverBg="rgba(239,68,68,0.1)" onClick={handleDeleteClick} />
            )}
          </div>

          {deleteTarget && (
            <ConfirmDialog
              open={true}
              title={`Delete ${getRecordName(deleteTarget)}?`}
              message="This action cannot be undone. Are you sure you want to delete this record?"
              confirmLabel="Delete"
              variant="danger"
              onConfirm={() => { onDelete?.(deleteTarget); setDeleteTarget(null); }}
              onCancel={() => setDeleteTarget(null)}
            />
          )}
        </td>
      )}
    </tr>
  );
});

export default TableRow;
