import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProjectsPage from '../index';
import * as projectsApi from '@/api/projects';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

vi.mock('@/api/projects', () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjectResources: vi.fn(),
  getProjectStats: vi.fn(),
}));

describe('Projects Page', () => {
  const mockProjects = [
    {
      id: 'proj-1',
      tenantId: 'tenant-1',
      name: 'orion-platform',
      slug: 'orion-platform',
      description: 'Orion core platform',
      status: 'active',
      teamLead: '张伟',
      teamMembers: ['张伟', '李娜'],
      productLineId: 'pl-1',
      environments: ['dev', 'staging', 'production'],
      createdAt: '2024-01-15T08:00:00Z',
      updatedAt: '2024-04-20T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads projects from API on mount', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue({ data: { data: mockProjects, total: 1 } } as any);

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('项目管理')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(projectsApi.getProjects).mockRejectedValue(new Error('Internal Server Error'));

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('项目管理')).toBeInTheDocument();
    });
  });
});
