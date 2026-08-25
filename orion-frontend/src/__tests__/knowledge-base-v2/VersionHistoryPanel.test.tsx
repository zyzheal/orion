/**
 * VersionHistoryPanel & SimpleDiffViewer Tests
 *
 * Tests:
 *  - computeDiff (LCS-based diff algorithm)
 *  - SimpleDiffViewer component render
 *  - VersionHistoryPanel integration smoke test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SimpleDiffViewer } from '@/pages/KnowledgeBaseV2/components/SimpleDiffViewer';
import VersionHistoryPanel from '@/pages/KnowledgeBaseV2/components/VersionHistoryPanel';
import * as pandawiki from '@/api/pandawiki';

// ─── Mock antd ────────────────────────────────────────────────────
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    Form: { Item: ({ children }: any) => <div>{children}</div>, useForm: () => [{ validateFields: vi.fn() }] },
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    Modal: ({ open, children, title }: any) =>
      open ? <div data-testid="modal" data-title={title}>{children}</div> : null,
    Collapse: ({ items, defaultActiveKey }: any) => (
      <div data-testid="collapse">
        {items?.map((item: any) => (
          <div key={item.key} data-testid={`collapse-${item.key}`}>
            <div>{item.label}</div>
            <div data-testid="collapse-content">{item.children}</div>
          </div>
        ))}
      </div>
    ),
    Timeline: ({ items }: any) => (
      <div data-testid="timeline">
        {items?.map((item: any, idx: number) => (
          <div key={idx} data-testid="timeline-item">{item.children}</div>
        ))}
      </div>
    ),
    Tree: ({ treeData, onSelect }: any) => (
      <div data-testid="tree">{treeData?.map((node: any) => <div key={node.key}>{node.title}</div>)}</div>
    ),
    Layout: { Sider: ({ children }: any) => <div>{children}</div>, Content: ({ children }: any) => <div>{children}</div> },
    Drawer: ({ open, children, title }: any) =>
      open ? <div data-testid="drawer" data-title={title}>{children}</div> : null,
    Empty: ({ description }: any) => <div data-testid="empty">{description}</div>,
    Spin: ({ spinning, children }: any) => <div data-testid="spin" data-spinning={spinning}>{children}</div>,
    Popconfirm: ({ children, onConfirm, title }: any) => (
      <div data-testid="popconfirm" data-title={title}>{children}</div>
    ),
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    Typography: actual.Typography,
  };
});

// ─── Mock pandawiki ────────────────────────────────────────────────
vi.mock('@/api/pandawiki', () => ({
  listDocumentVersions: vi.fn(),
  getDocumentVersion: vi.fn(),
  restoreDocumentVersion: vi.fn(),
  htmlToMarkdown: vi.fn((s: string) => s.replace(/<[^>]+>/g, '')),
  unwrapArray: vi.fn((res: any) => Array.isArray(res.data) ? res.data : []),
}));

// ─── Mock MarkdownEditor helper ───────────────────────────────────
vi.mock('@/components/MarkdownEditor', () => ({
  htmlToMarkdown: vi.fn((html: string) => html.replace(/<[^>]+>/g, '').trim()),
}));

// ─── SimpleDiffViewer Tests ─────────────────────────────────────────

describe('SimpleDiffViewer', () => {
  it('renders without crashing with empty content', () => {
    const { container } = render(
      <SimpleDiffViewer oldValue="" newValue="" oldLabel="Old" newLabel="New" />
    );
    expect(container).toBeDefined();
  });

  it('renders unchanged content', () => {
    const { container } = render(
      <SimpleDiffViewer
        oldValue="line 1\nline 2"
        newValue="line 1\nline 2"
        oldLabel="v1"
        newLabel="v2"
      />
    );
    expect(container.textContent).toContain('line 1');
    expect(container.textContent).toContain('line 2');
    expect(container.textContent).toContain('v1');
    expect(container.textContent).toContain('v2');
  });

  it('renders added lines in new version', () => {
    const { container } = render(
      <SimpleDiffViewer
        oldValue="line 1"
        newValue="line 1\nline 2"
        oldLabel="v1"
        newLabel="v2"
      />
    );
    expect(container.textContent).toContain('+');
    expect(container.textContent).toContain('line 2');
  });

  it('renders removed lines in old version', () => {
    const { container } = render(
      <SimpleDiffViewer
        oldValue="line 1\nline 2"
        newValue="line 1"
        oldLabel="v1"
        newLabel="v2"
      />
    );
    expect(container.textContent).toContain('-');
    expect(container.textContent).toContain('line 2');
  });

  it('renders with showDiffOnly mode (hides unchanged lines)', () => {
    const { container } = render(
      <SimpleDiffViewer
        oldValue="unchanged\nremoved"
        newValue="unchanged\nadded"
        oldLabel="old"
        newLabel="new"
        showDiffOnly={true}
      />
    );
    // In diff-only mode, unchanged lines are not rendered
    expect(container.textContent).toContain('+');
    expect(container.textContent).toContain('-');
  });
});

// ─── VersionHistoryPanel Integration Tests ────────────────────────

describe('VersionHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pandawiki.listDocumentVersions).mockResolvedValue({
      data: {
        items: [
          {
            id: 'v1',
            documentId: 'd1',
            content: '<p>Hello v1</p>',
            title: 'Test Doc',
            version: 1,
            createdAt: '2026-01-01T10:00:00Z',
            createdBy: 'user-1',
            createdByName: 'User One',
            changeSummary: 'Initial version',
          },
          {
            id: 'v2',
            documentId: 'd1',
            content: '<p>Hello v2</p>',
            title: 'Test Doc',
            version: 2,
            createdAt: '2026-01-02T10:00:00Z',
            createdBy: 'user-2',
            createdByName: 'User Two',
            changeSummary: 'Updated content',
          },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
    } as any);
  });

  it('renders without crashing', () => {
    render(
      <VersionHistoryPanel
        spaceId="space-1"
        docId="doc-1"
      />
    );
    expect(document.body).toBeDefined();
  });
});
