/**
 * Test Selector API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTestCases, getTestStats, runTests } from '../test-selector';
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

describe('Test Selector API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get test cases without filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { testCases: [] } });
    await getTestCases();
    expect(api.get).toHaveBeenCalledWith('/v1/test-selector/tests');
  });

  it('should get test cases with filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { testCases: [] } });
    await getTestCases({ suite: 'Auth', status: 'pass' });
    expect(api.get).toHaveBeenCalledWith('/v1/test-selector/tests?suite=Auth&status=pass');
  });

  it('should get test stats', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { stats: { total: 100, passed: 90, failed: 5, skipped: 5, passRate: 90, suites: [] } } });
    const result = await getTestStats();
    expect(api.get).toHaveBeenCalledWith('/v1/test-selector/stats');
    expect(result.data.stats.passRate).toBe(90);
  });

  it('should run tests', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { runId: 'run-1' } });
    const result = await runTests(['t1', 't2']);
    expect(api.post).toHaveBeenCalledWith('/v1/test-selector/run', { testIds: ['t1', 't2'] });
    expect(result.data.runId).toBe('run-1');
  });
});
