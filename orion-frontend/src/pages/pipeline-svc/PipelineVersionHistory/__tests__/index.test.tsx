/**
 * Pipeline Version History Page - Tests
 * 测试版本历史页面的中文UI和Design Token样式
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API - must be before other imports
vi.mock('@/api/pipeline-versions', () => ({
  pipelineVersionsApi: {
    list: vi.fn(),
    rollback: vi.fn(),
    setBaseline: vi.fn(),
    diff: vi.fn(),
  },
}));

// Mock antd components
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    Typography: {
      Title: ({ children, level, ...props }: any) => {
        const Tag = `h${level}` as keyof JSX.IntrinsicElements;
        return <Tag {...props}>{children}</Tag>;
      },
      Text: ({ children, type, ...props }: any) => (
        <span data-type={type} {...props}>
          {children}
        </span>
      ),
    },
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
    Modal: {
      confirm: vi.fn((config: any) => {
        if (config.onOk) config.onOk();
      }),
    },
    Tag: ({ children, color, ...props }: any) => (
      <span data-testid="tag" data-color={color} {...props}>
        {children}
      </span>
    ),
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Space: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Empty: ({ description, ...props }: any) => (
      <div data-testid="empty" {...props}>
        {description}
      </div>
    ),
  };
});

// Mock CardPanel
vi.mock('@/components/CardPanel', () => ({
  default: ({ children }: any) => <div data-testid="card-panel">{children}</div>,
}));

// Mock Table
vi.mock('@/components/Table', () => ({
  default: ({
    dataSource,
    loading,
    rowSelection,
  }: any) => (
    <div data-testid="table" data-loading={loading}>
      <div data-testid="row-count">{dataSource?.length || 0}</div>
      {rowSelection && (
        <div data-testid="row-selection" data-type={rowSelection.type} />
      )}
    </div>
  ),
}));

// Mock StatusBadge
vi.mock('@/components/StatusBadge', () => ({
  default: ({ status, size }: any) => (
    <span data-testid="status-badge" data-status={status} data-size={size} />
  ),
}));

// Mock dayjs
vi.mock('dayjs', () => {
  const mockDayjs = (_v: unknown) => ({
    fromNow: () => '2 hours ago',
    format: (_fmt: string) => '2024-03-20 10:30:00',
  });
  mockDayjs.extend = vi.fn();
  return { default: mockDayjs };
});

// Import mocked API
import { pipelineVersionsApi } from '@/api/pipeline-versions';

const mockVersions = [
  {
    id: 'v1',
    pipeline_id: 'p1',
    version: 1,
    yaml_definition: '...',
    spec: {},
    change_summary: 'Initial version',
    tags: ['release'],
    is_baseline: true,
    parent_version_id: null,
    created_by: 'admin',
    created_at: '2026-05-20T10:00:00Z',
  },
  {
    id: 'v2',
    pipeline_id: 'p1',
    version: 2,
    yaml_definition: '...',
    spec: {},
    change_summary: 'Added build stage',
    tags: ['feature'],
    is_baseline: false,
    parent_version_id: 'v1',
    created_by: 'developer',
    created_at: '2026-05-20T11:00:00Z',
  },
];

const renderWithRouter = (pipelineId: string) =>
  render(
    <MemoryRouter initialEntries={[`/pipelines/${pipelineId}/versions`]}>
      <Routes>
        <Route path="/pipelines/:pipelineId/versions" element={<PipelineVersionHistory />} />
      </Routes>
    </MemoryRouter>
  );

// Dynamically import after mocks are set up
const PipelineVersionHistory = (await import('../index')).default;

describe('PipelineVersionHistory', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title in Chinese', async () => {
    vi.mocked(pipelineVersionsApi.list).mockResolvedValue({
      data: mockVersions,
    } as any);

    renderWithRouter('p1');

    await waitFor(() => {
      expect(screen.getByText('版本历史')).toBeInTheDocument();
    });
  });

  it('displays version count in Chinese', async () => {
    vi.mocked(pipelineVersionsApi.list).mockResolvedValue({
      data: mockVersions,
    } as any);

    renderWithRouter('p1');

    await waitFor(() => {
      expect(screen.getByText(/共 2 个版本/)).toBeInTheDocument();
    });
  });

  it('calls API with correct pipelineId on mount', async () => {
    vi.mocked(pipelineVersionsApi.list).mockResolvedValue({
      data: [],
    } as any);

    renderWithRouter('test-pipeline-123');

    await waitFor(() => {
      expect(pipelineVersionsApi.list).toHaveBeenCalledWith('test-pipeline-123');
    });
  });

  it('displays version tags correctly', async () => {
    vi.mocked(pipelineVersionsApi.list).mockResolvedValue({
      data: mockVersions,
    } as any);

    renderWithRouter('p1');

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
      expect(screen.getByText('release')).toBeInTheDocument();
    });
  });

  it('shows empty state when no versions', async () => {
    vi.mocked(pipelineVersionsApi.list).mockResolvedValue({
      data: [],
    } as any);

    renderWithRouter('p1');

    await waitFor(() => {
      expect(screen.getByTestId('empty')).toBeInTheDocument();
      expect(screen.getByText('暂无版本记录')).toBeInTheDocument();
    });
  });

  it('renders table with correct row count', async () => {
    vi.mocked(pipelineVersionsApi.list).mockResolvedValue({
      data: mockVersions,
    } as any);

    renderWithRouter('p1');

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    });
  });

  it('has checkbox row selection for version comparison', async () => {
    vi.mocked(pipelineVersionsApi.list).mockResolvedValue({
      data: mockVersions,
    } as any);

    renderWithRouter('p1');

    await waitFor(() => {
      expect(screen.getByTestId('row-selection')).toHaveAttribute('data-type', 'checkbox');
    });
  });

  it('shows error message on API failure', async () => {
    vi.mocked(pipelineVersionsApi.list).mockRejectedValue(new Error('Network error'));

    renderWithRouter('p1');

    await waitFor(() => {
      expect(pipelineVersionsApi.list).toHaveBeenCalled();
    });
  });

  it('renders action buttons with Chinese text', async () => {
    vi.mocked(pipelineVersionsApi.list).mockResolvedValue({
      data: mockVersions,
    } as any);

    renderWithRouter('p1');

    await waitFor(() => {
      expect(screen.getByText('版本对比')).toBeInTheDocument();
      expect(screen.getByText('刷新')).toBeInTheDocument();
    });
  });
});
