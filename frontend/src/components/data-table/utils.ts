/**
 * Data Table Utilities
 * Helper functions for table operations
 */

import React from 'react';
import { TableColumn } from './types';

/**
 * Format currency values for display
 */
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format numbers for display
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', options).format(value);
}

/**
 * Format dates for display
 */
export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(date);
}

/**
 * Format datetime for display
 */
export function formatDateTime(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}

/**
 * Create a status badge component
 */
export function createStatusBadge(statusColors: Record<string, { bg: string; color: string }>) {
  return function StatusBadge({ status }: { status: string }) {
    const colors = statusColors[status?.toLowerCase()] || { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' };
    
    return React.createElement(
      'span',
      {
        className: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
        style: { background: colors.bg, color: colors.color }
      },
      status
    );
  };
}

/**
 * Common status colors for badges
 */
export const STATUS_COLORS = {
  active: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  inactive: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  approved: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  rejected: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  draft: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  published: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  archived: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  paid: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  unpaid: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  partial: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  overdue: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  completed: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  in_progress: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  on_hold: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  new: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  open: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  closed: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  won: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  lost: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  qualified: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  unqualified: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  hot: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  warm: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  cold: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  high: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  medium: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  low: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  urgent: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  normal: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  available: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  occupied: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  reserved: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  maintenance: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  sold: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  available_for_sale: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  under_construction: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
};

/**
 * Create common table columns
 */
export function createCommonColumns<T = any>(): Record<string, TableColumn<T>> {
  return {
    id: {
      key: 'id',
      label: 'ID',
      width: 80,
      align: 'right',
      render: (value) => React.createElement(
        'span',
        { className: 'font-mono text-xs text-muted' },
        `#${value}`
      ),
    },
    
    name: {
      key: 'name',
      label: 'Name',
      render: (value) => React.createElement(
        'span',
        { className: 'font-medium text-primary' },
        value
      ),
    },
    
    email: {
      key: 'email',
      label: 'Email',
      render: (value) => React.createElement(
        'span',
        { className: 'text-blue-400 hover:text-blue-300' },
        value
      ),
    },
    
    phone: {
      key: 'phone',
      label: 'Phone',
      render: (value) => React.createElement(
        'span',
        { className: 'font-mono text-xs' },
        value
      ),
    },
    
    status: {
      key: 'status',
      label: 'Status',
      width: 120,
      align: 'center',
      render: (value) => {
        const StatusBadge = createStatusBadge(STATUS_COLORS);
        return React.createElement(StatusBadge, { status: value });
      },
    },
    
    amount: {
      key: 'amount',
      label: 'Amount',
      width: 120,
      align: 'right',
      render: (value) => React.createElement(
        'span',
        { className: 'font-mono text-sm font-medium' },
        formatCurrency(value)
      ),
    },
    
    date: {
      key: 'date',
      label: 'Date',
      width: 120,
      render: (value) => React.createElement(
        'span',
        { className: 'text-xs' },
        formatDate(value)
      ),
    },
    
    datetime: {
      key: 'datetime',
      label: 'Date & Time',
      width: 160,
      render: (value) => React.createElement(
        'span',
        { className: 'text-xs' },
        formatDateTime(value)
      ),
    },
    
    created_at: {
      key: 'created_at',
      label: 'Created',
      width: 120,
      render: (value) => React.createElement(
        'span',
        { className: 'text-xs text-muted' },
        formatDate(value)
      ),
    },
    
    updated_at: {
      key: 'updated_at',
      label: 'Updated',
      width: 120,
      render: (value) => React.createElement(
        'span',
        { className: 'text-xs text-muted' },
        formatDate(value)
      ),
    },
  };
}

/**
 * Export data to CSV
 */
export function exportToCSV<T = any>(data: T[], columns: TableColumn<T>[], filename = 'export.csv'): void {
  const headers = columns.map(col => col.label);
  const rows = data.map(row => 
    columns.map(col => {
      const value = (row as any)[col.key];
      // Handle complex values by converting to string
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}