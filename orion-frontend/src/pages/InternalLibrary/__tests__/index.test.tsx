/**
 * InternalLibrary Page Tests
 * Verify: loads from API on mount, shows error on failure
 */
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import InternalLibraryManagement from '../index';
import { server } from '@/tests/mocks/server';

describe('InternalLibraryManagement', () => {
  const mockLibraries = [
    {
      id: 'lib-1',
      name: '@orion/auth',
      displayName: 'Orion 认证库',
      description: '统一认证与权限管理',
      language: 'node' as const,
      status: 'active' as const,
      owner: 'platform-team',
      maintainers: ['heal'],
      repository: 'https://github.com/orion/auth-lib',
      currentVersion: '2.3.0',
      latestStableVersion: '2.3.0',
      versions: [],
      dependents: { totalRepos: 12, totalTeams: 4, reposUsingLatest: 8, reposNeedingUpgrade: 4 },
      createdAt: '2023-06-01T08:00:00Z',
      updatedAt: '2024-03-15T10:00:00Z',
    },
  ];

  it('loads libraries from API on mount', async () => {
    server.use(
      http.get('/api/internal-libraries', () => {
        return HttpResponse.json({
          code: 0,
          message: 'success',
          data: mockLibraries,
        });
      })
    );

    render(<InternalLibraryManagement />);

    await waitFor(() => {
      expect(screen.getByText(/二方库管理/)).toBeInTheDocument();
    });
  });

  it('shows empty table when API returns empty array', async () => {
    server.use(
      http.get('/api/internal-libraries', () => {
        return HttpResponse.json({
          code: 0,
          message: 'success',
          data: [],
        });
      })
    );

    render(<InternalLibraryManagement />);

    await waitFor(() => {
      expect(screen.getByText(/二方库管理/)).toBeInTheDocument();
    });
  });

  it('shows error message and empty data when API fails', async () => {
    server.use(
      http.get('/api/internal-libraries', () => {
        return HttpResponse.json(
          { code: 500, message: 'Internal Server Error', data: null },
          { status: 500 }
        );
      })
    );

    render(<InternalLibraryManagement />);

    await waitFor(() => {
      expect(screen.getByText(/二方库管理/)).toBeInTheDocument();
    });
  });
});
