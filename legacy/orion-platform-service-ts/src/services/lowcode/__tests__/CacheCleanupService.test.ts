/**
 * CacheCleanupService - 工作流缓存清理服务测试
 *
 * 覆盖：constructor, start/stop lifecycle, runIncrementalCleanup, runFullCleanup,
 *        getStatus, triggerFullCleanup, error handling
 */

import { CacheCleanupService } from '../CacheCleanupService';

// ---- mocks ----

const mockQuery = jest.fn();
const mockTimerRepoCleanup = jest.fn();
const mockInstanceCleanup = jest.fn();

jest.mock('../../../repositories/WorkflowTimerRepository', () => ({
  WorkflowTimerRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../repositories/WorkflowTaskRepository', () => ({
  WorkflowTaskRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../WorkflowInstance', () => ({
  WorkflowInstanceManager: jest.fn().mockImplementation(() => ({
    repository: {
      cleanupExpiredInstances: mockInstanceCleanup,
    },
  })),
}));

// ---- tests ----

describe('CacheCleanupService', () => {
  let service: CacheCleanupService;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInstanceCleanup.mockResolvedValue(0);

    mockPool = {
      query: mockQuery.mockResolvedValue({ rowCount: 0 }),
    };

    service = new CacheCleanupService(mockPool);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ========== constructor ==========

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(service).toBeDefined();
    });

    it('should accept custom config', () => {
      const custom = new CacheCleanupService(mockPool, {
        incrementalIntervalMs: 30 * 60 * 1000,
        timerRetentionDays: 7,
        taskRetentionDays: 30,
        instanceRetentionDays: 60,
      });
      expect(custom).toBeDefined();
    });
  });

  // ========== start / stop lifecycle ==========

  describe('start', () => {
    it('should start and set isRunning to true', async () => {
      await service.start();

      const status = service.getStatus();
      expect(status.isRunning).toBe(true);
    });

    it('should run full cleanup on start', async () => {
      await service.start();

      // Full cleanup queries timers, tasks, and instances
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should not start twice', async () => {
      await service.start();
      await service.start();

      expect(service.getStatus().isRunning).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop and set isRunning to false', async () => {
      await service.start();
      await service.stop();

      expect(service.getStatus().isRunning).toBe(false);
    });

    it('should do nothing if not running', async () => {
      await service.stop();

      expect(service.getStatus().isRunning).toBe(false);
    });
  });

  // ========== runIncrementalCleanup ==========

  describe('runIncrementalCleanup', () => {
    it('should clean up expired timers and tasks', async () => {
      mockQuery.mockResolvedValue({ rowCount: 5 });

      const results = await service.runIncrementalCleanup();

      // Should have 2 results: timers + tasks (incremental does NOT clean instances)
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('expired_timers');
      expect(results[1].type).toBe('expired_tasks');
    });

    it('should return zero counts when nothing to clean', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const results = await service.runIncrementalCleanup();

      expect(results[0].deletedCount).toBe(0);
      expect(results[1].deletedCount).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('db error'));

      const results = await service.runIncrementalCleanup();

      // Errors are caught per-cleanup, returning 0 deleted
      expect(results[0].deletedCount).toBe(0);
    });

    it('should include duration in results', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const results = await service.runIncrementalCleanup();

      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(results[1].durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ========== runFullCleanup ==========

  describe('runFullCleanup', () => {
    it('should clean up timers, tasks, and instances', async () => {
      mockQuery.mockResolvedValue({ rowCount: 3 });
      mockInstanceCleanup.mockResolvedValue(10);

      const results = await service.runFullCleanup();

      // Should have 3 results: timers + tasks + instances
      expect(results).toHaveLength(3);
      expect(results[0].type).toBe('expired_timers');
      expect(results[1].type).toBe('expired_tasks');
      expect(results[2].type).toBe('expired_instances');
    });

    it('should handle instance cleanup errors', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      mockInstanceCleanup.mockRejectedValue(new Error('instance error'));

      const results = await service.runFullCleanup();

      expect(results[2].type).toBe('expired_instances');
      expect(results[2].deletedCount).toBe(0);
    });

    it('should use retention days from config for queries', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      mockInstanceCleanup.mockResolvedValue(0);

      await service.runFullCleanup();

      // Verify the query was called (dates are computed based on config)
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  // ========== getStatus ==========

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = service.getStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('config');
      expect(status.isRunning).toBe(false);
    });

    it('should reflect running state after start', async () => {
      await service.start();

      expect(service.getStatus().isRunning).toBe(true);
    });
  });

  // ========== triggerFullCleanup ==========

  describe('triggerFullCleanup', () => {
    it('should manually trigger full cleanup', async () => {
      mockQuery.mockResolvedValue({ rowCount: 2 });
      mockInstanceCleanup.mockResolvedValue(1);

      const results = await service.triggerFullCleanup();

      expect(results).toHaveLength(3);
      expect(results[0].deletedCount).toBe(2);
      expect(results[2].deletedCount).toBe(1);
    });
  });

  // ========== error handling in cleanup methods ==========

  describe('error handling', () => {
    it('should handle timer cleanup query failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('timer query failed'));
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const results = await service.runIncrementalCleanup();

      expect(results[0].deletedCount).toBe(0);
      expect(results[0].type).toBe('expired_timers');
    });

    it('should handle task cleanup query failure', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // timers ok
      mockQuery.mockRejectedValueOnce(new Error('task query failed')); // tasks fail

      const results = await service.runIncrementalCleanup();

      expect(results[1].deletedCount).toBe(0);
      expect(results[1].type).toBe('expired_tasks');
    });

    it('should handle null rowCount gracefully', async () => {
      mockQuery.mockResolvedValue({ rowCount: null });

      const results = await service.runIncrementalCleanup();

      expect(results[0].deletedCount).toBe(0);
    });
  });

  // ========== config defaults ==========

  describe('config defaults', () => {
    it('should use default config when none provided', () => {
      const status = service.getStatus();
      const config = status.config;

      expect(config.incrementalIntervalMs).toBe(60 * 60 * 1000); // 1 hour
      expect(config.timerRetentionDays).toBe(30);
      expect(config.taskRetentionDays).toBe(90);
      expect(config.instanceRetentionDays).toBe(90);
    });
  });
});
