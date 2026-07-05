/**
 * OPA Policy Service Tests
 */

import { OPAPolicyService, Policy, PolicyRule } from '../OPAPolicyService';

describe('OPAPolicyService', () => {
  let service: OPAPolicyService;

  beforeEach(() => {
    service = new OPAPolicyService();
  });

  describe('createPolicy', () => {
    it('should create a policy with generated id and rules', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [
        { effect: 'allow', condition: 'always', message: 'Allow all' },
      ];

      const policy = await service.createPolicy('test-policy', 'Test policy', rules, 'strict');

      expect(policy.id).toMatch(/^policy-/);
      expect(policy.name).toBe('test-policy');
      expect(policy.description).toBe('Test policy');
      expect(policy.enabled).toBe(true);
      expect(policy.enforcement).toBe('strict');
      expect(policy.rules).toHaveLength(1);
      expect(policy.rules[0].id).toMatch(/^rule-/);
    });

    it('should generate valid module name from policy name', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [];
      const policy = await service.createPolicy('my test policy', 'desc', rules, 'permissive');

      expect(policy.module).toBe('package orion.my_test_policy');
    });
  });

  describe('evaluate', () => {
    it('should allow when no policies exist', async () => {
      const result = await service.evaluate({ input: {} });

      expect(result.allowed).toBe(true);
      expect(result.decisions).toHaveLength(0);
    });

    it('should evaluate strict mode correctly', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [
        { effect: 'deny', condition: 'never', message: 'Never allow' },
      ];
      await service.createPolicy('strict-policy', 'Strict policy', rules, 'strict');

      const result = await service.evaluate({ input: {} });

      expect(result.allowed).toBe(false);
      expect(result.decisions[0].effect).toBe('deny');
    });

    it('should evaluate permissive mode correctly', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [
        { effect: 'deny', condition: 'never', message: 'Never allow' },
      ];
      await service.createPolicy('permissive-policy', 'Permissive policy', rules, 'permissive');

      const result = await service.evaluate({ input: {} });

      // In permissive mode, deny rule with 'never' condition still denies
      expect(result.allowed).toBe(false);
    });

    it('should evaluate audit mode correctly', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [
        { effect: 'allow', condition: 'always', message: 'Always allow' },
      ];
      await service.createPolicy('audit-policy', 'Audit policy', rules, 'audit');

      const result = await service.evaluate({ input: {} });

      expect(result.allowed).toBe(true);
    });

    it('should evaluate role-based conditions', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [
        { effect: 'allow', condition: 'role:admin', message: 'Admin only' },
      ];
      await service.createPolicy('role-policy', 'Role policy', rules, 'strict');

      // With admin role - should allow
      const allowedResult = await service.evaluate({
        input: { roles: ['admin', 'user'] },
      });
      expect(allowedResult.allowed).toBe(true);

      // Without admin role - should deny
      const deniedResult = await service.evaluate({
        input: { roles: ['user'] },
      });
      expect(deniedResult.allowed).toBe(false);
    });

    it('should evaluate tenant-based conditions', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [
        { effect: 'allow', condition: 'tenant:acme-corp', message: 'ACME only' },
      ];
      await service.createPolicy('tenant-policy', 'Tenant policy', rules, 'strict');

      // Matching tenant - should allow
      const allowedResult = await service.evaluate({
        input: { tenantId: 'acme-corp' },
      });
      expect(allowedResult.allowed).toBe(true);

      // Non-matching tenant - should deny
      const deniedResult = await service.evaluate({
        input: { tenantId: 'other-corp' },
      });
      expect(deniedResult.allowed).toBe(false);
    });

    it('should evaluate only specified policies when policies filter provided', async () => {
      const rules1: Omit<PolicyRule, 'id'>[] = [
        { effect: 'deny', condition: 'never', message: 'Never allow' },
      ];
      const policy1 = await service.createPolicy('policy-1', 'Policy 1', rules1, 'strict');

      const rules2: Omit<PolicyRule, 'id'>[] = [
        { effect: 'allow', condition: 'always', message: 'Always allow' },
      ];
      await service.createPolicy('policy-2', 'Policy 2', rules2, 'strict');

      // Evaluate only policy-1
      const result = await service.evaluate({
        input: {},
        policies: [policy1.id],
      });

      expect(result.allowed).toBe(false);
      expect(result.evaluatedPolicies).toContain(policy1.id);
    });

    it('should stop on first strict denial', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [
        { effect: 'deny', condition: 'never', message: 'Never allow' },
      ];
      await service.createPolicy('first-policy', 'First', rules, 'strict');

      // This won't be evaluated since first policy denies in strict mode
      const rules2: Omit<PolicyRule, 'id'>[] = [
        { effect: 'allow', condition: 'always', message: 'Always allow' },
      ];
      const policy2 = await service.createPolicy('second-policy', 'Second', rules2, 'strict');

      const result = await service.evaluate({ input: {} });

      expect(result.allowed).toBe(false);
      // Only first policy should be evaluated due to early termination
      expect(result.evaluatedPolicies).toHaveLength(1);
    });
  });

  describe('getPolicy', () => {
    it('should return policy by id', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [];
      const created = await service.createPolicy('test-policy', 'desc', rules, 'strict');

      const policy = await service.getPolicy(created.id);

      expect(policy).not.toBeNull();
      expect(policy?.name).toBe('test-policy');
    });

    it('should return null for non-existent policy', async () => {
      const policy = await service.getPolicy('non-existent');

      expect(policy).toBeNull();
    });
  });

  describe('listPolicies', () => {
    it('should list all policies', async () => {
      await service.createPolicy('policy-1', 'desc', [], 'strict');
      await service.createPolicy('policy-2', 'desc', [], 'permissive');

      const policies = await service.listPolicies();

      expect(policies).toHaveLength(2);
    });

    it('should list only enabled policies when enabledOnly is true', async () => {
      const policy1 = await service.createPolicy('policy-1', 'desc', [], 'strict');
      await service.createPolicy('policy-2', 'desc', [], 'permissive');

      // Disable first policy
      await service.updatePolicy(policy1.id, { enabled: false });

      const enabledPolicies = await service.listPolicies(true);

      expect(enabledPolicies).toHaveLength(1);
      expect(enabledPolicies[0].name).toBe('policy-2');
    });
  });

  describe('updatePolicy', () => {
    it('should update policy fields', async () => {
      const policy = await service.createPolicy('original-name', 'original desc', [], 'strict');

      const updated = await service.updatePolicy(policy.id, {
        name: 'updated-name',
        description: 'updated desc',
      });

      expect(updated?.name).toBe('updated-name');
      expect(updated?.description).toBe('updated desc');
      expect(updated?.version).toBe(2);
    });

    it('should return null for non-existent policy', async () => {
      const updated = await service.updatePolicy('non-existent', { name: 'test' });

      expect(updated).toBeNull();
    });
  });

  describe('deletePolicy', () => {
    it('should delete a policy', async () => {
      const policy = await service.createPolicy('to-delete', 'desc', [], 'strict');

      const deleted = await service.deletePolicy(policy.id);

      expect(deleted).toBe(true);
      expect(await service.getPolicy(policy.id)).toBeNull();
    });

    it('should return false for non-existent policy', async () => {
      const deleted = await service.deletePolicy('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('bundles', () => {
    it('should create a bundle', async () => {
      const policy1 = await service.createPolicy('policy-1', 'desc', [], 'strict');
      const policy2 = await service.createPolicy('policy-2', 'desc', [], 'strict');

      const bundle = await service.createBundle('my-bundle', [policy1.id, policy2.id]);

      expect(bundle.id).toMatch(/^bundle-/);
      expect(bundle.name).toBe('my-bundle');
      expect(bundle.policies).toHaveLength(2);
    });

    it('should get bundle by id', async () => {
      const policy = await service.createPolicy('policy', 'desc', [], 'strict');
      const created = await service.createBundle('test-bundle', [policy.id]);

      const bundle = await service.getBundle(created.id);

      expect(bundle).not.toBeNull();
      expect(bundle?.name).toBe('test-bundle');
    });

    it('should list bundles', async () => {
      await service.createBundle('bundle-1', []);
      await service.createBundle('bundle-2', []);

      const bundles = await service.listBundles();

      expect(bundles).toHaveLength(2);
    });

    it('should evaluate bundle', async () => {
      const rules: Omit<PolicyRule, 'id'>[] = [
        { effect: 'allow', condition: 'always', message: 'Allowed' },
      ];
      const policy = await service.createPolicy('policy', 'desc', rules, 'strict');
      const bundle = await service.createBundle('bundle', [policy.id]);

      const result = await service.evaluateBundle(bundle.id, {});

      expect(result.allowed).toBe(true);
      expect(result.evaluatedPolicies).toContain(policy.id);
    });

    it('should throw error for non-existent bundle evaluation', async () => {
      await expect(service.evaluateBundle('non-existent', {})).rejects.toThrow('Bundle not found');
    });

    it('should delete bundle', async () => {
      const bundle = await service.createBundle('to-delete', []);

      const deleted = await service.deleteBundle(bundle.id);

      expect(deleted).toBe(true);
      expect(await service.getBundle(bundle.id)).toBeNull();
    });
  });

  describe('togglePolicy', () => {
    it('should toggle policy enabled state', async () => {
      const policy = await service.createPolicy('toggle-test', 'desc', [], 'strict');

      expect(policy.enabled).toBe(true);

      const toggled = await service.togglePolicy(policy.id);
      expect(toggled?.enabled).toBe(false);

      const toggledAgain = await service.togglePolicy(policy.id);
      expect(toggledAgain?.enabled).toBe(true);
    });

    it('should return null for non-existent policy', async () => {
      const result = await service.togglePolicy('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('evaluation metadata', () => {
    it('should track evaluation time', async () => {
      await service.createPolicy('test', 'desc', [{ effect: 'allow', condition: 'always', message: '' }], 'strict');

      const result = await service.evaluate({ input: {} });

      expect(result.evaluationTime).toBeGreaterThanOrEqual(0);
    });

    it('should include all evaluated policy IDs', async () => {
      const policy1 = await service.createPolicy('p1', 'desc', [], 'permissive');
      const policy2 = await service.createPolicy('p2', 'desc', [], 'permissive');
      const policy3 = await service.createPolicy('p3', 'desc', [], 'permissive');

      const result = await service.evaluate({ input: {} });

      expect(result.evaluatedPolicies).toContain(policy1.id);
      expect(result.evaluatedPolicies).toContain(policy2.id);
      expect(result.evaluatedPolicies).toContain(policy3.id);
    });
  });
});