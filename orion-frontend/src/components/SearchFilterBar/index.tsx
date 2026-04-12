/**
 * SearchFilterBar Component
 * - Text search input
 * - Filter dropdowns
 * - Active filter tags display
 * - Used for list pages with search and filtering capabilities
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Input, Select, Tag, Space, Button } from 'antd';
import { SearchOutlined, CloseOutlined, FilterOutlined } from '@ant-design/icons';

// ============================================================================
// Types
// ============================================================================

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDefinition {
  /** Filter field name */
  key: string;
  /** Display label */
  label: string;
  /** Options for the dropdown */
  options: FilterOption[];
  /** Whether multiple selection is allowed */
  multiple?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

export interface SearchFilterBarProps {
  /** Search handler (debounced internally) */
  onSearch?: (query: string) => void;
  /** Filter change handler */
  onFilter?: (filters: Record<string, string | string[] | undefined>) => void;
  /** Filter definitions */
  filters?: FilterDefinition[];
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Initial search query */
  initialQuery?: string;
  /** Initial filter values */
  initialFilters?: Record<string, string | string[] | undefined>;
  /** Whether to show search input */
  showSearch?: boolean;
  /** Extra content (right side of the bar) */
  extra?: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

function SearchFilterBar({
  onSearch,
  onFilter,
  filters = [],
  searchPlaceholder = 'Search...',
  initialQuery = '',
  initialFilters = {},
  showSearch = true,
  extra,
}: SearchFilterBarProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeFilters, setActiveFilters] = useState<
    Record<string, string | string[] | undefined>
  >(initialFilters);

  // Debounced search
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        onSearch?.(value);
      }, 300);
    },
    [onSearch]
  );

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | undefined) => {
      const newFilters = { ...activeFilters, [key]: value };
      setActiveFilters(newFilters);
      onFilter?.(newFilters);
    },
    [activeFilters, onFilter]
  );

  const removeFilter = useCallback(
    (key: string) => {
      const newFilters = { ...activeFilters, [key]: undefined };
      setActiveFilters(newFilters);
      onFilter?.(newFilters);
    },
    [activeFilters, onFilter]
  );

  const clearAll = useCallback(() => {
    setSearchQuery('');
    setActiveFilters({});
    onSearch?.('');
    onFilter?.({});
  }, [onSearch, onFilter]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.values(activeFilters).filter((v) => v !== undefined && v !== '').length;
  }, [activeFilters]);

  // Get display label for a filter value
  const getFilterLabel = useCallback(
    (key: string, value: string | string[]): string => {
      const filterDef = filters.find((f) => f.key === key);
      if (!filterDef) return String(value);

      if (Array.isArray(value)) {
        return value
          .map((v) => filterDef.options.find((o) => o.value === v)?.label || v)
          .join(', ');
      }
      return filterDef.options.find((o) => o.value === value)?.label || value;
    },
    [filters]
  );

  return (
    <div className="orion-search-filter-bar" data-testid="orion-search-filter-bar">
      {/* Search and filter row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: activeFilterCount > 0 ? 12 : 0,
        }}
      >
        {/* Search input */}
        {showSearch && (
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
            style={{ minWidth: 240, flex: '0 1 320px' }}
            data-testid="search-input"
          />
        )}

        {/* Filter dropdowns */}
        {filters.map((filter) => (
          <Select
            key={filter.key}
            mode={filter.multiple ? 'multiple' : undefined}
            placeholder={filter.placeholder || filter.label}
            value={activeFilters[filter.key]}
            onChange={(value) => handleFilterChange(filter.key, value)}
            options={filter.options}
            allowClear
            style={{ minWidth: 160 }}
            prefix={<FilterOutlined />}
            data-testid={`filter-${filter.key}`}
          />
        ))}

        {/* Extra content */}
        {extra && <div>{extra}</div>}

        {/* Clear all button */}
        {activeFilterCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CloseOutlined />}
            onClick={clearAll}
            style={{ color: '#8c8c8c' }}
            data-testid="clear-all-filters"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Active filter tags */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(activeFilters)
            .filter(([, value]) => value !== undefined && value !== '')
            .map(([key, value]) => (
              <Tag
                key={key}
                closable
                onClose={() => removeFilter(key)}
                color="blue"
                style={{ marginBottom: 4 }}
                data-testid={`filter-tag-${key}`}
              >
                <strong>{filters.find((f) => f.key === key)?.label || key}:</strong>{' '}
                {getFilterLabel(key, value as string | string[])}
              </Tag>
            ))}
        </div>
      )}
    </div>
  );
}

export default SearchFilterBar;
