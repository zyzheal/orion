/**
 * Runner 模型测试
 */
import {
  createRunner,
  isRunnerAvailable,
  getRunnerUtilization,
  isRunnerStale,
} from '../Runner';

describe('Runner', () => {
  describe('createRunner', () => {
    it('should create runner with defaults', () => {
      const runner = createRunner({
        tenantId: 't1',
        name: 'runner-1',
        labels: ['linux', 'x86'],
        maxConcurrent: 5,
      });

      expect(runner.id).toBeDefined();
      expect(runner.tenantId).toBe('t1');
      expect(runner.name).toBe('runner-1');
      expect(runner.status).toBe('online');
      expect(runner.labels).toEqual(['linux', 'x86']);
      expect(runner.maxConcurrent).toBe(5);
      expect(runner.currentJobs).toBe(0);
      expect(runner.lastHeartbeat).toBeInstanceOf(Date);
      expect(runner.metadata).toEqual({});
      expect(runner.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const runner = createRunner({
        tenantId: 't1',
        name: 'r1',
        labels: [],
        maxConcurrent: 3,
        metadata: { os: 'linux', arch: 'arm64' },
        endpoint: 'http://runner-1:8080',
      });

      expect(runner.metadata.os).toBe('linux');
      expect(runner.endpoint).toBe('http://runner-1:8080');
    });
  });

  describe('isRunnerAvailable', () => {
    it('should return true for online runner with capacity', () => {
      const runner = createRunner({
        tenantId: 't1', name: 'r1', labels: [], maxConcurrent: 5,
      });
      expect(isRunnerAvailable(runner)).toBe(true);
    });

    it('should return false for runner at capacity', () => {
      const runner = {
        ...createRunner({
          tenantId: 't1', name: 'r1', labels: [], maxConcurrent: 1,
        }),
        currentJobs: 1,
      };
      expect(isRunnerAvailable(runner)).toBe(false);
    });

    it('should return false for offline runner', () => {
      const runner = {
        ...createRunner({
          tenantId: 't1', name: 'r1', labels: [], maxConcurrent: 5,
        }),
        status: 'offline' as const,
      };
      expect(isRunnerAvailable(runner)).toBe(false);
    });
  });

  describe('getRunnerUtilization', () => {
    it('should return 0 for idle runner', () => {
      const runner = createRunner({
        tenantId: 't1', name: 'r1', labels: [], maxConcurrent: 5,
      });
      expect(getRunnerUtilization(runner)).toBe(0);
    });

    it('should return correct ratio', () => {
      const runner = {
        ...createRunner({
          tenantId: 't1', name: 'r1', labels: [], maxConcurrent: 4,
        }),
        currentJobs: 2,
      };
      expect(getRunnerUtilization(runner)).toBe(0.5);
    });

    it('should return 1 for zero maxConcurrent', () => {
      const runner = {
        ...createRunner({
          tenantId: 't1', name: 'r1', labels: [], maxConcurrent: 0,
        }),
        currentJobs: 0,
      };
      expect(getRunnerUtilization(runner)).toBe(1);
    });
  });

  describe('isRunnerStale', () => {
    it('should return false for recent heartbeat', () => {
      const runner = createRunner({
        tenantId: 't1', name: 'r1', labels: [], maxConcurrent: 5,
      });
      expect(isRunnerStale(runner)).toBe(false);
    });

    it('should return true for old heartbeat', () => {
      const runner = {
        ...createRunner({
          tenantId: 't1', name: 'r1', labels: [], maxConcurrent: 5,
        }),
        lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      };
      expect(isRunnerStale(runner, 5)).toBe(true);
    });

    it('should use custom timeout', () => {
      const runner = {
        ...createRunner({
          tenantId: 't1', name: 'r1', labels: [], maxConcurrent: 5,
        }),
        lastHeartbeat: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
      };
      expect(isRunnerStale(runner, 2)).toBe(true);
      expect(isRunnerStale(runner, 5)).toBe(false);
    });
  });
});
