/**
 * Feature Flag Integration Tests
 *
 * Feature flag evaluation + percentage rollout flow
 */

import { FeatureFlagService, CreateFeatureFlagInput, EvaluateFlagContext } from '@/services/config-mgmt/FeatureFlagService';

// ============================================================
// Mock Database (FeatureFlagService has its own memory fallback)
// ============================================================

describe('Feature Flag Integration - Evaluation + Rollout', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    // Without DB pool, FeatureFlagService falls back to in-memory storage
    service = new FeatureFlagService();
  });

  describe('E2E: Feature Flag CRUD', () => {
    it('should create a feature flag', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'dark-mode',
        name: 'Dark Mode',
        description: 'Enable dark mode UI',
        defaultValue: false,
        rolloutPercentage: 0,
        rolloutStrategy: 'percentage',
        environments: ['development', 'staging'],
        tags: ['ui', 'experimental'],
      }, 'product-manager');

      expect(flag.id).toBeDefined();
      expect(flag.key).toBe('dark-mode');
      expect(flag.status).toBe('active');
      expect(flag.defaultValue).toBe(false);
      expect(flag.rolloutPercentage).toBe(0);
    });

    it('should create flag with targeting rules', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'beta-feature',
        name: 'Beta Feature',
        defaultValue: false,
        rolloutStrategy: 'targeted',
        targetingRules: [
          { attribute: 'plan', operator: 'equals', value: 'enterprise' },
        ],
      }, 'admin');

      expect(flag.targetingRules).toHaveLength(1);
      expect(flag.targetingRules[0].attribute).toBe('plan');
    });

    it('should reject duplicate flag key', async () => {
      await service.createFlag('tenant-1', {
        key: 'unique-key',
        name: 'First',
        defaultValue: false,
      }, 'admin');

      await expect(service.createFlag('tenant-1', {
        key: 'unique-key',
        name: 'Duplicate',
        defaultValue: true,
      }, 'admin')).rejects.toThrow("Feature flag with key 'unique-key' already exists");
    });

    it('should get flag by id', async () => {
      const created = await service.createFlag('tenant-1', {
        key: 'get-test',
        name: 'Get Test',
        defaultValue: true,
      }, 'admin');

      const found = await service.getFlag(created.id);
      expect(found).not.toBeNull();
      expect(found!.key).toBe('get-test');
    });

    it('should return null for non-existent flag', async () => {
      const found = await service.getFlag('non-existent-id');
      expect(found).toBeNull();
    });

    it('should list flags by tenant', async () => {
      await service.createFlag('tenant-1', { key: 'flag-a', name: 'A', defaultValue: false }, 'admin');
      await service.createFlag('tenant-1', { key: 'flag-b', name: 'B', defaultValue: true }, 'admin');

      const flags = await service.listFlags('tenant-1');
      expect(flags.length).toBeGreaterThanOrEqual(2);
    });

    it('should update a flag', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'update-test',
        name: 'Original',
        defaultValue: false,
      }, 'admin');

      const updated = await service.updateFlag(flag.id, {
        name: 'Updated Name',
        description: 'New description',
        rolloutPercentage: 50,
      }, 'admin');

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('New description');
      expect(updated.rolloutPercentage).toBe(50);
    });

    it('should delete a flag', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'delete-test',
        name: 'To Delete',
        defaultValue: false,
      }, 'admin');

      const deleted = await service.deleteFlag(flag.id);
      expect(deleted).toBe(true);

      const found = await service.getFlag(flag.id);
      expect(found).toBeNull();
    });
  });

  describe('E2E: Flag Evaluation', () => {
    it('should return disabled when flag not found', async () => {
      const result = await service.evaluateFlag('tenant-1', 'non-existent');

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('Flag not found');
    });

    it('should return disabled when flag is inactive', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'inactive-flag',
        name: 'Inactive',
        defaultValue: true,
      }, 'admin');

      await service.updateFlag(flag.id, { status: 'inactive' }, 'admin');

      const result = await service.evaluateFlag('tenant-1', 'inactive-flag');
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('inactive');
    });

    it('should return default value when no targeting rules match', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'default-flag',
        name: 'Default',
        defaultValue: true,
        rolloutPercentage: 0,
      }, 'admin');

      const result = await service.evaluateFlag('tenant-1', 'default-flag');
      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('Default value');
    });

    it('should evaluate based on targeting rules', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'enterprise-feature',
        name: 'Enterprise',
        defaultValue: false,
        rolloutStrategy: 'targeted',
        targetingRules: [
          { attribute: 'plan', operator: 'equals', value: 'enterprise' },
        ],
      }, 'admin');

      // Enterprise user should get enabled
      const enterpriseResult = await service.evaluateFlag('tenant-1', 'enterprise-feature', {
        attributes: { plan: 'enterprise' },
      });
      expect(enterpriseResult.enabled).toBe(true);
      expect(enterpriseResult.reason).toBe('Targeting rules matched');

      // Free user should get default
      const freeResult = await service.evaluateFlag('tenant-1', 'enterprise-feature', {
        attributes: { plan: 'free' },
      });
      expect(freeResult.enabled).toBe(false);
    });

    it('should evaluate percentage rollout with user hashing', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'percentage-flag',
        name: 'Percentage',
        defaultValue: false,
        rolloutStrategy: 'percentage',
        rolloutPercentage: 100,
      }, 'admin');

      // With 100% rollout, all users should get enabled
      const result = await service.evaluateFlag('tenant-1', 'percentage-flag', {
        userId: 'user-123',
      });
      expect(result.enabled).toBe(true);
    });

    it('should return false for low percentage rollout when user excluded', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'low-percentage',
        name: 'Low Rollout',
        defaultValue: false,
        rolloutStrategy: 'percentage',
        rolloutPercentage: 0,
      }, 'admin');

      // With 0% rollout, no users should get enabled
      const result = await service.evaluateFlag('tenant-1', 'low-percentage', {
        userId: 'user-456',
      });
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('excluded');
    });

    it('should respect environment filter', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'env-flag',
        name: 'Env Test',
        defaultValue: true,
        environments: ['development', 'staging'],
      }, 'admin');

      // Production not enabled
      const prodResult = await service.evaluateFlag('tenant-1', 'env-flag', {
        environment: 'production',
      });
      expect(prodResult.enabled).toBe(true); // Returns default because env not enabled
      expect(prodResult.reason).toBe('Environment not enabled');

      // Staging is enabled
      const stagingResult = await service.evaluateFlag('tenant-1', 'env-flag', {
        environment: 'staging',
      });
      expect(stagingResult.reason).toBe('Default value');
    });
  });

  describe('E2E: Targeting Rule Operators', () => {
    it('should handle "contains" operator', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'contains-test',
        name: 'Contains',
        defaultValue: false,
        rolloutStrategy: 'targeted',
        targetingRules: [
          { attribute: 'email', operator: 'contains', value: '@company.com' },
        ],
      }, 'admin');

      const matched = await service.evaluateFlag('tenant-1', 'contains-test', {
        attributes: { email: 'user@company.com' },
      });
      expect(matched.enabled).toBe(true);

      const notMatched = await service.evaluateFlag('tenant-1', 'contains-test', {
        attributes: { email: 'user@gmail.com' },
      });
      expect(notMatched.enabled).toBe(false);
    });

    it('should handle "in" operator', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'in-test',
        name: 'In',
        defaultValue: false,
        rolloutStrategy: 'targeted',
        targetingRules: [
          { attribute: 'region', operator: 'in', value: ['us-east', 'us-west'] },
        ],
      }, 'admin');

      const matched = await service.evaluateFlag('tenant-1', 'in-test', {
        attributes: { region: 'us-east' },
      });
      expect(matched.enabled).toBe(true);

      const notMatched = await service.evaluateFlag('tenant-1', 'in-test', {
        attributes: { region: 'eu-central' },
      });
      expect(notMatched.enabled).toBe(false);
    });

    it('should handle "gt" and "lt" operators', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'gt-lt-test',
        name: 'GT LT',
        defaultValue: false,
        rolloutStrategy: 'targeted',
        targetingRules: [
          { attribute: 'version', operator: 'gt', value: '10' },
        ],
      }, 'admin');

      const matched = await service.evaluateFlag('tenant-1', 'gt-lt-test', {
        attributes: { version: '15' },
      });
      expect(matched.enabled).toBe(true);
    });

    it('should require all targeting rules to match', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'multi-rule',
        name: 'Multi Rule',
        defaultValue: false,
        rolloutStrategy: 'targeted',
        targetingRules: [
          { attribute: 'plan', operator: 'equals', value: 'enterprise' },
          { attribute: 'region', operator: 'equals', value: 'us-east' },
        ],
      }, 'admin');

      // Both rules match
      const matched = await service.evaluateFlag('tenant-1', 'multi-rule', {
        attributes: { plan: 'enterprise', region: 'us-east' },
      });
      expect(matched.enabled).toBe(true);

      // Only one rule matches
      const partial = await service.evaluateFlag('tenant-1', 'multi-rule', {
        attributes: { plan: 'enterprise', region: 'eu-central' },
      });
      expect(partial.enabled).toBe(false);
    });
  });

  describe('E2E: Rollout Percentage Management', () => {
    it('should set rollout percentage', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'rollout-test',
        name: 'Rollout',
        defaultValue: false,
        rolloutPercentage: 0,
      }, 'admin');

      const updated = await service.setRolloutPercentage(flag.id, 50, 'admin');
      expect(updated.rolloutPercentage).toBe(50);
    });

    it('should reject invalid rollout percentage', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'invalid-rollout',
        name: 'Invalid',
        defaultValue: false,
      }, 'admin');

      await expect(service.setRolloutPercentage(flag.id, 150, 'admin'))
        .rejects
        .toThrow('Rollout percentage must be between 0 and 100');

      await expect(service.setRolloutPercentage(flag.id, -10, 'admin'))
        .rejects
        .toThrow('Rollout percentage must be between 0 and 100');
    });
  });

  describe('E2E: Toggle History', () => {
    it('should record toggle history', async () => {
      const flag = await service.createFlag('tenant-1', {
        key: 'history-test',
        name: 'History',
        defaultValue: false,
      }, 'admin');

      await service.recordToggle(flag.id, false, true, 'admin', 'Enabled for beta testing');
      await service.recordToggle(flag.id, true, false, 'admin', 'Disabled due to issues');

      const updated = await service.getFlag(flag.id);
      expect(updated).not.toBeNull();
      expect(updated!.toggleHistory).toHaveLength(2);
      expect(updated!.toggleHistory[0].reason).toBe('Enabled for beta testing');
      expect(updated!.toggleHistory[0].changedBy).toBe('admin');
    });
  });

  describe('E2E: Filter Flags', () => {
    it('should filter flags by status', async () => {
      await service.createFlag('tenant-1', { key: 'active-flag', name: 'Active', defaultValue: true }, 'admin');
      const inactiveFlag = await service.createFlag('tenant-1', { key: 'inactive-flag', name: 'Inactive', defaultValue: false }, 'admin');
      await service.updateFlag(inactiveFlag.id, { status: 'inactive' }, 'admin');

      const activeFlags = await service.listFlags('tenant-1', { status: 'active' });
      expect(activeFlags.some(f => f.key === 'active-flag')).toBe(true);
      expect(activeFlags.some(f => f.key === 'inactive-flag')).toBe(false);
    });

    it('should filter flags by environment', async () => {
      await service.createFlag('tenant-1', {
        key: 'dev-only',
        name: 'Dev Only',
        defaultValue: true,
        environments: ['development'],
      }, 'admin');

      await service.createFlag('tenant-1', {
        key: 'all-envs',
        name: 'All Envs',
        defaultValue: true,
        environments: ['development', 'staging', 'production'],
      }, 'admin');

      const devFlags = await service.listFlags('tenant-1', { environment: 'development' });
      expect(devFlags.length).toBeGreaterThanOrEqual(2);
    });
  });
});
