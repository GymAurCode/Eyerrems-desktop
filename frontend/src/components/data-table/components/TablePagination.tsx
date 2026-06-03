import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PaginationConfig } from '../types';

interface TablePaginationProps {
  pagination: PaginationConfig;
  onPaginationChange: (config: PaginationConfig) => void;
  loading?: boolean;
}

export default function TablePagination({
  pagination,
  onPaginationChange,
  loading = false,
}: TablePaginationProps) {
  const { page, pageSize, total, pageSizeOptions = [10, 25, 50, 100] } = pagination;
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      onPaginationChange({ ...pagination, page: newPage });
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    const newPage = Math.ceil(((page - 1) * pageSize + 1) / newPageSize);
    onPaginationChange({
      ...pagination,
      pageSize: newPageSize,
      page: Math.max(1, newPage),
    });
  };

  if (total === 0) return null;

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    transition: 'all 0.15s',
  });

  return (
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
          value={pageSize}
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
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          disabled={page <= 1 || loading}
          style={btnStyle(page <= 1 || loading)}
          onClick={() => handlePageChange(1)}
          title="First page"
          onMouseEnter={e => { if (page > 1 && !loading) e.currentTarget.style.background = 'var(--table-row-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          disabled={page <= 1 || loading}
          style={btnStyle(page <= 1 || loading)}
          onClick={() => handlePageChange(page - 1)}
          title="Previous page"
          onMouseEnter={e => { if (page > 1 && !loading) e.currentTarget.style.background = 'var(--table-row-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 8px' }}>
          Page {page} of {totalPages || 1}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          style={btnStyle(page >= totalPages || loading)}
          onClick={() => handlePageChange(page + 1)}
          title="Next page"
          onMouseEnter={e => { if (page < totalPages && !loading) e.currentTarget.style.background = 'var(--table-row-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          style={btnStyle(page >= totalPages || loading)}
          onClick={() => handlePageChange(totalPages)}
          title="Last page"
          onMouseEnter={e => { if (page < totalPages && !loading) e.currentTarget.style.background = 'var(--table-row-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}
