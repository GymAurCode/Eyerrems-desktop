/**
 * useTableState Hook
 * Manages all table state including sorting, filtering, pagination, and selection
 */

import { useState, useMemo, useCallback } from 'react';
import { UseTableStateOptions, TableState, TableActions, SortConfig, PaginationConfig } from '../types';

export function useTableState<T = any>(options: UseTableStateOptions<T>): [TableState<T>, TableActions<T>] {
  const {
    data,
    initialSort,
    initialFilters = {},
    initialSearch = '',
    initialPageSize = 20,
    serverSide = false,
  } = options;

  // Core state
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(initialSort || null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>(initialFilters);
  const [searchValue, setSearchValue] = useState(initialSearch);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [pagination, setPaginationState] = useState<PaginationConfig>({
    page: 1,
    pageSize: initialPageSize,
    total: data.length,
    pageSizeOptions: [10, 20, 50, 100],
  });

  // Client-side filtering and sorting (when not server-side)
  const filteredData = useMemo(() => {
    if (serverSide) return data;

    let result = [...data];

    // Apply search
    if (searchValue.trim()) {
      const search = searchValue.toLowerCase().trim();
      result = result.filter(row => {
        return Object.values(row as any).some(value => 
          String(value).toLowerCase().includes(search)
        );
      });
    }

    // Apply filters
    Object.entries(filterValues).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            result = result.filter(row => value.includes((row as any)[key]));
          }
        } else {
          result = result.filter(row => {
            const rowValue = (row as any)[key];
            if (typeof value === 'string') {
              return String(rowValue).toLowerCase().includes(value.toLowerCase());
            }
            return rowValue === value;
          });
        }
      }
    });

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = (a as any)[sortConfig.key];
        const bValue = (b as any)[sortConfig.key];
        
        if (aValue === bValue) return 0;
        
        let comparison = 0;
        if (aValue == null) comparison = 1;
        else if (bValue == null) comparison = -1;
        else if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        return sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [data, searchValue, filterValues, sortConfig, serverSide]);

  // Update pagination total when filtered data changes
  const paginatedData = useMemo(() => {
    if (serverSide) return filteredData;
    
    const total = filteredData.length;
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    
    // Update total if it changed
    if (pagination.total !== total) {
      setPaginationState(prev => ({ ...prev, total }));
    }
    
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, pagination.page, pagination.pageSize, serverSide]);

  // Actions
  const setSort = useCallback((config: SortConfig | null) => {
    setSortConfig(config);
    // Reset to first page when sorting changes
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const setFilters = useCallback((filters: Record<string, any>) => {
    setFilterValues(filters);
    // Reset to first page when filters change
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchValue(value);
    // Reset to first page when search changes
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const setPagination = useCallback((config: Partial<PaginationConfig>) => {
    setPaginationState(prev => ({ ...prev, ...config }));
  }, []);

  const toggleRowSelection = useCallback((row: T) => {
    setSelectedRows(prev => {
      const isSelected = prev.some(selected => selected === row);
      if (isSelected) {
        return prev.filter(selected => selected !== row);
      } else {
        return [...prev, row];
      }
    });
  }, []);

  const selectAllRows = useCallback(() => {
    setSelectedRows([...paginatedData]);
  }, [paginatedData]);

  const clearSelection = useCallback(() => {
    setSelectedRows([]);
  }, []);

  const refresh = useCallback(() => {
    // This would typically trigger a data refetch in server-side mode
    setError(null);
    if (serverSide) {
      setLoading(true);
      // The parent component should handle the actual refresh
    }
  }, [serverSide]);

  const state: TableState<T> = {
    filteredData: paginatedData,
    sortConfig,
    filterValues,
    searchValue,
    pagination: {
      ...pagination,
      total: serverSide ? pagination.total : filteredData.length,
    },
    selectedRows,
    loading,
    error,
  };

  const actions: TableActions<T> = {
    setSort,
    setFilters,
    setSearch,
    setPagination,
    setSelectedRows,
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    setLoading,
    setError,
    refresh,
  };

  return [state, actions];
}