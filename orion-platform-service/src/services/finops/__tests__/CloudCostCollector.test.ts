/**
 * CloudCostCollector 单元测试
 */

import {
  CloudCostCollector,
  AWSCostAdapter,
  AliCloudCostAdapter,
  TencentCloudCostAdapter,
} from '../CloudCostCollector';

/** Convert camelCase to snake_case */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Mock DB that stores rows with snake_case keys (simulating PostgreSQL).
 * Converts camelCase column names from INSERT to snake_case.
 */
function createMockDb() {
  const store: Record<string, any[]> = {};
  let idCounter = 0;

  const db = {
    query: jest.fn(async (text: string, params?: any[]) => {
      // CREATE
      if (text.includes('INSERT INTO')) {
        const table = text.match(/INSERT INTO (\w+)/)?.[1] || 'unknown';
        if (!store[table]) store[table] = [];
        const row: any = {};
        if (params) {
          const cols = text.match(/\(([^)]+)\)\s+VALUES/)?.[1]?.split(',').map(c => c.trim()) || [];
          cols.forEach((col, i) => { row[toSnakeCase(col)] = params[i]; });
        }
        if (!row.id) row.id = `mock-${++idCounter}`;
        if (!row.created_at) row.created_at = new Date();
        if (!row.updated_at) row.updated_at = new Date();
        store[table].push(row);
        return { rows: [row], rowCount: 1 };
      }
      // SELECT COUNT
      if (text.includes('COUNT(*)')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        return { rows: [{ count: String((store[table] || []).length) }], rowCount: 1 };
      }
      // DELETE (must be before WHERE id = $1 check since DELETE also contains it)
      if (text.includes('DELETE')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = store[table] || [];
        const idx = rows.findIndex(r => r.id === params?.[0]);
        if (idx >= 0) {
          rows.splice(idx, 1);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // SELECT by id
      if (text.includes('WHERE id = $1')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.id === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      // SELECT by provider
      if (text.includes('WHERE provider = $1')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.provider === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      // SELECT enabled
      if (text.includes('WHERE enabled = true')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.enabled === true);
        return { rows, rowCount: rows.length };
      }
      // SELECT all (with optional WHERE, ORDER, LIMIT)
      if (text.includes('SELECT * FROM')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        let rows = [...(store[table] || [])];
        return { rows, rowCount: rows.length };
      }
      // UPDATE by provider
      if (text.includes('UPDATE') && text.includes('WHERE provider = $')) {
        const table = text.match(/UPDATE (\w+)/)?.[1] || 'unknown';
        const rows = store[table] || [];
        const provider = params?.[params.length - 1];
        const idx = rows.findIndex(r => r.provider === provider);
        if (idx >= 0) {
          const setMatch = text.match(/SET (.+?) WHERE/);
          if (setMatch && params) {
            const assignments = setMatch[1].split(',').map(s => s.trim());
            let paramIdx = 0;
            for (const assignment of assignments) {
              const colMatch = assignment.match(/^(\w+)\s*=\s*\$(\d+)/);
              if (colMatch) {
                rows[idx][colMatch[1]] = params[paramIdx];
                paramIdx++;
              }
            }
          }
          rows[idx].updated_at = new Date();
          return { rows: [rows[idx]], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // UPDATE by id
      if (text.includes('UPDATE')) {
        const table = text.match(/UPDATE (\w+)/)?.[1] || 'unknown';
        const rows = store[table] || [];
        const id = params?.[params.length - 1];
        const idx = rows.findIndex(r => r.id === id);
        if (idx >= 0) {
          const setMatch = text.match(/SET (.+?) WHERE/);
          if (setMatch && params) {
            const assignments = setMatch[1].split(',').map(s => s.trim());
            let paramIdx = 0;
            for (const assignment of assignments) {
              const colMatch = assignment.match(/^(\w+)\s*=\s*\$(\d+)/);
              if (colMatch) {
                rows[idx][colMatch[1]] = params[paramIdx];
                paramIdx++;
              }
            }
          }
          rows[idx].updated_at = new Date();
          return { rows: [rows[idx]], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // DELETE
      if (text.includes('DELETE')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = store[table] || [];
        const idx = rows.findIndex(r => r.id === params?.[0]);
        if (idx >= 0) {
          rows.splice(idx, 1);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
  return db;
}

describe('CloudCostCollector', () => {
  let collector: CloudCostCollector;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    collector = new CloudCostCollector(mockDb as any);
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
      ).rejects.toThrow();
    });
  });

  describe('collectAll', () => {
    it('should collect from all providers', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      const resources = await collector.collectAll(startDate, endDate);

      expect(resources.length).toBeGreaterThan(0);
      const providers = new Set(resources.map((r) => r.provider));
      expect(providers.size).toBeGreaterThan(1);
    });
  });

  // ==================== Cost Normalization ====================

  describe('normalizeCost', () => {
    it('should convert CNY to USD', () => {
      const normalized = collector.normalizeCurrency(100, 'CNY');
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
        { cost: 20 },
      ] as any;

      const grouped = collector.groupByTenant(resources);

      expect(grouped['tenant-001']).toBe(150);
      expect(grouped['tenant-002']).toBe(30);
      expect(grouped['unknown']).toBe(20);
    });
  });

  // ==================== Scheduling ====================

  describe('setSchedule', () => {
    it('should set and get schedule', async () => {
      const schedule = {
        provider: 'aws' as const,
        cronExpression: '0 0 * * *',
        enabled: true,
      };

      await collector.setSchedule('aws', schedule);
      const retrieved = await collector.getSchedule('aws');

      expect(retrieved).toBeDefined();
      expect(retrieved!.cronExpression).toBe('0 0 * * *');
      expect(retrieved!.enabled).toBe(true);
    });

    it('should return undefined for unset schedule', async () => {
      const schedule = await collector.getSchedule('aws');
      expect(schedule).toBeUndefined();
    });
  });

  // ==================== Data Management ====================

  describe('getCollectedData', () => {
    it('should return all collected data from DB', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      await collector.collectFromProvider('aws', startDate, endDate);

      const data = await collector.getCollectedData();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('clearCollectedData', () => {
    it('should clear all collected data from DB', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-12');

      await collector.collectFromProvider('aws', startDate, endDate);
      await collector.clearCollectedData();

      const data = await collector.getCollectedData();
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
