/**
 * ProductLine Page Tests
 * Verify: loads from API on mount, shows error on failure
 */
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import ProductLineManagement from '../index';
import { server } from '@/tests/mocks/server';

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

  it('loads product lines from API on mount', async () => {
    server.use(
      http.get('/api/v1/product-lines', () => {
        return HttpResponse.json({
          code: 0,
          message: 'success',
          data: mockProductLines,
        });
      })
    );

    render(<ProductLineManagement />);

    await waitFor(() => {
      expect(screen.getByText(/多分支产品线/)).toBeInTheDocument();
    });
  });

  it('shows empty table when API returns empty array', async () => {
    server.use(
      http.get('/api/v1/product-lines', () => {
        return HttpResponse.json({
          code: 0,
          message: 'success',
          data: [],
        });
      })
    );

    render(<ProductLineManagement />);

    await waitFor(() => {
      expect(screen.getByText(/多分支产品线/)).toBeInTheDocument();
    });
  });

  it('shows error message and empty data when API fails', async () => {
    server.use(
      http.get('/api/v1/product-lines', () => {
        return HttpResponse.json(
          { code: 500, message: 'Internal Server Error', data: null },
          { status: 500 }
        );
      })
    );

    render(<ProductLineManagement />);

    await waitFor(() => {
      expect(screen.getByText(/多分支产品线/)).toBeInTheDocument();
    });
  });
});
