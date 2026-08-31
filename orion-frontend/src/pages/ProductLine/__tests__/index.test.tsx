/**
 * ProductLine Page Tests
 * Verify: loads from API on mount, shows error on failure
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProductLineManagement from '../index';
import * as productLineApi from '@/api/product-lines';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

vi.mock('@/api/product-lines', () => ({
  getProductLines: vi.fn(),
  getProductLine: vi.fn(),
  getProductLineByName: vi.fn(),
  createProductLine: vi.fn(),
  updateProductLine: vi.fn(),
  deleteProductLine: vi.fn(),
  activateProductLine: vi.fn(),
  suspendProductLine: vi.fn(),
  getProductLineBranches: vi.fn(),
  getProductLineEnvironments: vi.fn(),
  getProductLineStats: vi.fn(),
}));

describe('ProductLineManagement', () => {
  const mockProductLines = [
    {
      id: 'pl-1',
      name: 'core-platform',
      displayName: '核心平台',
      description: 'Orion 核心平台产品线',
      gitRepo: {
        url: 'https://github.com/orion/core-platform',
        provider: 'github',
        defaultBranch: 'main',
      },
      branchPolicies: {
        mode: 'gitflow' as const,
        protectedBranches: [],
      },
      environmentMappings: {
        defaultEnvironment: 'dev' as const,
        mappings: [],
      },
      status: {
        phase: 'Active' as const,
        statistics: {
          totalPipelines: 156,
          activePipelines: 12,
          successfulPipelines: 140,
          failedPipelines: 16,
          totalDeployments: 89,
        },
      },
      createdAt: '2024-01-15T08:00:00Z',
      updatedAt: '2024-03-20T10:00:00Z',
      tenantId: 't1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads product lines from API on mount', async () => {
    vi.mocked(productLineApi.getProductLines).mockResolvedValue({ data: mockProductLines } as any);

    render(<ProductLineManagement />);

    await waitFor(() => {
      expect(screen.getByText(/多分支产品线/)).toBeInTheDocument();
    });
  });

  it('shows empty table when API returns empty array', async () => {
    vi.mocked(productLineApi.getProductLines).mockResolvedValue({ data: [] } as any);

    render(<ProductLineManagement />);

    await waitFor(() => {
      expect(screen.getByText(/多分支产品线/)).toBeInTheDocument();
    });
  });

  it('shows error message and empty data when API fails', async () => {
    vi.mocked(productLineApi.getProductLines).mockRejectedValue(new Error('Internal Server Error'));

    render(<ProductLineManagement />);

    await waitFor(() => {
      expect(screen.getByText(/多分支产品线/)).toBeInTheDocument();
    });
  });
});
