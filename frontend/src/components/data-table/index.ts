/**
 * Data Table Container - Main Export
 * Professional reusable table system for enterprise REMS application
 */

// Main component
export { default as DataTable } from './DataTable';
export { default as SmartTable } from './SmartTable';
export { default as AppTable, removeEmptyParams } from './AppTable';

// Individual components for advanced usage
export { default as TableToolbar } from './components/TableToolbar';
export { default as TableHeader } from './components/TableHeader';
export { default as TableRow } from './components/TableRow';
export { default as TablePagination } from './components/TablePagination';
export { default as EmptyState } from './components/EmptyState';
export { default as LoadingState } from './components/LoadingState';

// Hooks
export { useTableState } from './hooks/useTableState';

// Types
export type {
  DataTableProps,
  TableColumn,
  TableFilter,
  TableAction,
  BulkAction,
  TableToolbarAction,
  SortConfig,
  PaginationConfig,
  TableState,
  TableActions,
  UseTableStateOptions,
} from './types';

// Utility functions
export * from './utils';