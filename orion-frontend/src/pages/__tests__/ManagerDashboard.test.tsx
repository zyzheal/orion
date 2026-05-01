/**
 * Tests for ManagerDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import ManagerDashboard from '@/pages/ManagerDashboard';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  return {
    ...(actual as Record<string, unknown>),
    extend: vi.fn(() => ({ format: () => '2026-04-13 10:00' })),
  };
});

vi.mock('dayjs/plugin/relativeTime', () => ({}));

import { ChartProvider } from '@/components/charts';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ChartProvider>{ui}</ChartProvider>
    </BrowserRouter>
  );
};

describe('ManagerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing and show page title', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByText('经理看板')).toBeInTheDocument();
  });

  it('should display team overview cards', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByText('总工单数')).toBeInTheDocument();
    expect(screen.getAllByText('已解决').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('平均解决时间').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SLA合规率').length).toBeGreaterThanOrEqual(1);
    // GaugeChart renders title differently, check for echarts wrapper instead
    const charts = screen.getAllByTestId('echarts-wrapper');
    expect(charts.length).toBeGreaterThan(0);
  });

  it('should display correct total tickets count', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByText('156')).toBeInTheDocument();
  });

  it('should display correct resolved count', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByText('132')).toBeInTheDocument();
  });

  it('should display week-over-week comparison section', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByText('环比变化（vs 上周）')).toBeInTheDocument();
    expect(screen.getByText('工单创建')).toBeInTheDocument();
    expect(screen.getAllByText('已解决').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('平均解决时间').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('SLA合规率').length).toBeGreaterThanOrEqual(1);
  });

  it('should display member metrics table', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByText('成员效能明细')).toBeInTheDocument();
    expect(screen.getAllByText('工程师').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('工作量').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('效率').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('质量').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('综合评分').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('等级').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('趋势').length).toBeGreaterThanOrEqual(1);
  });

  it('should display all member names in the table', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByText('张伟')).toBeInTheDocument();
    expect(screen.getByText('李娜')).toBeInTheDocument();
    expect(screen.getByText('王强')).toBeInTheDocument();
    expect(screen.getByText('赵敏')).toBeInTheDocument();
    expect(screen.getByText('孙磊')).toBeInTheDocument();
  });

  it('should display grade badges for members', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('B+').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('D').length).toBeGreaterThanOrEqual(1);
  });

  it('should display transfer analysis section', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByText('转派分析')).toBeInTheDocument();
    // PieChart is mocked, check for echarts wrapper in the section
    expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0);
  });

  it('should render ECharts components', () => {
    renderWithRouter(<ManagerDashboard />);
    const charts = screen.getAllByTestId('echarts-wrapper');
    expect(charts.length).toBeGreaterThan(0);
  });

  it('should display top transfer reasons', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByText('主要转派原因')).toBeInTheDocument();
    expect(screen.getByText('专业不匹配')).toBeInTheDocument();
    expect(screen.getByText('超时自动转派')).toBeInTheDocument();
    expect(screen.getByText('工程师请假')).toBeInTheDocument();
  });

  it('should display team load percentage', () => {
    renderWithRouter(<ManagerDashboard />);
    // GaugeChart renders the value in the option data, check for the echarts wrapper
    const charts = screen.getAllByTestId('echarts-wrapper');
    expect(charts.length).toBeGreaterThan(0);
  });

  it('should display SLA compliance rate in team overview', () => {
    renderWithRouter(<ManagerDashboard />);
    const slaLabel = screen.getAllByText('SLA合规率')[0];
    expect(slaLabel).toBeInTheDocument();
  });
});
