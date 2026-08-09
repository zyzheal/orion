/**
 * Test Selector API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTestCases, getTestStats, runTests } from '../test-selector';
import { api } from '../client';
import type { InternalAxiosRequestConfig } from 'axios';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Test Selector API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get test cases without filters', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig<any>,
    } as any);
    await getTestCases();
    expect(api.get).toHaveBeenCalledWith('/api/v1/test-selector/cases');
  });

  it('should get test cases with filters', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig<any>,
    } as any);
    await getTestCases({ suite: 'Auth', status: 'pass' });
    expect(api.get).toHaveBeenCalledWith('/api/v1/test-selector/cases?suite=Auth&status=pass');
  });

  it('should get test stats', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig<any>,
    } as any);
    const result = await getTestStats();
    expect(api.get).toHaveBeenCalledWith('/api/v1/test-selector/cases');
    expect(api.get).toHaveBeenCalledWith('/api/v1/test-selector/suites');
    // stats 计算来自 cases，cases 为空时 passRate 为 0
    expect(result.data.stats.passRate).toBe(0);
  });

  it('should run tests', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { runId: 'run-1' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig<any>,
    } as any);
    const result = await runTests(['t1', 't2']);
    expect(api.post).toHaveBeenCalledWith('/api/v1/test-selector/run', { testIds: ['t1', 't2'] });
    expect(result.data.runId).toBe('run-1');
  });
});
