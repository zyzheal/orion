/**
 * MetricsDashboard Page Tests
 * - Loads metrics from API on mount
 * - Shows error on API failure, no mock data fallback
 * - Renders metric cards and service health table on success
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { ChartProvider } from '@/components/charts';
import MetricsDashboard from '../index';

const { mockMessage, mockApi } = vi.hoisted(() => ({
  mockMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  mockApi: {
    getMonitoringHealth: vi.fn(),
    getMetrics: vi.fn(),
    getDashboardData: vi.fn(),
  },
}));

vi.mock('@/api/monitoring', () => mockApi);

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: mockMessage };
});

vi.mock('echarts-for-react', () => ({
  default: ({ option, style, 'data-testid': testId }: any) => (
    <div data-testid={testId} data-option={JSON.stringify(option)} style={style} />
  ),
}));

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, loading, rowKey }: any) => (
    <div data-testid="table" data-loading={loading}>
      <div data-testid="row-count">{dataSource?.length || 0}</div>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid="health-row">
          {item.serviceName}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/MetricCard', () => ({
  default: ({ title, value }: any) => (
    <div data-testid="metric-card">
      <span data-testid="metric-title">{title}</span>
      <span data-testid="metric-value">{value}</span>
    </div>
  ),
}));

vi.mock('@/components/DashboardLayout', () => ({
  default: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/SearchFilterBar', () => ({
  default: () => <div data-testid="search-filter-bar" />,
}));

const mockDashboardData = {
  data: {
    data: {
      metrics: {
        total: 10,
        rate: 12540,
        latencyP50: 45,
        latencyP95: 180,
        latencyP99: 420,
        throughput: 8920,
      },
      alerts: { total: 20, active: 3, resolved: 17 },
      rules: { total: 5, enabled: 4 },
      channels: { total: 3, active: 2 },
    },
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as any,
};

const mockMetricsData = {
  data: {
    data: [
      { name: 'api-gateway', value: 0.12, unit: '%', lastUpdated: '2024-03-20T10:00:00Z' },
      { name: 'platform-service', value: 0.28, unit: '%', lastUpdated: '2024-03-20T10:00:00Z' },
      { name: 'ai-service', value: 0.75, unit: '%', lastUpdated: '2024-03-20T10:00:00Z' },
    ],
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as any,
};

const mockHealthData = {
  data: {
    data: { status: 'healthy', uptime: 86400, metricsCount: 10 },
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as any,
};

describe('MetricsDashboard', () => {
  beforeEach(() => {
    mockMessage.error.mockClear();
    mockMessage.success.mockClear();
    mockMessage.warning.mockClear();
    mockApi.getMonitoringHealth.mockReset();
    mockApi.getMetrics.mockReset();
    mockApi.getDashboardData.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads metrics from API on mount', async () => {
    mockApi.getMonitoringHealth.mockResolvedValue(mockHealthData);
    mockApi.getMetrics.mockResolvedValue(mockMetricsData);
    mockApi.getDashboardData.mockResolvedValue(mockDashboardData);

    await act(async () => {
      render(<ChartProvider><MetricsDashboard /></ChartProvider>);
    });

    await waitFor(() => {
      expect(mockApi.getMonitoringHealth).toHaveBeenCalled();
      expect(mockApi.getMetrics).toHaveBeenCalled();
      expect(mockApi.getDashboardData).toHaveBeenCalled();
    });

    // Metric cards should be rendered with API data
    const metricValues = screen.getAllByTestId('metric-value');
    expect(metricValues.length).toBeGreaterThan(0);

    // Request rate should be 12540 from API
    expect(screen.getByText('12540')).toBeInTheDocument();

    // Service health table should show 3 rows from API
    await waitFor(() => {
      const rowCount = screen.getByTestId('row-count');
      expect(rowCount.textContent).toBe('3');
    });

    // Service names should be rendered
    await waitFor(() => {
      expect(screen.getByText('api-gateway')).toBeInTheDocument();
      expect(screen.getByText('platform-service')).toBeInTheDocument();
      expect(screen.getByText('ai-service')).toBeInTheDocument();
    });
  });

  it('shows error on API failure, no mock data fallback', async () => {
    mockApi.getMonitoringHealth.mockRejectedValue(new Error('Network error'));
    mockApi.getMetrics.mockRejectedValue(new Error('Network error'));
    mockApi.getDashboardData.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<ChartProvider><MetricsDashboard /></ChartProvider>);
    });

    await waitFor(() => {
      expect(mockApi.getMonitoringHealth).toHaveBeenCalled();
    });

    // Error message should be shown
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith(expect.stringContaining('加载指标数据失败'));
    });

    // Table should be empty (no mock data fallback)
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');

    // Metric values should show '-' (null state)
    const metricValues = screen.getAllByTestId('metric-value');
    expect(metricValues.some((el) => el.textContent === '-')).toBe(true);
  });

  it('handles empty API response gracefully', async () => {
    mockApi.getMonitoringHealth.mockResolvedValue(mockHealthData);
    mockApi.getMetrics.mockResolvedValue({
      ...mockMetricsData,
      data: { data: [] },
    });
    mockApi.getDashboardData.mockResolvedValue({
      ...mockDashboardData,
      data: { data: null },
    });

    await act(async () => {
      render(<ChartProvider><MetricsDashboard /></ChartProvider>);
    });

    await waitFor(() => {
      expect(mockApi.getDashboardData).toHaveBeenCalled();
    });

    // Table should be empty
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');

    // Metrics should show '-' since dashboardData is null
    const metricValues = screen.getAllByTestId('metric-value');
    expect(metricValues.every((el) => el.textContent === '-')).toBe(true);
  });
});
