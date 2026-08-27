import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProjects, getProject, createProject, updateProject, deleteProject, getProjectResources, getProjectStats } from '../projects';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('Projects API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should list projects', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getProjects();
    expect(api.get).toHaveBeenCalledWith('/projects', { params: undefined });
  });

  it('should get project by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getProject('1');
    expect(api.get).toHaveBeenCalledWith('/projects/1');
  });

  it('should create project', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createProject({ name: 'test', slug: 'test-slug' });
    expect(api.post).toHaveBeenCalledWith('/projects', { name: 'test', slug: 'test-slug' });
  });

  it('should update project', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateProject('1', { name: 'updated' });
    expect(api.put).toHaveBeenCalledWith('/projects/1', { name: 'updated' });
  });

  it('should delete project', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteProject('1');
    expect(api.delete).toHaveBeenCalledWith('/projects/1');
  });

  it('should get project resources', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getProjectResources('1');
    expect(api.get).toHaveBeenCalledWith('/projects/1/resources');
  });

  it('should get project stats', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { count: 5 } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getProjectStats();
    expect(api.get).toHaveBeenCalledWith('/projects/stats', { params: undefined });
  });
});
