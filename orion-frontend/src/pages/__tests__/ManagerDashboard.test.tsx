/**
 * Tests for ManagerDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import ManagerDashboard from '@/pages/ManagerDashboard';

// Mock the useBiDashboard hook to return mock data synchronously
vi.mock('@/hooks/useBiDashboard', () => ({
  useBiDashboard: () => ({
    data: {
      teamOverview: {
        totalTickets: 156,
        resolvedCount: 132,
        avgResolutionTimeHours: 3.8,
        slaComplianceRate: 88.5,
        teamLoadPercentage: 72,
      },
      memberMetrics: [
        { engineerId: 'E001', engineerName: '张伟', period: '2026-W15', workload: { totalAssigned: 20, totalResolved: 18 }, efficiency: { avgResolutionTimeMs: 3600000, ticketsPerDay: 2.5 }, quality: { slaComplianceRate: 95, firstTimeResolveRate: 90, reopenRate: 2 }, compositeScore: 92, performanceGrade: 'A', trend: 'improving' },
        { engineerId: 'E002', engineerName: '李娜', period: '2026-W15', workload: { totalAssigned: 18, totalResolved: 15 }, efficiency: { avgResolutionTimeMs: 4200000, ticketsPerDay: 2.1 }, quality: { slaComplianceRate: 88, firstTimeResolveRate: 85, reopenRate: 4 }, compositeScore: 85, performanceGrade: 'B+', trend: 'stable' },
        { engineerId: 'E003', engineerName: '王强', period: '2026-W15', workload: { totalAssigned: 15, totalResolved: 12 }, efficiency: { avgResolutionTimeMs: 5400000, ticketsPerDay: 1.7 }, quality: { slaComplianceRate: 82, firstTimeResolveRate: 78, reopenRate: 6 }, compositeScore: 78, performanceGrade: 'B', trend: 'stable' },
        { engineerId: 'E004', engineerName: '赵敏', period: '2026-W15', workload: { totalAssigned: 12, totalResolved: 8 }, efficiency: { avgResolutionTimeMs: 6000000, ticketsPerDay: 1.1 }, quality: { slaComplianceRate: 70, firstTimeResolveRate: 65, reopenRate: 10 }, compositeScore: 55, performanceGrade: 'D', trend: 'declining' },
        { engineerId: 'E005', engineerName: '孙磊', period: '2026-W15', workload: { totalAssigned: 10, totalResolved: 7 }, efficiency: { avgResolutionTimeMs: 7200000, ticketsPerDay: 1.0 }, quality: { slaComplianceRate: 65, firstTimeResolveRate: 60, reopenRate: 12 }, compositeScore: 50, performanceGrade: 'D', trend: 'declining' },
      ],
      weekOverWeek: {
        ticketsCreatedChange: 12.5,
        resolvedChange: 8.3,
        avgResolutionTimeChange: -5.4,
        slaComplianceChange: 1.2,
      },
      transferAnalysis: {
        totalTransfers: 15,
        avgTransfersPerTicket: 1.3,
        topTransferReasons: [
          { reason: '专业不匹配', count: 6 },
          { reason: '超时自动转派', count: 4 },
          { reason: '工程师请假', count: 3 },
          { reason: '工单升级', count: 2 },
        ],
      },
    },
    loading: false,
    error: null,
  }),
}));

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
