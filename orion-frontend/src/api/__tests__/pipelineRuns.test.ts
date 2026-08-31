import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAllPipelineRuns,
  retryPipelineRun,
  cancelPipelineRun,
  getPipelineRunDetail,
  retryFromStage,
} from '../pipelineRuns';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('PipelineRuns API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get all pipeline runs without params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [
          {
            id: 'run-1',
            pipelineId: 'p1',
            status: 'success',
            triggerType: 'manual',
            createdAt: '2026-08-26T12:00:00Z',
          },
        ],
        total: 1,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await getAllPipelineRuns();
    expect(api.get).toHaveBeenCalledWith('/pipeline-runs', { params: undefined });
  });

  it('should get all pipeline runs with filters', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [], total: 0 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await getAllPipelineRuns({ pipelineId: 'p1', status: 'failed', limit: 20, offset: 0 });
    expect(api.get).toHaveBeenCalledWith('/pipeline-runs', {
      params: { pipelineId: 'p1', status: 'failed', limit: 20, offset: 0 },
    });
  });

  it('should retry a pipeline run', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await retryPipelineRun('run-1');
    expect(api.post).toHaveBeenCalledWith('/pipeline-runs/run-1/retry', null, {
      params: undefined,
    });
  });

  it('should retry a pipeline run with options', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await retryPipelineRun('run-1', { fromStage: 'build', onlyFailed: true });
    expect(api.post).toHaveBeenCalledWith('/pipeline-runs/run-1/retry', null, {
      params: { fromStage: 'build', onlyFailed: true },
    });
  });

  it('should cancel a pipeline run', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await cancelPipelineRun('run-2');
    expect(api.post).toHaveBeenCalledWith('/pipeline-runs/run-2/cancel');
  });

  it('should get pipeline run detail', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 'run-1',
        pipelineId: 'p1',
        status: 'success',
        stages: [
          { id: 's1', name: 'build', status: 'success' },
          { id: 's2', name: 'deploy', status: 'success' },
        ],
        tasks: [],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getPipelineRunDetail('run-1');
    expect(api.get).toHaveBeenCalledWith('/pipeline-runs/run-1');
    // getPipelineRunDetail 未声明泛型，data 是 unknown —— 断言处显式收窄
    const detail = result.data as { stages: unknown[] };
    expect(detail.stages).toHaveLength(2);
  });

  it('should retry from stage', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await retryFromStage('run-3', 'deploy');
    expect(api.post).toHaveBeenCalledWith('/pipeline-runs/run-3/retry', null, {
      params: { fromStage: 'deploy' },
    });
  });
});
