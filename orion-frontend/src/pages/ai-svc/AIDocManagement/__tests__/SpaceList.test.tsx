/**
 * SpaceList Page Tests
 * Verify: loads from API on mount, shows error on failure, no mock data fallback
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import SpaceList from '../SpaceList';

const { mockMessage, mockApi } = vi.hoisted(() => ({
  mockMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  mockApi: {
    getSpaces: vi.fn(),
    createSpace: vi.fn(),
    updateSpace: vi.fn(),
    deleteSpace: vi.fn(),
  },
}));

vi.mock('@/api/ai-docs', () => mockApi);

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: mockMessage };
});

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, loading, rowKey }: any) => (
    <div data-testid="table" data-loading={loading}>
      <div data-testid="row-count">{dataSource?.length || 0}</div>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid="space-row">
          {item.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/SearchFilterBar', () => ({
  default: () => <div data-testid="search-filter-bar" />,
}));

vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (value: unknown) => ({
    format: () => String(value || '2024-03-20 10:00'),
    fromNow: () => '2 hours ago',
    valueOf: () => Date.now(),
  });
  (dayjsFn as any).extend = vi.fn(() => dayjsFn);
  (dayjsFn as any).duration = vi.fn(() => ({
    asMinutes: () => 0,
    seconds: () => 0,
  }));
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

const mockSpaces = [
  {
    id: 's1',
    name: '技术文档库',
    type: 'public',
    ownerId: 'admin',
    documentCount: 45,
    description: '公共技术文档',
    createdAt: '2024-01-01',
    updatedAt: '2024-03-15',
  },
  {
    id: 's2',
    name: '团队知识库',
    type: 'internal',
    ownerId: 'team-lead',
    documentCount: 28,
    description: '团队内部知识',
    createdAt: '2024-02-01',
    updatedAt: '2024-03-10',
  },
];

describe('SpaceList', () => {
  beforeEach(() => {
    mockMessage.error.mockClear();
    mockMessage.success.mockClear();
    mockApi.getSpaces.mockReset();
    mockApi.createSpace.mockReset();
    mockApi.updateSpace.mockReset();
    mockApi.deleteSpace.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads spaces from API on mount', async () => {
    mockApi.getSpaces.mockResolvedValue({
      data: mockSpaces,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    await act(async () => {
      render(<SpaceList />);
    });

    await waitFor(() => {
      expect(mockApi.getSpaces).toHaveBeenCalled();
    });

    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('2');

    await waitFor(() => {
      expect(screen.getByText('技术文档库')).toBeInTheDocument();
      expect(screen.getByText('团队知识库')).toBeInTheDocument();
    });
  });

  it('shows error message and empty data when API fails', async () => {
    mockApi.getSpaces.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<SpaceList />);
    });

    await waitFor(() => {
      expect(mockApi.getSpaces).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith(expect.stringContaining('加载知识库数据失败'));
    });

    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');
  });

  it('shows empty state when API returns empty array', async () => {
    mockApi.getSpaces.mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    await act(async () => {
      render(<SpaceList />);
    });

    await waitFor(() => {
      expect(mockApi.getSpaces).toHaveBeenCalled();
    });

    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');
  });
});
