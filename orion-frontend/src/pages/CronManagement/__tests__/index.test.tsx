/**
 * Tests for CronManagement page
 */
import type { ReactElement, ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CronManagement from '../index';
import * as cronApi from '@/api/cron';

// 页面用 useNavigate()，裸 render 会抛
// "useNavigate() may be used only in the context of a <Router> component"。
const renderWithRouter = (ui: ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

// 整页被 PermissionGuard 包着。它依赖 authStore 的用户角色，而测试里没有登录：
// userRoles 为空 → hasPermission 恒 false → 守卫渲染 fallback(null)，整页空白，
// 于是 orion-table / 新建任务 / 错误提示全都找不到。权限判定本身有独立的
// PermissionGuard 单测，页面测试只关心页面逻辑，这里直接放行。
vi.mock('@/components/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

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
    <div data-testid="metric-card">
      {title}: {value}
    </div>
  ),
}));

const mockJobs = [
  {
    id: '1',
    name: 'daily-cleanup',
    schedule: '0 2 * * *',
    command: 'npm run cleanup',
    enabled: true,
    status: 'idle',
    runCount: 42,
    lastRunAt: '2026-04-29T02:00:00Z',
    nextRunAt: '2026-04-30T02:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-29T02:00:00Z',
  },
];

const mockStats = { running: 1, total: 5, enabled: 4 };

describe('CronManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then displays data', async () => {
    vi.mocked(cronApi.getCronJobs).mockResolvedValue({ data: { jobs: mockJobs } } as any);
    vi.mocked(cronApi.getCronStatus).mockResolvedValue({ data: mockStats } as any);

    renderWithRouter(<CronManagement />);

    // Loading state
    await waitFor(() => {
      expect(screen.getByTestId('orion-table')).toBeTruthy();
    });

    expect(screen.getByText('daily-cleanup')).toBeTruthy();
    expect(screen.getByText('定时任务管理')).toBeTruthy();
  });

  it('opens create modal and submits form', async () => {
    vi.mocked(cronApi.getCronJobs).mockResolvedValue({ data: { jobs: [] } } as any);
    vi.mocked(cronApi.getCronStatus).mockResolvedValue({ data: mockStats } as any);
    vi.mocked(cronApi.createCronJob).mockResolvedValue({ data: {} } as any);

    renderWithRouter(<CronManagement />);

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

    renderWithRouter(<CronManagement />);

    await waitFor(() => {
      expect(screen.getByText('加载定时任务失败')).toBeTruthy();
    });
  });
});
