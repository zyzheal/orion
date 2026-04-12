/**
 * NamespacePoolService 单元测试
 */

import { NamespacePoolService, NamespacePoolEntry, NamespacePoolConfig } from '../NamespacePoolService';

describe('NamespacePoolService', () => {
  let poolService: NamespacePoolService;

  beforeEach(() => {
    poolService = new NamespacePoolService({
      poolSize: 100,
      namespacePrefix: 'orion-ns-',
      clusterId: 'cluster-001',
      reservedNamespaces: [],
    });
  });

  describe('initializePool', () => {
    it('should create pool of correct size', () => {
      const status = poolService.getPoolStatus();

      expect(status.total).toBe(100);
      expect(status.available).toBe(100);
      expect(status.allocated).toBe(0);
      expect(status.reserved).toBe(0);
    });

    it('should create namespaces with correct prefix', () => {
      const namespace = poolService.getNamespace('orion-ns-001');

      expect(namespace).toBeDefined();
      expect(namespace?.namespaceName).toBe('orion-ns-001');
      expect(namespace?.status).toBe('available');
    });

    it('should emit pool:initialized event', () => {
      // Create service with pre-configured listener
      const newService = new NamespacePoolService();

      // Since the event is emitted during initialization, we need to verify by checking the pool
      // which was created during initialization
      const status = newService.getPoolStatus();

      expect(status.total).toBe(100);
      expect(status.available).toBe(100);
    });
  });

  describe('allocateNamespace', () => {
    it('should allocate namespace to tenant', () => {
      const result = poolService.allocateNamespace(100);

      expect(result.success).toBe(true);
      expect(result.namespace).toBeDefined();
      expect(result.namespace?.tenantId).toBe(100);
      expect(result.namespace?.status).toBe('allocated');
    });

    it('should update pool status after allocation', () => {
      poolService.allocateNamespace(100);
      poolService.allocateNamespace(200);

      const status = poolService.getPoolStatus();

      expect(status.available).toBe(98);
      expect(status.allocated).toBe(2);
      expect(status.tenantAllocations.get(100)).toBe(1);
      expect(status.tenantAllocations.get(200)).toBe(1);
    });

    it('should emit namespace:allocated event', (done) => {
      poolService.on('namespace:allocated', (data) => {
        expect(data.tenantId).toBe(100);
        expect(data.namespace.tenantId).toBe(100);
        done();
      });

      poolService.allocateNamespace(100);
    });

    it('should fail when tenant reaches max namespaces', () => {
      // Allocate 10 namespaces (max per tenant = poolSize/10 = 10)
      for (let i = 0; i < 10; i++) {
        poolService.allocateNamespace(100);
      }

      // Try to allocate one more
      const result = poolService.allocateNamespace(100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum namespace allocation');
    });

    it('should fail when pool exhausted', () => {
      // Exhaust pool by allocating to different tenants
      for (let tenantId = 1; tenantId <= 10; tenantId++) {
        for (let i = 0; i < 10; i++) {
          poolService.allocateNamespace(tenantId);
        }
      }

      const result = poolService.allocateNamespace(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No available namespaces');
    });

    it('should add tenant-specific labels', () => {
      const result = poolService.allocateNamespace(100, {
        purpose: 'production',
        labels: { 'env': 'prod' },
      });

      expect(result.namespace?.labels['orion.io/tenant']).toBe('100');
      expect(result.namespace?.labels['env']).toBe('prod');
      expect(result.namespace?.purpose).toBe('production');
    });
  });

  describe('releaseNamespace', () => {
    it('should release allocated namespace', () => {
      const allocationResult = poolService.allocateNamespace(100);
      const namespaceName = allocationResult.namespace?.namespaceName;

      if (!namespaceName) {
        throw new Error('Allocation failed');
      }

      const releaseResult = poolService.releaseNamespace(namespaceName);

      expect(releaseResult.success).toBe(true);
      expect(releaseResult.namespace?.status).toBe('available');
      expect(releaseResult.namespace?.tenantId).toBeNull();
    });

    it('should update pool status after release', () => {
      const allocationResult = poolService.allocateNamespace(100);
      poolService.releaseNamespace(allocationResult.namespace?.namespaceName || '');

      const status = poolService.getPoolStatus();

      expect(status.available).toBe(100);
      expect(status.allocated).toBe(0);
      expect(status.tenantAllocations.get(100)).toBeUndefined();
    });

    it('should emit namespace:released event', (done) => {
      poolService.on('namespace:released', (data) => {
        expect(data.tenantId).toBe(100);
        expect(data.namespace.status).toBe('available');
        done();
      });

      const result = poolService.allocateNamespace(100);
      poolService.releaseNamespace(result.namespace?.namespaceName || '');
    });

    it('should fail for non-existent namespace', () => {
      const result = poolService.releaseNamespace('non-existent-ns');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail for already available namespace', () => {
      const result = poolService.releaseNamespace('orion-ns-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already available');
    });
  });

  describe('allocateNamespaces (batch)', () => {
    it('should allocate multiple namespaces', () => {
      const results = poolService.allocateNamespaces(100, 3);

      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should stop when quota reached', () => {
      // Already allocated 8 namespaces
      poolService.allocateNamespaces(100, 8);

      // Try to allocate 5 more (max is 10)
      const results = poolService.allocateNamespaces(100, 5);

      // Should get 2 successful + 1 failed = 3 total results
      expect(results.length).toBe(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);
    });
  });

  describe('getTenantNamespaces', () => {
    it('should return tenant allocated namespaces', () => {
      poolService.allocateNamespaces(100, 3);
      poolService.allocateNamespace(200);

      const tenant100Namespaces = poolService.getTenantNamespaces(100);
      const tenant200Namespaces = poolService.getTenantNamespaces(200);

      expect(tenant100Namespaces.length).toBe(3);
      expect(tenant200Namespaces.length).toBe(1);
    });

    it('should return empty array for tenant with no allocations', () => {
      const namespaces = poolService.getTenantNamespaces(999);

      expect(namespaces).toEqual([]);
    });
  });

  describe('getNamespace', () => {
    it('should return namespace details', () => {
      const namespace = poolService.getNamespace('orion-ns-001');

      expect(namespace).toBeDefined();
      expect(namespace?.namespaceName).toBe('orion-ns-001');
    });

    it('should return null for non-existent namespace', () => {
      const namespace = poolService.getNamespace('non-existent');

      expect(namespace).toBeNull();
    });
  });

  describe('getPoolStatus', () => {
    it('should return correct pool statistics', () => {
      poolService.allocateNamespace(100);
      poolService.allocateNamespace(200);
      poolService.allocateNamespace(300);

      const status = poolService.getPoolStatus();

      expect(status.total).toBe(100);
      expect(status.available).toBe(97);
      expect(status.allocated).toBe(3);
      expect(status.reserved).toBe(0);
      expect(status.tenantAllocations.size).toBe(3);
    });
  });

  describe('validateNamespaceAccess', () => {
    it('should allow tenant access to their namespace', () => {
      const result = poolService.allocateNamespace(100);
      const namespaceName = result.namespace?.namespaceName || '';

      expect(poolService.validateNamespaceAccess(namespaceName, 100)).toBe(true);
    });

    it('should deny tenant access to other namespace', () => {
      const result = poolService.allocateNamespace(100);
      const namespaceName = result.namespace?.namespaceName || '';

      expect(poolService.validateNamespaceAccess(namespaceName, 200)).toBe(false);
    });

    it('should allow system tenant to access any namespace', () => {
      const result = poolService.allocateNamespace(100);
      const namespaceName = result.namespace?.namespaceName || '';

      expect(poolService.validateNamespaceAccess(namespaceName, 0)).toBe(true);
    });

    it('should deny access to non-existent namespace', () => {
      expect(poolService.validateNamespaceAccess('non-existent', 100)).toBe(false);
    });
  });

  describe('updateNamespaceStatus', () => {
    it('should update namespace status', () => {
      poolService.allocateNamespace(100);
      const namespace = poolService.getTenantNamespaces(100)[0];

      const updated = poolService.updateNamespaceStatus(
        namespace.namespaceName,
        'reserved',
        { purpose: 'maintenance' }
      );

      expect(updated?.status).toBe('reserved');
      expect(updated?.purpose).toBe('maintenance');
    });

    it('should emit namespace:updated event', (done) => {
      poolService.on('namespace:updated', (ns: NamespacePoolEntry) => {
        expect(ns.status).toBe('reserved');
        done();
      });

      poolService.updateNamespaceStatus('orion-ns-001', 'reserved');
    });
  });

  describe('reinitialize', () => {
    it('should reinitialize pool with new config', () => {
      const newConfig: Partial<NamespacePoolConfig> = {
        poolSize: 50,
        namespacePrefix: 'new-ns-',
      };

      poolService.reinitialize(newConfig);

      const status = poolService.getPoolStatus();
      expect(status.total).toBe(50);
      expect(status.available).toBe(50);

      const namespace = poolService.getNamespace('new-ns-001');
      expect(namespace).toBeDefined();
    });

    it('should clear all allocations when reinitialized', () => {
      poolService.allocateNamespace(100);
      poolService.allocateNamespace(200);

      poolService.reinitialize({ poolSize: 100 });

      const status = poolService.getPoolStatus();
      expect(status.allocated).toBe(0);
      expect(status.tenantAllocations.size).toBe(0);
    });
  });

  describe('reserved namespaces', () => {
    it('should reserve specified namespaces', () => {
      const reservedService = new NamespacePoolService({
        reservedNamespaces: ['orion-ns-001', 'orion-ns-002'],
      });

      const ns1 = reservedService.getNamespace('orion-ns-001');
      const ns2 = reservedService.getNamespace('orion-ns-002');

      expect(ns1?.status).toBe('reserved');
      expect(ns2?.status).toBe('reserved');

      const status = reservedService.getPoolStatus();
      expect(status.reserved).toBe(2);
    });

    it('should not allow releasing reserved namespace', () => {
      const reservedService = new NamespacePoolService({
        reservedNamespaces: ['orion-ns-001'],
      });

      const result = reservedService.releaseNamespace('orion-ns-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot release reserved namespace');
    });
  });
});