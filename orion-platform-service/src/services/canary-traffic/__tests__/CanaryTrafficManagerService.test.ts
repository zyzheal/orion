/**
 * CanaryTrafficManagerService 单元测试
 */

import { CanaryTrafficManagerService } from '../CanaryTrafficManagerService';
import { CanaryTrafficRepository, type CanaryConfigEntity, type CanaryAnalysisEntity } from '../../repositories/CanaryTrafficRepository';

// ==================== Mock Repository ==================

function createMockRepo() {
  const configs = new Map<string, CanaryConfigEntity>();
  const analyses = new Map<string, CanaryAnalysisEntity>();

  const mockRepo = {
    configs,
    analyses,

    insertConfig: jest.fn(async (entity: CanaryConfigEntity): Promise<CanaryConfigEntity> => {
      const entry = { ...entity, createdAt: entity.createdAt || new Date() };
      configs.set(entry.id, entry);
      return entry;
    }),

    findConfigById: jest.fn(async (id: string, tenantId: string): Promise<CanaryConfigEntity | undefined> => {
      const entity = configs.get(id);
      if (!entity) return undefined;
      if (entity.tenantId !== tenantId) return undefined;
      return entity;
    }),

    updateCurrentPercent: jest.fn(async (id: string, tenantId: string, currentPercent: number): Promise<CanaryConfigEntity | undefined> => {
      const existing = configs.get(id);
      if (!existing || existing.tenantId !== tenantId) return undefined;
      const updated = { ...existing, currentPercent };
      configs.set(id, updated);
      return updated;
    }),

    updateConfigStatus: jest.fn(async (id: string, tenantId: string, status: CanaryConfigEntity['status'], currentPercent?: number): Promise<CanaryConfigEntity | undefined> => {
      const existing = configs.get(id);
      if (!existing || existing.tenantId !== tenantId) return undefined;
      const updated = { ...existing, status, ...(currentPercent !== undefined ? { currentPercent } : {}) };
      configs.set(id, updated);
      return updated;
    }),

    insertAnalysis: jest.fn(async (entity: CanaryAnalysisEntity): Promise<CanaryAnalysisEntity> => {
      const entry = { ...entity, createdAt: entity.createdAt || new Date() };
      analyses.set(entry.id, entry);
      return entry;
    }),
  };

  return mockRepo;
}

// ==================== Helpers ====================

const TENANT_ID = 'tenant1';

// ==================== Tests ====================

