/**
 * Tests for NotificationCenter page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NotificationCenter from '@/pages/NotificationCenter';

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (date: any) => ({
    format: () => '2026-04-13 09:30:00',
    fromNow: () => '2 分钟前',
    diff: () => 0,
    isBefore: () => false,
    isValid: () => true,
    toDate: () => new Date(date || '2026-04-13T09:30:00Z'),
    get: () => 0,
  });
  dayjsFn.extend = vi.fn(() => dayjsFn);
  dayjsFn.locale = vi.fn(() => dayjsFn);
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

vi.mock('dayjs/plugin/relativeTime', () => ({ default: vi.fn() }));

vi.mock('dayjs/locale/zh-cn', () => ({}));

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render notification center page', () => {
    renderWithRouter(<NotificationCenter />);
    expect(screen.getByText('通知中心')).toBeInTheDocument();
  });

  it('should show unread count in stats', async () => {
    renderWithRouter(<NotificationCenter />);
    // Wait for stats to load
    await waitFor(() => {
      expect(screen.getByText('未读')).toBeInTheDocument();
    });
  });

  it('should display notification list', async () => {
    renderWithRouter(<NotificationCenter />);
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText('新工单分配')).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByText('工单升级提醒')).toBeInTheDocument();
  });

  it('should show different notification types', async () => {
    renderWithRouter(<NotificationCenter />);
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText('SLA 警告')).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByText('被 @提及')).toBeInTheDocument();
    expect(screen.getByText('Pipeline 完成')).toBeInTheDocument();
    expect(screen.getByText('工单转派请求')).toBeInTheDocument();
    expect(screen.getByText('SLA 已违约')).toBeInTheDocument();
    expect(screen.getByText('系统告警')).toBeInTheDocument();
  });

  it('should show priority indicators (critical/high)', async () => {
    renderWithRouter(<NotificationCenter />);
    // Wait for notifications to load and check priority badges
    await waitFor(() => {
      const urgentTags = screen.getAllByText('紧急');
      expect(urgentTags.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    const highTags = screen.getAllByText('高');
    expect(highTags.length).toBeGreaterThan(0);
  });

  it('should have mark all as read button', () => {
    renderWithRouter(<NotificationCenter />);
    expect(screen.getByText('全部已读')).toBeInTheDocument();
  });

  it('should have clear read notifications button', () => {
    renderWithRouter(<NotificationCenter />);
    expect(screen.getByText('清除已读')).toBeInTheDocument();
  });

  it('should show stats cards', async () => {
    renderWithRouter(<NotificationCenter />);
    await waitFor(() => {
      expect(screen.getByText('紧急')).toBeInTheDocument();
      expect(screen.getByText('今日')).toBeInTheDocument();
      expect(screen.getByText('本周')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should filter by tab - unread', async () => {
    renderWithRouter(<NotificationCenter />);
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText('新工单分配')).toBeInTheDocument();
    }, { timeout: 3000 });
    // Click unread tab
    const unreadTab = screen.getByRole('tab', { name: '未读' });
    fireEvent.click(unreadTab);
    // Should still show unread notifications
    await waitFor(() => {
      expect(screen.getByText('新工单分配')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should filter by tab - tickets', async () => {
    renderWithRouter(<NotificationCenter />);
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText('新工单分配')).toBeInTheDocument();
    }, { timeout: 3000 });
    // Click tickets tab
    const ticketsTab = screen.getByRole('tab', { name: '工单' });
    fireEvent.click(ticketsTab);
    // Should show ticket-related notifications
    await waitFor(() => {
      expect(screen.getByText('新工单分配')).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByText('工单转派请求')).toBeInTheDocument();
  });

  it('should filter by tab - system', async () => {
    renderWithRouter(<NotificationCenter />);
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText('新工单分配')).toBeInTheDocument();
    }, { timeout: 3000 });
    // Click system tab
    const systemTab = screen.getByRole('tab', { name: '系统' });
    fireEvent.click(systemTab);
    // Should show system-related notifications
    await waitFor(() => {
      expect(screen.getByText('SLA 警告')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
