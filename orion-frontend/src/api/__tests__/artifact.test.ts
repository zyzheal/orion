import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createArtifactArtifacts, listArtifact, getArtifact, updateArtifact, deleteArtifact,
  createArtifactArtifactsTags, createArtifactArtifactsPromote } from '../artifact';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('Artifact API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create artifact', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createArtifactArtifacts({ name: 'test-artifact' });
    expect(api.post).toHaveBeenCalledWith('/artifacts/artifacts', { name: 'test-artifact' });
  });

  it('should list artifacts', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], total: 0 }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await listArtifact();
    expect(api.get).toHaveBeenCalled();
  });

  it('should get artifact by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getArtifact('1');
    expect(api.get).toHaveBeenCalledWith('/artifacts/artifacts/1');
  });

  it('should update artifact', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateArtifact('1', { name: 'updated' });
    expect(api.put).toHaveBeenCalledWith('/artifacts/artifacts/1', { name: 'updated' });
  });

  it('should delete artifact', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteArtifact('1');
    expect(api.delete).toHaveBeenCalledWith('/artifacts/artifacts/1');
  });

  it('should add tags to artifact', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await createArtifactArtifactsTags('1', { tags: ['stable'] });
    expect(api.post).toHaveBeenCalledWith('/artifacts/artifacts/1/tags', { tags: ['stable'] });
  });

  it('should promote artifact', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await createArtifactArtifactsPromote('1', { environment: 'production' });
    expect(api.post).toHaveBeenCalledWith('/artifacts/artifacts/1/promote', { environment: 'production' });
  });
});
