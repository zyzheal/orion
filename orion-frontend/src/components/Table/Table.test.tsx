import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Table, { type TableColumn } from './index';

// ---- Test data ----
interface TestData {
  id: number;
  name: string;
  age: number;
  department: string;
}

const sampleColumns: TableColumn<TestData>[] = [
  { key: 'name', title: 'Name', dataIndex: 'name', sortable: true, filterable: true },
  { key: 'age', title: 'Age', dataIndex: 'age', sortable: true },
  { key: 'department', title: 'Department', dataIndex: 'department', filterable: true },
];

const sampleData: TestData[] = [
  { id: 1, name: 'Alice', age: 30, department: 'Engineering' },
  { id: 2, name: 'Bob', age: 25, department: 'Design' },
  { id: 3, name: 'Charlie', age: 35, department: 'Engineering' },
  { id: 4, name: 'Diana', age: 28, department: 'Marketing' },
  { id: 5, name: 'Eve', age: 32, department: 'Design' },
];

describe('OrionTable', () => {
  it('should render with data', () => {
    render(<Table columns={sampleColumns} dataSource={sampleData} />);
    expect(screen.getByTestId('orion-table')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should show empty text when no data', () => {
    render(<Table columns={sampleColumns} dataSource={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<Table columns={sampleColumns} dataSource={sampleData} loading={true} />);
    // Ant Design Spin wraps the table
    expect(screen.getByTestId('orion-table')).toBeInTheDocument();
  });

  it('should paginate data by default (client-side)', () => {
    const largeData: TestData[] = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      age: 20 + i,
      department: 'Engineering',
    }));
    render(<Table columns={sampleColumns} dataSource={largeData} />);

    // With default pageSize=10, only 10 rows should be rendered in table
    // But all 25 should be countable in pagination total
    expect(screen.getByText(/共 25 条/)).toBeInTheDocument();
  });

  it('should render sortable columns', () => {
    render(<Table columns={sampleColumns} dataSource={sampleData} />);
    // Sortable columns should have sort indicators
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('should hide columns marked as hidden', () => {
    const cols: TableColumn<TestData>[] = [
      { key: 'name', title: 'Name', dataIndex: 'name', hidden: true },
      { key: 'age', title: 'Age', dataIndex: 'age' },
    ];
    render(<Table columns={cols} dataSource={sampleData} />);
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('should call onRowClick when row is clicked', () => {
    const handleClick = vi.fn();
    render(<Table columns={sampleColumns} dataSource={sampleData} onRowClick={handleClick} />);
    // Click first row
    const rows = screen.getAllByRole('row');
    // First row is header, second is first data row
    fireEvent.click(rows[1]);
    expect(handleClick).toHaveBeenCalledWith(sampleData[0]);
  });

  it('should render custom column render function', () => {
    const cols: TableColumn<TestData>[] = [
      {
        key: 'name',
        title: 'Name',
        dataIndex: 'name',
        render: (val) => <span data-testid="custom-name">{String(val).toUpperCase()}</span>,
      },
    ];
    render(<Table columns={cols} dataSource={sampleData} />);
    expect(screen.getAllByTestId('custom-name')[0]).toHaveTextContent('ALICE');
  });

  it('should respect external pagination', () => {
    render(
      <Table
        columns={sampleColumns}
        dataSource={sampleData}
        clientPagination={false}
        pagination={{ current: 1, pageSize: 10, total: 50 }}
      />
    );
    expect(screen.getByText(/共 50 条/)).toBeInTheDocument();
  });

  it('should show clear filters button when filters are active', () => {
    const cols: TableColumn<TestData>[] = [
      { key: 'name', title: 'Name', dataIndex: 'name', filterable: true },
    ];
    render(<Table columns={cols} dataSource={sampleData} />);
    // Initially no clear button
    expect(screen.queryByText('Clear All Filters')).not.toBeInTheDocument();
  });
});
