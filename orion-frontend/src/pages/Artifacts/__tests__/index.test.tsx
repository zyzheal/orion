import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API - must be before other imports
vi.mock('@/api/artifacts', () => ({
  getArtifacts: vi.fn(),
  createArtifact: vi.fn(),
  updateArtifact: vi.fn(),
  deleteArtifact: vi.fn(),
  getArtifactTags: vi.fn(),
  addArtifactTags: vi.fn(),
  downloadArtifact: vi.fn(),
  promoteArtifact: vi.fn(),
  getPromotionHistory: vi.fn(),
  deprecateArtifact: vi.fn(),
  quarantineArtifact: vi.fn(),
  getArtifactStats: vi.fn(),
  getNamespaces: vi.fn(),
}));

// Mock child components using absolute paths
vi.mock('@/pages/Artifacts/ArtifactTable', () => ({
  default: ({ dataSource, loading, total, onDetail }: any) => (
    <div data-testid="artifact-table" data-loading={loading}>
      <div data-testid="row-count">{dataSource?.length || 0}</div>
      <div data-testid="total-count">{total}</div>
      {dataSource?.map((item: any) => (
        <div key={item.id} data-testid="artifact-row">
          <span data-testid="artifact-name">{item.name}</span>
          <button data-testid="detail-btn" onClick={() => onDetail?.(item)}>
            Detail
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/pages/Artifacts/ArtifactStats', () => ({
  default: ({ stats }: any) => (
    <div data-testid="artifact-stats">
      <span data-testid="stats-total">{stats?.total}</span>
    </div>
  ),
}));

vi.mock('@/pages/Artifacts/ArtifactDetail', () => ({
  getArtifactTabItems: () => [],
}));

vi.mock('@/pages/Artifacts/constants', () => ({
  typeLabelMap: {
    container_image: 'Container Image',
    npm_package: 'NPM Package',
    helm_chart: 'Helm Chart',
  },
  promotionStageOrder: ['snapshot', 'release_candidate', 'stable', 'production', 'archived'],
}));

vi.mock('@/components/SearchFilterBar', () => ({
  default: ({ onSearch }: any) => (
    <div data-testid="search-filter-bar">
      <input data-testid="search-input" onChange={(e) => onSearch?.(e.target.value)} />
    </div>
  ),
}));

vi.mock('@/components/PageSkeleton', () => ({
  default: () => <div data-testid="page-skeleton">Loading...</div>,
}));

// Mock all antd components
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
      <div data-testid="card" {...props}>{children}</div>
    ),
    Tabs: ({ items, ...props }: any) => (
      <div data-testid="tabs">{items?.length} tabs</div>
    ),
    Drawer: ({ children, open, ...props }: any) =>
      open ? <div data-testid="drawer">{children}</div> : null,
    Tag: ({ children, color, ...props }: any) => (
      <span data-testid="tag" data-color={color} {...props}>{children}</span>
    ),
    Modal: ({ children, open, ...props }: any) =>
      open ? <div data-testid="modal">{children}</div> : null,
    Select: ({ children, ...restProps }: any) => <select {...restProps}>{children}</select>,
    Form: Object.assign(
      ({ children, ...restProps }: any) => <form {...restProps}>{children}</form>,
      {
        Item: ({ children, ...restProps }: any) => <div {...restProps}>{children}</div>,
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
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Space: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  };
});

// Import mocked API
import * as artifactApi from '@/api/artifacts';

describe('Artifacts Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads artifacts from API on mount', async () => {
    const mockArtifacts = [
      {
        id: 'art-1',
        name: 'orion-core',
        namespace: 'platform',
        version: '2.5.0',
        type: 'container_image',
        stage: 'stable',
        status: 'available',
        displayName: 'Orion Core',
        description: 'Orion core service',
        sizeBytes: 256000000,
        digest: 'sha256:abc123',
        storagePath: '/storage/images/orion-core',
        storageBackend: 'harbor',
        labels: {},
        createdAt: '2024-01-15T08:00:00Z',
        updatedAt: '2024-03-20T12:00:00Z',
      },
      {
        id: 'art-2',
        name: 'orion-ai',
        namespace: 'ai',
        version: '1.3.0',
        type: 'container_image',
        stage: 'release_candidate',
        status: 'available',
        displayName: 'AI Service',
        sizeBytes: 512000000,
        storagePath: '/storage/images/orion-ai',
        storageBackend: 'harbor',
        labels: {},
        createdAt: '2024-02-01T08:00:00Z',
        updatedAt: '2024-03-19T14:00:00Z',
      },
    ];

    const mockStats = {
      total: 2,
      byStage: { snapshot: 0, release_candidate: 1, stable: 1, production: 0, archived: 0 },
      byStatus: { uploading: 0, available: 2, deprecated: 0, quarantined: 0, deleted: 0 },
      byType: { container_image: 2 },
      totalSizeBytes: 768000000,
    };

    const mockNamespaces = ['platform', 'ai'];

    vi.mocked(artifactApi.getArtifacts).mockResolvedValue({
      data: { code: 200, message: 'success', data: mockArtifacts, total: 2 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    vi.mocked(artifactApi.getArtifactStats).mockResolvedValue({
      data: { code: 200, message: 'success', data: mockStats },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    vi.mocked(artifactApi.getNamespaces).mockResolvedValue({
      data: { code: 200, message: 'success', data: mockNamespaces },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    const ArtifactManagement = (await import('../index')).default;

    render(<ArtifactManagement />);

    await waitFor(() => {
      expect(artifactApi.getArtifacts).toHaveBeenCalledWith({ page: 1, perPage: 20 });
      expect(artifactApi.getArtifactStats).toHaveBeenCalled();
      expect(artifactApi.getNamespaces).toHaveBeenCalled();
    });

    // Verify table rendered with data
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('2');

    const totalCount = screen.getByTestId('total-count');
    expect(totalCount.textContent).toBe('2');

    // Verify artifact names are displayed
    const artifactNames = screen.getAllByTestId('artifact-name');
    expect(artifactNames).toHaveLength(2);
    expect(artifactNames[0].textContent).toBe('orion-core');
    expect(artifactNames[1].textContent).toBe('orion-ai');
  });

  it('shows error on API failure and clears data', async () => {
    vi.mocked(artifactApi.getArtifacts).mockRejectedValue(
      new Error('Network error')
    );
    vi.mocked(artifactApi.getArtifactStats).mockRejectedValue(
      new Error('Stats API unavailable')
    );
    vi.mocked(artifactApi.getNamespaces).mockRejectedValue(
      new Error('Namespaces API unavailable')
    );

    const ArtifactManagement = (await import('../index')).default;

    render(<ArtifactManagement />);

    await waitFor(() => {
      expect(artifactApi.getArtifacts).toHaveBeenCalled();
    });

    const { message } = await import('antd');
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(
        expect.stringContaining('加载制品数据失败')
      );
    });

    // Verify empty state (no mock data fallback)
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');
  });
});
