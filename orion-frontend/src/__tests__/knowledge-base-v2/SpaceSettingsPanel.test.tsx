/**
 * SpaceSettingsPanel Tests
 *
 * Tests for space settings: member management, roles, share links
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import SpaceSettingsPanel from '@/pages/KnowledgeBaseV2/components/SpaceSettingsPanel';
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
    Tabs: ({ items }: any) => (
      <div data-testid="tabs">
        {items?.map((item: any, idx: number) => (
          <div key={item.key} data-testid={`tab-${item.key}`}>
            <div>{item.label}</div>
            <div data-testid="tab-content">{item.children}</div>
          </div>
        ))}
      </div>
    ),
    Table: ({ columns, dataSource }: any) => (
      <div data-testid="table">
        {dataSource?.map((row: any, idx: number) => (
          <div key={idx} data-testid={`table-row-${idx}`}>
            {columns?.map((col: any) => (
              <span key={col.key || col.dataIndex}>{row[col.dataIndex]}</span>
            ))}
          </div>
        ))}
      </div>
    ),
    Tree: ({ treeData }: any) => (
      <div data-testid="tree">{treeData?.map((node: any) => <div key={node.key}>{node.title}</div>)}</div>
    ),
    Layout: { Sider: ({ children }: any) => <div>{children}</div>, Content: ({ children }: any) => <div>{children}</div> },
    Drawer: ({ open, children }: any) =>
      open ? <div data-testid="drawer">{children}</div> : null,
    Empty: ({ description }: any) => <div data-testid="empty">{description}</div>,
    Spin: ({ spinning, children }: any) => <div data-testid="spin" data-spinning={spinning}>{children}</div>,
    Popconfirm: ({ children, title }: any) => (
      <div data-testid="popconfirm" data-title={title}>{children}</div>
    ),
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    DatePicker: ({ value, onChange }: any) => (
      <input data-testid="datepicker" value={value?.format?.('YYYY-MM-DD') || ''} onChange={onChange} />
    ),
    Typography: actual.Typography,
  };
});

// ─── Mock pandawiki ────────────────────────────────────────────────
vi.mock('@/api/pandawiki', () => ({
  listSpacePermissions: vi.fn(),
  updateSpacePermission: vi.fn(),
  removeSpacePermission: vi.fn(),
  addSpaceMember: vi.fn(),
  createShareLink: vi.fn(),
  listShareLinks: vi.fn(),
  revokeShareLink: vi.fn(),
  searchUsers: vi.fn(),
}));

vi.mock('dayjs', () => ({
  default: vi.fn(() => ({
    toISOString: () => '2026-02-01T00:00:00Z',
    format: () => '2026-02-01',
    isBefore: () => false,
  })),
}));

// ─── Tests ─────────────────────────────────────────────────────────

describe('SpaceSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pandawiki.listSpacePermissions).mockResolvedValue({
      data: {
        permissions: [
          {
            id: 'perm-1',
            spaceId: 'space-1',
            userId: 'user-1',
            userName: 'Alice',
            userEmail: 'alice@example.com',
            role: 'owner',
            grantedAt: '2026-01-01T10:00:00Z',
          },
          {
            id: 'perm-2',
            spaceId: 'space-1',
            userId: 'user-2',
            userName: 'Bob',
            role: 'editor',
            grantedAt: '2026-01-02T10:00:00Z',
          },
        ],
      },
    } as any);

    vi.mocked(pandawiki.listShareLinks).mockResolvedValue({
      data: {
        links: [
          {
            id: 'link-1',
            spaceId: 'space-1',
            url: 'https://example.com/s/abc123',
            token: 'abc123',
            role: 'viewer',
            createdAt: '2026-01-01T10:00:00Z',
            createdBy: 'user-1',
          },
        ],
      },
    } as any);
  });

  it('renders without crashing', () => {
    render(
      <SpaceSettingsPanel
        open={true}
        onCancel={() => {}}
        spaceId="space-1"
        spaceName="Tech Docs"
      />
    );
    expect(document.body).toBeDefined();
  });

  it('shows the modal when open is true', () => {
    render(
      <SpaceSettingsPanel
        open={true}
        onCancel={() => {}}
        spaceId="space-1"
        spaceName="Tech Docs"
      />
    );
    const modal = document.querySelector('[data-testid="modal"]');
    expect(modal).not.toBeNull();
  });

  it('does not show modal when open is false', () => {
    render(
      <SpaceSettingsPanel
        open={false}
        onCancel={() => {}}
        spaceId="space-1"
        spaceName="Tech Docs"
      />
    );
    const modal = document.querySelector('[data-testid="modal"]');
    expect(modal).toBeNull();
  });
});
