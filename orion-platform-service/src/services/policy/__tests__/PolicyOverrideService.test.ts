/**
 * PolicyOverrideService 单元测试
 *
 * Uses mock repositories to test business logic without a real database.
 */

import {
  PolicyOverrideService,
  PolicyOverrideServiceError,
  type PolicyOverrideInput,
  type UpdateOverrideInput,
} from '../PolicyOverrideService';
import { PolicyOverrideRepository, PolicyOverrideEntity } from '../../../repositories/PolicyOverrideRepository';

// ==================== Mock Repository ====================

function createMockRepository() {
  const store: PolicyOverrideEntity[] = [];

  const repository: PolicyOverrideRepository = {
    async findById(id: string): Promise<PolicyOverrideEntity | undefined> {
      return store.find(e => e.id === id);
    },
    async findAll(): Promise<{ entities: PolicyOverrideEntity[]; total: number }> {
      return { entities: [...store], total: store.length };
    },
    async createOverride(input: any): Promise<PolicyOverrideEntity> {
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
    },
    async delete(id: string): Promise<boolean> {
      const idx = store.findIndex(e => e.id === id);
      if (idx === -1) return false;
      store.splice(idx, 1);
      return true;
    },
    async findActiveByTenant(tenantId: string): Promise<PolicyOverrideEntity[]> {
      return store.filter(e => e.tenantId === tenantId && e.status === 'active');
    },
    async findByTenant(tenantId: string): Promise<{ entities: PolicyOverrideEntity[]; total: number }> {
      const entities = store.filter(e => e.tenantId === tenantId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { entities, total: entities.length };
    },
    async findActiveByTenantAndPolicy(tenantId: string, policyId: string): Promise<PolicyOverrideEntity | undefined> {
      return store.find(e => e.tenantId === tenantId && e.policyId === policyId && e.status === 'active');
    },
    async updateOverride(id: string, updates: any): Promise<PolicyOverrideEntity | undefined> {
      const entity = store.find(e => e.id === id);
      if (!entity) return undefined;
      Object.assign(entity, updates);
      return entity;
    },
    async markExpired(now: Date): Promise<number> {
      let count = 0;
      for (const entity of store) {
        if (entity.status === 'active' && entity.expiresAt && entity.expiresAt < now) {
          entity.status = 'expired';
          entity.updatedAt = now;
          count++;
        }
      }
      return count;
    },
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

describe.skip('PolicyOverrideService', () => {
  // ==================== createOverride ====================

  describe('createOverride', () => {
    it('should create a new override', async () => {
      const { service } = createMockService();
      const input: PolicyOverrideInput = {
        policyId: 'policy-1',
        pipelineId: 'pipe-1',
        reason: 'Emergency deployment needed',
        approvedBy: 'admin@example.com',
        expiresAt: new Date(Date.now() + 3600000),
      };

      const override = await service.createOverride({ tenantId: 'tenant-1', ...input });

      expect(override.id).toMatch(/^override-/);
      expect(override.tenantId).toBe('tenant-1');
      expect(override.policyId).toBe('policy-1');
      expect(override.status).toBe('active');
      expect(override.approvedBy).toBe('admin@example.com');
    });

    it('should throw error for missing required fields', async () => {
      const { service } = createMockService();
      await expect(
        service.createOverride({ tenantId: 'tenant-1',
          policyId: '',
          reason: '',
          approvedBy: '',
        })
      ).rejects.toThrow(PolicyOverrideServiceError);
    });

    it('should throw error for missing tenant ID', async () => {
      const { service } = createMockService();
      await expect(
        service.createOverride({ tenantId: '',
          policyId: 'policy-1',
          reason: 'test',
          approvedBy: 'admin',
        })
      ).rejects.toThrow(PolicyOverrideServiceError);
    });
  });

  // ==================== getOverrideById ====================

  describe('getOverrideById', () => {
    it('should return override by ID', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });

      const found = await service.getOverrideById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent override', async () => {
      const { service } = createMockService();
      const found = await service.getOverrideById('non-existent');
      expect(found).toBeNull();
    });
  });

  // ==================== getActiveOverrides ====================

  describe('getActiveOverrides', () => {
    it('should return only active overrides', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'active override',
        approvedBy: 'admin',
      });
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-2',
        reason: 'will be revoked',
        approvedBy: 'admin',
      });
      await service.revokeOverride(created.id, 'admin');

      const active = await service.getActiveOverrides('tenant-1');
      expect(active).toHaveLength(1);
      expect(active[0].policyId).toBe('policy-1');
    });

    it('should mark expired overrides', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'expired soon',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      const active = await service.getActiveOverrides('tenant-1');
      expect(active).toHaveLength(0);
    });
  });

  // ==================== getAllOverrides ====================

  describe('getAllOverrides', () => {
    it('should return all overrides for tenant', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'first',
        approvedBy: 'admin',
      });
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-2',
        reason: 'second',
        approvedBy: 'admin',
      });
      await service.createOverride({ tenantId: 'tenant-2',
        policyId: 'policy-3',
        reason: 'other tenant',
        approvedBy: 'admin',
      });

      const all = await service.getAllOverrides('tenant-1');
      expect(all).toHaveLength(2);
    });

    it('should return sorted by createdAt descending', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1', reason: 'first', approvedBy: 'admin',
      });
      await new Promise((r) => setTimeout(r, 10));
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-2', reason: 'second', approvedBy: 'admin',
      });

      const all = await service.getAllOverrides('tenant-1');
      expect(all[0].policyId).toBe('policy-2');
    });
  });

  // ==================== isOverridden ====================

  describe('isOverridden', () => {
    it('should return true for active override', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'override',
        approvedBy: 'admin',
      });

      const result = await service.isOverridden('tenant-1', 'policy-1');
      expect(result).toBe(true);
    });

    it('should return false for non-overridden policy', async () => {
      const { service } = createMockService();
      const result = await service.isOverridden('tenant-1', 'policy-99');
      expect(result).toBe(false);
    });
  });

  // ==================== updateOverride ====================

  describe('updateOverride', () => {
    it('should update override reason', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'original reason',
        approvedBy: 'admin',
      });

      const input: UpdateOverrideInput = { reason: 'updated reason' };
      const updated = await service.updateOverride(created.id, input);

      expect(updated.reason).toBe('updated reason');
    });

    it('should update override expiresAt', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const newExpiry = new Date(Date.now() + 7200000);
      const input: UpdateOverrideInput = { expiresAt: newExpiry };
      const updated = await service.updateOverride(created.id, input);

      expect(updated.expiresAt).toEqual(newExpiry);
    });

    it('should update both reason and expiresAt', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'original',
        approvedBy: 'admin',
      });

      const newExpiry = new Date(Date.now() + 7200000);
      const input: UpdateOverrideInput = { reason: 'updated', expiresAt: newExpiry };
      const updated = await service.updateOverride(created.id, input);

      expect(updated.reason).toBe('updated');
      expect(updated.expiresAt).toEqual(newExpiry);
    });

    it('should throw error for non-existent override', async () => {
      const { service } = createMockService();
      await expect(
        service.updateOverride('non-existent', { reason: 'test' })
      ).rejects.toThrow(PolicyOverrideServiceError);
    });

    it('should throw error for revoked override', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });
      await service.revokeOverride(created.id, 'admin');

      await expect(
        service.updateOverride(created.id, { reason: 'new reason' })
      ).rejects.toThrow(PolicyOverrideServiceError);
    });

    it('should throw error if no fields provided', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });

      await expect(
        service.updateOverride(created.id, {} as UpdateOverrideInput)
      ).rejects.toThrow(PolicyOverrideServiceError);
    });

    it('should update updatedAt timestamp', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });
      const beforeUpdate = created.updatedAt.getTime();

      await new Promise((r) => setTimeout(r, 10));
      const updated = await service.updateOverride(created.id, { reason: 'updated' });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(beforeUpdate);
    });
  });

  // ==================== revokeOverride ====================

  describe('revokeOverride', () => {
    it('should revoke an active override', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });

      const revoked = await service.revokeOverride(created.id, 'admin@example.com');

      expect(revoked.status).toBe('revoked');
      expect(revoked.revokedBy).toBe('admin@example.com');
      expect(revoked.revokedAt).toBeDefined();
    });

    it('should throw error for already revoked override', async () => {
      const { service } = createMockService();
      const created = await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });
      await service.revokeOverride(created.id, 'admin');

      await expect(
        service.revokeOverride(created.id, 'admin')
      ).rejects.toThrow(PolicyOverrideServiceError);
    });
  });

  // ==================== cleanupExpiredOverrides ====================

  describe('cleanupExpiredOverrides', () => {
    it('should mark expired overrides', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'expired',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() - 1000),
      });
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-2',
        reason: 'not expired',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const count = await service.cleanupExpiredOverrides();
      expect(count).toBe(1);
    });

    it('should return 0 when no expired overrides', async () => {
      const { service } = createMockService();
      await service.createOverride({ tenantId: 'tenant-1',
        policyId: 'policy-1',
        reason: 'not expired',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const count = await service.cleanupExpiredOverrides();
      expect(count).toBe(0);
    });
  });
});
