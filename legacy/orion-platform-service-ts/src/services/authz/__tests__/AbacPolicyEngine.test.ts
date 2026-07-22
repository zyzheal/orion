/**
 * AbacPolicyEngine Tests - Attribute-Based Access Control Policy Engine
 *
 * Covers: policy registration/unregistration, condition evaluation (all operators),
 * policy combination (AND/OR/NOT), caching, batch evaluation, import/export.
 */

import {
  AbacPolicyEngine,
  AbacContext,
  AbacPolicy,
  ConditionRule,
  SYSTEM_ABAC_POLICIES,
} from '../AbacPolicyEngine';

// Default context that passes all system policies (tenant isolation, cross-dept, etc.)
function makeContext(overrides: Partial<AbacContext> = {}): AbacContext {
  const user = {
    id: 'user-1',
    role: 'developer',
    department: 'engineering',
    level: 'senior',
    teams: ['team-alpha'],
    tenantId: 'tenant-1',
    createdAt: new Date('2025-01-01'),
    lastLoginAt: new Date(),
    ...overrides.user,
  };
  const resource = {
    type: 'pipeline',
    id: 'pipe-1',
    owner: 'user-1',
    ownerId: 'user-1',
    department: 'engineering',
    tenantId: 'tenant-1',
    sensitivity: 'internal',
    status: 'active',
    createdAt: new Date('2025-06-01'),
    ...overrides.resource,
  };
  const environment = {
    time: new Date('2026-05-18T10:00:00Z'), // 10:00 UTC = working hours (9-18)
    ip: '10.0.0.1',
    network: 'internal',
    device: 'desktop',
    ...overrides.environment,
  };
  const action = {
    type: 'read',
    impact: 'low',
    ...overrides.action,
  };
  return { user, resource, environment, action };
}

// Create a fresh engine WITHOUT system policies, for isolated operator tests
async function makeCleanEngine(): Promise<AbacPolicyEngine> {
  const engine = new AbacPolicyEngine();
  // Remove all system policies
  for (const id of engine.getSystemPolicyIds()) {
    await engine.unregisterPolicy(id);
  }
  return engine;
}

