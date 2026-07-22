/**
 * Cron API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  executeCronJob,
  getCronStatus,
} from '../cron';
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

describe('Cron API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get cron jobs', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    const result = await getCronJobs();
    expect(api.get).toHaveBeenCalledWith('/v1/cron/jobs');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should create a cron job', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: '1', name: 'test', schedule: '0 * * * *', command: 'cmd', enabled: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    const result = await createCronJob({ name: 'test', schedule: '0 * * * *', command: 'cmd' });
    expect(api.post).toHaveBeenCalledWith('/v1/cron/jobs', {
      name: 'test',
      schedule: '0 * * * *',
      command: 'cmd',
    });
    expect(result.data.name).toBe('test');
  });

  it('should update a cron job', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: { id: '1', name: 'updated' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await updateCronJob('1', { name: 'updated' });
    expect(api.put).toHaveBeenCalledWith('/v1/cron/jobs/1', { name: 'updated' });
  });

  it('should delete a cron job', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await deleteCronJob('1');
    expect(api.delete).toHaveBeenCalledWith('/v1/cron/jobs/1');
  });

  it('should execute a cron job', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await executeCronJob('1');
    expect(api.post).toHaveBeenCalledWith('/v1/cron/jobs/1/execute');
  });

  it('should get cron status', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { running: 2, total: 10, enabled: 8 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    const result = await getCronStatus();
    expect(api.get).toHaveBeenCalledWith('/v1/cron/status');
    expect(result.data.running).toBe(2);
  });
});
