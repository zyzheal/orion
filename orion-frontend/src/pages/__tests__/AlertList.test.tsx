/**
 * Tests for AlertList page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('should display alert data', () => {
    renderWithRouter(<AlertList />);
    expect(screen.getByText('error_rate')).toBeInTheDocument();
    expect(screen.getByText('response_time_p99')).toBeInTheDocument();
  });

  it('should display active alert summary', () => {
    renderWithRouter(<AlertList />);
    expect(screen.getByText(/.*个严重告警/)).toBeInTheDocument();
  });

  it('should display action buttons for active alerts', () => {
    renderWithRouter(<AlertList />);
    expect(screen.getAllByText('确认').length).toBeGreaterThan(0);
    expect(screen.getAllByText('解决').length).toBeGreaterThan(0);
  });
});
