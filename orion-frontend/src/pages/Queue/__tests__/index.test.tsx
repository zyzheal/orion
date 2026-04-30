import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API - must be before other imports
vi.mock('@/api/queue', () => ({
  listJobs: vi.fn(),
  enqueueJob: vi.fn(),
  dequeueJob: vi.fn(),
  completeJob: vi.fn(),
  failJob: vi.fn(),
  getQueueStats: vi.fn(),
}));

// Mock antd components
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
      warning: vi.fn(),
      info: vi.fn(),
    },
    Card: ({ children, ...props }: any) => (
      <div data-testid="card" {...props}>{children}</div>
    ),
    Table: ({ dataSource, loading, ...props }: any) => (
      <div data-testid="table" data-loading={loading}>
        <div data-testid="row-count">{dataSource?.length || 0}</div>
      </div>
    ),
    Tag: ({ children, color, ...props }: any) => (
      <span data-testid="tag" data-color={color} {...props}>{children}</span>
    ),
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Space: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Select: ({ children, value, onChange, ...props }: any) => (
      <select data-testid="select" value={value} onChange={(e) => onChange?.(e.target.value)} {...props}>
        {children}
      </select>
    ),
    Form: Object.assign(
      ({ children, ...props }: any) => <form {...props}>{children}</form>,
      {
        Item: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        useForm: () => [
          {
            validateFields: vi.fn(),
            resetFields: vi.fn(),
            setFieldsValue: vi.fn(),
          },
        ],
      }
    ),
    Input: Object.assign(
      ({ ...props }: any) => <input {...props} />,
      { TextArea: ({ ...props }: any) => <textarea {...props} /> }
    ),
    Modal: ({ children, open, ...props }: any) =>
      open ? <div data-testid="modal">{children}</div> : null,
    Popconfirm: ({ children, onConfirm, ...props }: any) => (
      <div data-testid="popconfirm" {...props}>{children}</div>
    ),
    Drawer: ({ children, open, ...props }: any) =>
      open ? <div data-testid="drawer">{children}</div> : null,
    Descriptions: Object.assign(
      ({ children, ...props }: any) => <div {...props}>{children}</div>,
      { Item: ({ children, ...props }: any) => <div {...props}>{children}</div> }
    ),
    Tooltip: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Statistic: ({ children, value, ...props }: any) => (
      <div data-testid="statistic" data-value={value} {...props}>{children}</div>
    ),
    Row: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Col: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  };
});

// Mock dayjs
vi.mock('dayjs', () => {
  const mockDayjs = (v: any) => ({
    fromNow: () => '2 hours ago',
    format: (fmt: string) => '2024-03-20 10:30:00',
  });
  mockDayjs.extend = vi.fn();
  return { default: mockDayjs };
});

// Import mocked API
import * as queueApi from '@/api/queue';

describe('Queue Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads jobs from API on mount', async () => {
    const mockJobs = [
      {
        id: 'job-001',
        tenant_id: 'tenant-1',
        queue: 'pipeline-execution',
        payload: { pipelineId: 'pipe-101', action: 'build' },
        status: 'pending' as const,
        attempts: 0,
        created_at: '2024-03-20T10:30:00Z',
      },
      {
        id: 'job-002',
        tenant_id: 'tenant-1',
        queue: 'deployment',
        payload: { appId: 'orion-core', env: 'staging' },
        status: 'processing' as const,
        attempts: 1,
        created_at: '2024-03-20T10:25:00Z',
      },
    ];

    const mockStats = {
      pending: 5,
      processing: 2,
      completed: 100,
      failed: 3,
    };

    vi.mocked(queueApi.listJobs).mockResolvedValue({
      data: { data: { jobs: mockJobs, count: 2 } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    vi.mocked(queueApi.getQueueStats).mockResolvedValue({
      data: { data: mockStats },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    const QueueManagement = (await import('../index')).default;

    render(<QueueManagement />);

    await waitFor(() => {
      expect(queueApi.listJobs).toHaveBeenCalledWith({});
      expect(queueApi.getQueueStats).toHaveBeenCalled();
    });

    // Verify table rendered with correct data count
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('2');
  });

  it('shows error on API failure and sets empty jobs list', async () => {
    vi.mocked(queueApi.listJobs).mockRejectedValue(
      new Error('Network error')
    );
    vi.mocked(queueApi.getQueueStats).mockRejectedValue(
      new Error('Stats API unavailable')
    );

    const QueueManagement = (await import('../index')).default;

    render(<QueueManagement />);

    await waitFor(() => {
      expect(queueApi.listJobs).toHaveBeenCalled();
    });

    const { message } = await import('antd');
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(
        expect.stringContaining('加载任务数据失败')
      );
    });

    // Verify empty state (no mock data fallback)
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');
  });
});
