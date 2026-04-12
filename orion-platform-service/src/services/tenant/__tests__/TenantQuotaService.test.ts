/**
 * TenantQuotaService 单元测试
 */

import { TenantQuotaService, TenantQuota, QuotaAlert } from '../TenantQuotaService';

describe('TenantQuotaService', () => {
  let quotaService: TenantQuotaService;

  beforeEach(() => {
    quotaService = new TenantQuotaService();
  });

  afterEach(() => {
    quotaService.resetTenantUsage(100);
    quotaService.resetTenantUsage(200);
  });

  describe('getQuota and setQuota', () => {
    it('should return default quota when not configured', () => {
      const quota = quotaService.getQuota(100);

      expect(quota.tenantId).toBe(100);
      expect(quota.maxPipelines).toBe(100);
      expect(quota.maxConcurrentRuns).toBe(10);
      expect(quota.maxRunners).toBe(5);
    });

    it('should set and retrieve custom quota', () => {
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

      quotaService.setQuota(customQuota);
      const quota = quotaService.getQuota(100);

      expect(quota.maxPipelines).toBe(50);
      expect(quota.maxConcurrentRuns).toBe(5);
      expect(quota.maxRunners).toBe(3);
    });

    it('should emit quota:updated event', (done) => {
      quotaService.on('quota:updated', (quota: TenantQuota) => {
        expect(quota.tenantId).toBe(100);
        expect(quota.maxPipelines).toBe(50);
        done();
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
      const quota = quotaService.getQuota(100);
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
    it('should record resource usage', () => {
      quotaService.recordUsage(
        100,
        'pipelines',
        'pipeline-001',
        1,
        new Date(),
        new Date(Date.now() + 3600000)
      );

      const result = quotaService.getUsageReport(100);
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
    it('should generate usage report', () => {
      quotaService.recordUsage(100, 'pipelines', 'p1', 30, new Date(), new Date());
      quotaService.recordUsage(100, 'runners', 'r1', 4, new Date(), new Date());

      const report = quotaService.getUsageReport(100);

      expect(report.quota.tenantId).toBe(100);
      expect(report.usage.pipelines).toBe(30);
      expect(report.usage.runners).toBe(4);
    });

    it('should include alerts when usage is high', () => {
      quotaService.setAlertThreshold(80);
      quotaService.recordUsage(100, 'runners', 'r1', 4, new Date(), new Date()); // 80% of 5

      const report = quotaService.getUsageReport(100);

      expect(report.alerts.length).toBeGreaterThan(0);
      expect(report.alerts[0].resourceType).toBe('runners');
      expect(report.alerts[0].thresholdPercent).toBeGreaterThanOrEqual(80);
    });
  });

  describe('emit quota alert', () => {
    it('should emit quota:alert event when quota exceeded', async () => {
      quotaService.recordUsage(100, 'runners', 'active', 5, new Date(), new Date());

      quotaService.on('quota:alert', (alert: QuotaAlert) => {
        expect(alert.tenantId).toBe(100);
        expect(alert.resourceType).toBe('runners');
      });

      const result = await quotaService.checkRunnerQuota(100, 1);
      expect(result.allowed).toBe(false);
    });
  });

  describe('cleanupExpiredUsage', () => {
    it('should cleanup expired usage records', () => {
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
      expect(quotaService.getUsageReport(100).usage.pipelines).toBe(1);
    });
  });

  describe('resetTenantUsage', () => {
    it('should reset all usage for a tenant', () => {
      quotaService.recordUsage(100, 'pipelines', 'p1', 10, new Date(), new Date());
      quotaService.recordUsage(100, 'runners', 'r1', 3, new Date(), new Date());

      quotaService.resetTenantUsage(100);

      const report = quotaService.getUsageReport(100);
      expect(report.usage.pipelines).toBe(0);
      expect(report.usage.runners).toBe(0);
    });

    it('should emit usage:reset event', (done) => {
      // Use fresh service instance to avoid afterEach interference
      const freshService = new TenantQuotaService();

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

      quotaService.setQuota(customQuota);

      quotaService.recordUsage(200, 'runners', 'active', 1, new Date(), new Date());

      const result = await quotaService.checkRunnerQuota(200, 1);

      expect(result.allowed).toBe(true);
      expect(result.quotaLimit).toBe(2);
    });
  });
});