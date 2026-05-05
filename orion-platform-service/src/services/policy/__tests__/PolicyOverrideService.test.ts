/**
 * PolicyOverrideService 单元测试
 */

import {
  PolicyOverrideService,
  PolicyOverrideServiceError,
  type PolicyOverrideInput,
  type UpdateOverrideInput,
} from '../PolicyOverrideService';

describe('PolicyOverrideService', () => {
  let service: PolicyOverrideService;

  beforeEach(() => {
    service = new PolicyOverrideService();
  });

  // ==================== createOverride ====================

  describe('createOverride', () => {
    it('should create a new override', async () => {
      const input: PolicyOverrideInput = {
        policyId: 'policy-1',
        pipelineId: 'pipe-1',
        reason: 'Emergency deployment needed',
        approvedBy: 'admin@example.com',
        expiresAt: new Date(Date.now() + 3600000),
      };

      const override = await service.createOverride('tenant-1', input);

      expect(override.id).toMatch(/^override-/);
      expect(override.tenantId).toBe('tenant-1');
      expect(override.policyId).toBe('policy-1');
      expect(override.status).toBe('active');
      expect(override.approvedBy).toBe('admin@example.com');
    });

    it('should throw error for missing required fields', async () => {
      await expect(
        service.createOverride('tenant-1', {
          policyId: '',
          reason: '',
          approvedBy: '',
        })
      ).rejects.toThrow(PolicyOverrideServiceError);
    });

    it('should throw error for missing tenant ID', async () => {
      await expect(
        service.createOverride('', {
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
      const created = await service.createOverride('tenant-1', {
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });

      const found = await service.getOverrideById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent override', async () => {
      const found = await service.getOverrideById('non-existent');
      expect(found).toBeNull();
    });
  });

  // ==================== getActiveOverrides ====================

  describe('getActiveOverrides', () => {
    it('should return only active overrides', async () => {
      await service.createOverride('tenant-1', {
        policyId: 'policy-1',
        reason: 'active override',
        approvedBy: 'admin',
      });
      const created = await service.createOverride('tenant-1', {
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
      await service.createOverride('tenant-1', {
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
      await service.createOverride('tenant-1', {
        policyId: 'policy-1',
        reason: 'first',
        approvedBy: 'admin',
      });
      await service.createOverride('tenant-1', {
        policyId: 'policy-2',
        reason: 'second',
        approvedBy: 'admin',
      });
      await service.createOverride('tenant-2', {
        policyId: 'policy-3',
        reason: 'other tenant',
        approvedBy: 'admin',
      });

      const all = await service.getAllOverrides('tenant-1');
      expect(all).toHaveLength(2);
    });

    it('should return sorted by createdAt descending', async () => {
      await service.createOverride('tenant-1', {
        policyId: 'policy-1', reason: 'first', approvedBy: 'admin',
      });
      await new Promise((r) => setTimeout(r, 10));
      await service.createOverride('tenant-1', {
        policyId: 'policy-2', reason: 'second', approvedBy: 'admin',
      });

      const all = await service.getAllOverrides('tenant-1');
      expect(all[0].policyId).toBe('policy-2');
    });
  });

  // ==================== isOverridden ====================

  describe('isOverridden', () => {
    it('should return true for active override', async () => {
      await service.createOverride('tenant-1', {
        policyId: 'policy-1',
        reason: 'override',
        approvedBy: 'admin',
      });

      const result = await service.isOverridden('tenant-1', 'policy-1');
      expect(result).toBe(true);
    });

    it('should return false for non-overridden policy', async () => {
      const result = await service.isOverridden('tenant-1', 'policy-99');
      expect(result).toBe(false);
    });
  });

  // ==================== updateOverride ====================

  describe('updateOverride', () => {
    it('should update override reason', async () => {
      const created = await service.createOverride('tenant-1', {
        policyId: 'policy-1',
        reason: 'original reason',
        approvedBy: 'admin',
      });

      const input: UpdateOverrideInput = { reason: 'updated reason' };
      const updated = await service.updateOverride(created.id, input);

      expect(updated.reason).toBe('updated reason');
    });

    it('should update override expiresAt', async () => {
      const created = await service.createOverride('tenant-1', {
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
      const created = await service.createOverride('tenant-1', {
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
      await expect(
        service.updateOverride('non-existent', { reason: 'test' })
      ).rejects.toThrow(PolicyOverrideServiceError);
    });

    it('should throw error for revoked override', async () => {
      const created = await service.createOverride('tenant-1', {
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
      const created = await service.createOverride('tenant-1', {
        policyId: 'policy-1',
        reason: 'test',
        approvedBy: 'admin',
      });

      await expect(
        service.updateOverride(created.id, {} as UpdateOverrideInput)
      ).rejects.toThrow(PolicyOverrideServiceError);
    });

    it('should update updatedAt timestamp', async () => {
      const created = await service.createOverride('tenant-1', {
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
      const created = await service.createOverride('tenant-1', {
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
      const created = await service.createOverride('tenant-1', {
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
      await service.createOverride('tenant-1', {
        policyId: 'policy-1',
        reason: 'expired',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() - 1000),
      });
      await service.createOverride('tenant-1', {
        policyId: 'policy-2',
        reason: 'not expired',
        approvedBy: 'admin',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const count = await service.cleanupExpiredOverrides();
      expect(count).toBe(1);
    });

    it('should return 0 when no expired overrides', async () => {
      await service.createOverride('tenant-1', {
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
