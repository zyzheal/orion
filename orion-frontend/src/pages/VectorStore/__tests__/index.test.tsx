/**
 * VectorStore Page Tests
 * - Loads collections and stats from API on mount
 * - Shows error on API failure, no mock data fallback
 * - Shows empty state when API returns empty array
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import VectorStorePage from '../index';

const { mockMessage, mockApi } = vi.hoisted(() => ({
  mockMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  mockApi: {
    getCollections: vi.fn(),
    deleteCollection: vi.fn(),
    getCollectionDocuments: vi.fn(),
    addDocument: vi.fn(),
    deleteDocument: vi.fn(),
    searchVectors: vi.fn(),
    getVectorStats: vi.fn(),
  },
}));

vi.mock('@/api/vector-store', () => mockApi);

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: mockMessage };
});

vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (value: unknown) => ({
    format: () => String(value || '2024-03-20 10:00:00'),
    fromNow: () => '2 hours ago',
    unix: () => Date.now(),
    valueOf: () => Date.now(),
  });
  (dayjsFn as any).extend = vi.fn(() => dayjsFn);
  (dayjsFn as any).duration = vi.fn(() => ({
    asMinutes: () => 0,
    seconds: () => 0,
  }));
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

vi.mock('dayjs/plugin/relativeTime', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { default: mod?.default || vi.fn() };
});

vi.mock('../CollectionList', () => ({
  default: ({
    filteredCollections,
    loading,
  }: {
    filteredCollections: any[];
    loading: boolean;
  }) => (
    <div data-testid="collection-list" data-loading={loading}>
      <div data-testid="row-count">{filteredCollections?.length || 0}</div>
      {filteredCollections?.map((item: any) => (
        <div key={item.name} data-testid="collection-row">
          {item.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../CollectionDetail', () => ({
  default: () => <div data-testid="collection-detail" />,
}));

vi.mock('../VectorSearch', () => ({
  default: () => <div data-testid="vector-search" />,
}));

vi.mock('../DocumentManager', () => ({
  default: () => <div data-testid="document-manager" />,
}));

vi.mock('../CreateCollectionModal', () => ({
  default: () => <div data-testid="create-modal" />,
}));

const mockCollections = [
  {
    name: 'test-collection',
    displayName: 'Test Collection',
    description: 'A test collection',
    documentCount: 100,
    dimensions: 1536,
    indexType: 'hnsw' as const,
    distanceMetric: 'cosine' as const,
    status: 'active' as const,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-03-20T10:00:00Z',
  },
];

const mockStats = {
  documentCount: 100,
  collectionCount: 1,
  totalEmbeddings: 100,
  avgDimensions: 1536,
};

describe('VectorStorePage', () => {
  beforeEach(() => {
    mockMessage.error.mockClear();
    mockMessage.success.mockClear();
    mockMessage.warning.mockClear();
    mockApi.getCollections.mockReset();
    mockApi.getVectorStats.mockReset();
    mockApi.getCollectionDocuments.mockReset();
    mockApi.searchVectors.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads collections and stats from API on mount', async () => {
    mockApi.getCollections.mockResolvedValue({
      data: { data: mockCollections },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
    mockApi.getVectorStats.mockResolvedValue({
      data: { data: mockStats },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    await act(async () => {
      render(<VectorStorePage />);
    });

    await waitFor(() => {
      expect(mockApi.getCollections).toHaveBeenCalled();
      expect(mockApi.getVectorStats).toHaveBeenCalled();
    });

    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('1');
  });

  it('shows error on collections API failure, no mock data fallback', async () => {
    mockApi.getCollections.mockRejectedValue(new Error('Network error'));
    mockApi.getVectorStats.mockResolvedValue({
      data: { data: mockStats },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    await act(async () => {
      render(<VectorStorePage />);
    });

    await waitFor(() => {
      expect(mockApi.getCollections).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith(
        expect.stringContaining('加载集合数据失败'),
      );
    });

    // Table should be empty (no mock data)
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');
  });

  it('shows empty state when API returns empty array', async () => {
    mockApi.getCollections.mockResolvedValue({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
    mockApi.getVectorStats.mockResolvedValue({
      data: { data: mockStats },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    await act(async () => {
      render(<VectorStorePage />);
    });

    await waitFor(() => {
      expect(mockApi.getCollections).toHaveBeenCalled();
    });

    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('0');
  });

  it('handles stats API failure gracefully', async () => {
    mockApi.getCollections.mockResolvedValue({
      data: { data: mockCollections },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
    mockApi.getVectorStats.mockRejectedValue(new Error('Stats error'));

    await act(async () => {
      render(<VectorStorePage />);
    });

    await waitFor(() => {
      expect(mockApi.getVectorStats).toHaveBeenCalled();
    });

    // Collections should still load
    const rowCount = screen.getByTestId('row-count');
    expect(rowCount.textContent).toBe('1');
  });
});
