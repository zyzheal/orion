import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as sessionApi from '@/api/session';

// Mock all antd components and hooks
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    Typography: {
      Title: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
      Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    },
    message: {
      error: vi.fn(),
      success: vi.fn(),
    },
  };
});

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, loading, rowKey }: any) => (
    <div data-testid="table" data-loading={loading}>
      <div data-testid="row-count">{dataSource?.length || 0}</div>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid="session-row">
          {item.userId}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/MetricCard', () => ({
  default: ({ title, value }: any) => (
    <div data-testid="metric-card">
      <span>{title}</span>
      <span data-testid="metric-value">{value}</span>
    </div>
  ),
}));

vi.mock('@/tokens/colors', () => ({
  colors: {
    neutral: { 400: '#999' },
    primary: { 500: '#1677ff' },
    success: { 500: '#52c41a' },
    purple: { 500: '#722ed1' },
  },
}));

vi.mock('@/tokens/spacing', () => ({
  spacing: { sm: 8, md: 16, lg: 24 },
}));

vi.mock('@/api/session', () => ({
  getSessions: vi.fn(),
  getSessionStats: vi.fn(),
  deleteSession: vi.fn(),
}));

describe('Sessions Page', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads sessions and stats from API on mount', async () => {
    const mockSessions = {
      sessions: [
        {
          id: 'sess-1',
          userId: 'user1@test.com',
          token: 'abc123token',
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome / macOS',
          createdAt: '2024-03-20T08:00:00Z',
          lastAccessedAt: '2024-03-20T10:30:00Z',
          expiresAt: '2025-03-20T08:00:00Z',
        },
        {
          id: 'sess-2',
          userId: 'user2@test.com',
          token: 'def456token',
          ipAddress: '10.0.0.1',
          userAgent: 'Firefox / Windows',
          createdAt: '2024-03-19T08:00:00Z',
          lastAccessedAt: '2024-03-19T10:00:00Z',
          expiresAt: '2024-03-20T08:00:00Z',
        },
      ],
    };

    const mockStats = {
      stats: {
        total: 50,
        active: 10,
        expired: 40,
      },
    };

    vi.mocked(sessionApi.getSessions).mockResolvedValue({
      data: { code: 200, message: 'success', data: mockSessions },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    vi.mocked(sessionApi.getSessionStats).mockResolvedValue({
      data: { code: 200, message: 'success', data: mockStats },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    // Dynamic import to ensure mocks are in place
    const SessionManagement = (await import('../index')).default;

    await act(async () => {
      render(<SessionManagement />);
    });

    await waitFor(() => {
      expect(sessionApi.getSessions).toHaveBeenCalled();
      expect(sessionApi.getSessionStats).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(sessionApi.getSessions).mockRejectedValue(new Error('Network error'));
    vi.mocked(sessionApi.getSessionStats).mockRejectedValue(new Error('Network error'));

    const SessionManagement = (await import('../index')).default;

    await act(async () => {
      render(<SessionManagement />);
    });

    await waitFor(() => {
      expect(sessionApi.getSessions).toHaveBeenCalled();
    });

    const { message } = await import('antd');
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(expect.stringContaining('加载 Session 数据失败'));
    });
  });
});
