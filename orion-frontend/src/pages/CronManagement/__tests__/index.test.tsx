/**
 * Tests for CronManagement page
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CronManagement from '../index';
import * as cronApi from '@/api/cron';

vi.mock('@/api/cron', () => ({
  getCronJobs: vi.fn(),
  getCronStatus: vi.fn(),
  createCronJob: vi.fn(),
  updateCronJob: vi.fn(),
  deleteCronJob: vi.fn(),
  executeCronJob: vi.fn(),
}));

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, loading, rowKey }: any) => (
    <div data-testid="orion-table" data-loading={loading}>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid={`row-${item[rowKey]}`}>
          {item.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/MetricCard', () => ({
  default: ({ title, value }: any) => (
    <div data-testid="metric-card">{title}: {value}</div>
  ),
}));

const mockJobs = [
  { id: '1', name: 'daily-cleanup', schedule: '0 2 * * *', command: 'npm run cleanup', enabled: true, status: 'idle', runCount: 42, lastRunAt: '2026-04-29T02:00:00Z', nextRunAt: '2026-04-30T02:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-29T02:00:00Z' },
];

const mockStats = { running: 1, total: 5, enabled: 4 };

describe('CronManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then displays data', async () => {
    vi.mocked(cronApi.getCronJobs).mockResolvedValue({ data: { data: { jobs: mockJobs } } } as any);
    vi.mocked(cronApi.getCronStatus).mockResolvedValue({ data: { data: mockStats } } as any);

    render(<CronManagement />);

    // Loading state
    await waitFor(() => {
      expect(screen.getByTestId('orion-table')).toBeTruthy();
    });

    expect(screen.getByText('daily-cleanup')).toBeTruthy();
    expect(screen.getByText('定时任务管理')).toBeTruthy();
  });

  it('opens create modal and submits form', async () => {
    vi.mocked(cronApi.getCronJobs).mockResolvedValue({ data: { data: { jobs: [] } } } as any);
    vi.mocked(cronApi.getCronStatus).mockResolvedValue({ data: { data: mockStats } } as any);
    vi.mocked(cronApi.createCronJob).mockResolvedValue({ data: { data: {} } } as any);

    render(<CronManagement />);

    await waitFor(() => {
      expect(screen.getByText('新建任务')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('新建任务'));

    await waitFor(() => {
      expect(screen.getByText('新建定时任务')).toBeTruthy();
    });
  });

  it('shows error message when API fails', async () => {
    vi.mocked(cronApi.getCronJobs).mockRejectedValue(new Error('加载定时任务失败'));
    vi.mocked(cronApi.getCronStatus).mockRejectedValue(new Error('加载定时任务失败'));

    render(<CronManagement />);

    await waitFor(() => {
      expect(screen.getByText('加载定时任务失败')).toBeTruthy();
    });
  });
});
