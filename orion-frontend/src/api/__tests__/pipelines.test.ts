import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPipelines, getPipeline, createPipeline, updatePipeline, deletePipeline, triggerPipeline, getPipelineVersions, validatePipelineYaml } from '../pipelines';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('Pipelines API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should list pipelines', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getPipelines();
    expect(api.get).toHaveBeenCalledWith('/pipelines', { params: undefined });
  });

  it('should get pipeline by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: '1', name: 'build' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getPipeline('1');
    expect(api.get).toHaveBeenCalledWith('/pipelines/1');
  });

  it('should create pipeline', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createPipeline({ name: 'build', status: 'active' });
    expect(api.post).toHaveBeenCalledWith('/pipelines', { name: 'build', status: 'active' });
  });

  it('should update pipeline', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updatePipeline('1', { name: 'updated' });
    expect(api.put).toHaveBeenCalledWith('/pipelines/1', { name: 'updated' });
  });

  it('should delete pipeline', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deletePipeline('1');
    expect(api.delete).toHaveBeenCalledWith('/pipelines/1');
  });

  it('should trigger pipeline', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { runId: 'r1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await triggerPipeline('1');
    expect(api.post).toHaveBeenCalledWith('/pipelines/1/runs', undefined);
  });

  it('should get pipeline versions', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getPipelineVersions('build');
    expect(api.get).toHaveBeenCalledWith('/pipelines/versions/build');
  });

  it('should validate pipeline yaml', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { valid: true } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await validatePipelineYaml('stages: []');
    expect(api.post).toHaveBeenCalledWith('/pipelines/validate', { yamlDefinition: 'stages: []' });
  });
});
