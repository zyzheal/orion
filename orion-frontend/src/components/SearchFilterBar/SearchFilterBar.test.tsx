import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchFilterBar, { type FilterDefinition } from './index';

describe('SearchFilterBar', () => {
  const sampleFilters: FilterDefinition[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
    {
      key: 'type',
      label: 'Type',
      options: [
        { label: 'Pipeline', value: 'pipeline' },
        { label: 'Deployment', value: 'deployment' },
      ],
    },
  ];

  it('should render search input', () => {
    render(<SearchFilterBar />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('should render filter dropdowns', () => {
    render(<SearchFilterBar filters={sampleFilters} />);
    expect(screen.getByTestId('filter-status')).toBeInTheDocument();
    expect(screen.getByTestId('filter-type')).toBeInTheDocument();
  });

  it('should hide search when showSearch is false', () => {
    render(<SearchFilterBar showSearch={false} />);
    expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();
  });

  it('should call onSearch when typing (debounced)', async () => {
    const handleSearch = vi.fn();
    render(<SearchFilterBar onSearch={handleSearch} />);

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(
      () => {
        expect(handleSearch).toHaveBeenCalledWith('test');
      },
      { timeout: 500 }
    );
  });

  it('should call onFilter when filter changes', () => {
    const handleFilter = vi.fn();
    render(<SearchFilterBar filters={sampleFilters} onFilter={handleFilter} />);

    // Click the status select to open dropdown
    const statusSelect = screen.getByTestId('filter-status');
    fireEvent.mouseDown(statusSelect.querySelector('.ant-select-selector')!);

    // Find and click an option
    const option = screen.getByText('Active');
    fireEvent.click(option);

    expect(handleFilter).toHaveBeenCalled();
  });

  it('should display active filter tags', () => {
    render(<SearchFilterBar filters={sampleFilters} initialFilters={{ status: 'active' }} />);
    expect(screen.getByTestId('filter-tag-status')).toBeInTheDocument();
  });

  it('should remove filter tag when close icon is clicked', () => {
    const handleFilter = vi.fn();
    render(
      <SearchFilterBar
        filters={sampleFilters}
        initialFilters={{ status: 'active' }}
        onFilter={handleFilter}
      />
    );

    const closeIcon = screen.getByTestId('filter-tag-status').querySelector('.ant-tag-close-icon');
    if (closeIcon) {
      fireEvent.click(closeIcon);
      expect(handleFilter).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
    }
  });

  it('should show clear all button when filters are active', () => {
    render(<SearchFilterBar filters={sampleFilters} initialFilters={{ status: 'active' }} />);
    expect(screen.getByTestId('clear-all-filters')).toBeInTheDocument();
  });

  it('should not show clear all button when no filters active', () => {
    render(<SearchFilterBar filters={sampleFilters} />);
    expect(screen.queryByTestId('clear-all-filters')).not.toBeInTheDocument();
  });

  it('should clear all filters on click', () => {
    const handleSearch = vi.fn();
    const handleFilter = vi.fn();
    render(
      <SearchFilterBar
        filters={sampleFilters}
        initialFilters={{ status: 'active' }}
        initialQuery="test"
        onSearch={handleSearch}
        onFilter={handleFilter}
      />
    );

    screen.getByTestId('clear-all-filters').click();

    expect(handleSearch).toHaveBeenCalledWith('');
    expect(handleFilter).toHaveBeenCalledWith({});
  });

  it('should render extra content', () => {
    render(<SearchFilterBar extra={<button data-testid="extra-btn">Extra</button>} />);
    expect(screen.getByTestId('extra-btn')).toBeInTheDocument();
  });

  it('should support custom search placeholder', () => {
    render(<SearchFilterBar searchPlaceholder="Find something..." />);
    expect(screen.getByPlaceholderText('Find something...')).toBeInTheDocument();
  });

  it('should support multiple selection filters', () => {
    const multiFilter: FilterDefinition[] = [
      {
        key: 'tags',
        label: 'Tags',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
        multiple: true,
      },
    ];
    render(<SearchFilterBar filters={multiFilter} />);
    expect(screen.getByTestId('filter-tags')).toBeInTheDocument();
  });
});
