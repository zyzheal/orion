import { render, waitFor } from '@testing-library/react';
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
];

describe('Projects Page', { timeout: 15000 }, () => {
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
      })
    );

    const { queryByText } = render(<ProjectsPage />);

    await waitFor(() => {
      expect(queryByText('项目管理')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    server.use(
      http.get('/api/v1/projects', () => {
        return HttpResponse.json(
          { code: 500, message: 'Internal Server Error', data: null },
          { status: 500 }
        );
      })
    );

    const { queryByText } = render(<ProjectsPage />);

    await waitFor(() => {
      expect(queryByText('项目管理')).toBeInTheDocument();
    });
  });
});
