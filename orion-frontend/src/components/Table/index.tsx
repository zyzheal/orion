/**
 * Enhanced Table Component
 * - Sortable columns
 * - Filterable rows
 * - Pagination support
 * - Loading state
 *
 * Wraps Ant Design Table with additional conveniences for the Orion platform.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Table as AntTable, Pagination, Input, Space, Button } from 'antd';
import { SearchOutlined, FilterOutlined, ClearOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { colors } from '@/tokens';

// ============================================================================
// Types
// ============================================================================

export interface TableColumn<T = Record<string, unknown>> {
  /** Unique column key */
  key: string;
  /** Column display title */
  title: React.ReactNode;
  /** Data index in the record */
  dataIndex?: string;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Whether this column is filterable (text match) */
  filterable?: boolean;
  /** Custom render function */
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
  /** Column width */
  width?: number | string;
  /** Whether column is fixed */
  fixed?: 'left' | 'right';
  /** Hide column */
  hidden?: boolean;
  /** Truncate long text with ellipsis */
  ellipsis?: boolean;
  /** Sorter function for this column */
  sorter?: boolean | ((a: T, b: T) => number);
}

export interface TablePagination {
  current: number;
  pageSize: number;
  total: number;
}

export interface OrionTableProps<T extends object> extends Omit<
  TableProps<T>,
  'columns' | 'pagination'
> {
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Data source */
  dataSource: T[];
  /** Loading state */
  loading?: boolean;
  /** Whether to use client-side pagination (default: true) */
  clientPagination?: boolean;
  /** External pagination config */
  pagination?: TablePagination | false;
  /** External sort handler (for server-side sorting) */
  onSort?: (columnKey: string, order: 'ascend' | 'descend' | null) => void;
  /** External filter handler (for server-side filtering) */
  onFilter?: (filters: Record<string, string | undefined>) => void;
  /** Row click handler */
  onRowClick?: (record: T) => void;
  /** Custom pagination page size options */
  pageSizeOptions?: number[];
  /** Show quick jumper in pagination */
  showQuickJumper?: boolean;
  /** Show total count in pagination */
  showTotal?: boolean;
  /** Table size */
  size?: 'small' | 'middle' | 'large';
  /** Whether to show stripe rows */
  striped?: boolean;
  /** Pagination change handler (for server-side pagination) */
  onPaginationChange?: (page: number, pageSize: number) => void;
}

// ============================================================================
// Component
// ============================================================================

