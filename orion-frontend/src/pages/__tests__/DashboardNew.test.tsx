/**
 * Tests for DashboardNew page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import DashboardNew from '@/pages/DashboardNew';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

// 页面挂载时并发调用 4 个 API 拉数据，任何未 mock 的 API 都会挂起导致整页卡在 loading。
vi.mock('@/api/pipelines', () => ({
  getPipelines: vi.fn().mockResolvedValue({ data: [] }),
  getPipelineRuns: vi.fn().mockResolvedValue({ data: { data: [] } }),
}));

vi.mock('@/api/pipelineRuns', () => ({
  retryPipelineRun: vi.fn().mockResolvedValue({ data: {} }),
}));

vi.mock('@/api/monitoring', () => ({
  getMonitoringHealth: vi.fn().mockResolvedValue({ data: { status: 'healthy' } }),
}));

vi.mock('@/api/health', () => ({
  getServiceHealthList: vi.fn().mockResolvedValue({ data: [] }),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <BrowserRouter>
      <ChartProvider>{ui}</ChartProvider>
    </BrowserRouter>
  );

describe('DashboardNew', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard title elements', async () => {
    renderWithProviders(<DashboardNew />);
    await waitFor(() => {
      expect(screen.getByText('Pipeline 总数')).toBeTruthy();
      expect(screen.getByText('系统健康状态')).toBeTruthy();
    });
  });

  it('renders StatCard components', async () => {
    renderWithProviders(<DashboardNew />);
    await waitFor(() => {
      expect(screen.getByText('Pipeline 总数')).toBeTruthy();
      expect(screen.getByText('运行中')).toBeTruthy();
      expect(screen.getByText('成功')).toBeTruthy();
    });
  });
});
