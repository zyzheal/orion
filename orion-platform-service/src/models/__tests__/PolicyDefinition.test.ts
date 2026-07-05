/**
 * PolicyDefinition 模型测试
 */
import {
  createPolicyDefinition,
  createPolicyBundle,
  createPolicyEvaluation,
  createPolicyViolation,
  createPolicyOverride,
} from '../PolicyDefinition';

describe('PolicyDefinition', () => {
  describe('createPolicyDefinition', () => {
    it('should create policy with defaults', () => {
      const policy = createPolicyDefinition({
        name: 'no-root-containers',
        category: 'security',
        regoPath: '/policies/no-root.rego',
      });

      expect(policy.id).toBeDefined();
      expect(policy.name).toBe('no-root-containers');
      expect(policy.category).toBe('security');
      expect(policy.regoPath).toBe('/policies/no-root.rego');
      expect(policy.severity).toBe('warning');
      expect(policy.enabled).toBe(true);
      expect(policy.metadata).toEqual({});
      expect(policy.createdAt).toBeInstanceOf(Date);
      expect(policy.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept custom values', () => {
      const policy = createPolicyDefinition({
        name: 'cost-limit',
        description: 'Limit costs',
        category: 'cost',
        regoPath: '/policies/cost.rego',
        gateId: 'gate-1',
        severity: 'block',
        metadata: { maxCost: 100 },
      });

      expect(policy.description).toBe('Limit costs');
      expect(policy.gateId).toBe('gate-1');
      expect(policy.severity).toBe('block');
      expect(policy.metadata).toEqual({ maxCost: 100 });
    });
  });

  describe('createPolicyBundle', () => {
    it('should create bundle', () => {
      const bundle = createPolicyBundle({
        bundleName: 'security-bundle',
        gitRef: 'main',
        regoContent: { 'policy.rego': 'package policy' },
      });

      expect(bundle.id).toBeDefined();
      expect(bundle.bundleName).toBe('security-bundle');
      expect(bundle.gitRef).toBe('main');
      expect(bundle.status).toBe('active');
      expect(bundle.deployedAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const bundle = createPolicyBundle({
        bundleName: 'b',
        gitRef: 'v1',
        regoContent: {},
        deployedBy: 'admin',
        testResults: { passed: 5 },
      });

      expect(bundle.deployedBy).toBe('admin');
      expect(bundle.testResults).toEqual({ passed: 5 });
    });
  });

  describe('createPolicyEvaluation', () => {
    it('should create evaluation', () => {
      const eval1 = createPolicyEvaluation({
        runId: 'run-1',
        inputContext: { image: 'nginx' },
        result: { allowed: true },
      });

      expect(eval1.id).toBeDefined();
      expect(eval1.runId).toBe('run-1');
      expect(eval1.inputContext).toEqual({ image: 'nginx' });
      expect(eval1.result).toEqual({ allowed: true });
      expect(eval1.evaluatedAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const eval1 = createPolicyEvaluation({
        policyId: 'pol-1',
        runId: 'run-1',
        inputContext: {},
        result: {},
        evaluationMs: 150,
      });

      expect(eval1.policyId).toBe('pol-1');
      expect(eval1.evaluationMs).toBe(150);
    });
  });

  describe('createPolicyViolation', () => {
    it('should create violation with defaults', () => {
      const violation = createPolicyViolation({
        severity: 'block',
        message: 'Root container detected',
      });

      expect(violation.id).toBeDefined();
      expect(violation.severity).toBe('block');
      expect(violation.message).toBe('Root container detected');
      expect(violation.status).toBe('open');
      expect(violation.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const violation = createPolicyViolation({
        evaluationId: 'eval-1',
        policyId: 'pol-1',
        severity: 'warning',
        message: 'warn',
        resourceType: 'image',
        resourceId: 'img-1',
      });

      expect(violation.evaluationId).toBe('eval-1');
      expect(violation.policyId).toBe('pol-1');
      expect(violation.resourceType).toBe('image');
      expect(violation.resourceId).toBe('img-1');
    });
  });

  describe('createPolicyOverride', () => {
    it('should create override', () => {
      const override = createPolicyOverride({
        reason: 'Known issue',
        expiresAt: new Date('2030-01-01'),
      });

      expect(override.id).toBeDefined();
      expect(override.reason).toBe('Known issue');
      expect(override.scope).toBe('global');
      expect(override.approvedAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const override = createPolicyOverride({
        policyId: 'pol-1',
        violationId: 'viol-1',
        reason: 'approved',
        approvedBy: 'admin',
        expiresAt: new Date('2030-01-01'),
        scope: 'project',
      });

      expect(override.policyId).toBe('pol-1');
      expect(override.violationId).toBe('viol-1');
      expect(override.approvedBy).toBe('admin');
      expect(override.scope).toBe('project');
    });
  });
});
