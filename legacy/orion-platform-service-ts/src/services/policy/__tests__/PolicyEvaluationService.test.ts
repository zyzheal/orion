/**
 * PolicyEvaluationService - Unit Tests
 *
 * Tests for policy evaluation, batch evaluation, compliance status,
 * enforcement summary, violation management, and mock mode behavior.
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

import { PolicyEvaluationService, EvaluationInput } from '../PolicyEvaluationService';

describe('PolicyEvaluationService', () => {
  let service: PolicyEvaluationService;

  beforeEach(() => {
    service = new PolicyEvaluationService(); // No db = mock mode
  });

  // ==================== evaluate ====================

  describe('evaluate', () => {
    it('should evaluate and return allowed result', async () => {
      const input: EvaluationInput = {
        tenantId: 'tenant-1',
        runId: 'run-1',
      };

      const result = await service.evaluate(input);

      expect(result.id).toBeDefined();
      expect(result.allowed).toBe(true);
      expect(result.runId).toBe('run-1');
      expect(result.result).toHaveProperty('allowed');
      expect(result.result).toHaveProperty('reason');
      expect(result.evaluatedAt).toBeInstanceOf(Date);
      expect(typeof result.evaluationMs).toBe('number');
    });

    it('should use provided policyId', async () => {
      const result = await service.evaluate({
        policyId: 'custom-policy',
        tenantId: 'tenant-1',
        runId: 'run-1',
      });

      expect(result.policyId).toBe('custom-policy');
    });

    it('should default policyId to default-policy', async () => {
      const result = await service.evaluate({
        tenantId: 'tenant-1',
        runId: 'run-1',
      });

      expect(result.policyId).toBe('default-policy');
    });

    it('should include context in result', async () => {
      const result = await service.evaluate({
        tenantId: 'tenant-1',
        runId: 'run-1',
        resourceType: 'deployment',
        resourceId: 'deploy-1',
        action: 'create',
        context: { environment: 'production' },
      });

      expect(result.result.context).toEqual({ environment: 'production' });
    });
  });

  // ==================== evaluatePolicy ====================

  describe('evaluatePolicy', () => {
    it('should evaluate a specific policy', async () => {
      const result = await service.evaluatePolicy('policy-1', {
        tenantId: 'tenant-1',
        runId: 'run-1',
      });

      expect(result.policyId).toBe('policy-1');
      expect(result.allowed).toBe(true);
    });

    it('should generate runId when not provided', async () => {
      const result = await service.evaluatePolicy('policy-1', {});

      expect(result.runId).toBeDefined();
      expect(result.runId).toMatch(/^eval-/);
    });
  });

  // ==================== evaluateBatch ====================

  describe('evaluateBatch', () => {
    it('should evaluate multiple inputs', async () => {
      const inputs: EvaluationInput[] = [
        { tenantId: 't1', runId: 'run-1' },
        { tenantId: 't1', runId: 'run-2', policyId: 'p1' },
        { tenantId: 't1', runId: 'run-3', policyId: 'p2' },
      ];

      const results = await service.evaluateBatch(inputs);

      expect(results).toHaveLength(3);
      expect(results[0].runId).toBe('run-1');
      expect(results[1].policyId).toBe('p1');
      expect(results[2].policyId).toBe('p2');
    });

    it('should return empty array for empty input', async () => {
      const results = await service.evaluateBatch([]);
      expect(results).toEqual([]);
    });
  });

  // ==================== getEvaluation ====================

  describe('getEvaluation', () => {
    it('should return null in mock mode', async () => {
      const result = await service.getEvaluation('any-id');
      expect(result).toBeNull();
    });
  });

  // ==================== getByRunId ====================

  describe('getByRunId', () => {
    it('should return empty array in mock mode', async () => {
      const results = await service.getByRunId('run-1');
      expect(results).toEqual([]);
    });
  });

  // ==================== getByPolicyId ====================

  describe('getByPolicyId', () => {
    it('should return empty array in mock mode', async () => {
      const results = await service.getByPolicyId('policy-1');
      expect(results).toEqual([]);
    });

    it('should accept options', async () => {
      const results = await service.getByPolicyId('policy-1', { limit: 5, offset: 0 });
      expect(results).toEqual([]);
    });
  });

  // ==================== listEvaluations ====================

  describe('listEvaluations', () => {
    it('should return empty list in mock mode', async () => {
      const result = await service.listEvaluations();
      expect(result.evaluations).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==================== getViolations ====================

  describe('getViolations', () => {
    it('should return empty array in mock mode', async () => {
      const violations = await service.getViolations('eval-1');
      expect(violations).toEqual([]);
    });
  });

  // ==================== getViolationsByPolicy ====================

  describe('getViolationsByPolicy', () => {
    it('should return empty array in mock mode', async () => {
      const violations = await service.getViolationsByPolicy('policy-1');
      expect(violations).toEqual([]);
    });
  });

  // ==================== getOpenViolations ====================

  describe('getOpenViolations', () => {
    it('should return empty array in mock mode', async () => {
      const violations = await service.getOpenViolations();
      expect(violations).toEqual([]);
    });

    it('should accept custom status', async () => {
      const violations = await service.getOpenViolations('resolved');
      expect(violations).toEqual([]);
    });
  });

  // ==================== updateViolationStatus ====================

  describe('updateViolationStatus', () => {
    it('should return null in mock mode', async () => {
      const result = await service.updateViolationStatus('any-id', 'resolved');
      expect(result).toBeNull();
    });
  });

  // ==================== evaluateGate ====================

  describe('evaluateGate', () => {
    it('should be an alias for evaluatePolicy', async () => {
      const result = await service.evaluateGate('gate-1', {
        tenantId: 'tenant-1',
        runId: 'run-1',
      });

      expect(result.policyId).toBe('gate-1');
      expect(result.allowed).toBe(true);
    });
  });

  // ==================== getEvaluations ====================

  describe('getEvaluations', () => {
    it('should be an alias for getByRunId', async () => {
      const results = await service.getEvaluations('run-1');
      expect(results).toEqual([]);
    });
  });

  // ==================== getViolationById ====================

  describe('getViolationById', () => {
    it('should return null in mock mode', async () => {
      const result = await service.getViolationById('any-id');
      expect(result).toBeNull();
    });
  });

  // ==================== waiveViolation ====================

  describe('waiveViolation', () => {
    it('should return null in mock mode', async () => {
      const result = await service.waiveViolation('any-id', 'false positive');
      expect(result).toBeNull();
    });
  });

  // ==================== resolveViolation ====================

  describe('resolveViolation', () => {
    it('should return null in mock mode', async () => {
      const result = await service.resolveViolation('any-id', 'fixed');
      expect(result).toBeNull();
    });
  });

  // ==================== listOverrides ====================

  describe('listOverrides', () => {
    it('should return empty array in mock mode', async () => {
      const overrides = await service.listOverrides();
      expect(overrides).toEqual([]);
    });
  });

  // ==================== createOverride ====================

  describe('createOverride', () => {
    it('should return null in mock mode', async () => {
      const result = await service.createOverride('policy-1', 'violation-1', 'approved by manager');
      expect(result).toBeNull();
    });
  });

  // ==================== getComplianceStatus ====================

  describe('getComplianceStatus', () => {
    it('should return compliance status in mock mode', async () => {
      const status = await service.getComplianceStatus();

      expect(status.totalEvaluations).toBe(0);
      expect(status.allowedCount).toBe(0);
      expect(status.deniedCount).toBe(0);
      expect(status.complianceRate).toBe(1); // no evaluations = 100% compliant
      expect(status.byPolicy).toEqual([]);
      expect(status.period).toBe('week');
    });

    it('should accept custom period', async () => {
      const status = await service.getComplianceStatus({ period: 'day' });
      expect(status.period).toBe('day');
    });

    it('should accept policyId filter', async () => {
      const status = await service.getComplianceStatus({ policyId: 'policy-1' });
      expect(status.totalEvaluations).toBe(0);
    });
  });

  // ==================== getEnforcementSummary ====================

  describe('getEnforcementSummary', () => {
    it('should return enforcement summary in mock mode', async () => {
      const summary = await service.getEnforcementSummary();

      expect(summary.activeViolations).toBe(0);
      expect(summary.resolvedViolations).toBe(0);
      expect(summary.policies).toEqual([]);
    });
  });

  // ==================== setRepositories ====================

  describe('setRepositories', () => {
    it('should accept repository instances', () => {
      const mockEvalRepo = {} as any;
      const mockViolationRepo = {} as any;
      // Should not throw
      service.setRepositories(mockEvalRepo, mockViolationRepo);
    });
  });
});
