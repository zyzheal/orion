/**
 * Tests for EfficiencyDashboard page (TASK-402)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EfficiencyDashboard from '@/pages/EfficiencyDashboard';

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (_: any) => ({
    format: () => '2026-04-13',
    fromNow: () => '2 分钟前',
  });
  dayjsFn.extend = vi.fn(() => dayjsFn);
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('EfficiencyDashboard', () => {
  it('should render without crashing', async () => {
    renderWithRouter(<EfficiencyDashboard />);
    await waitFor(() => {
      expect(screen.getByText('效能看板')).toBeInTheDocument();
    });
  });

  it('should display DORA metrics section', async () => {
    renderWithRouter(<EfficiencyDashboard />);
    await waitFor(() => {
      expect(screen.getByText('核心指标')).toBeInTheDocument();
    });
    expect(screen.getByText('发布频率')).toBeInTheDocument();
    expect(screen.getByText('变更前置时间')).toBeInTheDocument();
    expect(screen.getByText('服务恢复时间')).toBeInTheDocument();
    expect(screen.getByText('变更失败率')).toBeInTheDocument();
  });

  it('should display metric cards with data', async () => {
    renderWithRouter(<EfficiencyDashboard />);
    await waitFor(() => {
      expect(screen.getByText('175')).toBeInTheDocument();
    });
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('6.4')).toBeInTheDocument();
  });

  it('should display DORA metrics detail table', async () => {
    renderWithRouter(<EfficiencyDashboard />);
    await waitFor(() => {
      expect(screen.getByText('DORA 指标详情')).toBeInTheDocument();
    });
    expect(screen.getByText(/Deployment Frequency/)).toBeInTheDocument();
    expect(screen.getByText(/Lead Time/)).toBeInTheDocument();
    expect(screen.getByText(/MTTR/)).toBeInTheDocument();
  });

  it('should display improvement suggestions', async () => {
    renderWithRouter(<EfficiencyDashboard />);
    await waitFor(() => {
      expect(screen.getByText('改进建议')).toBeInTheDocument();
    });
    expect(screen.getByText(/自动化测试覆盖率/)).toBeInTheDocument();
  });

  it('should display team comparison tab', async () => {
    renderWithRouter(<EfficiencyDashboard />);
    await waitFor(() => {
      expect(screen.getByText('团队对比')).toBeInTheDocument();
    });
  });

  it('should display trend analysis tab', async () => {
    renderWithRouter(<EfficiencyDashboard />);
    await waitFor(() => {
      expect(screen.getByText('趋势分析')).toBeInTheDocument();
    });
  });
});
