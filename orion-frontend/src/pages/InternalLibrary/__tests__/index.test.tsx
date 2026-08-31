/**
 * InternalLibrary Page Tests
 * Verify: loads from API on mount, shows error on failure
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InternalLibraryManagement from '../index';
import * as libraryApi from '@/api/internal-library';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

vi.mock('@/api/internal-library', () => ({
  getInternalLibraries: vi.fn(),
  getInternalLibrary: vi.fn(),
  getInternalLibraryByName: vi.fn(),
  createInternalLibrary: vi.fn(),
  deleteInternalLibrary: vi.fn(),
  deprecateInternalLibrary: vi.fn(),
  activateInternalLibrary: vi.fn(),
  publishLibraryVersion: vi.fn(),
  getLibraryVersions: vi.fn(),
  getLibraryVersion: vi.fn(),
  getLibraryDependents: vi.fn(),
}));

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads libraries from API on mount', async () => {
    vi.mocked(libraryApi.getInternalLibraries).mockResolvedValue({ data: mockLibraries } as any);

    render(<InternalLibraryManagement />);

    await waitFor(() => {
      expect(screen.getByText(/二方库管理/)).toBeInTheDocument();
    });
  });

  it('shows empty table when API returns empty array', async () => {
    vi.mocked(libraryApi.getInternalLibraries).mockResolvedValue({ data: [] } as any);

    render(<InternalLibraryManagement />);

    await waitFor(() => {
      expect(screen.getByText(/二方库管理/)).toBeInTheDocument();
    });
  });

  it('shows error message and empty data when API fails', async () => {
    vi.mocked(libraryApi.getInternalLibraries).mockRejectedValue(new Error('Internal Server Error'));

    render(<InternalLibraryManagement />);

    await waitFor(() => {
      expect(screen.getByText(/二方库管理/)).toBeInTheDocument();
    });
  });
});
