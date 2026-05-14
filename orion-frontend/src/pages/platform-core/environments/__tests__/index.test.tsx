/**
 * Environments Page Tests
 * - Loads environments from API on mount
 * - Shows error on API failure, no mock data fallback
 * - Shows empty state when API returns empty array
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import EnvironmentManagement from '../index';

const { mockMessage, mockApi } = vi.hoisted(() => ({
  mockMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  mockApi: {
    getEnvironments: vi.fn(),
    createEnvironment: vi.fn(),
    updateEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    updateEnvironmentStatus: vi.fn(),
  },
}));

vi.mock('@/api/environments', () => mockApi);

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: mockMessage };
});

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, loading, rowKey }: any) => (
    <div data-testid="table" data-loading={loading}>
      <div data-testid="row-count">{dataSource?.length || 0}</div>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid="env-row">
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

const mockEnvironments = [
  {
    id: 'env-1',
    project_id: 'proj-1',
    name: 'dev-default',
    type: 'dev' as const,
    cluster: 'k8s-dev-01',
    namespace: 'default',
    status: 'active' as const,
    config: { replicas: 1 },
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-03-20T10:00:00Z',
  },
  {
    id: 'env-2',
    project_id: 'proj-1',
    name: 'production',
    type: 'prod' as const,
    cluster: 'k8s-prod-01',
    namespace: 'production',
    status: 'active' as const,
    config: { replicas: 3 },
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-03-20T12:00:00Z',
  },
];

describe('EnvironmentManagement', () => {
  beforeEach(() => {
    mockMessage.error.mockClear();
    mockMessage.success.mockClear();
    mockApi.getEnvironments.mockReset();
    mockApi.createEnvironment.mockReset();
    mockApi.updateEnvironment.mockReset();
    mockApi.deleteEnvironment.mockReset();
    mockApi.updateEnvironmentStatus.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads environments from API on mount', async () => {
    mockApi.getEnvironments.mockResolvedValue({
      data: { data: mockEnvironments },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    await act(async () => {
      render(<EnvironmentManagement />);
    });

    await waitFor(() => {
      expect(mockApi.getEnvironments).toHaveBeenCalled();
    });

    // Table should have 2 rows
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('2');

    // Environment names should be rendered
    await waitFor(() => {
      expect(screen.getByText('dev-default')).toBeInTheDocument();
      expect(screen.getByText('production')).toBeInTheDocument();
    });
  });

  it('shows error on API failure, no mock data fallback', async () => {
    mockApi.getEnvironments.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<EnvironmentManagement />);
    });

    await waitFor(() => {
      expect(mockApi.getEnvironments).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith(expect.stringContaining('加载环境列表失败'));
    });

    // Table should be empty (no mock data)
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');
  });

  it('shows empty state when API returns empty array', async () => {
    mockApi.getEnvironments.mockResolvedValue({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    await act(async () => {
      render(<EnvironmentManagement />);
    });

    await waitFor(() => {
      expect(mockApi.getEnvironments).toHaveBeenCalled();
    });

    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');
  });
});
