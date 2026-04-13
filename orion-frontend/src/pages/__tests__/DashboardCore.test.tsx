/**
 * Tests for DashboardCore page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardCore from '@/pages/DashboardCore';

// Mock dayjs relativeTime plugin
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  return {
    ...(actual as any),
    extend: vi.fn(() => ({ format: () => '2026-04-12 15:00' })),
  };
});

// Mock the dayjs plugins
vi.mock('dayjs/plugin/relativeTime', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual.default || vi.fn(),
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('DashboardCore', () => {
  it('should render without crashing', () => {
    renderWithRouter(<DashboardCore />);
    expect(screen.getByText('工作台')).toBeInTheDocument();
  });

  it('should display KPI metric cards', () => {
    renderWithRouter(<DashboardCore />);
    expect(screen.getByText('Pipeline 成功率')).toBeInTheDocument();
    expect(screen.getByText('部署频率')).toBeInTheDocument();
    expect(screen.getByText('活跃告警')).toBeInTheDocument();
    expect(screen.getByText('系统健康度')).toBeInTheDocument();
  });

  it('should display recent activity section', () => {
    renderWithRouter(<DashboardCore />);
    expect(screen.getByText('最近活动')).toBeInTheDocument();
  });

  it('should display quick actions section', () => {
    renderWithRouter(<DashboardCore />);
    expect(screen.getByText('快速操作')).toBeInTheDocument();
    expect(screen.getByText('创建 Pipeline')).toBeInTheDocument();
    expect(screen.getByText('部署应用')).toBeInTheDocument();
  });

  it('should display system health section', () => {
    renderWithRouter(<DashboardCore />);
    expect(screen.getByText('系统健康')).toBeInTheDocument();
    expect(screen.getByText('API Gateway')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
  });
});
