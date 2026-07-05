/**
 * TenantQuotaService 单元测试
 *
 * 使用 mock TenantQuotaRepository（基于内存 Map）替代直接 mock DB query
 */

import { TenantQuotaService, TenantQuota, QuotaAlert } from '../TenantQuotaService';
import { TenantQuotaRepository, TenantQuotaEntity } from '../../../repositories/TenantQuotaRepository';

// Mock repository backed by in-memory store
function createMockRepo() {
  const store = new Map<string, TenantQuotaEntity>();
  let idCounter = 1;

  const repo = {
    findAll: jest.fn().mockImplementation(async ({ limit }: { limit?: number } = {}) => {
      const entities = Array.from(store.values());
      return { entities: entities.slice(0, limit ?? entities.length), total: entities.length };
    }),

    findByTenantId: jest.fn().mockImplementation(async (tenantId: string) => {
      for (const entity of store.values()) {
        if (entity.tenantId === tenantId) return entity;
      }
      return undefined;
    }),

    findByTenantAndType: jest.fn().mockImplementation(async () => undefined),

    findById: jest.fn().mockImplementation(async (id: string) => {
      return store.get(id);
    }),

    create: jest.fn().mockImplementation(async (data: Partial<TenantQuotaEntity>) => {
      const entity: TenantQuotaEntity = {
        id: data.id || `quota-${idCounter++}`,
        tenantId: data.tenantId || '',
        maxPipelines: data.maxPipelines ?? 100,
        maxPipelineRunsPerDay: data.maxPipelineRunsPerDay ?? 1000,
        maxConcurrentBuilds: data.maxConcurrentBuilds ?? 10,
        maxTasksPerPipeline: data.maxTasksPerPipeline ?? 50,
        maxRunners: data.maxRunners ?? 5,
        maxCpuCores: data.maxCpuCores ?? 16,
        maxMemoryGb: data.maxMemoryGb ?? 32,
        maxStorageMb: data.maxStorageMb ?? 102400,
        maxProjects: data.maxProjects ?? 10,
        maxUsers: data.maxUsers ?? 100,
        apiRateLimit: data.apiRateLimit ?? 1000,
        apiRateLimitWindowSeconds: data.apiRateLimitWindowSeconds ?? 60,
        usage: data.usage ?? {},
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
      };
      store.set(entity.id, entity);
      return entity;
    }),

    update: jest.fn().mockImplementation(async (id: string, data: Partial<TenantQuotaEntity>) => {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.set(id, updated);
      return updated;
    }),

    delete: jest.fn().mockImplementation(async (id: string) => {
      return store.delete(id);
    }),

    incrementUsage: jest.fn(),
    resetUsage: jest.fn(),

    _store: store,
    _reset: () => {
      store.clear();
      idCounter = 1;
    },
  };

  return repo as unknown as TenantQuotaRepository;
}

