import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as approvalApi from '@/api/approvals';

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
        <div key={item[rowKey]} data-testid="approval-row">
          {item.title}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/tokens/colors', () => ({
  colors: {
    neutral: { 200: '#ddd', 300: '#bbb', 400: '#999' },
    primary: { 500: '#1677ff' },
    success: { 500: '#52c41a' },
    error: { 400: '#ff4d4f' },
  },
}));

vi.mock('@/api/approvals', () => ({
  getApprovals: vi.fn(),
  getApproval: vi.fn(),
  createApproval: vi.fn(),
  approveApproval: vi.fn(),
  rejectApproval: vi.fn(),
}));

vi.mock('dayjs', () => {
  const fakeDayjs = (_date: any) => ({
    fromNow: () => '2 days ago',
    format: () => '2024-03-20 10:00:00',
  });
  fakeDayjs.extend = () => fakeDayjs;
  return { default: fakeDayjs };
});

vi.mock('@/components/PageSkeleton', () => ({
  default: () => <div data-testid="page-skeleton">Loading...</div>,
}));

describe('Approvals Page', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads approvals from API on mount', async () => {
    const mockApprovals = {
      approvals: [
        {
          id: 'appr-1',
          title: '生产环境部署审批',
          description: '测试描述',
          requesterId: 'dev-001',
          approverIds: ['tech-lead', 'ops-manager'],
          status: 'pending' as const,
          approvals: ['tech-lead'],
          rejections: [],
          requiredApprovals: 2,
          createdAt: '2024-03-20T10:00:00Z',
          updatedAt: '2024-03-20T14:00:00Z',
          metadata: { resourceType: 'deployment' },
        },
        {
          id: 'appr-2',
          title: '数据库结构变更审批',
          description: '测试描述2',
          requesterId: 'dev-002',
          approverIds: ['dba-lead'],
          status: 'approved' as const,
          approvals: ['dba-lead'],
          rejections: [],
          requiredApprovals: 1,
          createdAt: '2024-03-19T08:00:00Z',
          updatedAt: '2024-03-19T08:00:00Z',
        },
      ],
    };

    vi.mocked(approvalApi.getApprovals).mockResolvedValue({
      data: { code: 200, message: 'success', data: mockApprovals } as any,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    const ApprovalManagement = (await import('../index')).default;

    await act(async () => {
      render(<ApprovalManagement />);
    });

    await waitFor(() => {
      expect(approvalApi.getApprovals).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(approvalApi.getApprovals).mockRejectedValue(new Error('Network error'));

    const ApprovalManagement = (await import('../index')).default;

    await act(async () => {
      render(<ApprovalManagement />);
    });

    await waitFor(() => {
      expect(approvalApi.getApprovals).toHaveBeenCalled();
    });

    const { message } = await import('antd');
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(expect.stringContaining('加载审批数据失败'));
    });
  });
});
