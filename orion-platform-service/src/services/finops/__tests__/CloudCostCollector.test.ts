/**
 * CloudCostCollector 单元测试
 */

import {
  CloudCostCollector,
  AWSCostAdapter,
  AliCloudCostAdapter,
  TencentCloudCostAdapter,
} from '../CloudCostCollector';

describe('CloudCostCollector', () => {
  let collector: CloudCostCollector;

  beforeEach(() => {
    collector = new CloudCostCollector();
  });

  // ==================== Adapter Registration ====================

  describe('getRegisteredProviders', () => {
    it('should have default providers registered', () => {
      const providers = collector.getRegisteredProviders();

      expect(providers).toContain('aws');
      expect(providers).toContain('alicloud');
      expect(providers).toContain('tencent');
    });

    it('should register a custom adapter', () => {
      const customAdapter = new AWSCostAdapter();
      customAdapter.provider = 'azure';
      collector.registerAdapter(customAdapter);

      const providers = collector.getRegisteredProviders();
      expect(providers).toContain('azure');
    });
  });

  describe('getAdapter', () => {
    it('should return adapter for registered provider', () => {
      const adapter = collector.getAdapter('aws');
      expect(adapter).toBeDefined();
      expect(adapter!.provider).toBe('aws');
    });

    it('should return undefined for unregistered provider', () => {
      const adapter = collector.getAdapter('gcp');
      expect(adapter).toBeUndefined();
    });
  });

  // ==================== Cost Collection ====================

  describe('collectFromProvider', () => {
    it('should collect costs from AWS', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      const resources = await collector.collectFromProvider('aws', startDate, endDate);

      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].provider).toBe('aws');
      expect(resources[0].cost).toBeGreaterThan(0);
      expect(resources[0].currency).toBe('USD');
    });

    it('should collect costs from AliCloud', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      const resources = await collector.collectFromProvider('alicloud', startDate, endDate);

      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].provider).toBe('alicloud');
    });

    it('should collect costs from Tencent Cloud', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      const resources = await collector.collectFromProvider('tencent', startDate, endDate);

      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].provider).toBe('tencent');
    });

    it('should throw error for unregistered provider', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      await expect(
        collector.collectFromProvider('gcp' as any, startDate, endDate)
      ).rejects.toThrow('No adapter registered for provider: gcp');
    });
  });

  describe('collectAll', () => {
    it('should collect from all providers', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      const resources = await collector.collectAll(startDate, endDate);

      expect(resources.length).toBeGreaterThan(0);
      // Should include multiple providers
      const providers = new Set(resources.map((r) => r.provider));
      expect(providers.size).toBeGreaterThan(1);
    });

    it('should skip disabled providers', async () => {
      collector.setSchedule('aws', {
        provider: 'aws',
        cronExpression: '0 0 * * *',
        enabled: false,
      });

      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      const resources = await collector.collectAll(startDate, endDate);

      // AWS should be skipped
      const awsResources = resources.filter((r) => r.provider === 'aws');
      expect(awsResources.length).toBe(0);
    });
  });

  // ==================== Cost Normalization ====================

  describe('normalizeCost', () => {
    it('should convert CNY to USD', () => {
      const normalized = collector.normalizeCurrency(100, 'CNY');
      // 100 CNY * 0.14 = 14 USD
      expect(normalized).toBe(14);
    });

    it('should keep USD as is', () => {
      const normalized = collector.normalizeCurrency(100, 'USD');
      expect(normalized).toBe(100);
    });

    it('should use rate 1 for unknown currency', () => {
      const normalized = collector.normalizeCurrency(100, 'GBP');
      expect(normalized).toBe(100);
    });

    it('should normalize a list of resources', () => {
      const resources = [
        {
          id: '1',
          provider: 'alicloud' as const,
          resourceType: 'compute' as const,
          resourceId: 'r1',
          region: 'cn-hangzhou',
          cost: 100,
          currency: 'CNY',
          tags: {},
          timestamp: new Date(),
        },
      ];

      const normalized = collector.normalizeCost(resources);
      expect(normalized[0].currency).toBe('USD');
      expect(normalized[0].cost).toBe(14);
    });
  });

  // ==================== Grouping ====================

  describe('groupByResourceType', () => {
    it('should group costs by resource type', () => {
      const resources = [
        { resourceType: 'compute' as const, cost: 100 },
        { resourceType: 'compute' as const, cost: 50 },
        { resourceType: 'storage' as const, cost: 30 },
        { resourceType: 'network' as const, cost: 20 },
      ] as any;

      const grouped = collector.groupByResourceType(resources);

      expect(grouped['compute']).toBe(150);
      expect(grouped['storage']).toBe(30);
      expect(grouped['network']).toBe(20);
    });

    it('should return empty object for no resources', () => {
      const grouped = collector.groupByResourceType([]);
      expect(Object.keys(grouped).length).toBe(0);
    });
  });

  describe('groupByTenant', () => {
    it('should group costs by tenant', () => {
      const resources = [
        { tenantId: 'tenant-001', cost: 100 },
        { tenantId: 'tenant-001', cost: 50 },
        { tenantId: 'tenant-002', cost: 30 },
        { cost: 20 }, // no tenant
      ] as any;

      const grouped = collector.groupByTenant(resources);

      expect(grouped['tenant-001']).toBe(150);
      expect(grouped['tenant-002']).toBe(30);
      expect(grouped['unknown']).toBe(20);
    });
  });

  // ==================== Scheduling ====================

  describe('setSchedule', () => {
    it('should set and get schedule', () => {
      const schedule = {
        provider: 'aws' as const,
        cronExpression: '0 0 * * *',
        enabled: true,
      };

      collector.setSchedule('aws', schedule);
      const retrieved = collector.getSchedule('aws');

      expect(retrieved).toBeDefined();
      expect(retrieved!.cronExpression).toBe('0 0 * * *');
      expect(retrieved!.enabled).toBe(true);
    });

    it('should return undefined for unset schedule', () => {
      const schedule = collector.getSchedule('aws');
      expect(schedule).toBeUndefined();
    });
  });

  // ==================== Data Management ====================

  describe('getCollectedData', () => {
    it('should return all collected data', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      await collector.collectFromProvider('aws', startDate, endDate);

      const data = collector.getCollectedData();
      expect(data.length).toBeGreaterThan(0);
    });

    it('should return a copy, not the original array', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      await collector.collectFromProvider('aws', startDate, endDate);

      const data1 = collector.getCollectedData();
      const data2 = collector.getCollectedData();

      expect(data1).not.toBe(data2);
      expect(data1.length).toBe(data2.length);
    });
  });

  describe('clearCollectedData', () => {
    it('should clear all collected data', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      await collector.collectFromProvider('aws', startDate, endDate);
      collector.clearCollectedData();

      const data = collector.getCollectedData();
      expect(data.length).toBe(0);
    });
  });

  // ==================== Individual Adapters ====================

  describe('AWSCostAdapter', () => {
    it('should return AWS resources', async () => {
      const adapter = new AWSCostAdapter();
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      const resources = await adapter.collectCosts(startDate, endDate);

      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].provider).toBe('aws');
      expect(resources.every((r) => r.provider === 'aws')).toBe(true);
    });

    it('should report connected status', async () => {
      const adapter = new AWSCostAdapter();
      const status = await adapter.getStatus();

      expect(status.connected).toBe(true);
    });
  });

  describe('AliCloudCostAdapter', () => {
    it('should return AliCloud resources', async () => {
      const adapter = new AliCloudCostAdapter();
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      const resources = await adapter.collectCosts(startDate, endDate);

      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].provider).toBe('alicloud');
    });
  });

  describe('TencentCloudCostAdapter', () => {
    it('should return Tencent resources', async () => {
      const adapter = new TencentCloudCostAdapter();
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      const resources = await adapter.collectCosts(startDate, endDate);

      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].provider).toBe('tencent');
    });
  });
});
