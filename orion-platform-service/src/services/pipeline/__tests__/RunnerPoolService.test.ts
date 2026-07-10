/**
 * RunnerPoolService Tests
 *
 * Tests for runner registration, label matching, job dispatch, and heartbeat timeout.
 */

import { RunnerPoolService } from '../RunnerPoolService';
import { safeFetch } from '../../../utils/safeFetch';

jest.mock('../../../utils/safeFetch', () => ({
  safeFetch: jest.fn(),
}));

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;

// Mock DatabasePool
const mockDbQuery = jest.fn();
const mockDb = {
  query: mockDbQuery,
};

// Mock HTTP fetch for remote runner communication
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('RunnerPoolService', () => {
  let service: RunnerPoolService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RunnerPoolService(mockDb as any);
  });

  describe('registerRunner', () => {
    it('should register a new runner successfully', async () => {
      const input = {
        tenantId: 'tenant-1',
        name: 'runner-linux-01',
        labels: ['linux', 'docker'],
        maxConcurrent: 4,
        metadata: { os: 'linux', arch: 'amd64', version: '1.0.0' },
      };

      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          id: 'runner-1',
          tenant_id: 'tenant-1',
          name: 'runner-linux-01',
          status: 'online',
          labels: ['linux', 'docker'],
          max_concurrent: 4,
          current_jobs: 0,
          last_heartbeat: expect.any(Date),
          metadata: { os: 'linux', arch: 'amd64', version: '1.0.0' },
          created_at: expect.any(Date),
        }],
        rowCount: 1,
      });

      const runner = await service.registerRunner(input);

      expect(runner.id).toBe('runner-1');
      expect(runner.status).toBe('online');
      expect(runner.labels).toEqual(['linux', 'docker']);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO runners'),
        expect.any(Array)
      );
    });

    it('should fail if runner name already exists for tenant', async () => {
      const input = {
        tenantId: 'tenant-1',
        name: 'runner-linux-01',
        labels: ['linux'],
        maxConcurrent: 2,
      };

      // Simulate unique constraint violation
      mockDbQuery.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      await expect(service.registerRunner(input)).rejects.toThrow('duplicate key');
    });
  });

  describe('deregisterRunner', () => {
    it('should deregister a runner', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'runner-1' }] });
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // delete runner_jobs

      await service.deregisterRunner('runner-1');

      expect(mockDbQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('DELETE FROM runner_jobs WHERE runner_id = $1'),
        ['runner-1']
      );
      expect(mockDbQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DELETE FROM runners WHERE id = $1'),
        ['runner-1']
      );
    });
  });

  describe('heartbeat', () => {
    it('should update runner heartbeat', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'runner-1', status: 'online' }] });

      await service.heartbeat('runner-1');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE runners SET last_heartbeat'),
        ['runner-1']
      );
    });

    it('should return false if runner not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.heartbeat('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('selectRunner', () => {
    it('should select a runner matching all labels', async () => {
      const now = new Date();
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'runner-1',
            tenant_id: 'tenant-1',
            name: 'runner-linux-01',
            status: 'online',
            labels: ['linux', 'docker', 'gpu'],
            max_concurrent: 4,
            current_jobs: 2,
            last_heartbeat: now,
            metadata: {},
            created_at: now,
          },
          {
            id: 'runner-2',
            tenant_id: 'tenant-1',
            name: 'runner-linux-02',
            status: 'online',
            labels: ['linux', 'docker'],
            max_concurrent: 2,
            current_jobs: 1,
            last_heartbeat: now,
            metadata: {},
            created_at: now,
          },
        ],
      });

      const runner = await service.selectRunner(['linux', 'docker'], 'tenant-1');

      expect(runner).not.toBeNull();
      // Should pick runner-2 since it has fewer available slots ratio
      // Actually: runner-1 has 2/4 = 0.5 usage, runner-2 has 1/2 = 0.5 usage
      // Both match. Should pick runner-1 (first by order)
      expect(runner!.id).toBe('runner-1');
    });

    it('should return null if no runner matches all labels', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'runner-1', labels: ['linux'] }],
      });

      const runner = await service.selectRunner(['gpu'], 'tenant-1');

      expect(runner).toBeNull();
    });

    it('should not select busy or offline runners', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          { id: 'runner-1', status: 'busy', labels: ['linux', 'docker'] },
          { id: 'runner-2', status: 'offline', labels: ['linux', 'docker'] },
        ],
      });

      const runner = await service.selectRunner(['linux', 'docker'], 'tenant-1');

      expect(runner).toBeNull();
    });

    it('should not select draining runners unless no other option', async () => {
      const now = new Date();
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'runner-draining',
            tenant_id: 'tenant-1',
            name: 'runner-draining',
            status: 'draining',
            labels: ['linux', 'docker'],
            max_concurrent: 4,
            current_jobs: 0,
            last_heartbeat: now,
            metadata: {},
            created_at: now,
          },
        ],
      });

      const runner = await service.selectRunner(['linux', 'docker'], 'tenant-1');

      // Draining runners should not be selected for new jobs
      expect(runner).toBeNull();
    });

    it('should return null when no runners available', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const runner = await service.selectRunner(['linux'], 'tenant-1');

      expect(runner).toBeNull();
    });

    it('should select runner with lowest job-to-capacity ratio', async () => {
      const now = new Date();
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'runner-heavy',
            tenant_id: 'tenant-1',
            name: 'runner-heavy',
            status: 'online',
            labels: ['linux', 'docker'],
            max_concurrent: 4,
            current_jobs: 3,
            last_heartbeat: now,
            metadata: {},
            created_at: now,
          },
          {
            id: 'runner-light',
            tenant_id: 'tenant-1',
            name: 'runner-light',
            status: 'online',
            labels: ['linux', 'docker'],
            max_concurrent: 4,
            current_jobs: 1,
            last_heartbeat: now,
            metadata: {},
            created_at: now,
          },
        ],
      });

      const runner = await service.selectRunner(['linux', 'docker'], 'tenant-1');

      expect(runner!.id).toBe('runner-light');
    });
  });

  describe('executeOnRunner', () => {
    it('should dispatch task to remote runner via HTTP', async () => {
      const task = {
        id: 'task-1',
        name: 'build',
        type: 'shell/script',
        parameters: { script: 'echo hello' },
      };

      mockSafeFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-1', status: 'running' }),
      });

      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          id: 'job-1',
          runner_id: 'runner-1',
          task_id: 'task-1',
          status: 'running',
        }],
      });

      const result = await service.executeOnRunner('runner-1', task as any, 'http://runner-1:8080');

      expect(result.status).toBe('running');
      expect(result.jobId).toBe('job-1');
      expect(mockSafeFetch).toHaveBeenCalledWith(
        'http://runner-1:8080/execute',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle remote runner HTTP failure', async () => {
      const task = {
        id: 'task-2',
        name: 'test',
        type: 'npm/run',
        parameters: { command: 'test' },
      };

      // Use a mock that resolves all queries
      mockDbQuery.mockImplementation(async (query: string) => {
        if (query.includes('INSERT INTO runner_jobs')) {
          return { rows: [{ id: 'job-2', runner_id: 'runner-1', task_id: 'task-2', status: 'pending' }] };
        }
        if (query.includes('status = \'failed\'')) {
          return { rows: [{ id: 'job-2', status: 'failed', runner_id: 'runner-1' }] };
        }
        return { rows: [] };
      });

      mockSafeFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Runner error',
      });

      await expect(
        service.executeOnRunner('runner-1', task as any, 'http://runner-1:8080')
      ).rejects.toThrow(/Runner HTTP 500/);
    });
  });

  describe('releaseRunner', () => {
    it('should mark runner as available and decrement current jobs', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'runner-1', current_jobs: 1 }] });

      await service.releaseRunner('runner-1');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('current_jobs = GREATEST'),
        ['runner-1']
      );
    });
  });

  describe('markJobComplete', () => {
    it('should mark job as complete and release runner', async () => {
      const result = { exitCode: 0, stdout: 'done', stderr: '' };

      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'job-1', runner_id: 'runner-1' }] });
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // runner decrement

      await service.markJobComplete('job-1', result, 'runner-1');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'completed'"),
        expect.any(Array)
      );
    });
  });

  describe('getStaleRunners', () => {
    it('should find runners with expired heartbeats', async () => {
      const now = new Date();
      const staleDate = new Date(now.getTime() - 10 * 60 * 1000); // 10 min ago

      // Mock both findByStatus calls (online and busy)
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [
            { id: 'runner-stale', name: 'stale-runner', status: 'online', last_heartbeat: staleDate, labels: '[]', max_concurrent: 1, current_jobs: 0, metadata: '{}', created_at: now, tenant_id: 'tenant-1' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [], // busy runners
        });

      const stale = await service.getStaleRunners(5); // 5 minute timeout

      expect(stale.length).toBeGreaterThan(0);
    });
  });

  describe('db not available', () => {
    it('should throw error when db is not available', async () => {
      const noDbService = new RunnerPoolService(null);

      await expect(
        noDbService.registerRunner({
          tenantId: 'tenant-1',
          name: 'test-runner',
          labels: ['linux'],
          maxConcurrent: 2,
        })
      ).rejects.toThrow('Database not available');
    });

    it('should throw error on selectRunner when db is not available', async () => {
      const noDbService = new RunnerPoolService(null);

      await expect(noDbService.selectRunner(['linux'], 'tenant-1'))
        .rejects.toThrow('Database not available');
    });
  });
});