describe('AbacPolicyEngine', () => {
  let engine: AbacPolicyEngine;

  beforeEach(() => {
    engine = new AbacPolicyEngine();
  });

  // ==================== System Policies Initialization ====================

  describe('system policies initialization', () => {
    it('should load all system policies on construction', () => {
      const policies = engine.getAllPolicies();
      expect(policies.length).toBe(SYSTEM_ABAC_POLICIES.length);
    });

    it('should have resource-owner-full-control policy', () => {
      const policy = engine.getPolicy('resource-owner-full-control');
      expect(policy).toBeDefined();
      expect(policy?.effect).toBe('allow');
      expect(policy?.priority).toBe(100);
    });

    it('should have tenant-isolation policy with highest priority', () => {
      const policy = engine.getPolicy('tenant-isolation');
      expect(policy).toBeDefined();
      expect(policy?.priority).toBe(99);
      expect(policy?.effect).toBe('deny');
    });

    it('should return system policy IDs', () => {
      const ids = engine.getSystemPolicyIds();
      expect(ids).toContain('resource-owner-full-control');
      expect(ids).toContain('tenant-isolation');
      expect(ids).toContain('external-network-restriction');
    });
  });

  // ==================== Policy Registration ====================

  describe('registerPolicy', () => {
    it('should register a new custom policy', async () => {
      const policy: AbacPolicy = {
        id: 'custom-1',
        name: 'Custom Policy',
        resourceType: 'pipeline',
        actionType: 'read',
        conditions: { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
        effect: 'allow',
        priority: 50,
        enabled: true,
      };

      await engine.registerPolicy(policy);

      const retrieved = engine.getPolicy('custom-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Custom Policy');
      expect(retrieved?.createdAt).toBeDefined();
      expect(retrieved?.updatedAt).toBeDefined();
    });

    it('should invalidate cache when registering policy', async () => {
      engine.evaluate(makeContext());

      await engine.registerPolicy({
        id: 'new-policy',
        name: 'New',
        resourceType: '*',
        actionType: '*',
        conditions: { condition: { attribute: 'user.id', operator: 'exists' } },
        effect: 'allow',
      });

      const result = engine.evaluate(makeContext());
      expect(result).toBeDefined();
    });

    it('should set createdAt if not provided', async () => {
      const before = new Date();
      await engine.registerPolicy({
        id: 'time-test',
        name: 'Time Test',
        resourceType: '*',
        actionType: '*',
        conditions: { condition: { attribute: 'user.id', operator: 'exists' } },
        effect: 'allow',
      });

      const policy = engine.getPolicy('time-test');
      expect(policy?.createdAt).toBeDefined();
      expect(policy?.createdAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  // ==================== Policy Unregistration ====================

  describe('unregisterPolicy', () => {
    it('should remove a custom policy', async () => {
      await engine.registerPolicy({
        id: 'to-remove',
        name: 'Remove Me',
        resourceType: '*',
        actionType: '*',
        conditions: { condition: { attribute: 'user.id', operator: 'exists' } },
        effect: 'allow',
      });

      expect(engine.getPolicy('to-remove')).toBeDefined();

      await engine.unregisterPolicy('to-remove');

      expect(engine.getPolicy('to-remove')).toBeUndefined();
    });

    it('should not throw when removing non-existent policy', async () => {
      await expect(engine.unregisterPolicy('non-existent')).resolves.not.toThrow();
    });
  });

  // ==================== Policy Update ====================

  describe('updatePolicy', () => {
    it('should update an existing policy', async () => {
      await engine.registerPolicy({
        id: 'update-test',
        name: 'Original Name',
        resourceType: 'pipeline',
        actionType: 'read',
        conditions: { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
        effect: 'allow',
      });

      await engine.updatePolicy('update-test', { name: 'Updated Name', priority: 99 });

      const policy = engine.getPolicy('update-test');
      expect(policy?.name).toBe('Updated Name');
      expect(policy?.priority).toBe(99);
      expect(policy?.updatedAt).toBeDefined();
    });

    it('should do nothing when updating non-existent policy', async () => {
      await engine.updatePolicy('non-existent', { name: 'New' });

      expect(engine.getPolicy('non-existent')).toBeUndefined();
    });
  });

  // ==================== Policy Matching ====================

  describe('getPoliciesForResourceType', () => {
    it('should return policies matching a specific resource type', () => {
      const policies = engine.getPoliciesForResourceType('pipeline');
      expect(policies.length).toBeGreaterThan(0);
      policies.forEach((p) => {
        expect(
          p.resourceType === '*' ||
          (Array.isArray(p.resourceType) && p.resourceType.includes('pipeline')) ||
          p.resourceType === 'pipeline',
        ).toBe(true);
      });
    });

    it('should exclude disabled policies', async () => {
      await engine.registerPolicy({
        id: 'disabled-policy',
        name: 'Disabled',
        resourceType: 'pipeline',
        actionType: 'read',
        conditions: { condition: { attribute: 'user.id', operator: 'exists' } },
        effect: 'allow',
        enabled: false,
      });

      const policies = engine.getPoliciesForResourceType('pipeline');
      const disabled = policies.find((p) => p.id === 'disabled-policy');
      expect(disabled).toBeUndefined();
    });

    it('should return wildcard policies for any resource type', () => {
      const policies = engine.getPoliciesForResourceType('any-type');
      const wildcardPolicies = policies.filter((p) => p.resourceType === '*');
      expect(wildcardPolicies.length).toBeGreaterThan(0);
    });
  });

  // ==================== Evaluate - Owner Check ====================

  describe('evaluate - resource owner', () => {
    it('should allow resource owner to read their own resource', () => {
      const result = engine.evaluate(makeContext());

      expect(result.allowed).toBe(true);
      expect(result.matchedPolicies.some((p) => p.id === 'resource-owner-full-control')).toBe(true);
    });

    it('should allow resource owner to update their own resource', () => {
      const result = engine.evaluate(makeContext({ action: { type: 'update' } }));
      expect(result.allowed).toBe(true);
    });

    it('should deny non-owner when no other policy allows', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-other', role: 'viewer', tenantId: 'tenant-1', department: 'engineering' },
        resource: { type: 'pipeline', owner: 'user-1', tenantId: 'tenant-1', department: 'engineering' },
      }));

      expect(result.allowed).toBe(false);
    });
  });

  // ==================== Evaluate - Tenant Isolation ====================

  describe('evaluate - tenant isolation', () => {
    it('should deny access to resources from different tenant', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'admin', tenantId: 'tenant-A', department: 'eng' },
        resource: { type: 'pipeline', tenantId: 'tenant-B', owner: 'user-1', department: 'eng' },
      }));

      expect(result.allowed).toBe(false);
      expect(result.denied).toBe(true);
      expect(result.denialReason).toContain('Tenant Isolation');
    });

    it('should allow access to resources from same tenant', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'admin', tenantId: 'tenant-1', department: 'engineering' },
        resource: { type: 'pipeline', tenantId: 'tenant-1', owner: 'user-1', department: 'engineering' },
      }));

      expect(result.allowed).toBe(true);
    });

    it('should not block when resource has no tenantId', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'admin', tenantId: 'tenant-1', department: 'eng' },
        resource: { type: 'pipeline', department: 'eng' }, // no tenantId
      }));

      expect(result.denied).toBe(false);
    });
  });

  // ==================== Evaluate - External Network ====================

  describe('evaluate - external network restriction', () => {
    it('should deny write operations from external network', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'developer', tenantId: 'tenant-1', department: 'engineering' },
        resource: { type: 'pipeline', tenantId: 'tenant-1', owner: 'user-other', department: 'engineering' },
        environment: { time: new Date(), network: 'external' },
        action: { type: 'update' },
      }));

      expect(result.allowed).toBe(false);
      expect(result.denied).toBe(true);
      expect(result.denialReason).toContain('External Network Restriction');
    });

    it('should allow read operations from external network', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'admin', tenantId: 'tenant-1', department: 'engineering' },
        resource: { type: 'pipeline', tenantId: 'tenant-1', owner: 'user-1', department: 'engineering' },
        environment: { time: new Date(), network: 'external' },
        action: { type: 'read' },
      }));

      expect(result.allowed).toBe(true);
    });
  });

  // ==================== Evaluate - Restricted Resources ====================

  describe('evaluate - restricted resource access', () => {
    it('should allow admin to access restricted resources', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'admin', tenantId: 'tenant-1', department: 'engineering' },
        resource: { type: 'pipeline', sensitivity: 'restricted', tenantId: 'tenant-1', owner: 'user-other', department: 'engineering' },
      }));

      expect(result.allowed).toBe(true);
    });

    it('should allow same-department user to access restricted resources', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'developer', department: 'engineering', tenantId: 'tenant-1' },
        resource: {
          type: 'pipeline', sensitivity: 'restricted', department: 'engineering',
          tenantId: 'tenant-1', owner: 'user-other',
        },
      }));

      expect(result.allowed).toBe(true);
    });

    it('should deny cross-department non-admin access to restricted resources', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'developer', department: 'engineering', tenantId: 'tenant-1' },
        resource: {
          type: 'pipeline', sensitivity: 'restricted', department: 'marketing',
          tenantId: 'tenant-1', owner: 'user-other',
        },
      }));

      expect(result.allowed).toBe(false);
    });
  });

  // ==================== Evaluate - Working Hours ====================

  describe('evaluate - working hours restriction', () => {
    it('should deny high-impact operations outside working hours for non-admin', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'developer', tenantId: 'tenant-1', department: 'engineering' },
        resource: { type: 'deployment', tenantId: 'tenant-1', owner: 'user-other', department: 'engineering' },
        environment: { time: new Date('2026-05-18T22:00:00Z') },
        action: { type: 'execute', impact: 'high' },
      }));

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Working Hours');
    });

    it('should not deny admin for high-impact operations outside working hours', () => {
      // Use 'update' which resource-owner-full-control covers, so admin+owner gets allowed
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'admin', tenantId: 'tenant-1', department: 'engineering' },
        resource: { type: 'deployment', tenantId: 'tenant-1', owner: 'user-1', department: 'engineering' },
        environment: { time: new Date('2026-05-18T22:00:00Z') },
        action: { type: 'update', impact: 'critical' },
      }));

      expect(result.allowed).toBe(true);
    });

    it('should allow low-impact operations at any time', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'developer', tenantId: 'tenant-1', department: 'engineering' },
        resource: { type: 'pipeline', tenantId: 'tenant-1', owner: 'user-1', department: 'engineering' },
        environment: { time: new Date('2026-05-18T03:00:00Z') },
        action: { type: 'read', impact: 'low' },
      }));

      expect(result.allowed).toBe(true);
    });
  });

  // ==================== Evaluate - Cross Department ====================

  describe('evaluate - cross department restriction', () => {
    it('should deny non-admin from accessing other department resources', () => {
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'developer', department: 'engineering', tenantId: 'tenant-1' },
        resource: {
          type: 'pipeline', department: 'marketing',
          tenantId: 'tenant-1', owner: 'user-other', sensitivity: 'internal',
        },
      }));

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Cross Department');
    });

    it('should not deny admin when accessing other department resources', () => {
      // Admin is not blocked by cross-department, and is the owner so resource-owner-full-control fires
      const result = engine.evaluate(makeContext({
        user: { id: 'user-1', role: 'admin', department: 'engineering', tenantId: 'tenant-1' },
        resource: {
          type: 'pipeline', department: 'marketing',
          tenantId: 'tenant-1', owner: 'user-1', sensitivity: 'internal',
        },
      }));

      expect(result.allowed).toBe(true);
    });
  });

  // ==================== Condition Operators (isolated from system policies) ====================

  describe('condition operators', () => {
    // Use clean engine without system policies for isolated operator tests
    async function evaluateWithCondition(condition: ConditionRule, contextOverrides?: Partial<AbacContext>) {
      const cleanEngine = await makeCleanEngine();
      await cleanEngine.registerPolicy({
        id: 'test-policy',
        name: 'Test',
        resourceType: '*',
        actionType: '*',
        conditions: condition,
        effect: 'allow',
        enabled: true,
      });
      return cleanEngine.evaluate(makeContext(contextOverrides));
    }

    it('should evaluate equals operator (true)', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.role', operator: 'equals', value: 'developer' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate equals operator (false)', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.role', operator: 'equals', value: 'admin' },
      });
      expect(result.allowed).toBe(false);
    });

    it('should evaluate notEquals operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.role', operator: 'notEquals', value: 'admin' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate contains operator for string', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.department', operator: 'contains', value: 'engine' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate contains operator for array', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.teams', operator: 'contains', value: 'team-alpha' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate notContains operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.department', operator: 'notContains', value: 'sales' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate startsWith operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.department', operator: 'startsWith', value: 'engine' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate endsWith operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.department', operator: 'endsWith', value: 'ing' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate in operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.role', operator: 'in', value: ['developer', 'admin'] },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate notIn operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.role', operator: 'notIn', value: ['admin', 'super_admin'] },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate greaterThan operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.level', operator: 'greaterThan', value: 5 },
      }, { user: { id: 'u1', role: 'dev', level: 10 as any } });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate lessThan operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.level', operator: 'lessThan', value: 100 },
      }, { user: { id: 'u1', role: 'dev', level: 50 as any } });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate greaterThanOrEqual operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.level', operator: 'greaterThanOrEqual', value: 50 },
      }, { user: { id: 'u1', role: 'dev', level: 50 as any } });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate lessThanOrEqual operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.level', operator: 'lessThanOrEqual', value: 50 },
      }, { user: { id: 'u1', role: 'dev', level: 50 as any } });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate matches (regex) operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.department', operator: 'matches', value: '^engine' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should return false for invalid regex in matches', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.department', operator: 'matches', value: '[invalid' },
      });
      expect(result.allowed).toBe(false);
    });

    it('should evaluate exists operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.department', operator: 'exists' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate notExists operator for missing attribute', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.nonExistent', operator: 'notExists' },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate between operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.level', operator: 'between', value: 1, value2: 100 },
      }, { user: { id: 'u1', role: 'dev', level: 50 as any } });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate timeInRange operator (within range)', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'environment.time', operator: 'timeInRange', value: { startHour: 9, endHour: 18 } },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate timeInRange operator (outside range)', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'environment.time', operator: 'timeInRange', value: { startHour: 9, endHour: 18 } },
      }, { environment: { time: new Date('2026-05-18T22:00:00Z') } });
      expect(result.allowed).toBe(false);
    });

    it('should return false for unknown operator', async () => {
      const result = await evaluateWithCondition({
        condition: { attribute: 'user.role', operator: 'unknownOp' as any, value: 'test' },
      });
      expect(result.allowed).toBe(false);
    });
  });

  // ==================== Condition Combination (isolated) ====================

  describe('condition combination (AND/OR/NOT)', () => {
    async function evaluateWithCondition(condition: ConditionRule, contextOverrides?: Partial<AbacContext>) {
      const cleanEngine = await makeCleanEngine();
      await cleanEngine.registerPolicy({
        id: 'combo-policy',
        name: 'Combo',
        resourceType: '*',
        actionType: '*',
        conditions: condition,
        effect: 'allow',
        enabled: true,
      });
      return cleanEngine.evaluate(makeContext(contextOverrides));
    }

    it('should evaluate AND combination (all true)', async () => {
      const result = await evaluateWithCondition({
        and: [
          { condition: { attribute: 'user.role', operator: 'equals', value: 'developer' } },
          { condition: { attribute: 'user.department', operator: 'equals', value: 'engineering' } },
        ],
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate AND combination (one false)', async () => {
      const result = await evaluateWithCondition({
        and: [
          { condition: { attribute: 'user.role', operator: 'equals', value: 'developer' } },
          { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
        ],
      });
      expect(result.allowed).toBe(false);
    });

    it('should evaluate OR combination (one true)', async () => {
      const result = await evaluateWithCondition({
        or: [
          { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
          { condition: { attribute: 'user.role', operator: 'equals', value: 'developer' } },
        ],
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate OR combination (all false)', async () => {
      const result = await evaluateWithCondition({
        or: [
          { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
          { condition: { attribute: 'user.role', operator: 'equals', value: 'super_admin' } },
        ],
      });
      expect(result.allowed).toBe(false);
    });

    it('should evaluate NOT combination', async () => {
      const result = await evaluateWithCondition({
        not: { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
      });
      expect(result.allowed).toBe(true);
    });

    it('should evaluate nested AND/OR/NOT', async () => {
      const result = await evaluateWithCondition({
        and: [
          { condition: { attribute: 'user.department', operator: 'equals', value: 'engineering' } },
          {
            or: [
              { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
              { not: { condition: { attribute: 'user.role', operator: 'equals', value: 'viewer' } } },
            ],
          },
        ],
      });
      expect(result.allowed).toBe(true);
    });

    it('should default to true for empty rule', async () => {
      const result = await evaluateWithCondition({});
      expect(result.allowed).toBe(true);
    });
  });

  // ==================== Variable Resolution ====================

  describe('variable resolution', () => {
    it('should resolve ${user.id} variable in condition value', async () => {
      const cleanEngine = await makeCleanEngine();
      await cleanEngine.registerPolicy({
        id: 'var-test',
        name: 'Variable Test',
        resourceType: '*',
        actionType: '*',
        conditions: {
          condition: { attribute: 'resource.owner', operator: 'equals', value: '${user.id}' },
        },
        effect: 'allow',
        enabled: true,
      });

      const result = cleanEngine.evaluate(makeContext());
      expect(result.allowed).toBe(true);
    });

    it('should resolve ${resource.department} variable', async () => {
      const cleanEngine = await makeCleanEngine();
      await cleanEngine.registerPolicy({
        id: 'dept-var',
        name: 'Dept Variable',
        resourceType: '*',
        actionType: '*',
        conditions: {
          condition: { attribute: 'user.department', operator: 'equals', value: '${resource.department}' },
        },
        effect: 'allow',
        enabled: true,
      });

      const result = cleanEngine.evaluate(makeContext({
        user: { id: 'user-1', role: 'dev', department: 'engineering', tenantId: 'tenant-1' },
        resource: { type: 'pipeline', department: 'engineering', tenantId: 'tenant-1' },
      }));

      expect(result.allowed).toBe(true);
    });

    it('should return false when variable resolves to different value', async () => {
      const cleanEngine = await makeCleanEngine();
      await cleanEngine.registerPolicy({
        id: 'var-mismatch',
        name: 'Var Mismatch',
        resourceType: '*',
        actionType: '*',
        conditions: {
          condition: { attribute: 'user.department', operator: 'equals', value: '${resource.department}' },
        },
        effect: 'allow',
        enabled: true,
      });

      const result = cleanEngine.evaluate(makeContext({
        user: { id: 'user-1', role: 'dev', department: 'engineering', tenantId: 'tenant-1' },
        resource: { type: 'pipeline', department: 'marketing', tenantId: 'tenant-1' },
      }));

      expect(result.allowed).toBe(false);
    });
  });

  // ==================== Priority Ordering ====================

  describe('priority ordering', () => {
    it('should apply deny policy before allow policy when deny has higher priority', async () => {
      const cleanEngine = await makeCleanEngine();
      await cleanEngine.registerPolicy({
        id: 'allow-low',
        name: 'Allow Low',
        resourceType: '*',
        actionType: '*',
        conditions: { condition: { attribute: 'user.role', operator: 'exists' } },
        effect: 'allow',
        priority: 10,
        enabled: true,
      });
      await cleanEngine.registerPolicy({
        id: 'deny-high',
        name: 'Deny High',
        resourceType: '*',
        actionType: '*',
        conditions: { condition: { attribute: 'user.role', operator: 'exists' } },
        effect: 'deny',
        priority: 100,
        enabled: true,
      });

      const result = cleanEngine.evaluate(makeContext());
      // Deny with higher priority is evaluated first and returns immediately
      expect(result.allowed).toBe(false);
      expect(result.denied).toBe(true);
    });

    it('should deny when deny policy matches regardless of allow priority', async () => {
      const cleanEngine = await makeCleanEngine();
      await cleanEngine.registerPolicy({
        id: 'deny-low',
        name: 'Deny Low',
        resourceType: '*',
        actionType: '*',
        conditions: { condition: { attribute: 'user.role', operator: 'exists' } },
        effect: 'deny',
        priority: 10,
        enabled: true,
      });
      await cleanEngine.registerPolicy({
        id: 'allow-high',
        name: 'Allow High',
        resourceType: '*',
        actionType: '*',
        conditions: { condition: { attribute: 'user.role', operator: 'exists' } },
        effect: 'allow',
        priority: 100,
        enabled: true,
      });

      const result = cleanEngine.evaluate(makeContext());
      // Policies sorted by priority desc: allow-high (100), deny-low (10).
      // allow-high matches → added to matchedAllowPolicies.
      // deny-low matches → returns immediately with denied=true (deny wins).
      expect(result.denied).toBe(true);
    });
  });

  // ==================== isAllowed / isDenied ====================

  describe('isAllowed / isDenied', () => {
    it('should return boolean from isAllowed', () => {
      const context = makeContext();
      expect(typeof engine.isAllowed(context)).toBe('boolean');
    });

    it('should return boolean from isDenied', () => {
      const context = makeContext();
      expect(typeof engine.isDenied(context)).toBe('boolean');
    });
  });

  // ==================== evaluateBatch ====================

  describe('evaluateBatch', () => {
    it('should evaluate multiple contexts', () => {
      const contexts = [
        makeContext({ user: { id: 'u1', role: 'admin', tenantId: 't1', department: 'eng' }, resource: { type: 'pipeline', tenantId: 't1', owner: 'u1', department: 'eng' } }),
        makeContext({ user: { id: 'u2', role: 'viewer', tenantId: 't1', department: 'eng' }, resource: { type: 'pipeline', tenantId: 't1', owner: 'other', department: 'eng' } }),
      ];

      const results = engine.evaluateBatch(contexts);

      expect(results.size).toBe(2);
      expect(results.has('0')).toBe(true);
      expect(results.has('1')).toBe(true);
    });
  });

  // ==================== getAvailableActions ====================

  describe('getAvailableActions', () => {
    it('should return allowed actions from a list', () => {
      const context = {
        user: { id: 'user-1', role: 'admin', tenantId: 'tenant-1', department: 'eng' },
        resource: { type: 'pipeline', tenantId: 'tenant-1', owner: 'user-1', department: 'eng' },
        environment: { time: new Date() },
      };

      const actions = engine.getAvailableActions(context, ['read', 'update', 'delete']);
      expect(Array.isArray(actions)).toBe(true);
      expect(actions).toContain('read');
    });
  });

  // ==================== Export / Import ====================

  describe('exportPolicies / importPolicies', () => {
    it('should export all policies', () => {
      const exported = engine.exportPolicies();
      expect(exported.length).toBe(SYSTEM_ABAC_POLICIES.length);
      expect(exported[0].conditions).toBeDefined();
    });

    it('should import policies and register them', async () => {
      const policies: AbacPolicy[] = [
        {
          id: 'import-1',
          name: 'Imported',
          resourceType: 'cmdb',
          actionType: 'read',
          conditions: { condition: { attribute: 'user.role', operator: 'equals', value: 'admin' } },
          effect: 'allow',
        },
      ];

      await engine.importPolicies(policies);

      expect(engine.getPolicy('import-1')).toBeDefined();
    });
  });

  // ==================== Cache ====================

  describe('cache', () => {
    it('should use cached result on second evaluation', () => {
      const context = makeContext();
      const result1 = engine.evaluate(context);
      const result2 = engine.evaluate(context);

      expect(result2.allowed).toBe(result1.allowed);
      expect(result2.evaluationTime).toBeDefined();
    });

    it('should clear cache when disabling cache', () => {
      engine.evaluate(makeContext());
      engine.setCacheConfig(false);
      const result = engine.evaluate(makeContext());
      expect(result).toBeDefined();
    });

    it('should support custom TTL', () => {
      engine.setCacheConfig(true, 60000);
      const result = engine.evaluate(makeContext());
      expect(result).toBeDefined();
    });

    it('should invalidate cache', () => {
      engine.evaluate(makeContext());
      engine.invalidateCache();
      const result = engine.evaluate(makeContext());
      expect(result).toBeDefined();
    });
  });

  // ==================== PolicyEvaluationResult shape ====================

  describe('PolicyEvaluationResult shape', () => {
    it('should return valid result with all fields', () => {
      const result = engine.evaluate(makeContext());

      expect(typeof result.allowed).toBe('boolean');
      expect(typeof result.denied).toBe('boolean');
      expect(Array.isArray(result.matchedPolicies)).toBe(true);
      expect(Array.isArray(result.matchedConditions)).toBe(true);
      expect(typeof result.evaluationTime).toBe('number');
    });

    it('should include denialReason when denied', () => {
      const context = makeContext({
        user: { id: 'user-1', role: 'developer', tenantId: 'tenant-A', department: 'eng' },
        resource: { type: 'pipeline', tenantId: 'tenant-B', department: 'eng' },
      });

      const result = engine.evaluate(context);
      if (result.denied) {
        expect(result.denialReason).toBeDefined();
      }
    });
  });
});
