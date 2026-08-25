import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueJob,
  dequeueJob,
  completeJob,
  failJob,
  listJobs,
  getJob,
  getQueueStats,
} from '../queue';
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

describe('Queue API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enqueue a job', async () => {
    const mockJob = {
      id: 'job-1',
      tenant_id: 't1',
      queue: 'email',
      payload: { to: 'user@example.com' },
      status: 'pending' as const,
      attempts: 0,
      created_at: '2026-08-26T12:00:00Z',
    };

    vi.mocked(api.post).mockResolvedValue({
      data: mockJob,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await enqueueJob('email', {
      tenantId: 't1',
      payload: { to: 'user@example.com' },
    });

    expect(api.post).toHaveBeenCalledWith('/queue/email/jobs', {
      tenantId: 't1',
      payload: { to: 'user@example.com' },
    });
    expect(result).toEqual({
      data: mockJob,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });
  });

  it('should dequeue jobs', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { jobs: [{ id: 'job-1' } as any], count: 1 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await dequeueJob('worker', { limit: 5 });
    expect(api.post).toHaveBeenCalledWith('/queue/worker/dequeue', { limit: 5 });
  });

  it('should complete a job', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await completeJob('job-123');
    expect(api.post).toHaveBeenCalledWith('/queue/jobs/job-123/complete');
  });

  it('should fail a job', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await failJob('job-456');
    expect(api.post).toHaveBeenCalledWith('/queue/jobs/job-456/fail');
  });

  it('should list jobs without params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { jobs: [], count: 0 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await listJobs();
    expect(api.get).toHaveBeenCalledWith('/queue/jobs', { params: undefined });
  });

  it('should list jobs with filters', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { jobs: [], count: 0 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await listJobs({ tenantId: 't1', queue: 'email', status: 'pending' });
    expect(api.get).toHaveBeenCalledWith('/queue/jobs', {
      params: { tenantId: 't1', queue: 'email', status: 'pending' },
    });
  });

  it('should get a job by ID', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 'job-1',
        tenant_id: 't1',
        queue: 'email',
        payload: {},
        status: 'pending' as const,
        attempts: 1,
        created_at: '2026-08-26T12:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getJob('job-1');
    expect(api.get).toHaveBeenCalledWith('/queue/jobs/job-1');
    expect(result.data.id).toBe('job-1');
  });

  it('should get queue stats', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { pending: 10, processing: 3, completed: 100, failed: 2 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getQueueStats();
    expect(api.get).toHaveBeenCalledWith('/queue/stats');
    expect(result.data).toEqual({
      pending: 10,
      processing: 3,
      completed: 100,
      failed: 2,
    });
  });
});
