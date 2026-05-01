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

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('DashboardNew', () => {
  beforeEach(() => { vi.clearAllMocks(); });

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
