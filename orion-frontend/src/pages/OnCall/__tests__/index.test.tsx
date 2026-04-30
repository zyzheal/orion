import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as oncallApi from '@/api/oncall';
import * as usersApi from '@/api/users';

// Mock antd components
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    Typography: {
      Title: ({ children, level, style, ...props }: any) => {
        const Tag = `h${level || 1}` as keyof JSX.IntrinsicElements;
        return <Tag {...props}>{children}</Tag>;
      },
      Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    },
    message: {
      error: vi.fn(),
      success: vi.fn(),
    },
    Table: ({ dataSource, loading, rowKey }: any) => (
      <div data-testid="table" data-loading={loading}>
        <div data-testid="row-count">{dataSource?.length || 0}</div>
        {dataSource?.map((item: any) => (
          <div key={item[rowKey]} data-testid="schedule-row">
            {item.name}
          </div>
        ))}
      </div>
    ),
  };
});

vi.mock('@/components/PageSkeleton', () => ({
  default: () => <div data-testid="page-skeleton">Loading...</div>,
}));

vi.mock('@/tokens/colors', () => ({
  colors: {
    primary: { 500: '#1677ff' },
    success: { 500: '#52c41a' },
  },
}));

vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjs = (actual as any).default;
  const mockDayjs = (...args: any[]) => {
    const obj = dayjs(...args);
    return {
      ...obj,
      format: () => '2024-03-20 10:00',
      fromNow: () => '2 days ago',
    };
  };
  mockDayjs.extend = () => {};
  mockDayjs.utc = dayjs.utc;
  return { default: mockDayjs, __esModule: true };
});

const mockSchedules = [
  {
    id: 'sched-1',
    name: '平台核心服务',
    timezone: 'Asia/Shanghai',
    rotationType: 'weekly',
    rotationStartHour: 9,
    teamMembers: ['dev-001', 'dev-002'],
    startDate: '2024-03-01T09:00:00Z',
    escalations: [],
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-03-15T10:00:00Z',
  },
];

describe('OnCallManagement', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads schedules from API on mount', async () => {
    vi.spyOn(oncallApi, 'getSchedules').mockResolvedValue({
      data: { data: { schedules: mockSchedules } },
    } as any);
    vi.spyOn(oncallApi, 'getCurrentOnCall').mockResolvedValue({
      data: { data: { isOnCall: true, primaryUserId: 'dev-001' } },
    } as any);
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue({
      data: { data: { data: [] } },
    } as any);

    await act(async () => {
      render(React.createElement(await import('@/pages/OnCall').then((m) => m.default)));
    });

    await waitFor(() => {
      expect(oncallApi.getSchedules).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error message when getSchedules API fails', async () => {
    const errorMessage = 'Network Error';
    vi.spyOn(oncallApi, 'getSchedules').mockRejectedValue(new Error(errorMessage));
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue({
      data: { data: { data: [] } },
    } as any);

    await act(async () => {
      render(React.createElement(await import('@/pages/OnCall').then((m) => m.default)));
    });

    await waitFor(() => {
      expect(oncallApi.getSchedules).toHaveBeenCalledTimes(1);
    });

    const { message } = await import('antd');
    await waitFor(() => {
      expect(message.error).toHaveBeenCalled();
    });
  });
});
