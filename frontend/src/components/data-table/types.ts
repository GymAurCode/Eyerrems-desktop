/**
 * Data Table Container - Type Definitions
 * Professional reusable table system for enterprise REMS application
 */

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface TableFilter {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange' | 'number' | 'boolean';
  options?: { label: string; value: any }[];
  placeholder?: string;
  defaultValue?: any;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
}

export interface TableAction<T = any> {
  key: string;
  label: string;
  icon?: React.ComponentType<any>;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  onClick: (row: T) => void;
  disabled?: (row: T) => boolean;
  hidden?: (row: T) => boolean;
  permission?: string;
}

export interface BulkAction<T = any> {
  key: string;
  label: string;
  icon?: React.ComponentType<any>;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  onClick: (selectedRows: T[]) => void;
  disabled?: (selectedRows: T[]) => boolean;
  permission?: string;
}

export interface TableToolbarAction {
  key: string;
  label: string;
  icon?: React.ComponentType<any>;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  onClick: () => void;
  disabled?: boolean;
  permission?: string;
}

export interface DataTableProps<T = any> {
  // Core data
  data: T[];
  columns: TableColumn<T>[];
  
  // Table configuration
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  
  // Selection
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (selectedRows: T[]) => void;
  getRowId?: (row: T) => string | number;
  
  // Sorting
  sortable?: boolean;
  sortConfig?: SortConfig;
  onSort?: (config: SortConfig) => void;
  
  // Pagination
  pagination?: PaginationConfig;
  onPaginationChange?: (config: PaginationConfig) => void;
  
  // Filtering
  filters?: TableFilter[];
  filterValues?: Record<string, any>;
  onFilterChange?: (filters: Record<string, any>) => void;
  
  // Search
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  
  // Actions
  rowActions?: TableAction<T>[];
  bulkActions?: BulkAction<T>[];
  toolbarActions?: TableToolbarAction[];
  
  // Styling
  variant?: 'default' | 'compact' | 'comfortable';
  stickyHeader?: boolean;
  striped?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
  
  // Responsive
  responsive?: boolean;
  mobileCardView?: boolean;
  
  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ComponentType<any>;
  
  // Row interaction
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;
  
  // Custom renderers
  customToolbar?: React.ReactNode;
  customFooter?: React.ReactNode;
  
  // Performance
  virtualized?: boolean;
  rowHeight?: number;
}

export interface UseTableStateOptions<T = any> {
  data: T[];
  initialSort?: SortConfig;
  initialFilters?: Record<string, any>;
  initialSearch?: string;
  initialPageSize?: number;
  serverSide?: boolean;
}

export interface TableState<T = any> {
  filteredData: T[];
  sortConfig: SortConfig | null;
  filterValues: Record<string, any>;
  searchValue: string;
  pagination: PaginationConfig;
  selectedRows: T[];
  loading: boolean;
  error: string | null;
}

export interface TableActions<T = any> {
  setSort: (config: SortConfig | null) => void;
  setFilters: (filters: Record<string, any>) => void;
  setSearch: (value: string) => void;
  setPagination: (config: Partial<PaginationConfig>) => void;
  setSelectedRows: (rows: T[]) => void;
  toggleRowSelection: (row: T) => void;
  selectAllRows: () => void;
  clearSelection: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refresh: () => void;
}