function OrionTable<T extends object>({
  columns,
  dataSource,
  loading = false,
  clientPagination = true,
  pagination: externalPagination,
  onSort: externalOnSort,
  onFilter: externalOnFilter,
  onRowClick,
  pageSizeOptions = [10, 20, 50, 100],
  showQuickJumper = true,
  showTotal = true,
  size = 'middle',
  striped = false,
  onPaginationChange,
  rowKey = 'id' as keyof T & string,
  scroll,
  ...restProps
}: OrionTableProps<T>) {
  // ---- Sorting state ----
  const [sortConfig, setSortConfig] = useState<{
    columnKey: string;
    order: 'ascend' | 'descend' | null;
  }>({ columnKey: '', order: null });

  // ---- Filter state (text filter per column) ----
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [filterVisible, setFilterVisible] = useState<Record<string, boolean>>({});

  // ---- Pagination state ----
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);

  // ---- Convert columns ----
  const antColumns: ColumnsType<T> = useMemo(() => {
    return columns
      .filter((col) => !col.hidden)
      .map((col) => {
        const antCol: any = {
          key: col.key,
          title: col.title,
          dataIndex: col.dataIndex,
          width: col.width,
          fixed: col.fixed,
          render: col.render,
        };

        if (col.sortable) {
          antCol.sorter = true;
          antCol.sortDirections = ['ascend', 'descend'];
        }

        if (col.filterable) {
          antCol.filterDropdown = () => (
            <div style={{ padding: 8 }}>
              <Input
                placeholder={`Search ${col.title}`}
                value={filterValues[col.key] || ''}
                onChange={(e) => {
                  const newFilters = { ...filterValues, [col.key]: e.target.value };
                  setFilterValues(newFilters);
                  if (externalOnFilter) {
                    externalOnFilter(newFilters);
                  }
                }}
                onPressEnter={() => setFilterVisible({ ...filterVisible, [col.key]: false })}
                style={{ marginBottom: 8, display: 'block' }}
                size="small"
                prefix={<SearchOutlined />}
              />
              <Space>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => setFilterVisible({ ...filterVisible, [col.key]: false })}
                  style={{ width: 70 }}
                >
                  Search
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setFilterValues({ ...filterValues, [col.key]: '' });
                    if (externalOnFilter) {
                      const newFilters = { ...filterValues, [col.key]: '' };
                      externalOnFilter(newFilters);
                    }
                  }}
                  style={{ width: 70 }}
                >
                  Reset
                </Button>
              </Space>
            </div>
          );
          antCol.filterIcon = (filtered: boolean) => (
            <FilterOutlined style={{ color: filtered ? colors.primary[500] : undefined }} />
          );
          antCol.onFilter = undefined; // We handle filter externally
        }

        return antCol;
      });
  }, [columns, filterValues, filterVisible, externalOnFilter]);

  // ---- Client-side filtering & sorting ----
  const processedData = useMemo(() => {
    let data = [...dataSource];

    // Apply text filters
    const activeFilters = Object.entries(filterValues).filter(([, v]) => v && v.trim());
    if (activeFilters.length > 0) {
      data = data.filter((record) =>
        activeFilters.every(([key, value]) => {
          const cellValue = String((record as Record<string, unknown>)[key] ?? '');
          return cellValue.toLowerCase().includes(value.toLowerCase());
        })
      );
    }

    // Apply sorting
    if (sortConfig.order && sortConfig.columnKey) {
      data.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortConfig.columnKey];
        const bVal = (b as Record<string, unknown>)[sortConfig.columnKey];

        if (aVal === bVal) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        const comparison = aVal < bVal ? -1 : 1;
        return sortConfig.order === 'ascend' ? comparison : -comparison;
      });
    }

    return data;
  }, [dataSource, filterValues, sortConfig]);

  // ---- Client-side pagination ----
  const paginatedData = useMemo(() => {
    if (!clientPagination) return processedData;
    const start = (page - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, page, pageSize, clientPagination]);

  // ---- Handlers ----
  const handleTableChange: TableProps<T>['onChange'] = useCallback(
    (_pagination: any, _filters: any, sorter: any) => {
      if (Array.isArray(sorter)) return;
      const order = sorter.order || null;
      const columnKey = (sorter.columnKey as string) || '';
      setSortConfig({ columnKey, order });
      if (externalOnSort) {
        externalOnSort(columnKey, order);
      }
    },
    [externalOnSort]
  );

  const handlePaginationChange = useCallback(
    (newPage: number, newPageSize?: number) => {
      const effectivePageSize = newPageSize ?? pageSize;
      if (!clientPagination && onPaginationChange) {
        // Server-side pagination: notify parent to reload data
        onPaginationChange(newPage, effectivePageSize);
      } else {
        setPage(newPage);
        if (newPageSize) {
          setPageSize(newPageSize);
        }
      }
    },
    [clientPagination, onPaginationChange, pageSize]
  );

  const clearAllFilters = useCallback(() => {
    setFilterValues({});
    if (externalOnFilter) {
      externalOnFilter({});
    }
  }, [externalOnFilter]);

  const hasActiveFilters = Object.values(filterValues).some((v) => v && v.trim());

  // ---- Row click ----
  const onRow = useCallback(
    (record: T) => ({
      onClick: () => onRowClick?.(record),
      style: onRowClick ? { cursor: 'pointer' } : undefined,
    }),
    [onRowClick]
  );

  // ---- Render ----
  return (
    <div className="orion-table" data-testid="orion-table">
      {/* Filter toolbar */}
      {columns.some((c) => c.filterable) && (
        <div
          style={{
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          {hasActiveFilters && (
            <Button size="small" icon={<ClearOutlined />} onClick={clearAllFilters} type="link">
              Clear All Filters
            </Button>
          )}
        </div>
      )}

      {/* Table - uses Ant Design's built-in loading skeleton */}
      <AntTable<T>
        columns={antColumns}
        dataSource={clientPagination ? paginatedData : processedData}
        rowKey={rowKey}
        onChange={handleTableChange}
        onRow={onRow}
        size={size}
        scroll={scroll}
        loading={loading}
        rowClassName={
          striped
            ? (_record, index) => (index % 2 === 1 ? 'orion-table-row-stripe' : '')
            : undefined
        }
        locale={{
          emptyText: 'No data available',
          ...restProps.locale,
        }}
        {...restProps}
      />

      {/* Pagination */}
      {(clientPagination || externalPagination) && (
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Pagination
            current={
              externalPagination && typeof externalPagination === 'object'
                ? externalPagination.current
                : page
            }
            pageSize={
              externalPagination && typeof externalPagination === 'object'
                ? externalPagination.pageSize
                : pageSize
            }
            total={
              externalPagination && typeof externalPagination === 'object'
                ? externalPagination.total
                : processedData.length
            }
            onChange={handlePaginationChange}
            onShowSizeChange={(_, size) => handlePaginationChange(1, size)}
            pageSizeOptions={pageSizeOptions.map(String)}
            showSizeChanger
            showQuickJumper={showQuickJumper}
            showTotal={showTotal ? (total) => `Total ${total} items` : undefined}
          />
        </div>
      )}
    </div>
  );
}

export default OrionTable;
