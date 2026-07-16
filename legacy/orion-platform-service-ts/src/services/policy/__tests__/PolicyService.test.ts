/**
 * PolicyService - Unit Tests
 *
 * Tests for policy CRUD, policy evaluation, policy bundles,
 * and evaluation context handling.
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import { PolicyService, CreatePolicyInput, PolicyEvaluationContext } from '../PolicyService';

describe('PolicyService', () => {
  let service: PolicyService;

  beforeEach(() => {
    // No database = mock mode
    service = new PolicyService();
  });

  // ==================== createPolicy ====================

  describe('createPolicy', () => {
    it('should create a policy with required fields', async () => {
      const input: CreatePolicyInput = {
        name: 'security-scan-required',
        category: 'security',
        regoPath: '/policies/security-scan.rego',
      };

      const policy = await service.createPolicy(input);

      expect(policy.id).toBeDefined();
      expect(policy.name).toBe('security-scan-required');
      expect(policy.category).toBe('security');
      expect(policy.regoPath).toBe('/policies/security-scan.rego');
      expect(policy.severity).toBe('warning'); // default
      expect(policy.enabled).toBe(true);
      expect(policy.createdAt).toBeInstanceOf(Date);
      expect(policy.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a policy with all optional fields', async () => {
      const input: CreatePolicyInput = {
        name: 'cost-check',
        description: 'Check deployment cost limits',
        category: 'cost',
        regoPath: '/policies/cost.rego',
        gateId: 'gate-1',
        severity: 'block',
        metadata: { maxCost: 1000 },
      };

      const policy = await service.createPolicy(input);

      expect(policy.description).toBe('Check deployment cost limits');
      expect(policy.gateId).toBe('gate-1');
      expect(policy.severity).toBe('block');
      expect(policy.metadata).toEqual({ maxCost: 1000 });
    });

    it('should support all policy categories', async () => {
      const categories = ['security', 'cost', 'quality', 'governance'] as const;

      for (const category of categories) {
        const policy = await service.createPolicy({
          name: `${category}-policy`,
          category,
          regoPath: `/policies/${category}.rego`,
        });
        expect(policy.category).toBe(category);
      }
    });
  });

  // ==================== getPolicy ====================

  describe('getPolicy', () => {
    it('should return null in mock mode', async () => {
      const result = await service.getPolicy('any-id');
      expect(result).toBeNull();
    });
  });

  // ==================== listPolicies ====================

  describe('listPolicies', () => {
    it('should return empty list in mock mode', async () => {
      const result = await service.listPolicies('tenant-1');
      expect(result.policies).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should accept filter options', async () => {
      const result = await service.listPolicies('tenant-1', {
        category: 'security',
        enabled: true,
        limit: 10,
        offset: 0,
      });
      expect(result.policies).toEqual([]);
    });
  });

  // ==================== updatePolicy / deletePolicy ====================

  describe('updatePolicy', () => {
    it('should return null in mock mode', async () => {
      const result = await service.updatePolicy('any-id', { description: 'updated' });
      expect(result).toBeNull();
    });
  });

  describe('deletePolicy', () => {
    it('should return false in mock mode', async () => {
      const result = await service.deletePolicy('any-id');
      expect(result).toBe(false);
    });
  });

  // ==================== evaluatePolicy ====================

  describe('evaluatePolicy', () => {
    it('should allow when policy not found', async () => {
      const context: PolicyEvaluationContext = {
        runId: 'run-1',
        pipelineName: 'test-pipeline',
      };

      const result = await service.evaluatePolicy('non-existent', context);

      expect(result.allowed).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.evaluationMs).toBeGreaterThanOrEqual(0);
    });

    it('should allow when policy is disabled', async () => {
      // In mock mode, getPolicy returns null, so this is covered by the above
      const result = await service.evaluatePolicy('disabled-policy', {
        runId: 'run-1',
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ==================== evaluateAllPolicies ====================

  describe('evaluateAllPolicies', () => {
    it('should allow all in mock mode (no repo)', async () => {
      const result = await service.evaluateAllPolicies({
        runId: 'run-1',
        pipelineName: 'test-pipeline',
      });

      expect(result.allowed).toBe(true);
      expect(result.violations).toEqual([]);
    });
  });

  // ==================== getActiveBundle ====================

  describe('getActiveBundle', () => {
    it('should return null in mock mode', async () => {
      const result = await service.getActiveBundle();
      expect(result).toBeNull();
    });
  });

  // ==================== getPoliciesByGate ====================

  describe('getPoliciesByGate', () => {
    it('should return empty array in mock mode', async () => {
      const result = await service.getPoliciesByGate('gate-1');
      expect(result).toEqual([]);
    });
  });

  // ==================== listBundles / getBundle ====================

  describe('listBundles', () => {
    it('should return empty array in mock mode', async () => {
      const result = await service.listBundles();
      expect(result).toEqual([]);
    });
  });

  describe('getBundle', () => {
    it('should return null in mock mode', async () => {
      const result = await service.getBundle('any-id');
      expect(result).toBeNull();
    });
  });

  // ==================== syncBundles ====================

  describe('syncBundles', () => {
    it('should return empty array in mock mode', async () => {
      const result = await service.syncBundles('https://example.com/bundles');
      expect(result).toEqual([]);
    });
  });

  // ==================== testPolicy ====================

  describe('testPolicy', () => {
    it('should evaluate policy against context', async () => {
      const result = await service.testPolicy('policy-1', {
        runId: 'run-1',
        pipelineName: 'test-pipeline',
      });

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('evaluationMs');
    });

    it('should handle rego + testCases mode', async () => {
      const testCases = [
        { input: 'test1', expected: true },
        { input: 'test2', expected: false },
      ];

      const result = await service.testPolicy('package test', testCases);

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].result).toBe('pass');
    });
  });

  // ==================== toggle ====================

  describe('toggle', () => {
    it('should return null in mock mode', async () => {
      const result = await service.toggle('policy-1', false);
      expect(result).toBeNull();
    });
  });

  // ==================== getEvaluationHistory ====================

  describe('getEvaluationHistory', () => {
    it('should return empty array in mock mode', async () => {
      const result = await service.getEvaluationHistory('run-1');
      expect(result).toEqual([]);
    });

    it('should accept limit parameter', async () => {
      const result = await service.getEvaluationHistory('run-1', 10);
      expect(result).toEqual([]);
    });
  });

  // ==================== evaluate ====================

  describe('evaluate', () => {
    it('should be an alias for evaluatePolicy', async () => {
      const result = await service.evaluate(
        'tenant-1',
        'deployment',
        'deploy-1',
        'create',
        { environment: 'production' }
      );

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('violations');
    });
  });
});
