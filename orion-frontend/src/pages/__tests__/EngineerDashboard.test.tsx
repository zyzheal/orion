/**
 * Tests for EngineerDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import EngineerDashboard from '@/pages/EngineerDashboard';

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
