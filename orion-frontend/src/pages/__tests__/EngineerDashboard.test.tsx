/**
 * Tests for EngineerDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import EngineerDashboard from '@/pages/EngineerDashboard';

// Mock the useBiDashboard hook to return mock data synchronously
vi.mock('@/hooks/useBiDashboard', () => ({
  useBiDashboard: () => ({
    data: {
      personalOverview: {
        engineerId: 'E001',
        engineerName: '张伟',
        currentLoad: 5,
        totalResolved: 52,
        avgResolutionTimeHours: 3.2,
        slaComplianceRate: 95.5,
        performanceGrade: 'A',
        rank: 1,
        totalInTeam: 24,
      },
      personalTrend: Array.from({ length: 14 }, (_, i) => ({
        period: `2026-04-${String(i + 1).padStart(2, '0')}`,
        resolved: 2 + Math.floor(Math.random() * 4),
        avgResolutionHours: 2 + Math.random() * 3,
        slaCompliant: Math.random() > 0.2 ? 1 : 0,
      })),
      strengths: [
        { category: '基础设施', resolvedCount: 18, slaComplianceRate: 97, proficiencyScore: 92 },
        { category: '网络', resolvedCount: 15, slaComplianceRate: 95, proficiencyScore: 88 },
        { category: '数据库', resolvedCount: 12, slaComplianceRate: 93, proficiencyScore: 85 },
      ],
      weaknesses: [
        { category: '安全', resolvedCount: 3, slaComplianceRate: 65, suggestion: '建议参加安全工单处理培训' },
        { category: '性能', resolvedCount: 4, slaComplianceRate: 70, suggestion: '建议与性能专家结对处理' },
      ],
      activeTickets: [
        { ticketId: 'TKT-001', title: '生产数据库CPU使用率过高', priority: '紧急', status: '处理中', elapsedHours: 2.5, slaRemainingHours: 5.5, isOverdue: false },
        { ticketId: 'TKT-015', title: '应用部署失败回滚', priority: '高', status: '处理中', elapsedHours: 1.2, slaRemainingHours: 6.8, isOverdue: false },
        { ticketId: 'TKT-023', title: '服务器磁盘空间不足', priority: '高', status: '待处理', elapsedHours: 8.0, slaRemainingHours: 0, isOverdue: true },
        { ticketId: 'TKT-008', title: 'API网关响应延迟', priority: '中', status: '处理中', elapsedHours: 0.5, slaRemainingHours: 11.5, isOverdue: false },
      ],
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

describe('EngineerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing and show page title', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('个人看板')).toBeInTheDocument();
  });

  it('should display engineer name in personal overview', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('张伟')).toBeInTheDocument();
  });

  it('should display rank badge', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('排名 #1/24')).toBeInTheDocument();
  });

  it('should display grade badge', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('等级 A')).toBeInTheDocument();
  });

  it('should display personal metrics', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('当前负载')).toBeInTheDocument();
    expect(screen.getByText('已解决总数')).toBeInTheDocument();
    expect(screen.getByText('平均解决时间')).toBeInTheDocument();
    expect(screen.getByText('SLA合规率')).toBeInTheDocument();
  });

  it('should display correct current load value', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should display correct total resolved value', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('52')).toBeInTheDocument();
  });

  it('should display personal trend chart section', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('个人趋势（近14天）')).toBeInTheDocument();
  });

  it('should display strengths section', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('优势领域')).toBeInTheDocument();
    expect(screen.getByText('基础设施')).toBeInTheDocument();
    expect(screen.getByText('网络')).toBeInTheDocument();
    expect(screen.getByText('数据库')).toBeInTheDocument();
  });

  it('should display weaknesses section with suggestions', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('待提升领域')).toBeInTheDocument();
    expect(screen.getByText('安全')).toBeInTheDocument();
    expect(screen.getByText('性能')).toBeInTheDocument();
    expect(screen.getByText(/建议参加安全工单处理培训/)).toBeInTheDocument();
    expect(screen.getByText(/建议与性能专家结对处理/)).toBeInTheDocument();
  });

  it('should display active tickets table', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('活跃工单')).toBeInTheDocument();
    expect(screen.getByText('工单号')).toBeInTheDocument();
    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(screen.getByText('优先级')).toBeInTheDocument();
    expect(screen.getAllByText('状态').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('已耗时')).toBeInTheDocument();
    expect(screen.getByText('SLA剩余')).toBeInTheDocument();
  });

  it('should display active ticket details', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('TKT-001')).toBeInTheDocument();
    expect(screen.getByText('TKT-015')).toBeInTheDocument();
    expect(screen.getByText('TKT-023')).toBeInTheDocument();
    expect(screen.getByText('TKT-008')).toBeInTheDocument();
  });

  it('should display ticket titles in active list', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText(/生产数据库CPU使用率过高/)).toBeInTheDocument();
    expect(screen.getByText(/应用部署失败回滚/)).toBeInTheDocument();
    expect(screen.getByText(/服务器磁盘空间不足/)).toBeInTheDocument();
    expect(screen.getByText(/API网关响应延迟/)).toBeInTheDocument();
  });

  it('should display overdue indicator for overdue tickets', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getAllByText('超期').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('正常').length).toBeGreaterThanOrEqual(1);
  });

  it('should display priority tags for tickets', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByText('紧急')).toBeInTheDocument();
    expect(screen.getAllByText('高').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('中')).toBeInTheDocument();
  });

  it('should render ECharts components', () => {
    renderWithRouter(<EngineerDashboard />);
    const charts = screen.getAllByTestId('echarts-wrapper');
    expect(charts.length).toBeGreaterThan(0);
  });
});
