/**
 * Tests for ExecutiveDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import ExecutiveDashboard from '@/pages/ExecutiveDashboard';

// Mock the useBiDashboard hook to return mock data synchronously
vi.mock('@/hooks/useBiDashboard', () => ({
  useBiDashboard: () => ({
    data: null, // null triggers mock data fallback in component
    loading: false,
    error: null,
  }),
}));

// Mock chart components that use echarts-for-react (not available in jsdom)
vi.mock('@/components/charts', async () => {
  const actual = await vi.importActual('@/components/charts');
  return {
    ...(actual as Record<string, unknown>),
    ChartProvider: ({ children }: { children: React.ReactNode }) => children,
    TrendLineChart: ({ data }: { data: unknown[][] }) => (
      <div data-testid="trend-chart">
        {data.flat().map((d: unknown, i: number) => (
          <span key={i}>{(d as { label?: string })?.label}</span>
        ))}
      </div>
    ),
    PieChart: ({ data }: { data: { name: string }[] }) => (
      <div data-testid="pie-chart">
        {data.map((d: { name: string }) => (
          <span key={d.name}>{d.name}</span>
        ))}
      </div>
    ),
    GaugeChart: () => <div data-testid="gauge-chart" />,
    StatCard: ({ title, value }: { title: string; value: string | number }) => (
      <div data-testid="stat-card">
        <span>{title}</span>
        <span>{value}</span>
      </div>
    ),
    BarChart: ({ data, title }: { data: unknown[]; title?: string }) => (
      <div data-testid="bar-chart">
        {title && <span>{title}</span>}
        {data.map((d: any, i: number) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    ),
  };
});

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  return {
    ...(actual as Record<string, unknown>),
    extend: vi.fn(() => ({ format: () => '2026-04-13 10:00' })),
  };
});

vi.mock('dayjs/plugin/relativeTime', () => ({}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ChartProvider>{ui}</ChartProvider>
    </BrowserRouter>
  );
};

describe('ExecutiveDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing and show page title', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('总览看板')).toBeInTheDocument();
  });

  it('should display all 8 KPI metric cards', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('总工单数')).toBeInTheDocument();
    expect(screen.getByText('已解决')).toBeInTheDocument();
    expect(screen.getByText('待处理')).toBeInTheDocument();
    expect(screen.getByText('解决率')).toBeInTheDocument();
    expect(screen.getByText('平均解决时间')).toBeInTheDocument();
    expect(screen.getByText('SLA合规率')).toBeInTheDocument();
    expect(screen.getByText('工程师总数')).toBeInTheDocument();
    expect(screen.getByText('活跃工程师')).toBeInTheDocument();
  });

  it('should display correct total tickets value', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('487')).toBeInTheDocument();
  });

  it('should display correct resolved tickets value', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('412')).toBeInTheDocument();
  });

  it('should display correct SLA compliance rate value', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('92.1%')).toBeInTheDocument();
  });

  it('should display ticket volume trend section', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('工单量趋势（近14天）')).toBeInTheDocument();
  });

  it('should display SLA compliance trend section', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('SLA合规率趋势（近14天）')).toBeInTheDocument();
  });

  it('should display team ranking section with top performers', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('团队排名 - 优秀工程师')).toBeInTheDocument();
    expect(screen.getByText('张伟')).toBeInTheDocument();
    expect(screen.getByText('李娜')).toBeInTheDocument();
    expect(screen.getByText('王强')).toBeInTheDocument();
  });

  it('should display bottom performers needing attention', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('需关注工程师')).toBeInTheDocument();
    expect(screen.getByText('孙磊')).toBeInTheDocument();
    expect(screen.getByText('SLA合规率偏低 (72%)')).toBeInTheDocument();
  });

  it('should display alert cards section', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('告警中心')).toBeInTheDocument();
    expect(screen.getByText('SLA违规')).toBeInTheDocument();
    expect(screen.getByText('超期工单')).toBeInTheDocument();
    expect(screen.getByText('过载工程师')).toBeInTheDocument();
    expect(screen.getByText('24h+未分配')).toBeInTheDocument();
  });

  it('should display correct SLA breached count', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should display category distribution section', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('工单分类分布')).toBeInTheDocument();
    expect(screen.getByText('基础设施')).toBeInTheDocument();
    expect(screen.getByText('应用')).toBeInTheDocument();
  });

  it('should display priority distribution section', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(screen.getByText('优先级分布')).toBeInTheDocument();
    expect(screen.getAllByText('紧急').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('高').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('中').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('低').length).toBeGreaterThanOrEqual(1);
  });
});
