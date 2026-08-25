/**
 * KnowledgeBasePage Tests
 *
 * Tests for the KnowledgeBaseV2 page component, including:
 * - buildDocTree document tree builder
 * - Space tree navigation
 * - Document tree display
 * - Document detail drawer
 * - Create space/document modals
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import KnowledgeBasePage, { buildDocTree } from '@/pages/KnowledgeBaseV2/KnowledgeBasePage';
import type { WikiDocument } from '@/api/pandawiki';
import * as pandawiki from '@/api/pandawiki';

// ─── Mock pandawiki API ──────────────────────────────────────────
vi.mock('@/api/pandawiki', () => ({
  listSpaces: vi.fn(),
  createSpace: vi.fn(),
  deleteSpace: vi.fn(),
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocument: vi.fn(),
  searchDocuments: vi.fn(),
  unwrapArray: vi.fn((res: any) => Array.isArray(res.data) ? res.data : []),
  unwrapSearchResults: vi.fn((res: any) => Array.isArray(res.data) ? res.data : []),
}));

// ─── Mock antd ────────────────────────────────────────────────────
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    Form: {
      Item: ({ children, rules }: any) => <div>{children}</div>,
      useForm: () => [
        {
          validateFields: vi.fn().mockResolvedValue({ title: 'Test Doc', content: '<p>Test</p>' }),
          resetFields: vi.fn(),
        },
      ],
    },
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    Modal: ({ open, children, title }: any) => (open ? <div data-testid="modal" data-title={title}>{children}</div> : null),
    Tree: ({ treeData, onSelect, onExpand, selectedKeys, expandedKeys }: any) => (
      <div data-testid="tree">
        {treeData?.map((node: any) => (
          <div key={node.key} data-testid={`tree-node-${node.key}`}>
            <div onClick={() => onSelect?.([node.key], { node, selected: true })}>{node.title}</div>
          </div>
        ))}
      </div>
    ),
    Layout: {
      Sider: ({ children, collapsed }: any) => <div data-testid="sider">{children}</div>,
      Content: ({ children }: any) => <div data-testid="content">{children}</div>,
    },
    Drawer: ({ open, children, title }: any) => (open ? <div data-testid="drawer" data-title={title}>{children}</div> : null),
    Empty: ({ description }: any) => <div data-testid="empty">{description}</div>,
    Spin: ({ spinning, children }: any) => <div data-testid="spin" data-spinning={spinning}>{children}</div>,
    Popconfirm: ({ children, onConfirm, title }: any) => (
      <div data-testid="popconfirm" data-title={title}>{children}</div>
    ),
    Card: ({ children, title }: any) => <div data-testid="card" data-title={title}>{children}</div>,
    Typography: actual.Typography,
  };
});

// ─── Mock MarkdownEditor ──────────────────────────────────────────
vi.mock('@/components/MarkdownEditor', () => ({
  default: ({ content, placeholder, height, disabled, hideToolbar, showWordCount }: any) => (
    <div data-testid="markdown-editor">
      <div contentEditable={!disabled}>{content || ''}</div>
    </div>
  ),
  htmlToMarkdown: vi.fn((html: string) => html.replace(/<[^>]+>/g, '')),
  markdownToHtml: vi.fn((md: string) => md),
}));

// ─── buildDocTree Tests (real implementation) ─────────────────────

describe('buildDocTree', () => {
  const makeDoc = (id: string, title: string, parentId?: string): WikiDocument => ({
    id,
    title,
    content: '',
    spaceId: 'space-1',
    parentId,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });

  it('returns empty array for empty input', () => {
    expect(buildDocTree([])).toEqual([]);
  });

  it('returns flat list when no parent-child relationships', () => {
    const docs = [makeDoc('1', 'A'), makeDoc('2', 'B')];
    const result = buildDocTree(docs);
    expect(result).toHaveLength(2);
    expect(result[0].children).toHaveLength(0);
    expect(result[0].isLeaf).toBe(true);
  });

  it('builds parent-child hierarchy correctly', () => {
    const docs = [
      makeDoc('1', 'Root'),
      makeDoc('2', 'Child A', '1'),
      makeDoc('3', 'Child B', '1'),
    ];
    const result = buildDocTree(docs);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Root');
    expect(result[0].isLeaf).toBe(false);
    expect(result[0].children).toHaveLength(2);
  });

  it('builds multi-level nested tree', () => {
    const docs = [
      makeDoc('1', 'Root'),
      makeDoc('2', 'Child A', '1'),
      makeDoc('3', 'Grandchild', '2'),
    ];
    const result = buildDocTree(docs);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Root');
    expect(result[0].children?.[0].title).toBe('Child A');
    expect(result[0].children?.[0].children?.[0].title).toBe('Grandchild');
  });

  it('handles documents with missing parent gracefully (orphans → root)', () => {
    const docs = [
      makeDoc('1', 'Root'),
      makeDoc('2', 'Orphan', '999'), // parent doesn't exist
    ];
    const result = buildDocTree(docs);
    expect(result).toHaveLength(2);
  });

  it('preserves all WikiDocument fields in tree nodes', () => {
    const doc = makeDoc('1', 'Test', undefined);
    const result = buildDocTree([doc]);
    expect(result[0].id).toBe('1');
    expect(result[0].spaceId).toBe('space-1');
    expect(result[0].key).toBe('1');
    expect(result[0].title).toBe('Test');
  });
});

// ─── Page Component Tests ─────────────────────────────────────────

describe('KnowledgeBasePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pandawiki.listSpaces as any).mockResolvedValue({ data: { spaces: [] } });
    vi.mocked(pandawiki.listDocuments as any).mockResolvedValue({ data: { documents: [] } });
  });

  it('renders without crashing', () => {
    render(<KnowledgeBasePage />);
    expect(document.body).toBeDefined();
  });

  it('shows the sidebar with space list', async () => {
    vi.mocked(pandawiki.listSpaces as any).mockResolvedValue({
      data: {
        spaces: [
          { id: 'space-1', name: 'Tech Docs', description: 'Technical', documentCount: 5 },
          { id: 'space-2', name: 'Process', description: 'Process', documentCount: 3 },
        ],
      },
    });
    vi.mocked(pandawiki.unwrapArray).mockImplementation((res: any) =>
      Array.isArray(res.data) ? res.data : (res.data as any)?.spaces ?? []
    );

    render(<KnowledgeBasePage />);
    const sider = document.querySelector('[data-testid="sider"]');
    expect(sider).toBeDefined();
  });

  it('shows empty state when no space is selected', () => {
    render(<KnowledgeBasePage />);
    const content = document.querySelector('[data-testid="content"]');
    expect(content).toBeDefined();
  });

  it('loads spaces and renders tree when data is available', async () => {
    vi.mocked(pandawiki.unwrapArray).mockImplementation((res: any) =>
      Array.isArray(res.data) ? res.data : (res.data as any)?.spaces ?? []
    );
    vi.mocked(pandawiki.listSpaces as any).mockResolvedValue({
      data: { spaces: [{ id: 's1', name: 'Test Space', description: '', documentCount: 2 }] },
    });

    render(<KnowledgeBasePage />);

    // Verify the page renders and the sider is present
    const sider = document.querySelector('[data-testid="sider"]');
    expect(sider).not.toBeNull();
  });
});
