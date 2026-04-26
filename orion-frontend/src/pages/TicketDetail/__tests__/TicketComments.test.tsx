/**
 * TicketComments Component Tests
 * - Rendering comment list for TKT-001
 * - Display internal note badge
 * - Show @mentions as tags
 * - Render attachments section
 * - Input area for new comments
 * - Show both tabs (评论 / 内部备注)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TicketComments from '../TicketComments';

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

function renderComments(ticketId: string) {
  return render(<TicketComments ticketId={ticketId} />);
}

describe('TicketComments', () => {
  it('should render comment list for TKT-001', () => {
    renderComments('TKT-001');
    expect(screen.getByTestId('ticket-comments-section')).toBeInTheDocument();
    expect(screen.getByTestId('comment-list')).toBeInTheDocument();

    // Check that comments are rendered (default tab is 'comment')
    expect(screen.getByTestId('comment-C001')).toBeInTheDocument();
    expect(screen.getByTestId('comment-C003')).toBeInTheDocument();
  });

  it('should display comment content text', () => {
    renderComments('TKT-001');
    // Check content is rendered (use queryAllByText since author name appears in multiple places)
    const content = screen.getByTestId('comment-content-C001');
    expect(content.textContent).toContain('正在排查，初步判断是慢查询导致 CPU 飙升');
  });

  it('should show both tabs (评论 / 内部备注)', () => {
    renderComments('TKT-001');
    expect(screen.getByTestId('tab-comments')).toBeInTheDocument();
    expect(screen.getByTestId('tab-internal-notes')).toBeInTheDocument();
    expect(screen.getByText('评论')).toBeInTheDocument();
    expect(screen.getByText('内部备注')).toBeInTheDocument();
  });

  it('should display internal note badge when switching to internal-note tab', () => {
    renderComments('TKT-001');

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

  it('should show @mentions as tags in comment content', () => {
    renderComments('TKT-001');

    // C003 has @王磊 mention in its content
    const contentEl = screen.getByTestId('comment-content-C003');
    expect(contentEl.textContent).toContain('@王磊');

    // Check that the mention is rendered as a styled element (Tag)
    const mentionElements = contentEl.querySelectorAll('[data-testid^="mention-"]');
    expect(mentionElements.length).toBeGreaterThan(0);
  });

  it('should render attachments section', () => {
    renderComments('TKT-001');
    expect(screen.getByTestId('attachments-section')).toBeInTheDocument();

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

  it('should have input area for new comments', () => {
    renderComments('TKT-001');
    expect(screen.getByTestId('comment-input-area')).toBeInTheDocument();
    expect(screen.getByTestId('comment-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('submit-comment-btn')).toBeInTheDocument();
  });

  it('should render empty state for tickets without comments', () => {
    renderComments('TKT-003');
    expect(screen.getByTestId('ticket-comments-section')).toBeInTheDocument();
    expect(screen.getByText(/暂无评论/)).toBeInTheDocument();
  });

  it('should render attachments for TKT-002', () => {
    renderComments('TKT-002');
    expect(screen.getByTestId('attachments-section')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-A003')).toBeInTheDocument();
    expect(screen.getByText('error-trace.log')).toBeInTheDocument();
  });

  it('should show timestamps in comment items', () => {
    renderComments('TKT-001');
    // Check timestamps are displayed in comment items (format may vary by timezone)
    const commentC001 = screen.getByTestId('comment-C001');
    expect(commentC001.textContent).toMatch(/04-13/);

    const commentC003 = screen.getByTestId('comment-C003');
    expect(commentC003.textContent).toMatch(/04-13/);
  });

  it('should not show attachments section for tickets without attachments', () => {
    renderComments('TKT-003');
    const section = screen.queryByTestId('attachments-section');
    expect(section).not.toBeInTheDocument();
  });
});
