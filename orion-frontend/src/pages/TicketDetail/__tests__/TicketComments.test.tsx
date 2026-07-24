/**
 * TicketComments Component Tests
 * - Rendering comment list for TKT-001
 * - Display internal note badge
 * - Show @mentions as tags
 * - Render attachments section
 * - Input area for new comments
 * - Show both tabs (评论 / 内部备注)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TicketComments from '../TicketComments';
import * as ticketingApi from '@/api/ticketing';
import * as usersApi from '@/api/users';

// Mock antd message to avoid console noise
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      loading: vi.fn(),
    },
  };
});

vi.mock('@/api/ticketing');
vi.mock('@/api/users');

const mockComments = [
  {
    id: 'C001',
    ticketId: 'TKT-001',
    author: '张伟',
    content: '正在排查，初步判断是慢查询导致 CPU 飙升',
    type: 'comment' as const,
    createdAt: '2024-04-13T10:30:00Z',
    mentions: [],
  },
  {
    id: 'C002',
    ticketId: 'TKT-001',
    author: '李娜',
    content: '已经添加了索引，需要观察一下效果',
    type: 'internal-note' as const,
    createdAt: '2024-04-13T11:00:00Z',
    mentions: [],
  },
  {
    id: 'C003',
    ticketId: 'TKT-001',
    author: '王磊',
    content: '同意 @李娜 的方案，我先监控 QPS 变化',
    type: 'comment' as const,
    createdAt: '2024-04-13T11:15:00Z',
    mentions: ['李娜'],
  },
];

const mockAttachments = [
  {
    id: 'A001',
    ticketId: 'TKT-001',
    name: 'cpu-graph.png',
    size: '2.3 MB',
    type: 'image/png',
    uploadedBy: '张伟',
    uploadedAt: '2024-04-13T10:35:00Z',
    url: 'https://example.com/cpu-graph.png',
  },
  {
    id: 'A002',
    ticketId: 'TKT-001',
    name: 'slow-query.log',
    size: '156 KB',
    type: 'text/x-log',
    uploadedBy: '张伟',
    uploadedAt: '2024-04-13T10:36:00Z',
    url: 'https://example.com/slow-query.log',
  },
];

const mockAttachmentsTKT002 = [
  {
    id: 'A003',
    ticketId: 'TKT-002',
    name: 'error-trace.log',
    size: '89 KB',
    type: 'text/x-log',
    uploadedBy: '赵强',
    uploadedAt: '2024-04-13T14:20:00Z',
    url: 'https://example.com/error-trace.log',
  },
];

const mockEngineers = [
  { id: '1', name: '张伟', username: 'zhangwei', email: 'zhangwei@example.com', role: 'engineer', status: 'active', availability: 'available', avatar_url: null, last_login_at: null, last_login_ip: null, settings: {}, created_at: '', updated_at: '', created_by: null },
  { id: '2', name: '李娜', username: 'lina', email: 'lina@example.com', role: 'engineer', status: 'active', availability: 'busy', avatar_url: null, last_login_at: null, last_login_ip: null, settings: {}, created_at: '', updated_at: '', created_by: null },
  { id: '3', name: '王磊', username: 'wanglei', email: 'wanglei@example.com', role: 'engineer', status: 'active', availability: 'away', avatar_url: null, last_login_at: null, last_login_ip: null, settings: {}, created_at: '', updated_at: '', created_by: null },
] as any[];

beforeEach(() => {
  vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: [] } } as any);
  vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: [] } } as any);
  vi.mocked(usersApi.listUsers).mockResolvedValue({ data: { data: mockEngineers } } as any);
});

function renderComments(ticketId: string) {
  return render(<TicketComments ticketId={ticketId} />);
}

describe('TicketComments', () => {
  it('should render comment list for TKT-001', async () => {
    vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: mockComments } } as any);
    vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: mockAttachments } } as any);
    renderComments('TKT-001');
    expect(screen.getByTestId('ticket-comments-section')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('comment-C001')).toBeInTheDocument();
    });
    expect(screen.getByTestId('comment-C003')).toBeInTheDocument();
  });

  it('should display comment content text', async () => {
    vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: mockComments } } as any);
    vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: mockAttachments } } as any);
    renderComments('TKT-001');
    await waitFor(() => {
      const content = screen.getByTestId('comment-content-C001');
      expect(content.textContent).toContain('正在排查，初步判断是慢查询导致 CPU 飙升');
    });
  });

  it('should show both tabs (评论 / 内部备注)', async () => {
    vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: mockComments } } as any);
    vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: mockAttachments } } as any);
    renderComments('TKT-001');
    await waitFor(() => {
      expect(screen.getByTestId('tab-comments')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tab-internal-notes')).toBeInTheDocument();
    expect(screen.queryByText('评论', { selector: 'span' })).toBeInTheDocument();
    // The tab label contains the text inside a span
    const tabInternal = screen.getByTestId('tab-internal-notes');
    expect(tabInternal).toBeInTheDocument();
  });

  it('should display internal note badge when switching to internal-note tab', async () => {
    vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: mockComments } } as any);
    vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: mockAttachments } } as any);
    renderComments('TKT-001');

    await waitFor(() => {
      expect(screen.getByTestId('comment-C002')).toBeInTheDocument();
    });

    // Find the internal-note tab and click it
    const internalTab = screen.getByTestId('tab-internal-notes').closest('[role="tab"]');
    if (internalTab) {
      fireEvent.click(internalTab);
    }

    // After switching, internal note comment should be visible
    expect(screen.getByTestId('comment-C002')).toBeInTheDocument();

    // Check the internal note badge
    const badge = screen.getByTestId('internal-badge-C002');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('内部备注');
  });

  it('should show @mentions as tags in comment content', async () => {
    vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: mockComments } } as any);
    vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: mockAttachments } } as any);
    renderComments('TKT-001');

    await waitFor(() => {
      const contentEl = screen.getByTestId('comment-content-C003');
      expect(contentEl.textContent).toContain('@李娜');
      const mentionElements = contentEl.querySelectorAll('[data-testid^="mention-"]');
      expect(mentionElements.length).toBeGreaterThan(0);
    });
  });

  it('should render attachments section', async () => {
    vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: mockComments } } as any);
    vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: mockAttachments } } as any);
    renderComments('TKT-001');
    await waitFor(() => {
      expect(screen.getByTestId('attachments-section')).toBeInTheDocument();
    });

    // Check attachment items
    expect(screen.getByTestId('attachment-A001')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-A002')).toBeInTheDocument();

    // Check file names
    expect(screen.getByText('cpu-graph.png')).toBeInTheDocument();
    expect(screen.getByText('slow-query.log')).toBeInTheDocument();

    // Check file sizes
    expect(screen.getByText('2.3 MB')).toBeInTheDocument();
    expect(screen.getByText('156 KB')).toBeInTheDocument();
  });

  it('should have input area for new comments', async () => {
    vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: mockComments } } as any);
    vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: mockAttachments } } as any);
    renderComments('TKT-001');
    await waitFor(() => {
      expect(screen.getByTestId('comment-input-area')).toBeInTheDocument();
    });
    expect(screen.getByTestId('comment-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('submit-comment-btn')).toBeInTheDocument();
  });

  it('should render empty state for tickets without comments', async () => {
    renderComments('TKT-003');
    await waitFor(() => {
      expect(screen.getByText(/暂无评论/)).toBeInTheDocument();
    });
  });

  it('should render attachments for TKT-002', async () => {
    vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: [] } } as any);
    vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: mockAttachmentsTKT002 } } as any);
    renderComments('TKT-002');
    await waitFor(() => {
      expect(screen.getByTestId('attachments-section')).toBeInTheDocument();
    });
    expect(screen.getByTestId('attachment-A003')).toBeInTheDocument();
    expect(screen.getByText('error-trace.log')).toBeInTheDocument();
  });

  it('should show timestamps in comment items', async () => {
    vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: mockComments } } as any);
    vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: mockAttachments } } as any);
    renderComments('TKT-001');
    await waitFor(() => {
      const commentC001 = screen.getByTestId('comment-C001');
      expect(commentC001.textContent).toMatch(/04-13/);
      const commentC003 = screen.getByTestId('comment-C003');
      expect(commentC003.textContent).toMatch(/04-13/);
    });
  });

  it('should not show attachments section for tickets without attachments', async () => {
    renderComments('TKT-003');
    await waitFor(() => {
      const section = screen.queryByTestId('attachments-section');
      expect(section).not.toBeInTheDocument();
    });
  });
});
