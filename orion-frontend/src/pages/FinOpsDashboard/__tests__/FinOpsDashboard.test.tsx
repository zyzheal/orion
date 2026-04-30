/**
 * Tests for FinOpsDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FinOpsDashboard from '@/pages/FinOpsDashboard';

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = () => ({
    format: () => '2026-04-13 10:00:00',
    fromNow: () => '5 minutes ago',
  });
  dayjsFn.extend = vi.fn(() => dayjsFn);
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

vi.mock('dayjs/plugin/relativeTime', () => ({}));

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('FinOpsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render FinOps dashboard', () => {
    renderWithRouter(<FinOpsDashboard />);
    expect(screen.getByText('成本分析')).toBeInTheDocument();
  });

  it('should show summary cards with correct values', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('本月花费')).toBeInTheDocument();
    });
    expect(screen.getByText('45,680')).toBeInTheDocument();
  });

  it('should show budget usage percentage', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('预算使用')).toBeInTheDocument();
    });
    expect(screen.getByText('76%')).toBeInTheDocument();
    expect(screen.getByText('预算上限 ¥60,000')).toBeInTheDocument();
  });

  it('should display waste amount', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('预计浪费')).toBeInTheDocument();
    });
    expect(screen.getByText('5,400')).toBeInTheDocument();
  });

  it('should display savings amount', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('节省金额')).toBeInTheDocument();
    });
    // "3,200" may appear in multiple places, use getAllByText
    const savingsElements = screen.getAllByText('3,200');
    expect(savingsElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show cost by service table', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('各服务成本明细')).toBeInTheDocument();
    });
    // "云服务器 ECS" appears in multiple places
    const ecsElements = screen.getAllByText('云服务器 ECS');
    expect(ecsElements.length).toBeGreaterThanOrEqual(1);
    const rdsElements = screen.getAllByText('数据库 RDS');
    expect(rdsElements.length).toBeGreaterThanOrEqual(1);
    const ossElements = screen.getAllByText('对象存储 OSS');
    expect(ossElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display optimization recommendations', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('优化建议')).toBeInTheDocument();
    });
    expect(screen.getByText('闲置资源清理')).toBeInTheDocument();
    expect(screen.getByText('预留实例购买')).toBeInTheDocument();
    expect(screen.getByText('降配建议')).toBeInTheDocument();
  });

  it('should show budget alerts', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('预算告警')).toBeInTheDocument();
    });
    // "已超支" appears multiple times in budget alerts section
    const overBudgetElements = screen.getAllByText('已超支');
    expect(overBudgetElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should have export report button', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('导出报表')).toBeInTheDocument();
    });
    expect(screen.getByText('设置预算')).toBeInTheDocument();
    expect(screen.getByText('查看明细')).toBeInTheDocument();
  });

  it('should show cost trend section', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('成本趋势（近12个月）')).toBeInTheDocument();
    });
  });
});
