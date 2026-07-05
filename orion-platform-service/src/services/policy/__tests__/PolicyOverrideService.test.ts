/**
 * PolicyOverrideService 单元测试
 *
 * Uses mock repositories to test business logic without a real database.
 */

import {
  PolicyOverrideService,
  type CreateOverrideInput,
  type UpdateOverrideInput,
} from '../PolicyOverrideService';
import { PolicyOverrideRepository, PolicyOverrideEntity } from '../../../repositories/PolicyOverrideRepository';

// ==================== Mock Repository ====================

function createMockRepository() {
  const store: PolicyOverrideEntity[] = [];

  const repository = {
    findById: jest.fn().mockImplementation(async (id: string) => {
      return store.find(e => e.id === id);
    }),
    findAll: jest.fn().mockImplementation(async () => {
      return { entities: [...store], total: store.length };
    }),
    createOverride: jest.fn().mockImplementation(async (input: any) => {
      const entity: PolicyOverrideEntity = {
        id: input.id,
        tenantId: input.tenantId,
        policyId: input.policyId,
        pipelineId: input.pipelineId,
        runId: input.runId,
        violationId: input.violationId,
        reason: input.reason,
        approvedBy: input.approvedBy,
        approvedAt: input.approvedAt,
        status: input.status,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        revokedAt: input.revokedAt,
        revokedBy: input.revokedBy,
        scope: input.scope,
      };
      store.push(entity);
      return entity;
    }),
    delete: jest.fn().mockImplementation(async (id: string) => {
      const idx = store.findIndex(e => e.id === id);
      if (idx === -1) return false;
      store.splice(idx, 1);
      return true;
    }),
    findActiveByTenant: jest.fn().mockImplementation(async (tenantId: string) => {
      return store.filter(e => e.tenantId === tenantId && e.status === 'active');
    }),
    findByTenant: jest.fn().mockImplementation(async (tenantId: string) => {
      const entities = store.filter(e => e.tenantId === tenantId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { entities, total: entities.length };
    }),
    findActiveByTenantAndPolicy: jest.fn().mockImplementation(async (tenantId: string, policyId: string) => {
      return store.find(e => e.tenantId === tenantId && e.policyId === policyId && e.status === 'active');
    }),
    updateOverride: jest.fn().mockImplementation(async (id: string, updates: any) => {
      const entity = store.find(e => e.id === id);
      if (!entity) return undefined;
      Object.assign(entity, updates);
      return entity;
    }),
    markExpired: jest.fn().mockImplementation(async (now: Date) => {
      let count = 0;
      for (const entity of store) {
        if (entity.status === 'active' && entity.expiresAt && entity.expiresAt < now) {
          entity.status = 'expired';
          entity.updatedAt = now;
          count++;
        }
      }
      return count;
    }),
  } as unknown as PolicyOverrideRepository;

  return { repository, store };
}

function createMockService() {
  const { repository, store } = createMockRepository();
  const service = new PolicyOverrideService();
  service.setRepository(repository);
  return { service, repository, store };
}

// ==================== Tests ====================

describe('PolicyOverrideService', () => {
  // ==================== createOverride ====================

  describe('createOverride', () => {
    it('should create a new override', async () => {
      const { service } = createMockService();
      const input: CreateOverrideInput = {
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'Emergency deployment needed',
        approvedBy: 'admin@example.com',
        expiresAt: new Date(Date.now() + 3600000),
      };

      const override = await service.createOverride(input);

      expect(override.id).toBeDefined();
      expect(override.tenantId).toBe('tenant-1');
      expect(override.policyId).toBe('policy-1');
      expect(override.status).toBe('active');
      expect(override.approvedBy).toBe('admin@example.com');
    });

    it('should create override with optional fields', async () => {
      const { service } = createMockService();
      const override = await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
        pipelineId: 'pipe-1',
        runId: 'run-1',
        scope: 'project',
      });

      expect(override.pipelineId).toBe('pipe-1');
      expect(override.runId).toBe('run-1');
      expect(override.scope).toBe('project');
    });
  });

  // ==================== getOverride ====================

  describe('getOverride', () => {
    it('should return override by ID', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });

      const found = await service.getOverride(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent override', async () => {
      const { service } = createMockService();
      const found = await service.getOverride('non-existent');
      expect(found).toBeNull();
    });
  });

  // ==================== getActiveOverride ====================

  describe('getActiveOverride', () => {
    it('should return active override for tenant+policy', async () => {
      const { service } = createMockService();
      await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'active override',
        approvedBy: 'admin',
      });

      const found = await service.getActiveOverride('tenant-1', 'policy-1');
      expect(found).not.toBeNull();
      expect(found!.policyId).toBe('policy-1');
    });

    it('should return null for non-overridden policy', async () => {
      const { service } = createMockService();
      const found = await service.getActiveOverride('tenant-1', 'policy-99');
      expect(found).toBeNull();
    });

    it('should not return revoked overrides', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'will be revoked',
        approvedBy: 'admin',
      });
      await service.revokeOverride(created.id, 'admin');

      const found = await service.getActiveOverride('tenant-1', 'policy-1');
      expect(found).toBeNull();
    });
  });

  // ==================== listOverrides ====================

  describe('listOverrides', () => {
    it('should return all overrides for tenant', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1', policyId: 'policy-1', reason: 'first', approvedBy: 'admin' });
      await service.createOverride({ tenantId: 'tenant-1', policyId: 'policy-2', reason: 'second', approvedBy: 'admin' });
      await service.createOverride({ tenantId: 'tenant-2', policyId: 'policy-3', reason: 'other tenant', approvedBy: 'admin' });

      const result = await service.listOverrides({ tenantId: 'tenant-1' });
      expect(result.overrides).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1', policyId: 'policy-1', reason: 'active', approvedBy: 'admin' });
      const created = await service.createOverride({ tenantId: 'tenant-1', policyId: 'policy-2', reason: 'will revoke', approvedBy: 'admin' });
      await service.revokeOverride(created.id, 'admin');

      const result = await service.listOverrides({ tenantId: 'tenant-1', status: 'active' });
      expect(result.overrides).toHaveLength(1);
      expect(result.overrides[0].policyId).toBe('policy-1');
    });

    it('should filter by policyId', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1', policyId: 'policy-1', reason: 'first', approvedBy: 'admin' });
      await service.createOverride({ tenantId: 'tenant-1', policyId: 'policy-2', reason: 'second', approvedBy: 'admin' });

      const result = await service.listOverrides({ tenantId: 'tenant-1', policyId: 'policy-1' });
      expect(result.overrides).toHaveLength(1);
      expect(result.overrides[0].policyId).toBe('policy-1');
    });
  });

  // ==================== getActiveOverrides ====================

  describe('getActiveOverrides', () => {
    it('should return only active overrides', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1', policyId: 'policy-1', reason: 'active override', approvedBy: 'admin' });
      const created = await service.createOverride({ tenantId: 'tenant-1', policyId: 'policy-2', reason: 'will be revoked', approvedBy: 'admin' });
      await service.revokeOverride(created.id, 'admin');

      const active = await service.getActiveOverrides('tenant-1');
      expect(active).toHaveLength(1);
      expect(active[0].policyId).toBe('policy-1');
    });

    it('should not return expired overrides', async () => {
      const { service } = createMockService();
      await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'expired soon',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      // Mark expired first
      await service.markExpiredOverrides();

      const active = await service.getActiveOverrides('tenant-1');
      expect(active).toHaveLength(0);
    });
  });

  // ==================== updateOverride ====================

  describe('updateOverride', () => {
    it('should update override reason', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'original reason',
        approvedBy: 'admin',
      });

      const updated = await service.updateOverride(created.id, { reason: 'updated reason' });
      expect(updated).not.toBeNull();
      expect(updated!.reason).toBe('updated reason');
    });

    it('should update override expiresAt', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const newExpiry = new Date(Date.now() + 7200000);
      const updated = await service.updateOverride(created.id, { expiresAt: newExpiry });
      expect(updated).not.toBeNull();
      expect(updated!.expiresAt).toEqual(newExpiry);
    });

    it('should return null for non-existent override', async () => {
      const { service } = createMockService();
      const updated = await service.updateOverride('non-existent', { reason: 'test' });
      expect(updated).toBeNull();
    });
  });

  // ==================== revokeOverride ====================

  describe('revokeOverride', () => {
    it('should revoke an active override', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });

      const revoked = await service.revokeOverride(created.id, 'admin@example.com');

      expect(revoked).not.toBeNull();
      expect(revoked!.status).toBe('revoked');
      expect(revoked!.revokedBy).toBe('admin@example.com');
      expect(revoked!.revokedAt).toBeDefined();
    });

    it('should return null for non-existent override', async () => {
      const { service } = createMockService();
      const result = await service.revokeOverride('non-existent', 'admin');
      expect(result).toBeNull();
    });
  });

  // ==================== deleteOverride ====================

  describe('deleteOverride', () => {
    it('should delete an override', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });

      const deleted = await service.deleteOverride(created.id);
      expect(deleted).toBe(true);

      const found = await service.getOverride(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent override', async () => {
      const { service } = createMockService();
      const deleted = await service.deleteOverride('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== markExpiredOverrides ====================

  describe('markExpiredOverrides', () => {
    it('should mark expired overrides', async () => {
      const { service } = createMockService();
      await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'expired',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() - 1000),
      });
      await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-2',
        reason: 'not expired',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const count = await service.markExpiredOverrides();
      expect(count).toBe(1);
    });

    it('should return 0 when no expired overrides', async () => {
      const { service } = createMockService();
      await service.createOverride({
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'not expired',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const count = await service.markExpiredOverrides();
      expect(count).toBe(0);
    });
  });
});
