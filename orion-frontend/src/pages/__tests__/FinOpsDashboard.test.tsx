/**
 * Tests for FinOpsDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import FinOpsDashboard from '@/pages/FinOpsDashboard';

vi.mock('@orion-mf/core', () => ({
  EventBus: class { on = vi.fn(); off = vi.fn(); emit = vi.fn(); },
  eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  loadSubApp: vi.fn(), getSubApp: vi.fn(), getPreloadStrategy: vi.fn(),
}));

vi.mock('@/api/finops', async () => {
  const actual = await vi.importActual<typeof import('@/api/finops')>('@/api/finops');
  return {
    ...actual,
    getCostSummary: vi.fn().mockResolvedValue({ totalMonthly: 15000, budgetLimit: 20000, previousMonth: 14000, waste: 2000, savings: 3000 }),
    getCostByService: vi.fn().mockResolvedValue([
      { key: '1', service: 'api-gateway', cost: 5000, percent: 33, trend: 'up' as const },
      { key: '2', service: 'platform', cost: 6000, percent: 40, trend: 'stable' as const },
      { key: '3', service: 'ai-service', cost: 4000, percent: 27, trend: 'down' as const },
    ]),
    getCostTrend: vi.fn().mockResolvedValue([
      { month: '2024-01', cost: 12000, budget: 20000 },
      { month: '2024-02', cost: 13500, budget: 20000 },
      { month: '2024-03', cost: 15000, budget: 20000 },
    ]),
    getOptimizations: vi.fn().mockResolvedValue([]),
    getBudgetAlerts: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('FinOpsDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders cost analysis title', async () => {
    renderWithProviders(<FinOpsDashboard />);
    await waitFor(() => expect(screen.getByText('成本分析')).toBeTruthy());
  });

  it('renders ECharts components', async () => {
    renderWithProviders(<FinOpsDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });

  it('renders summary cards', async () => {
    renderWithProviders(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('本月花费')).toBeTruthy();
      // GaugeChart title is in mocked option, check for echarts wrapper
      expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0);
      expect(screen.getByText('预计浪费')).toBeTruthy();
      expect(screen.getByText('节省金额')).toBeTruthy();
    });
  });
});