describe('TenantQuotaService', () => {
  let quotaService: TenantQuotaService;
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    mockRepo = createMockRepo();
    quotaService = new TenantQuotaService(mockRepo);
  });

  afterEach(() => {
    quotaService.resetTenantUsage(100);
    quotaService.resetTenantUsage(200);
    (mockRepo as any)._reset();
  });

  describe('constructor', () => {
    it('should throw if repository is not provided', () => {
      expect(() => new TenantQuotaService(null as any)).toThrow('TenantQuotaRepository is required');
    });

    it('should throw if repository is undefined', () => {
      expect(() => new TenantQuotaService(undefined as any)).toThrow('TenantQuotaRepository is required');
    });
  });

  describe('getQuota and setQuota', () => {
    it('should return default quota when not configured', async () => {
      const quota = await quotaService.getQuota(100);

      expect(quota.tenantId).toBe(100);
      expect(quota.maxPipelines).toBe(100);
      expect(quota.maxConcurrentRuns).toBe(10);
      expect(quota.maxRunners).toBe(5);
    });

    it('should set and retrieve custom quota', async () => {
      const customQuota: TenantQuota = {
        tenantId: 100,
        maxPipelines: 50,
        maxConcurrentRuns: 5,
        maxRunners: 3,
        maxNamespaces: 5,
        maxPipelineRunsPerDay: 500,
        maxTasksPerPipeline: 20,
        maxCpuCores: 8,
        maxMemoryGb: 16,
        maxStorageGb: 50,
        apiRateLimit: 500,
        apiRateLimitWindowSeconds: 60,
      };

      await quotaService.setQuota(customQuota);
      const quota = await quotaService.getQuota(100);

      expect(quota.maxPipelines).toBe(50);
      expect(quota.maxConcurrentRuns).toBe(5);
      expect(quota.maxRunners).toBe(3);
    });

    it('should emit quota:updated event', async () => {
      const emittedQuota = await new Promise<TenantQuota>((resolve) => {
        quotaService.on('quota:updated', (quota: TenantQuota) => {
          resolve(quota);
        });

        quotaService.setQuota({
          tenantId: 100,
          maxPipelines: 50,
          maxConcurrentRuns: 10,
          maxRunners: 5,
          maxNamespaces: 10,
          maxPipelineRunsPerDay: 1000,
          maxTasksPerPipeline: 50,
          maxCpuCores: 16,
          maxMemoryGb: 32,
          maxStorageGb: 100,
          apiRateLimit: 1000,
          apiRateLimitWindowSeconds: 60,
        });
      });

      expect(emittedQuota.tenantId).toBe(100);
      expect(emittedQuota.maxPipelines).toBe(50);
    });
  });

  describe('checkQuota', () => {
    it('should allow when under quota', async () => {
      quotaService.recordUsage(100, 'runners', 'active', 2, new Date(), new Date(Date.now() + 3600000));

      const result = await quotaService.checkRunnerQuota(100, 1);

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(2);
      expect(result.quotaLimit).toBe(5);
      expect(result.remaining).toBe(3);
    });

    it('should deny when quota exceeded', async () => {
      quotaService.recordUsage(100, 'runners', 'active', 5, new Date(), new Date(Date.now() + 3600000));

      const result = await quotaService.checkRunnerQuota(100, 1);

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Quota exceeded');
    });

    it('should check concurrent runs quota', async () => {
      quotaService.recordUsage(100, 'concurrent_runs', 'running', 8, new Date(), new Date(Date.now() + 3600000));

      const result = await quotaService.checkConcurrentRunsQuota(100, 2);

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(8);
      expect(result.quotaLimit).toBe(10);
    });

    it('should check namespace quota', async () => {
      quotaService.recordUsage(100, 'namespaces', 'allocated', 5, new Date(), new Date(Date.now() + 3600000));

      const result = await quotaService.checkNamespaceQuota(100, 5);

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(5);
      expect(result.quotaLimit).toBe(10);
    });

    it('should check pipeline quota', async () => {
      quotaService.recordUsage(100, 'pipelines', 'active', 80, new Date(), new Date(Date.now() + 3600000));

      const result = await quotaService.checkPipelineQuota(100, 10);

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(80);
    });
  });

  describe('checkApiRateLimit', () => {
    it('should allow API requests under rate limit', async () => {
      const result = await quotaService.checkApiRateLimit(100);

      expect(result.allowed).toBe(true);
      expect(result.quotaLimit).toBe(1000);
    });

    it('should deny when rate limit exceeded', async () => {
      const quota = await quotaService.getQuota(100);
      const windowIndex = Math.floor(Date.now() / (quota.apiRateLimitWindowSeconds * 1000));

      quotaService.recordUsage(
        100,
        'api_rate',
        `${windowIndex}`,
        1000,
        new Date(),
        new Date(Date.now() + quota.apiRateLimitWindowSeconds * 1000)
      );

      const result = await quotaService.checkApiRateLimit(100);

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Rate limit exceeded');
    });
  });

  describe('recordUsage and incrementUsage', () => {
    it('should record resource usage', async () => {
      quotaService.recordUsage(
        100,
        'pipelines',
        'pipeline-001',
        1,
        new Date(),
        new Date(Date.now() + 3600000)
      );

      const result = await quotaService.getUsageReport(100);
      expect(result.usage.pipelines).toBe(1);
    });

    it('should increment usage count', () => {
      const newValue = quotaService.incrementUsage(100, 'pipelines', 'pipeline-001');

      expect(newValue).toBe(1);

      const newValue2 = quotaService.incrementUsage(100, 'pipelines', 'pipeline-001');
      expect(newValue2).toBe(2);
    });

    it('should emit usage:recorded event', (done) => {
      quotaService.on('usage:recorded', (data) => {
        expect(data.tenantId).toBe(100);
        expect(data.resourceType).toBe('pipelines');
        done();
      });

      quotaService.recordUsage(100, 'pipelines', 'test', 1, new Date(), new Date());
    });
  });

  describe('getUsageReport', () => {
    it('should generate usage report', async () => {
      quotaService.recordUsage(100, 'pipelines', 'p1', 30, new Date(), new Date());
      quotaService.recordUsage(100, 'runners', 'r1', 4, new Date(), new Date());

      const report = await quotaService.getUsageReport(100);

      expect(report.quota.tenantId).toBe(100);
      expect(report.usage.pipelines).toBe(30);
      expect(report.usage.runners).toBe(4);
    });

    it('should include alerts when usage is high', async () => {
      quotaService.setAlertThreshold(80);
      quotaService.recordUsage(100, 'runners', 'r1', 4, new Date(), new Date()); // 80% of 5

      const report = await quotaService.getUsageReport(100);

      expect(report.alerts.length).toBeGreaterThan(0);
      expect(report.alerts[0].resourceType).toBe('runners');
      expect(report.alerts[0].thresholdPercent).toBeGreaterThanOrEqual(80);
    });
  });

  describe('emit quota alert', () => {
    it('should emit quota:alert event when quota exceeded', async () => {
      quotaService.recordUsage(100, 'runners', 'active', 5, new Date(), new Date());

      const alertPromise = new Promise<QuotaAlert>((resolve) => {
        quotaService.on('quota:alert', (alert: QuotaAlert) => {
          resolve(alert);
        });
      });

      const result = await quotaService.checkRunnerQuota(100, 1);
      expect(result.allowed).toBe(false);

      const alert = await alertPromise;
      expect(alert.tenantId).toBe(100);
      expect(alert.resourceType).toBe('runners');
    });
  });

  describe('cleanupExpiredUsage', () => {
    it('should cleanup expired usage records', async () => {
      quotaService.recordUsage(
        100,
        'pipelines',
        'expired',
        1,
        new Date(Date.now() - 7200000),
        new Date(Date.now() - 3600000)
      );

      quotaService.recordUsage(
        100,
        'pipelines',
        'valid',
        1,
        new Date(),
        new Date(Date.now() + 3600000)
      );

      const cleaned = quotaService.cleanupExpiredUsage();

      expect(cleaned).toBeGreaterThan(0);
      expect((await quotaService.getUsageReport(100)).usage.pipelines).toBe(1);
    });
  });

  describe('resetTenantUsage', () => {
    it('should reset all usage for a tenant', async () => {
      quotaService.recordUsage(100, 'pipelines', 'p1', 10, new Date(), new Date());
      quotaService.recordUsage(100, 'runners', 'r1', 3, new Date(), new Date());

      quotaService.resetTenantUsage(100);

      const report = await quotaService.getUsageReport(100);
      expect(report.usage.pipelines).toBe(0);
      expect(report.usage.runners).toBe(0);
    });

    it('should emit usage:reset event', (done) => {
      const freshRepo = createMockRepo();
      const freshService = new TenantQuotaService(freshRepo);

      freshService.on('usage:reset', (tenantId: number) => {
        expect(tenantId).toBe(100);
        done();
      });

      freshService.resetTenantUsage(100);
    });
  });

  describe('custom quota limits', () => {
    it('should use custom quota limits', async () => {
      const customQuota: TenantQuota = {
        tenantId: 200,
        maxPipelines: 20,
        maxConcurrentRuns: 3,
        maxRunners: 2,
        maxNamespaces: 5,
        maxPipelineRunsPerDay: 100,
        maxTasksPerPipeline: 10,
        maxCpuCores: 4,
        maxMemoryGb: 8,
        maxStorageGb: 20,
        apiRateLimit: 100,
        apiRateLimitWindowSeconds: 60,
      };

      await quotaService.setQuota(customQuota);

      quotaService.recordUsage(200, 'runners', 'active', 1, new Date(), new Date());

      const result = await quotaService.checkRunnerQuota(200, 1);

      expect(result.allowed).toBe(true);
      expect(result.quotaLimit).toBe(2);
    });
  });
});
