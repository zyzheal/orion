import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API - must be before other imports
vi.mock('@/api/artifactVersions', () => ({
  getArtifactVersions: vi.fn(),
  getTraceabilityChain: vi.fn(),
  getVersionDiff: vi.fn(),
  deployVersion: vi.fn(),
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
    },
    Card: ({ children, ...props }: any) => (
      <div data-testid="card" {...props}>
        {children}
      </div>
    ),
    Drawer: ({ children, open }: any) => (open ? <div data-testid="drawer">{children}</div> : null),
    Modal: ({ children, open }: any) => (open ? <div data-testid="modal">{children}</div> : null),
    Tag: ({ children, color, ...props }: any) => (
      <span data-testid="tag" data-color={color} {...props}>
        {children}
      </span>
    ),
    Form: Object.assign(
      ({ children, ...restProps }: any) => <form {...restProps}>{children}</form>,
      {
        Item: ({ children, ...restProps }: any) => <div {...restProps}>{children}</div>,
        useForm: () => [
          {
            validateFields: vi.fn(),
            resetFields: vi.fn(),
            setFieldsValue: vi.fn(),
            submit: vi.fn(),
          },
        ],
      }
    ),
    Select: ({ children, ...restProps }: any) => <select {...restProps}>{children}</select>,
    Input: Object.assign(({ ...props }: any) => <input {...props} />, {
      TextArea: ({ ...props }: any) => <textarea {...props} />,
    }),
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Space: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    DatePicker: Object.assign(
      ({ ...props }: any) => <input {...props} />,
      {
        RangePicker: ({ ...props }: any) => <input {...props} />,
      }
    ),
    Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
    Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Descriptions: Object.assign(
      ({ children, ...restProps }: any) => <div {...restProps}>{children}</div>,
      {
        Item: ({ children, ...restProps }: any) => <div {...restProps}>{children}</div>,
      }
    ),
    Divider: ({ ...props }: any) => <div {...props} />,
    Empty: Object.assign(
      ({ description }: any) => <div data-testid="empty">{description}</div>,
      { PRESENTED_IMAGE_SIMPLE: null }
    ),
  };
});

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, loading, pagination, rowSelection, onPaginationChange }: any) => (
    <div data-testid="version-table" data-loading={loading}>
      <div data-testid="row-count">{dataSource?.length || 0}</div>
      <div data-testid="total">{pagination?.total}</div>
      {rowSelection && <div data-testid="row-selection-enabled" />}
      <button
        data-testid="pagination-btn"
        onClick={() => onPaginationChange?.(2, 10)}
      >
        Next Page
      </button>
    </div>
  ),
}));

// Import mocked API
import * as artifactVersionApi from '@/api/artifactVersions';

// Import components for testing
import VersionTable from '../VersionTable';
import TraceabilityChainView from '../TraceabilityChainView';
import VersionCompareDrawer from '../VersionCompareDrawer';
import DeployVersionModal from '../DeployVersionModal';

describe('ArtifactBrowser Page', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header and version table', async () => {
    vi.mocked(artifactVersionApi.getArtifactVersions).mockRejectedValue(new Error('API not available'));

    const ArtifactBrowser = (await import('../index')).default;

    render(<ArtifactBrowser />);

    // Verify page title is rendered
    await waitFor(() => {
      const title = screen.getByText('制品版本浏览器');
      expect(title).toBeTruthy();
    });

    // Verify table is rendered (even with mock fallback data)
    await waitFor(() => {
      const table = screen.getByTestId('version-table');
      expect(table).toBeTruthy();
    });
  });

  it('shows empty table on API failure (no mock fallback)', async () => {
    vi.mocked(artifactVersionApi.getArtifactVersions).mockRejectedValue(new Error('API error'));

    const ArtifactBrowser = (await import('../index')).default;

    render(<ArtifactBrowser />);

    // API failure → table renders with 0 rows (mock fallback removed)
    await waitFor(() => {
      const rowCount = screen.getByTestId('row-count');
      expect(rowCount.textContent).toBe('0');
    });
  });
});

describe('VersionTable Component', { timeout: 15000 }, () => {
  it('renders with row selection enabled', () => {
    render(
      <VersionTable
        dataSource={[]}
        loading={false}
        currentPage={1}
        pageSize={10}
        total={0}
        onViewTraceability={vi.fn()}
        onDeploy={vi.fn()}
        onCompare={vi.fn()}
        onFilter={vi.fn()}
        onPaginationChange={vi.fn()}
        pipelineOptions={[]}
      />
    );

    expect(screen.getByTestId('row-selection-enabled')).toBeTruthy();
  });
});

describe('TraceabilityChainView Component', { timeout: 15000 }, () => {
  it('renders without crashing when chain is null', () => {
    render(<TraceabilityChainView chain={null} loading={false} />);

    expect(screen.getByText('暂无追溯数据')).toBeTruthy();
  });

  it('renders chain data when provided', () => {
    const mockChain = {
      version: {
        id: 'av-001',
        tenantId: 'tenant-1',
        pipelineId: 'pipe-001',
        runId: 'run-0001',
        stageName: 'build',
        artifactName: 'orion-core.jar',
        version: '1.0.0',
        commitSha: 'abc00000def000',
        branch: 'main',
        metadata: {},
        storagePath: '/artifacts/orion-core.jar',
        createdAt: '2024-03-20T10:00:00Z',
      },
      pipelineRun: {
        id: 'run-0001',
        pipelineId: 'pipe-001',
        triggerType: 'git',
        status: 'success',
        startedAt: '2024-03-20T10:00:00Z',
        completedAt: '2024-03-20T10:05:00Z',
      },
      deployments: [
        {
          id: 'deploy-1',
          environment: 'staging',
          status: 'success',
          deployedAt: '2024-03-20T10:10:00Z',
          deployedBy: 'ci-bot',
        },
      ],
    };

    render(<TraceabilityChainView chain={mockChain as any} loading={false} />);

    expect(screen.getAllByText(/orion-core.jar/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1.0.0/).length).toBeGreaterThan(0);
  });
});

describe('VersionCompareDrawer Component', { timeout: 15000 }, () => {
  it('shows empty state when no versions selected', () => {
    render(
      <VersionCompareDrawer
        open
        onClose={vi.fn()}
        versionA={null}
        versionB={null}
        diff={null}
        loading={false}
      />
    );

    expect(screen.getByTestId('empty')).toBeTruthy();
  });
});

describe('DeployVersionModal Component', { timeout: 15000 }, () => {
  it('renders when open', () => {
    const mockVersion = {
      id: 'av-001',
      tenantId: 'tenant-1',
      pipelineId: 'pipe-001',
      runId: 'run-0001',
      stageName: 'build',
      artifactName: 'orion-core.jar',
      version: '1.0.0',
      commitSha: 'abc00000def000',
      branch: 'main',
      metadata: {},
      storagePath: '/artifacts/orion-core.jar',
      createdAt: '2024-03-20T10:00:00Z',
    };

    const mockForm = [
      {
        resetFields: vi.fn(),
        submit: vi.fn(),
        setFieldsValue: vi.fn(),
        validateFields: vi.fn(),
      },
    ];

    render(
      <DeployVersionModal
        open
        onCancel={vi.fn()}
        onOk={vi.fn()}
        version={mockVersion}
        submitting={false}
        form={mockForm}
      />
    );

    expect(screen.getByTestId('modal')).toBeTruthy();
    expect(screen.getByText(/1.0.0/)).toBeTruthy();
  });
});
