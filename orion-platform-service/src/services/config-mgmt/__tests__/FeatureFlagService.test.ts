/**
 * FeatureFlagService - Unit Tests
 *
 * Tests for feature flag CRUD, rollout percentage control, targeting rules,
 * flag evaluation, toggle history, and error handling.
 */

// Mock uuid to return predictable IDs
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 6)),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import {
  FeatureFlagService,
  CreateFeatureFlagInput,
  EvaluateFlagContext,
} from '../FeatureFlagService';
import { OrionError } from '../../../errors';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    // No database = in-memory mode
    service = new FeatureFlagService();
  });

  // ==================== createFlag ====================

  describe('createFlag', () => {
    it('should create a feature flag with defaults', async () => {
      const input: CreateFeatureFlagInput = {
        key: 'dark-mode',
        name: 'Dark Mode',
      };

      const flag = await service.createFlag('tenant-1', input, 'admin');

      expect(flag.id).toBeDefined();
      expect(flag.tenantId).toBe('tenant-1');
      expect(flag.key).toBe('dark-mode');
      expect(flag.name).toBe('Dark Mode');
      expect(flag.status).toBe('active');
      expect(flag.defaultValue).toBe(false);
      expect(flag.rolloutPercentage).toBe(0);
      expect(flag.rolloutStrategy).toBe('percentage');
      expect(flag.targetingRules).toEqual([]);
      expect(flag.environments).toEqual(['development', 'staging', 'production']);
      expect(flag.tags).toEqual([]);
      expect(flag.createdBy).toBe('admin');
      expect(flag.createdAt).toBeInstanceOf(Date);
      expect(flag.toggleHistory).toEqual([]);
    });

    it('should create a flag with custom values', async () => {
      const input: CreateFeatureFlagInput = {
        key: 'new-dashboard',
        name: 'New Dashboard',
        description: 'Enable the new dashboard UI',
        defaultValue: true,
        rolloutPercentage: 50,
        rolloutStrategy: 'targeted',
        targetingRules: [
          { attribute: 'plan', operator: 'equals', value: 'enterprise' },
        ],
        environments: ['staging', 'production'],
        tags: ['ui', 'dashboard'],
      };

      const flag = await service.createFlag('tenant-1', input, 'admin');

      expect(flag.defaultValue).toBe(true);
      expect(flag.rolloutPercentage).toBe(50);
      expect(flag.rolloutStrategy).toBe('targeted');
      expect(flag.targetingRules).toHaveLength(1);
      expect(flag.targetingRules[0].attribute).toBe('plan');
      expect(flag.environments).toEqual(['staging', 'production']);
      expect(flag.tags).toEqual(['ui', 'dashboard']);
    });

    it('should throw error for duplicate key', async () => {
      const input: CreateFeatureFlagInput = {
        key: 'duplicate-key',
        name: 'First',
      };

      await service.createFlag('tenant-1', input, 'admin');

      await expect(
        service.createFlag('tenant-1', { ...input, name: 'Second' }, 'admin')
      ).rejects.toThrow("Feature flag with key 'duplicate-key' already exists");
    });

    it('should allow same key in different tenants', async () => {
      const input: CreateFeatureFlagInput = {
        key: 'shared-key',
        name: 'Shared Feature',
      };

      const flag1 = await service.createFlag('tenant-1', input, 'admin');
      const flag2 = await service.createFlag('tenant-2', input, 'admin');

      expect(flag1.id).not.toBe(flag2.id);
      expect(flag1.tenantId).toBe('tenant-1');
      expect(flag2.tenantId).toBe('tenant-2');
    });
  });

  // ==================== getFlag / listFlags ====================

  describe('getFlag', () => {
    it('should return flag by id', async () => {
      const input: CreateFeatureFlagInput = { key: 'my-flag', name: 'My Flag' };
      const created = await service.createFlag('tenant-1', input, 'admin');

      const found = await service.getFlag(created.id);
      expect(found).not.toBeNull();
      expect(found!.key).toBe('my-flag');
    });

    it('should return null for non-existent id', async () => {
      const found = await service.getFlag('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('listFlags', () => {
    beforeEach(async () => {
      await service.createFlag('tenant-1', { key: 'flag-a', name: 'Flag A' }, 'admin');
      await service.createFlag('tenant-1', { key: 'flag-b', name: 'Flag B' }, 'admin');
      await service.createFlag('tenant-2', { key: 'flag-c', name: 'Flag C' }, 'admin');
    });

    it('should list flags for a tenant', async () => {
      const flags = await service.listFlags('tenant-1');
      expect(flags).toHaveLength(2);
      expect(flags.map((f) => f.key)).toContain('flag-a');
      expect(flags.map((f) => f.key)).toContain('flag-b');
    });

    it('should return empty array for tenant with no flags', async () => {
      const flags = await service.listFlags('empty-tenant');
      expect(flags).toHaveLength(0);
    });

    it('should filter by status', async () => {
      const flags = await service.listFlags('tenant-1', { status: 'active' });
      expect(flags).toHaveLength(2);

      const archived = await service.listFlags('tenant-1', { status: 'archived' });
      expect(archived).toHaveLength(0);
    });
  });

  // ==================== updateFlag ====================

  describe('updateFlag', () => {
    it('should update flag fields', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'updatable', name: 'Original' },
        'admin'
      );

      const updated = await service.updateFlag(
        created.id,
        {
          name: 'Updated Name',
          description: 'New description',
          rolloutPercentage: 75,
        },
        'editor'
      );

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('New description');
      expect(updated.rolloutPercentage).toBe(75);
      expect(updated.updatedBy).toBe('editor');
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent flag', async () => {
      await expect(
        service.updateFlag('non-existent', { name: 'x' }, 'admin')
      ).rejects.toThrow('Feature flag');
    });

    it('should update status', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'status-test', name: 'Test' },
        'admin'
      );

      const updated = await service.updateFlag(
        created.id,
        { status: 'archived' },
        'admin'
      );

      expect(updated.status).toBe('archived');
    });
  });

  // ==================== deleteFlag ====================

  describe('deleteFlag', () => {
    it('should delete an existing flag', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'deleteme', name: 'Delete Me' },
        'admin'
      );

      const result = await service.deleteFlag(created.id);
      expect(result).toBe(true);

      const found = await service.getFlag(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent flag', async () => {
      const result = await service.deleteFlag('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== setRolloutPercentage ====================

  describe('setRolloutPercentage', () => {
    it('should update rollout percentage', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'rollout-test', name: 'Rollout Test', rolloutPercentage: 0 },
        'admin'
      );

      const updated = await service.setRolloutPercentage(created.id, 50, 'admin');
      expect(updated.rolloutPercentage).toBe(50);
    });

    it('should reject percentage below 0', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'rollout-bounds', name: 'Bounds Test' },
        'admin'
      );

      await expect(
        service.setRolloutPercentage(created.id, -1, 'admin')
      ).rejects.toThrow('Rollout percentage must be between 0 and 100');
    });

    it('should reject percentage above 100', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'rollout-over', name: 'Over Test' },
        'admin'
      );

      await expect(
        service.setRolloutPercentage(created.id, 101, 'admin')
      ).rejects.toThrow('Rollout percentage must be between 0 and 100');
    });

    it('should accept boundary values 0 and 100', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'rollout-boundary', name: 'Boundary' },
        'admin'
      );

      const at0 = await service.setRolloutPercentage(created.id, 0, 'admin');
      expect(at0.rolloutPercentage).toBe(0);

      const at100 = await service.setRolloutPercentage(created.id, 100, 'admin');
      expect(at100.rolloutPercentage).toBe(100);
    });
  });

  // ==================== evaluateFlag ====================

  describe('evaluateFlag', () => {
    it('should return disabled for non-existent flag', async () => {
      const result = await service.evaluateFlag('tenant-1', 'nonexistent');
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('Flag not found');
    });

    it('should return disabled for inactive flag', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'inactive-flag', name: 'Inactive', defaultValue: true },
        'admin'
      );
      await service.updateFlag(created.id, { status: 'inactive' }, 'admin');

      const result = await service.evaluateFlag('tenant-1', 'inactive-flag');
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('inactive');
    });

    it('should return default value when no targeting rules match', async () => {
      await service.createFlag(
        'tenant-1',
        {
          key: 'default-flag',
          name: 'Default Flag',
          defaultValue: true,
          rolloutPercentage: 0,
        },
        'admin'
      );

      const result = await service.evaluateFlag('tenant-1', 'default-flag');
      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('Default value');
    });

    it('should return default value when environment not in flag environments', async () => {
      await service.createFlag(
        'tenant-1',
        {
          key: 'env-flag',
          name: 'Env Flag',
          defaultValue: true,
          environments: ['production'],
        },
        'admin'
      );

      const result = await service.evaluateFlag('tenant-1', 'env-flag', {
        environment: 'development',
      });
      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('Environment not enabled');
    });

    it('should evaluate targeting rules - equals', async () => {
      await service.createFlag(
        'tenant-1',
        {
          key: 'target-flag',
          name: 'Target Flag',
          defaultValue: false,
          targetingRules: [
            { attribute: 'plan', operator: 'equals', value: 'enterprise' },
          ],
        },
        'admin'
      );

      // Should match
      const match = await service.evaluateFlag('tenant-1', 'target-flag', {
        attributes: { plan: 'enterprise' },
      });
      expect(match.enabled).toBe(true);
      expect(match.reason).toBe('Targeting rules matched');

      // Should not match
      const noMatch = await service.evaluateFlag('tenant-1', 'target-flag', {
        attributes: { plan: 'free' },
      });
      expect(noMatch.enabled).toBe(false);
    });

    it('should evaluate targeting rules - contains', async () => {
      await service.createFlag(
        'tenant-1',
        {
          key: 'contains-flag',
          name: 'Contains Flag',
          defaultValue: false,
          targetingRules: [
            { attribute: 'email', operator: 'contains', value: '@company.com' },
          ],
        },
        'admin'
      );

      const match = await service.evaluateFlag('tenant-1', 'contains-flag', {
        attributes: { email: 'user@company.com' },
      });
      expect(match.enabled).toBe(true);

      const noMatch = await service.evaluateFlag('tenant-1', 'contains-flag', {
        attributes: { email: 'user@gmail.com' },
      });
      expect(noMatch.enabled).toBe(false);
    });

    it('should evaluate targeting rules - in', async () => {
      await service.createFlag(
        'tenant-1',
        {
          key: 'in-flag',
          name: 'In Flag',
          defaultValue: false,
          targetingRules: [
            { attribute: 'country', operator: 'in', value: ['US', 'UK', 'CN'] },
          ],
        },
        'admin'
      );

      const match = await service.evaluateFlag('tenant-1', 'in-flag', {
        attributes: { country: 'CN' },
      });
      expect(match.enabled).toBe(true);

      const noMatch = await service.evaluateFlag('tenant-1', 'in-flag', {
        attributes: { country: 'JP' },
      });
      expect(noMatch.enabled).toBe(false);
    });

    it('should evaluate targeting rules - gt/lt', async () => {
      await service.createFlag(
        'tenant-1',
        {
          key: 'numeric-flag',
          name: 'Numeric Flag',
          defaultValue: false,
          targetingRules: [
            { attribute: 'age', operator: 'gt', value: '18' },
            { attribute: 'score', operator: 'lt', value: '100' },
          ],
        },
        'admin'
      );

      const match = await service.evaluateFlag('tenant-1', 'numeric-flag', {
        attributes: { age: 25, score: 50 },
      });
      expect(match.enabled).toBe(true);

      const noMatch = await service.evaluateFlag('tenant-1', 'numeric-flag', {
        attributes: { age: 15, score: 50 },
      });
      expect(noMatch.enabled).toBe(false);
    });

    it('should evaluate targeting rules - regex', async () => {
      await service.createFlag(
        'tenant-1',
        {
          key: 'regex-flag',
          name: 'Regex Flag',
          defaultValue: false,
          targetingRules: [
            { attribute: 'version', operator: 'regex', value: '^v2\\.' },
          ],
        },
        'admin'
      );

      const match = await service.evaluateFlag('tenant-1', 'regex-flag', {
        attributes: { version: 'v2.1.0' },
      });
      expect(match.enabled).toBe(true);

      const noMatch = await service.evaluateFlag('tenant-1', 'regex-flag', {
        attributes: { version: 'v1.9.0' },
      });
      expect(noMatch.enabled).toBe(false);
    });

    it('should use percentage-based rollout with deterministic hashing', async () => {
      await service.createFlag(
        'tenant-1',
        {
          key: 'rollout-eval',
          name: 'Rollout Eval',
          defaultValue: false,
          rolloutPercentage: 100, // 100% = all users
          rolloutStrategy: 'percentage',
        },
        'admin'
      );

      // With 100% rollout, any user should be included
      const result = await service.evaluateFlag('tenant-1', 'rollout-eval', {
        userId: 'any-user',
      });
      expect(result.enabled).toBe(true);
      expect(result.reason).toContain('user included');
    });

    it('should use percentage-based rollout with 0%', async () => {
      await service.createFlag(
        'tenant-1',
        {
          key: 'rollout-zero',
          name: 'Rollout Zero',
          defaultValue: false,
          rolloutPercentage: 0,
          rolloutStrategy: 'percentage',
        },
        'admin'
      );

      // With 0% rollout, no user should be included
      const result = await service.evaluateFlag('tenant-1', 'rollout-zero', {
        userId: 'any-user',
      });
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('user excluded');
    });
  });

  // ==================== recordToggle ====================

  describe('recordToggle', () => {
    it('should record a toggle event', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'toggle-test', name: 'Toggle Test' },
        'admin'
      );

      await service.recordToggle(created.id, false, true, 'admin', 'Enable for testing');

      const flag = await service.getFlag(created.id);
      expect(flag!.toggleHistory).toHaveLength(1);
      expect(flag!.toggleHistory[0].oldValue).toBe(false);
      expect(flag!.toggleHistory[0].newValue).toBe(true);
      expect(flag!.toggleHistory[0].changedBy).toBe('admin');
      expect(flag!.toggleHistory[0].reason).toBe('Enable for testing');
    });

    it('should record multiple toggle events', async () => {
      const created = await service.createFlag(
        'tenant-1',
        { key: 'multi-toggle', name: 'Multi Toggle' },
        'admin'
      );

      await service.recordToggle(created.id, false, true, 'admin');
      await service.recordToggle(created.id, true, false, 'admin');

      const flag = await service.getFlag(created.id);
      expect(flag!.toggleHistory).toHaveLength(2);
    });

    it('should not throw for non-existent flag', async () => {
      // Should silently return
      await expect(
        service.recordToggle('non-existent', false, true, 'admin')
      ).resolves.toBeUndefined();
    });
  });
});
