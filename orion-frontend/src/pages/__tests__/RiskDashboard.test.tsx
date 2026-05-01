/**
 * Tests for RiskDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import RiskDashboard from '@/pages/RiskDashboard';

vi.mock('@/api/risk', async () => {
  const actual = await vi.importActual<typeof import('@/api/risk')>('@/api/risk');
  return {
    ...actual,
    getRiskAssessments: vi.fn().mockResolvedValue({ data: { data: { assessments: [
      { id: '1', targetType: 'deployment', targetId: 'deploy-1', riskLevel: 'high', riskScore: 75, status: 'completed', assessedAt: '2024-01-01', assessedBy: 'admin', factors: [], recommendations: [] },
    ]}}}),
    getRiskEvents: vi.fn().mockResolvedValue({ data: { data: { events: [] } } }),
    getRiskStatus: vi.fn().mockResolvedValue({ data: { data: { totalAssessments: 10, pendingAssessments: 2, highRiskCount: 3, status: 'healthy' } } }),
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

describe('RiskDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders dashboard title', async () => {
    renderWithProviders(<RiskDashboard />);
    await waitFor(() => expect(screen.getByText('风险管理')).toBeTruthy());
  });

  it('renders ECharts components', async () => {
    renderWithProviders(<RiskDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });

  it('renders summary cards', async () => {
    renderWithProviders(<RiskDashboard />);
    await waitFor(() => {
      expect(screen.getByText('总评估数')).toBeTruthy();
      expect(screen.getByText('评估中')).toBeTruthy();
      expect(screen.getByText('高风险')).toBeTruthy();
      expect(screen.getByText('未确认事件')).toBeTruthy();
    });
  });
});
