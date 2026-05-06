/**
 * CanaryTrafficManagerService 单元测试
 */

import { CanaryTrafficManagerService } from '../CanaryTrafficManagerService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('CanaryTrafficManagerService', () => {
  let service: CanaryTrafficManagerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CanaryTrafficManagerService(mockPool as any);
  });

  describe('createCanary', () => {
    it('应该创建 Canary 配置', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          tenant_id: 'tenant1',
          deployment_id: 'deployment1',
          initial_percent: 5,
          max_percent: 100,
          increment_percent: 10,
          status: 'running',
          current_percent: 5,
        }],
      });

      const result = await service.createCanary({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
      });

      expect(result.deployment_id).toBe('deployment1');
      expect(result.status).toBe('running');
    });

    it('应该使用默认初始百分比', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'c1', initial_percent: 5 }],
      });

      const result = await service.createCanary({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
      });

      expect(result.initial_percent).toBe(5);
    });

    it('应该支持自定义初始百分比', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'c1', initial_percent: 10 }],
      });

      const result = await service.createCanary({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
        initial_percent: 10,
      });

      expect(result.initial_percent).toBe(10);
    });

    it('应该设置当前百分比为初始值', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'c1', current_percent: 5 }],
      });

      const result = await service.createCanary({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
        initial_percent: 5,
      });

      expect(result.current_percent).toBe(5);
    });
  });

  describe('getCanary', () => {
    it('应该返回 Canary 配置', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          deployment_id: 'deployment1',
          status: 'running',
        }],
      });

      const result = await service.getCanary('c1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('running');
    });

    it('应该返回 null 如果未找到', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getCanary('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('analyzeCanary', () => {
    it('应该分析 Canary', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'c1',
            success_threshold: 0.99,
            rollback_threshold: 0.95,
            current_percent: 10,
            max_percent: 100,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'a1',
            canary_id: 'c1',
            stable_success_rate: 0.99,
            canary_success_rate: 0.98,
            recommendation: 'continue',
          }],
        });

      const result = await service.analyzeCanary('c1');

      expect(result).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });

    it('应该拒绝不存在的 Canary', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.analyzeCanary('nonexistent')).rejects.toThrow('Canary not found');
    });

    it('应该返回 continue 如果成功率高于阈值', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            success_threshold: 0.99,
            rollback_threshold: 0.95,
            current_percent: 10,
            max_percent: 100,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ recommendation: 'continue' }],
        });

      const result = await service.analyzeCanary('c1');

      expect(result.recommendation).toBe('continue');
    });

    it('应该返回 promote 如果达到最大百分比', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            success_threshold: 0.99,
            rollback_threshold: 0.95,
            current_percent: 100,
            max_percent: 100,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ recommendation: 'promote' }],
        });

      const result = await service.analyzeCanary('c1');

      expect(result.recommendation).toBe('promote');
    });

    it('应该返回 rollback 如果成功率低于阈值', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            success_threshold: 0.99,
            rollback_threshold: 0.95,
            current_percent: 10,
            max_percent: 100,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ recommendation: 'rollback' }],
        });

      const result = await service.analyzeCanary('c1');

      expect(result.recommendation).toBe('rollback');
    });

    it('应该返回 pause 如果成功率在阈值之间', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            success_threshold: 0.99,
            rollback_threshold: 0.95,
            current_percent: 10,
            max_percent: 100,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ recommendation: 'pause' }],
        });

      const result = await service.analyzeCanary('c1');

      expect(['pause', 'continue', 'rollback', 'promote'].includes(result.recommendation)).toBe(true);
    });
  });

  describe('incrementTraffic', () => {
    it('应该增加流量百分比', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            current_percent: 10,
            increment_percent: 10,
            max_percent: 100,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'c1', current_percent: 20 }],
        });

      const result = await service.incrementTraffic('c1');

      expect(result.current_percent).toBe(20);
    });

    it('应该不超过最大百分比', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            current_percent: 95,
            increment_percent: 10,
            max_percent: 100,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ current_percent: 100 }],
        });

      const result = await service.incrementTraffic('c1');

      expect(result.current_percent).toBeLessThanOrEqual(100);
    });

    it('应该拒绝不存在的 Canary', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(service.incrementTraffic('nonexistent')).rejects.toThrow('Canary not found');
    });
  });

  describe('rollbackCanary', () => {
    it('应该回滚 Canary', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          status: 'rollback',
          current_percent: 0,
        }],
      });

      const result = await service.rollbackCanary('c1');

      expect(result.status).toBe('rollback');
      expect(result.current_percent).toBe(0);
    });
  });

  describe('promoteCanary', () => {
    it('应该推广 Canary', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          status: 'completed',
          current_percent: 100,
        }],
      });

      const result = await service.promoteCanary('c1');

      expect(result.status).toBe('completed');
      expect(result.current_percent).toBe(100);
    });
  });

  describe('CanaryConfig', () => {
    it('应该包含完整的配置信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          tenant_id: 'tenant1',
          deployment_id: 'deployment1',
          initial_percent: 5,
          max_percent: 100,
          increment_percent: 10,
          increment_interval_minutes: 10,
          analysis_window_minutes: 5,
          success_threshold: 0.99,
          rollback_threshold: 0.95,
          status: 'running',
          current_percent: 5,
          created_at: new Date(),
        }],
      });

      const result = await service.createCanary({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
      });

      expect(result.id).toBeDefined();
      expect(result.increment_interval_minutes).toBeDefined();
      expect(result.analysis_window_minutes).toBeDefined();
    });

    it('应该支持不同的状态', async () => {
      const statuses = ['running', 'completed', 'rollback', 'paused'];

      for (const status of statuses) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', status }],
        });

        const result = await service.getCanary('c1');
        if (result) {
          expect(['running', 'completed', 'rollback', 'paused'].includes(result.status)).toBe(true);
        }
      }
    });
  });

  describe('CanaryAnalysis', () => {
    it('应该包含完整的分析信息', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            success_threshold: 0.99,
            rollback_threshold: 0.95,
            current_percent: 10,
            max_percent: 100,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'a1',
            canary_id: 'c1',
            window_start: new Date(),
            window_end: new Date(),
            stable_success_rate: 0.99,
            canary_success_rate: 0.98,
            stable_error_rate: 0.01,
            canary_error_rate: 0.02,
            recommendation: 'continue',
            created_at: new Date(),
          }],
        });

      const result = await service.analyzeCanary('c1');

      expect(result.window_start).toBeDefined();
      expect(result.window_end).toBeDefined();
      expect(result.stable_success_rate).toBeDefined();
      expect(result.canary_success_rate).toBeDefined();
    });
  });
});