describe('CanaryTrafficManagerService', () => {
  let service: CanaryTrafficManagerService;
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new CanaryTrafficManagerService(mockRepo as unknown as CanaryTrafficRepository);
  });

  // ---- createCanary ----

  describe('createCanary', () => {
    it('应该创建 Canary 配置', async () => {
      const result = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      expect(result).toBeDefined();
      expect(result.deployment_id).toBe('deployment1');
      expect(result.status).toBe('running');
      expect(mockRepo.insertConfig).toHaveBeenCalledTimes(1);
    });

    it('应该使用默认初始百分比', async () => {
      const result = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      expect(result.initial_percent).toBe(5);
      expect(result.current_percent).toBe(5);
    });

    it('应该支持自定义初始百分比', async () => {
      const result = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
        initial_percent: 10,
      });

      expect(result.initial_percent).toBe(10);
      expect(result.current_percent).toBe(10);
    });

    it('应该设置当前百分比为初始值', async () => {
      const result = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
        initial_percent: 5,
      });

      expect(result.current_percent).toBe(5);
    });
  });

  // ---- getCanary ----

  describe('getCanary', () => {
    it('应该返回 Canary 配置', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      const result = await service.getCanary(TENANT_ID, created.id);

      expect(result).not.toBeNull();
      expect(result!.status).toBe('running');
    });

    it('应该返回 null 如果未找到', async () => {
      const result = await service.getCanary(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('应该返回 null 如果租户不匹配', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      const result = await service.getCanary('other-tenant', created.id);

      expect(result).toBeNull();
    });
  });

  // ---- analyzeCanary ----

  describe('analyzeCanary', () => {
    it('应该分析 Canary', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      const result = await service.analyzeCanary(TENANT_ID, created.id);

      expect(result).toBeDefined();
      expect(result.recommendation).toBeDefined();
      expect(mockRepo.insertAnalysis).toHaveBeenCalledTimes(1);
    });

    it('应该拒绝不存在的 Canary', async () => {
      await expect(service.analyzeCanary(TENANT_ID, 'nonexistent')).rejects.toThrow('Canary not found');
    });

    it('应该拒绝租户不匹配的 Canary', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      await expect(service.analyzeCanary('other-tenant', created.id)).rejects.toThrow('Canary not found');
    });

    it('应该返回 continue 如果成功率高于阈值', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      const result = await service.analyzeCanary(TENANT_ID, created.id, { canarySuccessRate: 1.0 });

      expect(result.recommendation).toBe('continue');
    });

    it('应该返回 promote 如果达到最大百分比', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });
      await mockRepo.updateConfigStatus(created.id, TENANT_ID, 'running', 100);

      const result = await service.analyzeCanary(TENANT_ID, created.id, { canarySuccessRate: 1.0 });

      expect(result.recommendation).toBe('promote');
    });

    it('应该返回 rollback 如果成功率低于回滚阈值', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      const result = await service.analyzeCanary(TENANT_ID, created.id, { canarySuccessRate: 0.90 });

      expect(result.recommendation).toBe('rollback');
    });

    it('应该返回 pause 如果成功率在阈值之间', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      // success_threshold=0.99, rollback_threshold=0.95
      // canarySuccessRate=0.97 → 0.97 < 0.99 (not continue), 0.97 >= 0.95 (not rollback) → pause
      const result = await service.analyzeCanary(TENANT_ID, created.id, { canarySuccessRate: 0.97 });

      expect(result.recommendation).toBe('pause');
    });
  });

  // ---- incrementTraffic ----

  describe('incrementTraffic', () => {
    it('应该增加流量百分比', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
        initial_percent: 10,
      });

      const result = await service.incrementTraffic(TENANT_ID, created.id);

      expect(result.current_percent).toBe(20);
    });

    it('应该不超过最大百分比', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
        initial_percent: 95,
      });

      const result = await service.incrementTraffic(TENANT_ID, created.id);

      expect(result.current_percent).toBeLessThanOrEqual(100);
    });

    it('应该拒绝不存在的 Canary', async () => {
      await expect(service.incrementTraffic(TENANT_ID, 'nonexistent')).rejects.toThrow('Canary not found');
    });

    it('应该拒绝租户不匹配的 Canary', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      await expect(service.incrementTraffic('other-tenant', created.id)).rejects.toThrow('Canary not found');
    });
  });

  // ---- rollbackCanary ----

  describe('rollbackCanary', () => {
    it('应该回滚 Canary', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      const result = await service.rollbackCanary(TENANT_ID, created.id);

      expect(result.status).toBe('rollback');
      expect(result.current_percent).toBe(0);
    });

    it('应该拒绝租户不匹配的 Canary', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      await expect(service.rollbackCanary('other-tenant', created.id)).rejects.toThrow('Canary not found');
    });
  });

  // ---- promoteCanary ----

  describe('promoteCanary', () => {
    it('应该推广 Canary', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      const result = await service.promoteCanary(TENANT_ID, created.id);

      expect(result.status).toBe('completed');
      expect(result.current_percent).toBe(100);
    });

    it('应该拒绝租户不匹配的 Canary', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      await expect(service.promoteCanary('other-tenant', created.id)).rejects.toThrow('Canary not found');
    });
  });

  // ---- CanaryConfig ----

  describe('CanaryConfig', () => {
    it('应该包含完整的配置信息', async () => {
      const result = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      expect(result.id).toBeDefined();
      expect(result.increment_interval_minutes).toBeDefined();
      expect(result.analysis_window_minutes).toBeDefined();
    });

    it('应该支持不同的状态', async () => {
      const statuses: Array<'running' | 'completed' | 'rollback' | 'paused'> = ['running', 'completed', 'rollback', 'paused'];

      for (const status of statuses) {
        const created = await service.createCanary({
          tenant_id: TENANT_ID,
          deployment_id: 'deployment1',
        });
        await mockRepo.updateConfigStatus(created.id, TENANT_ID, status);
        const result = await service.getCanary(TENANT_ID, created.id);
        if (result) {
          expect(['running', 'completed', 'rollback', 'paused'].includes(result.status)).toBe(true);
        }
      }
    });
  });

  // ---- CanaryAnalysis ----

  describe('CanaryAnalysis', () => {
    it('应该包含完整的分析信息', async () => {
      const created = await service.createCanary({
        tenant_id: TENANT_ID,
        deployment_id: 'deployment1',
      });

      // Use high success rate to ensure 'continue' recommendation and complete analysis
      const result = await service.analyzeCanary(TENANT_ID, created.id, { canarySuccessRate: 1.0 });

      expect(result.window_start).toBeDefined();
      expect(result.window_end).toBeDefined();
      expect(result.stable_success_rate).toBeCloseTo(0.99);
      expect(result.canary_success_rate).toBeCloseTo(1.0);
      expect(result.recommendation).toBe('continue');
    });
  });
});
