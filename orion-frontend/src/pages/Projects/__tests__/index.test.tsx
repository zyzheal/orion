import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/server';
import ProjectsPage from '../index';

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
  {
    id: 'proj-2',
    tenantId: 'tenant-1',
    name: 'orion-ai-service',
    slug: 'orion-ai-service',
    description: 'AI service',
    status: 'active',
    teamLead: '陈思',
    teamMembers: ['陈思'],
    productLineId: 'pl-1',
    environments: ['dev', 'staging'],
    createdAt: '2024-02-01T08:00:00Z',
    updatedAt: '2024-04-18T14:00:00Z',
  },
];

const mockResources = [
  {
    id: 'r1',
    projectId: 'proj-1',
    type: 'repository',
    name: 'orion-platform-service',
    externalId: 'repo-101',
    status: 'active',
    createdAt: '2024-01-15T08:00:00Z',
  },
];

describe('Projects Page', () => {
  it('loads projects from API on mount', async () => {
    server.use(
      http.get('/api/v1/projects', () => {
        return HttpResponse.json({
          code: 0,
          message: 'success',
          data: {
            data: mockProjects,
            total: mockProjects.length,
          },
        });
      }),
    );

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('orion-platform')).toBeInTheDocument();
      expect(screen.getByText('orion-ai-service')).toBeInTheDocument();
    });
  });

  it('shows empty state on API failure (no mock fallback)', async () => {
    server.use(
      http.get('/api/v1/projects', () => {
        return HttpResponse.json(
          { code: 500, message: 'Internal Server Error', data: null },
          { status: 500 },
        );
      }),
    );

    render(<ProjectsPage />);

    // Wait for loading to finish and table to show empty state
    await waitFor(() => {
      expect(screen.queryByText('项目管理')).toBeInTheDocument();
    });

    // Verify no mock data is shown (orion-platform should NOT appear)
    await waitFor(() => {
      expect(screen.queryByText('orion-platform')).not.toBeInTheDocument();
      expect(screen.queryByText('orion-ai-service')).not.toBeInTheDocument();
    });
  });

  it('loads resources from API when opening detail', async () => {
    server.use(
      http.get('/api/v1/projects', () => {
        return HttpResponse.json({
          code: 0,
          message: 'success',
          data: {
            data: mockProjects,
            total: mockProjects.length,
          },
        });
      }),
      http.get('/api/v1/projects/:projectId/resources', () => {
        return HttpResponse.json({
          code: 0,
          message: 'success',
          data: mockResources,
        });
      }),
    );

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('orion-platform')).toBeInTheDocument();
    });

    // Click on the project name to open detail drawer
    const projectName = screen.getByText('orion-platform');
    fireEvent.click(projectName);

    await waitFor(() => {
      expect(screen.getByText('关联资源')).toBeInTheDocument();
      expect(screen.getByText('orion-platform-service')).toBeInTheDocument();
    });
  });

  it('shows empty resources on resource API failure', async () => {

    server.use(
      http.get('/api/v1/projects', () => {
        return HttpResponse.json({
          code: 0,
          message: 'success',
          data: {
            data: mockProjects,
            total: mockProjects.length,
          },
        });
      }),
      http.get('/api/v1/projects/:projectId/resources', () => {
        return HttpResponse.json(
          { code: 500, message: 'Internal Server Error', data: null },
          { status: 500 },
        );
      }),
    );

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('orion-platform')).toBeInTheDocument();
    });

    const projectName = screen.getByText('orion-platform');
    fireEvent.click(projectName);

    await waitFor(() => {
      expect(screen.getByText('暂无关联资源')).toBeInTheDocument();
    });
  });
});
