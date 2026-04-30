/**
 * EventBus Page Tests
 * - Loads events and stats from API on mount
 * - Shows error on API failure, no mock data
 * - Shows empty state when API returns empty array
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventBusMonitoring from '../index';

const { mockMessage, mockApi } = vi.hoisted(() => ({
  mockMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  mockApi: {
    getEvents: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('@/api/eventbus', () => mockApi);

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: mockMessage };
});

vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (value: unknown) => ({
    format: () => String(value || '2026-04-20 10:30:00'),
    fromNow: () => '2 hours ago',
    valueOf: () => Date.now(),
  });
  // @ts-expect-error dayjs mock needs these extensions
  (dayjsFn as Record<string, unknown>).extend = vi.fn(() => dayjsFn);
  // @ts-expect-error dayjs mock needs these extensions
  (dayjsFn as Record<string, unknown>).duration = vi.fn(() => ({
    asMinutes: () => 0,
    seconds: () => 0,
  }));
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

vi.mock('dayjs/plugin/relativeTime', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { default: mod?.default || vi.fn() };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

const mockApiEvent = {
  id: 'evt-test-001',
  tenantId: 'tenant-1',
  eventType: 'pipeline.run.completed',
  subject: 'pipeline.run.completed',
  source: 'pipeline-engine',
  status: 'delivered',
  payload: { runId: '123' },
  publishedBy: 'user-1',
  publishedAt: '2026-04-20T10:30:00Z',
  retryCount: 0,
  createdAt: '2026-04-20T10:30:00Z',
};

const mockStats = {
  total: 15842,
  activeSubscribers: 23,
  failed: 47,
  eventRate: 128,
};

describe('EventBusMonitoring', () => {
  beforeEach(() => {
    mockMessage.error.mockClear();
    mockApi.getEvents.mockReset();
    mockApi.getStats.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads events and stats from API on mount', async () => {
    mockApi.getEvents.mockResolvedValue({
      data: { data: { events: [mockApiEvent] } },
    });
    mockApi.getStats.mockResolvedValue({
      data: { data: { stats: mockStats } },
    });

    renderWithRouter(<EventBusMonitoring />);

    await waitFor(() => {
      expect(mockApi.getEvents).toHaveBeenCalledWith({ limit: 100 });
      expect(mockApi.getStats).toHaveBeenCalled();
    });

    // Verify the mapped event data is displayed
    await waitFor(() => {
      expect(screen.getByText('pipeline.run.completed')).toBeInTheDocument();
    });
  });

  it('shows error on API failure, no mock data', async () => {
    mockApi.getEvents.mockRejectedValue(new Error('Network error'));
    mockApi.getStats.mockRejectedValue(new Error('Network error'));

    renderWithRouter(<EventBusMonitoring />);

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith(
        expect.stringContaining('加载 EventBus 数据失败'),
      );
    });

    // No mock data warning should appear since we removed it
    // Table should be empty (no events rendered)
    await waitFor(() => {
      expect(screen.queryByText('evt-001')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when API returns empty array', async () => {
    mockApi.getEvents.mockResolvedValue({
      data: { data: { events: [] } },
    });
    mockApi.getStats.mockResolvedValue({
      data: { data: { stats: {} } },
    });

    renderWithRouter(<EventBusMonitoring />);

    await waitFor(() => {
      expect(mockApi.getEvents).toHaveBeenCalled();
    });

    // No event types should be in the document since events are empty
    // Stats with zeros should still render but with 0 values
    await waitFor(() => {
      // The page should render without errors
      expect(screen.getByText('EventBus')).toBeInTheDocument();
    });
  });
});
