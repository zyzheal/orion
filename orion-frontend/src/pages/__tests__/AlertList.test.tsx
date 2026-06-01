/**
 * Tests for AlertList page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AlertList from '@/pages/AlertList';

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (_: any) => ({
    format: () => '2026-04-12 15:00:00',
    fromNow: () => '5 minutes ago',
  });
  dayjsFn.extend = vi.fn(() => dayjsFn);
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

vi.mock('dayjs/plugin/relativeTime', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: actual?.default || vi.fn(),
  };
});

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

// Mock alerts API - mock data must be inside the factory since vi.mock is hoisted
vi.mock('@/api/alerts', () => ({
  getAlerts: vi.fn().mockResolvedValue({
    data: {
      items: [
        {
          id: 'alert-1',
          severity: 'critical',
          metric: 'error_rate',
          value: 5.2,
          threshold: 1.0,
          status: 'active',
          message: 'Error rate exceeds threshold',
          source: 'prometheus',
          firstTriggered: '2026-04-12T10:00:00Z',
          lastUpdated: '2026-04-12T15:00:00Z',
        },
        {
          id: 'alert-2',
          severity: 'warning',
          metric: 'response_time_p99',
          value: 1200,
          threshold: 500,
          status: 'active',
          message: 'P99 response time is high',
          source: 'prometheus',
          firstTriggered: '2026-04-12T11:00:00Z',
          lastUpdated: '2026-04-12T15:00:00Z',
        },
      ],
    },
  }),
  acknowledgeAlert: vi.fn().mockResolvedValue({}),
  resolveAlert: vi.fn().mockResolvedValue({}),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('AlertList', () => {
  it('should render without crashing', () => {
    renderWithRouter(<AlertList />);
    expect(screen.getByText('监控告警')).toBeInTheDocument();
  });

  it('should display search filter bar', () => {
    renderWithRouter(<AlertList />);
    expect(screen.getByPlaceholderText('搜索指标名称、来源、消息...')).toBeInTheDocument();
  });

  it('should display severity filters', () => {
    renderWithRouter(<AlertList />);
    // Multiple select placeholders contain "状态" - use getAllByText
    expect(screen.getAllByText('严重级别')[0]).toBeInTheDocument();
    expect(screen.getAllByText('状态')[0]).toBeInTheDocument();
  });

  it('should display alert data', async () => {
    renderWithRouter(<AlertList />);
    await waitFor(() => {
      expect(screen.getByText('error_rate')).toBeInTheDocument();
    });
    expect(screen.getByText('response_time_p99')).toBeInTheDocument();
  });

  it('should display active alert summary', async () => {
    renderWithRouter(<AlertList />);
    await waitFor(() => {
      expect(screen.getByText(/.*个严重告警/)).toBeInTheDocument();
    });
  });

  it('should display action buttons for active alerts', async () => {
    renderWithRouter(<AlertList />);
    await waitFor(() => {
      expect(screen.getAllByText('确认').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('解决').length).toBeGreaterThan(0);
  });
});
