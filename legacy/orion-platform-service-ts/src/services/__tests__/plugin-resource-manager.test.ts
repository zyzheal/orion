/**
 * Plugin Resource Manager Tests
 */

import { PluginResourceManager } from '../plugin/PluginResourceManager';
import { DEFAULT_QUOTA, SECURITY_LEVEL_QUOTAS } from '../plugin/types';

describe('PluginResourceManager', () => {
  let manager: PluginResourceManager;

  beforeEach(() => {
    manager = new PluginResourceManager();
  });

  afterEach(() => {
    manager.releaseAll();
  });

  describe('Quota Allocation', () => {
    it('should allocate quota successfully', () => {
      const context = manager.allocateQuota('task-1', 'plugin-1', 'MEDIUM');

      expect(context).not.toBeNull();
      expect(context?.taskId).toBe('task-1');
      expect(context?.pluginId).toBe('plugin-1');
      expect(context?.quota).toEqual(SECURITY_LEVEL_QUOTAS.MEDIUM);
    });

    it('should use default quota when no security level provided', () => {
      const context = manager.allocateQuota('task-2', 'plugin-2');

      expect(context).not.toBeNull();
      expect(context?.quota).toEqual(DEFAULT_QUOTA);
    });

    it('should use custom quota when set', () => {
      const customQuota = {
        cpuCores: 4,
        memoryBytes: 4 * 1024 * 1024 * 1024,
        timeoutMs: 120000,
        maxConcurrent: 30,
      };

      manager.setPluginQuota('plugin-custom', customQuota);
      const context = manager.allocateQuota('task-3', 'plugin-custom');

      expect(context).not.toBeNull();
      expect(context?.quota).toEqual(customQuota);
    });

    it('should track active allocations', () => {
      manager.allocateQuota('task-1', 'plugin-1');
      manager.allocateQuota('task-2', 'plugin-2');

      const allocations = manager.getActiveAllocations();
      expect(allocations.length).toBe(2);
    });
  });

  describe('Quota Limits', () => {
    it('should reject allocation when max concurrent reached', () => {
      // 设置全局配额的 maxConcurrent 为 2
      manager = new PluginResourceManager({
        globalQuota: {
          cpuCores: 8,
          memoryBytes: 16 * 1024 * 1024 * 1024,
          timeoutMs: 300000,
          maxConcurrent: 2,
        },
      });

      manager.allocateQuota('task-1', 'plugin-1');
      manager.allocateQuota('task-2', 'plugin-2');
      const result = manager.allocateQuota('task-3', 'plugin-3');

      expect(result).toBeNull();
    });

    it('should emit allocation:failed event when quota exceeded', () => {
      // 创建一个低 CPU 配额的 manager
      const lowCpuManager = new PluginResourceManager({
        globalQuota: {
          cpuCores: 1,
          memoryBytes: 1024 * 1024 * 1024,
          timeoutMs: 300000,
          maxConcurrent: 10,
        },
      });

      const handler = jest.fn();
      lowCpuManager.on('allocation:failed', handler);

      // MEDIUM 需要 2 核，但只有 1 核可用
      const result = lowCpuManager.allocateQuota('task-1', 'plugin-1', 'MEDIUM');

      // 应该失败并触发事件
      expect(result).toBeNull();
      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].reason).toContain('Insufficient CPU');

      lowCpuManager.releaseAll();
    });
  });

  describe('Quota Release', () => {
    it('should release quota successfully', () => {
      manager.allocateQuota('task-1', 'plugin-1');
      manager.releaseQuota('task-1');

      const stats = manager.getResourceStats();
      expect(stats.activeExecutions).toBe(0);
    });

    it('should emit allocation:released event', () => {
      const handler = jest.fn();
      manager.on('allocation:released', handler);

      manager.allocateQuota('task-1', 'plugin-1');
      manager.releaseQuota('task-1');

      expect(handler).toHaveBeenCalled();
    });

    it('should handle release of non-existent allocation', () => {
      // 不应该抛出错误
      manager.releaseQuota('non-existent-task');
    });
  });

  describe('Resource Stats', () => {
    it('should track peak concurrency', () => {
      manager.allocateQuota('task-1', 'plugin-1');
      manager.allocateQuota('task-2', 'plugin-2');
      manager.allocateQuota('task-3', 'plugin-3');

      let stats = manager.getResourceStats();
      expect(stats.peakConcurrency).toBe(3);

      manager.releaseQuota('task-1');
      stats = manager.getResourceStats();
      expect(stats.peakConcurrency).toBe(3); // peak should stay at 3
      expect(stats.activeExecutions).toBe(2);
    });

    it('should track total allocations', () => {
      manager.allocateQuota('task-1', 'plugin-1');
      manager.releaseQuota('task-1');
      manager.allocateQuota('task-2', 'plugin-2');

      const stats = manager.getResourceStats();
      expect(stats.totalAllocated).toBe(2);
    });
  });

  describe('Available Resources', () => {
    it('should calculate available resources correctly', () => {
      const initial = manager.getAvailableResources();
      expect(initial.cpuCores).toBe(8);
      expect(initial.memoryBytes).toBe(16 * 1024 * 1024 * 1024);

      manager.allocateQuota('task-1', 'plugin-1', 'MEDIUM');
      const after = manager.getAvailableResources();

      expect(after.cpuCores).toBe(8 - SECURITY_LEVEL_QUOTAS.MEDIUM.cpuCores);
      expect(after.memoryBytes).toBe(16 * 1024 * 1024 * 1024 - SECURITY_LEVEL_QUOTAS.MEDIUM.memoryBytes);
    });
  });
});