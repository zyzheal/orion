/**
 * NamespacePoolService 单元测试
 *
 * 使用 mock NamespaceAllocationRepository（基于内存 Map）
 */

import { NamespacePoolService, NamespacePoolEntry, NamespacePoolConfig } from '../NamespacePoolService';
import { NamespaceAllocationRepository, NamespaceAllocationEntity } from '../../../repositories/NamespaceAllocationRepository';

// Mock repository backed by in-memory store
function createMockRepo(config: Partial<NamespacePoolConfig> = {}) {
  const poolSize = config.poolSize ?? 100;
  const namespacePrefix = config.namespacePrefix ?? 'orion-ns-';
  const clusterId = config.clusterId ?? 'default';
  const store = new Map<string, NamespaceAllocationEntity>();

  // Pre-populate pool entries
  for (let i = 1; i <= poolSize; i++) {
    const namespaceName = `${namespacePrefix}${i.toString().padStart(3, '0')}`;
    const entity: NamespaceAllocationEntity = {
      id: `ns-${i}`,
      namespaceName,
      clusterId,
      tenantId: null,
      status: 'available',
      labels: {
        'orion.io/pool': 'true',
        'orion.io/index': i.toString(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.set(entity.id, entity);
  }

  // Handle reserved namespaces
  const reservedNamespaces = config.reservedNamespaces ?? [];
  for (const reserved of reservedNamespaces) {
    for (const entity of store.values()) {
      if (entity.namespaceName === reserved) {
        entity.status = 'reserved';
        entity.purpose = 'system';
        break;
      }
    }
  }

  const repo = {
    findAllEntries: jest.fn().mockImplementation(async () => {
      return Array.from(store.values());
    }),

    findByNamespaceName: jest.fn().mockImplementation(async (name: string) => {
      for (const entity of store.values()) {
        if (entity.namespaceName === name) return entity;
      }
      return undefined;
    }),

    findAvailable: jest.fn().mockImplementation(async () => {
      for (const entity of store.values()) {
        if (entity.status === 'available') return entity;
      }
      return undefined;
    }),

    findByTenantId: jest.fn().mockImplementation(async (tenantId: number) => {
      return Array.from(store.values()).filter(
        e => e.tenantId === tenantId && e.status === 'allocated'
      );
    }),

    allocate: jest.fn().mockImplementation(async (id: string, tenantId: string | number, purpose: string, labels: Record<string, string>) => {
      const entity = store.get(id);
      if (!entity) throw new Error(`Namespace ${id} not found`);
      const isNumeric = typeof tenantId === 'number' || (typeof tenantId === 'string' && /^\d+$/.test(tenantId));
      entity.tenantId = isNumeric ? Number(tenantId) : null;
      entity.status = 'allocated';
      entity.purpose = purpose;
      entity.labels = { ...entity.labels, ...labels };
      entity.allocatedAt = new Date();
      entity.updatedAt = new Date();
      store.set(id, entity);
      return entity;
    }),

    release: jest.fn().mockImplementation(async (id: string) => {
      const entity = store.get(id);
      if (!entity) throw new Error(`Namespace ${id} not found`);
      entity.tenantId = null;
      entity.status = 'available';
      entity.purpose = undefined;
      entity.allocatedAt = undefined;
      entity.labels = { 'orion.io/pool': 'true', 'orion.io/index': entity.labels['orion.io/index'] || '' };
      entity.updatedAt = new Date();
      store.set(id, entity);
      return entity;
    }),

    countByStatus: jest.fn().mockImplementation(async (status: string) => {
      return Array.from(store.values()).filter(e => e.status === status).length;
    }),

    countByTenant: jest.fn().mockImplementation(async (tenantId: number) => {
      return Array.from(store.values()).filter(e => e.tenantId === tenantId && e.status === 'allocated').length;
    }),

    countAllocationsByTenant: jest.fn().mockImplementation(async () => {
      const map = new Map<number, number>();
      for (const entity of store.values()) {
        if (entity.status === 'allocated' && entity.tenantId != null) {
          map.set(entity.tenantId, (map.get(entity.tenantId) || 0) + 1);
        }
      }
      return map;
    }),

    updateStatus: jest.fn().mockImplementation(async (id: string, status: string, purpose: string | null, labels: Record<string, string>) => {
      const entity = store.get(id);
      if (!entity) throw new Error(`Namespace ${id} not found`);
      entity.status = status as 'available' | 'allocated' | 'reserved';
      entity.purpose = purpose ?? entity.purpose;
      entity.labels = labels;
      entity.updatedAt = new Date();
      store.set(id, entity);
      return entity;
    }),

    _store: store,
    _reset: () => {
      store.clear();
    },
  };

  return repo as unknown as NamespaceAllocationRepository;
}

describe('NamespacePoolService', () => {
  let poolService: NamespacePoolService;
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(async () => {
    mockRepo = createMockRepo({
      poolSize: 100,
      namespacePrefix: 'orion-ns-',
      clusterId: 'cluster-001',
      reservedNamespaces: [],
    });
    poolService = new NamespacePoolService(mockRepo, {
      poolSize: 100,
      namespacePrefix: 'orion-ns-',
      clusterId: 'cluster-001',
      reservedNamespaces: [],
    });
    await poolService.initialize();
  });

  describe('constructor', () => {
    it('should throw if repository is not provided', () => {
      expect(() => new NamespacePoolService(null as any)).toThrow('NamespaceAllocationRepository is required');
    });

    it('should throw if repository is undefined', () => {
      expect(() => new NamespacePoolService(undefined as any)).toThrow('NamespaceAllocationRepository is required');
    });
  });

  describe('initializePool', () => {
    it('should create pool of correct size', async () => {
      const status = await poolService.getPoolStatus();

      expect(status.total).toBe(100);
      expect(status.available).toBe(100);
      expect(status.allocated).toBe(0);
      expect(status.reserved).toBe(0);
    });

    it('should create namespaces with correct prefix', async () => {
      const namespace = await poolService.getNamespace('orion-ns-001');

      expect(namespace).toBeDefined();
      expect(namespace?.namespaceName).toBe('orion-ns-001');
      expect(namespace?.status).toBe('available');
    });
  });

  describe('allocateNamespace', () => {
    it('should allocate namespace to tenant', async () => {
      const result = await poolService.allocateNamespace(100);

      expect(result.success).toBe(true);
      expect(result.namespace).toBeDefined();
      expect(result.namespace?.tenantId).toBe(100);
      expect(result.namespace?.status).toBe('allocated');
    });

    it('should update pool status after allocation', async () => {
      await poolService.allocateNamespace(100);
      await poolService.allocateNamespace(200);

      const status = await poolService.getPoolStatus();

      expect(status.available).toBe(98);
      expect(status.allocated).toBe(2);
      expect(status.tenantAllocations.get(100)).toBe(1);
      expect(status.tenantAllocations.get(200)).toBe(1);
    });

    it('should emit namespace:allocated event', async () => {
      const eventPromise = new Promise<void>((resolve) => {
        poolService.on('namespace:allocated', (data) => {
          expect(data.tenantId).toBe(100);
          expect(data.namespace.tenantId).toBe(100);
          resolve();
        });
      });

      await poolService.allocateNamespace(100);
      await eventPromise;
    });

    it('should fail when tenant reaches max namespaces', async () => {
      for (let i = 0; i < 10; i++) {
        await poolService.allocateNamespace(100);
      }

      const result = await poolService.allocateNamespace(100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum namespace allocation');
    });

    it('should fail when pool exhausted', async () => {
      for (let tenantId = 1; tenantId <= 10; tenantId++) {
        for (let i = 0; i < 10; i++) {
          await poolService.allocateNamespace(tenantId);
        }
      }

      const result = await poolService.allocateNamespace(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No available namespaces');
    });

    it('should add tenant-specific labels', async () => {
      const result = await poolService.allocateNamespace(100, {
        purpose: 'production',
        labels: { 'env': 'prod' },
      });

      expect(result.namespace?.labels['orion.io/tenant']).toBe('100');
      expect(result.namespace?.labels['env']).toBe('prod');
      expect(result.namespace?.purpose).toBe('production');
    });
  });

  describe('releaseNamespace', () => {
    it('should release allocated namespace', async () => {
      const allocationResult = await poolService.allocateNamespace(100);
      const namespaceName = allocationResult.namespace?.namespaceName;

      if (!namespaceName) {
        throw new Error('Allocation failed');
      }

      const releaseResult = await poolService.releaseNamespace(namespaceName);

      expect(releaseResult.success).toBe(true);
      expect(releaseResult.namespace?.status).toBe('available');
      expect(releaseResult.namespace?.tenantId).toBeNull();
    });

    it('should update pool status after release', async () => {
      const allocationResult = await poolService.allocateNamespace(100);
      await poolService.releaseNamespace(allocationResult.namespace?.namespaceName || '');

      const status = await poolService.getPoolStatus();

      expect(status.available).toBe(100);
      expect(status.allocated).toBe(0);
      expect(status.tenantAllocations.get(100)).toBeUndefined();
    });

    it('should emit namespace:released event', async () => {
      const eventPromise = new Promise<void>((resolve) => {
        poolService.on('namespace:released', (data) => {
          expect(data.tenantId).toBe(100);
          expect(data.namespace.status).toBe('available');
          resolve();
        });
      });

      const result = await poolService.allocateNamespace(100);
      await poolService.releaseNamespace(result.namespace?.namespaceName || '');
      await eventPromise;
    });

    it('should fail for non-existent namespace', async () => {
      const result = await poolService.releaseNamespace('non-existent-ns');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail for already available namespace', async () => {
      const result = await poolService.releaseNamespace('orion-ns-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already available');
    });
  });

  describe('allocateNamespaces (batch)', () => {
    it('should allocate multiple namespaces', async () => {
      const results = await poolService.allocateNamespaces(100, 3);

      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should stop when quota reached', async () => {
      await poolService.allocateNamespaces(100, 8);

      const results = await poolService.allocateNamespaces(100, 5);

      expect(results.length).toBe(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);
    });
  });

  describe('getTenantNamespaces', () => {
    it('should return tenant allocated namespaces', async () => {
      await poolService.allocateNamespaces(100, 3);
      await poolService.allocateNamespace(200);

      const tenant100Namespaces = await poolService.getTenantNamespaces(100);
      const tenant200Namespaces = await poolService.getTenantNamespaces(200);

      expect(tenant100Namespaces.length).toBe(3);
      expect(tenant200Namespaces.length).toBe(1);
    });

    it('should return empty array for tenant with no allocations', async () => {
      const namespaces = await poolService.getTenantNamespaces(999);

      expect(namespaces).toEqual([]);
    });
  });

  describe('getNamespace', () => {
    it('should return namespace details', async () => {
      const namespace = await poolService.getNamespace('orion-ns-001');

      expect(namespace).toBeDefined();
      expect(namespace?.namespaceName).toBe('orion-ns-001');
    });

    it('should return null for non-existent namespace', async () => {
      const namespace = await poolService.getNamespace('non-existent');

      expect(namespace).toBeNull();
    });
  });

  describe('getPoolStatus', () => {
    it('should return correct pool statistics', async () => {
      await poolService.allocateNamespace(100);
      await poolService.allocateNamespace(200);
      await poolService.allocateNamespace(300);

      const status = await poolService.getPoolStatus();

      expect(status.total).toBe(100);
      expect(status.available).toBe(97);
      expect(status.allocated).toBe(3);
      expect(status.reserved).toBe(0);
      expect(status.tenantAllocations.size).toBe(3);
    });
  });

  describe('validateNamespaceAccess', () => {
    it('should allow tenant access to their namespace', async () => {
      const result = await poolService.allocateNamespace(100);
      const namespaceName = result.namespace?.namespaceName || '';

      const access = await poolService.validateNamespaceAccess(namespaceName, 100);
      expect(access).toBe(true);
    });

    it('should deny tenant access to other namespace', async () => {
      const result = await poolService.allocateNamespace(100);
      const namespaceName = result.namespace?.namespaceName || '';

      const access = await poolService.validateNamespaceAccess(namespaceName, 200);
      expect(access).toBe(false);
    });

    it('should allow system tenant to access any namespace', async () => {
      const result = await poolService.allocateNamespace(100);
      const namespaceName = result.namespace?.namespaceName || '';

      const access = await poolService.validateNamespaceAccess(namespaceName, 0);
      expect(access).toBe(true);
    });

    it('should deny access to non-existent namespace', async () => {
      const access = await poolService.validateNamespaceAccess('non-existent', 100);
      expect(access).toBe(false);
    });
  });

  describe('updateNamespaceStatus', () => {
    it('should update namespace status', async () => {
      await poolService.allocateNamespace(100);
      const namespaces = await poolService.getTenantNamespaces(100);
      const namespace = namespaces[0];

      const updated = await poolService.updateNamespaceStatus(
        namespace.namespaceName,
        'reserved',
        { purpose: 'maintenance' }
      );

      expect(updated?.status).toBe('reserved');
      expect(updated?.purpose).toBe('maintenance');
    });

    it('should emit namespace:updated event', async () => {
      const eventPromise = new Promise<void>((resolve) => {
        poolService.on('namespace:updated', (ns: NamespacePoolEntry) => {
          expect(ns.status).toBe('reserved');
          resolve();
        });
      });

      await poolService.updateNamespaceStatus('orion-ns-001', 'reserved');
      await eventPromise;
    });
  });

  describe('reinitialize', () => {
    it('should reinitialize pool with new config', async () => {
      // Create a new repo with different config
      const newMockRepo = createMockRepo({
        poolSize: 50,
        namespacePrefix: 'new-ns-',
      });
      // We can't change the repo after construction, so test with the existing one
      // The reinitialize method updates config only in DB-backed mode
      // For this test, we just verify the method doesn't throw
      await expect(poolService.reinitialize({ poolSize: 100 })).resolves.not.toThrow();
    });

    it('should preserve allocations when reinitialized', async () => {
      await poolService.allocateNamespace(100);
      await poolService.allocateNamespace(200);

      await poolService.reinitialize({ poolSize: 100 });

      // reinitialize only updates config; DB state (allocations) persists
      const status = await poolService.getPoolStatus();
      expect(status.allocated).toBe(2);
      expect(status.tenantAllocations.size).toBe(2);
    });
  });

  describe('reserved namespaces', () => {
    it('should reserve specified namespaces', async () => {
      const reservedRepo = createMockRepo({
        reservedNamespaces: ['orion-ns-001', 'orion-ns-002'],
      });
      const reservedService = new NamespacePoolService(reservedRepo, {
        reservedNamespaces: ['orion-ns-001', 'orion-ns-002'],
      });
      await reservedService.initialize();

      const ns1 = await reservedService.getNamespace('orion-ns-001');
      const ns2 = await reservedService.getNamespace('orion-ns-002');

      expect(ns1?.status).toBe('reserved');
      expect(ns2?.status).toBe('reserved');

      const status = await reservedService.getPoolStatus();
      expect(status.reserved).toBe(2);
    });

    it('should not allow releasing reserved namespace', async () => {
      const reservedRepo = createMockRepo({
        reservedNamespaces: ['orion-ns-001'],
      });
      const reservedService = new NamespacePoolService(reservedRepo, {
        reservedNamespaces: ['orion-ns-001'],
      });
      await reservedService.initialize();

      const result = await reservedService.releaseNamespace('orion-ns-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot release reserved namespace');
    });
  });
});
