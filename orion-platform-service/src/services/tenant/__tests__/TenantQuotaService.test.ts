/**
 * TenantQuotaService 单元测试
 */

import { TenantQuotaService, TenantQuota, QuotaAlert } from '../TenantQuotaService';

// Mock database for testing
const createMockDb = () => {
  const mockQuotas: Map<string, any> = new Map();

  return {
    query: jest.fn().mockImplementation((sql: string, params?: unknown[]) => {
      // Handle SELECT queries
      if (sql.includes('SELECT') && sql.includes('FROM tenant_quotas')) {
        // findAll: SELECT * FROM tenant_quotas WHERE 1=1 ORDER BY ... LIMIT ... OFFSET ...
        if (sql.includes('WHERE 1=1')) {
          const rows = Array.from(mockQuotas.values());
          return { rows, rowCount: rows.length };
        }
        // findByTenantId: SELECT * FROM tenant_quotas WHERE tenant_id = $1
        if (sql.includes('WHERE tenant_id =')) {
          const tenantId = params?.[0];
          const quota = mockQuotas.get(tenantId);
          if (quota) {
            return { rows: [quota], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
        // findById: SELECT * FROM tenant_quotas WHERE id = $1
        if (sql.includes('WHERE id =')) {
          const id = params?.[0];
          for (const quota of mockQuotas.values()) {
            if (quota.id === id) {
              return { rows: [quota], rowCount: 1 };
            }
          }
          return { rows: [], rowCount: 0 };
        }
      }

      // Handle INSERT queries (with RETURNING *)
      if (sql.includes('INSERT INTO')) {
        // BaseRepository.create flattens the object to columns and values
        // Object keys: id, tenantId, maxUsers, maxPipelines, maxApiCallsPerHour, maxConcurrentBuilds,
        //       maxProjects, maxStorageMb, maxCpuCores, maxMemoryGb, maxTasksPerPipeline,
        //       maxRunners, apiRateLimit, apiRateLimitWindowSeconds, maxPipelineRunsPerDay, usage
        const values = params as unknown[];
        const now = new Date();

        const entity = {
          id: String(values[0]),
          tenant_id: String(values[1]),
          max_users: Number(values[2]) || 100,
          max_pipelines: Number(values[3]) || 200,
          max_api_calls_per_hour: Number(values[4]) || 10000,
          max_concurrent_builds: Number(values[5]) || 10,
          max_projects: Number(values[6]) || 50,
          max_storage_mb: Number(values[7]) || 10240,
          max_cpu_cores: Number(values[8]) || 16,
          max_memory_gb: Number(values[9]) || 32,
          max_tasks_per_pipeline: Number(values[10]) || 50,
          max_runners: Number(values[11]) || 5,
          api_rate_limit: Number(values[12]) || 1000,
          api_rate_limit_window_seconds: Number(values[13]) || 60,
          max_pipeline_runs_per_day: Number(values[14]) || 1000,
          usage: values[15] || {},
          created_at: now,
          updated_at: now,
        };

        mockQuotas.set(entity.tenant_id, entity);
        return { rows: [entity], rowCount: 1 };
      }

      // Handle UPDATE queries (with RETURNING *)
      if (sql.includes('UPDATE tenant_quotas')) {
        const values = params as unknown[];
        const id = String(values[values.length - 1]);

        // Usage-only update: SET usage = $1, updated_at = NOW() WHERE id = $2
        // (from persistTenantUsage / resetTenantUsageInDb / cleanupExpiredUsageInDb)
        if (sql.match(/SET\s+usage\s*=/) && !sql.includes('max_pipelines')) {
          const existing = Array.from(mockQuotas.values()).find(q => q.id === id);
          if (existing) {
            const updated = { ...existing, usage: values[0], updated_at: new Date() };
            mockQuotas.set(existing.tenant_id, updated);
            return { rows: [updated], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // Full update from setQuota: BaseRepository.update() flattens the data object
        // Object keys: maxPipelines, maxApiCallsPerHour, maxConcurrentBuilds, maxProjects,
        // maxStorageMb, maxCpuCores, maxMemoryGb, maxTasksPerPipeline, maxRunners,
        // apiRateLimit, apiRateLimitWindowSeconds, maxPipelineRunsPerDay, usage
        const tenantId = id.replace('quota_', '');

        const existing = mockQuotas.get(tenantId);
        if (existing) {
          const updated = {
            ...existing,
            max_pipelines: Number(values[0]) || existing.max_pipelines,
            max_api_calls_per_hour: Number(values[1]) || existing.max_api_calls_per_hour,
            max_concurrent_builds: Number(values[2]) || existing.max_concurrent_builds,
            max_projects: Number(values[3]) || existing.max_projects,
            max_storage_mb: Number(values[4]) || existing.max_storage_mb,
            max_cpu_cores: Number(values[5]) || existing.max_cpu_cores,
            max_memory_gb: Number(values[6]) || existing.max_memory_gb,
            max_tasks_per_pipeline: Number(values[7]) || existing.max_tasks_per_pipeline,
            max_runners: Number(values[8]) || existing.max_runners,
            api_rate_limit: Number(values[9]) || existing.api_rate_limit,
            api_rate_limit_window_seconds: Number(values[10]) || existing.api_rate_limit_window_seconds,
            max_pipeline_runs_per_day: Number(values[11]) || existing.max_pipeline_runs_per_day,
            usage: values[12] || existing.usage,
            updated_at: new Date(),
          };
          mockQuotas.set(tenantId, updated);
          return { rows: [updated], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    }),
    _reset: () => {
      mockQuotas.clear();
    },
  };
};

describe('TenantQuotaService', () => {
  let quotaService: TenantQuotaService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    quotaService = new TenantQuotaService(mockDb as any);
  });

  afterEach(() => {
    quotaService.resetTenantUsage(100);
    quotaService.resetTenantUsage(200);
    mockDb._reset();
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
      // Get the quota first to determine window
      const quota = await quotaService.getQuota(100);
      const windowIndex = Math.floor(Date.now() / (quota.apiRateLimitWindowSeconds * 1000));

      // Record usage at the limit using the correct key format: tenantId:resourceType:resourceKey
      quotaService.recordUsage(
        100,
        'api_rate',
        `${windowIndex}`, // resourceKey part of the key
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
      // Add expired usage
      quotaService.recordUsage(
        100,
        'pipelines',
        'expired',
        1,
        new Date(Date.now() - 7200000),
        new Date(Date.now() - 3600000)
      );

      // Add valid usage
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
      // Use fresh service instance to avoid afterEach interference
      const freshDb = createMockDb();
      const freshService = new TenantQuotaService(freshDb as any);

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