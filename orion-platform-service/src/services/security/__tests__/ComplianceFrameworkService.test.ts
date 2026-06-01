/**
 * ComplianceFrameworkService Unit Tests
 *
 * Tests: policy CRUD, compliance evaluation, gap analysis, evidence collection,
 * supported frameworks, remediation, compliance scoring
 */

import { ComplianceFrameworkService } from '../ComplianceFrameworkService';
import { OrionError, ErrorCode } from '../../../errors';

// Mock Phase3Repository
jest.mock('../../../repositories/Phase3Repository', () => {
  const mockPolicyRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findByTenant: jest.fn().mockResolvedValue([]),
    findByFramework: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(true),
    update: jest.fn(),
  };

  const mockEvaluationRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findLatestByPolicy: jest.fn(),
    findByTenant: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
  };

  const mockRemediationRepo = {
    create: jest.fn(),
  };

  return {
    CompliancePolicyRepository: jest.fn(() => mockPolicyRepo),
    ComplianceEvaluationRepository: jest.fn(() => mockEvaluationRepo),
    ComplianceRemediationRepository: jest.fn(() => mockRemediationRepo),
  };
});

// Mock ComplianceEvidenceRepository
jest.mock('../../../repositories/ComplianceEvidenceRepository', () => ({
  ComplianceEvidenceRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    findByPolicyId: jest.fn().mockResolvedValue([]),
  })),
}));

describe('ComplianceFrameworkService', () => {
  let service: ComplianceFrameworkService;
  const mockDb = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ComplianceFrameworkService(mockDb as any);
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create instance with db', () => {
      expect(service).toBeInstanceOf(ComplianceFrameworkService);
    });

    it('should create instance without db', () => {
      const noDbService = new ComplianceFrameworkService();
      expect(noDbService).toBeInstanceOf(ComplianceFrameworkService);
    });
  });

  // ==================== Policy CRUD ====================

  describe('definePolicy', () => {
    it('should create a policy', async () => {
      const { CompliancePolicyRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = CompliancePolicyRepository.mock.results[0]?.value;
      const expectedEntity = {
        id: 'policy-1',
        tenant_id: 'tenant-1',
        name: 'SOC2 Policy',
        framework_type: 'soc2',
      };
      mockRepo.create.mockResolvedValue(expectedEntity);

      const result = await service.definePolicy('tenant-1', {
        name: 'SOC2 Policy',
        frameworkType: 'soc2',
      });

      expect(result).toEqual(expectedEntity);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-1',
          name: 'SOC2 Policy',
          framework_type: 'soc2',
          enabled: true,
        }),
      );
    });

    it('should throw SERVICE_UNAVAILABLE when no db', async () => {
      const noDbService = new ComplianceFrameworkService();

      await expect(
        noDbService.definePolicy('tenant-1', { name: 'test', frameworkType: 'soc2' }),
      ).rejects.toThrow(OrionError);
    });
  });

  describe('getPolicy', () => {
    it('should return policy by id', async () => {
      const { CompliancePolicyRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = CompliancePolicyRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({ id: 'policy-1', name: 'Test' });

      const result = await service.getPolicy('policy-1');

      expect(result).toEqual({ id: 'policy-1', name: 'Test' });
    });

    it('should return undefined for non-existent policy', async () => {
      const { CompliancePolicyRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = CompliancePolicyRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue(undefined);

      const result = await service.getPolicy('non-existent');

      expect(result).toBeUndefined();
    });

    it('should throw when no db configured', async () => {
      const noDbService = new ComplianceFrameworkService();

      await expect(noDbService.getPolicy('policy-1')).rejects.toThrow(OrionError);
    });
  });

  describe('listPolicies', () => {
    it('should list all policies for tenant', async () => {
      const { CompliancePolicyRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = CompliancePolicyRepository.mock.results[0]?.value;
      mockRepo.findByTenant.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

      const result = await service.listPolicies('tenant-1');

      expect(result).toHaveLength(2);
    });

    it('should filter by framework type', async () => {
      const { CompliancePolicyRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = CompliancePolicyRepository.mock.results[0]?.value;
      mockRepo.findByFramework.mockResolvedValue([{ id: 'p1', framework_type: 'soc2' }]);

      const result = await service.listPolicies('tenant-1', 'soc2');

      expect(result).toHaveLength(1);
      expect(mockRepo.findByFramework).toHaveBeenCalledWith('tenant-1', 'soc2');
    });
  });

  describe('deletePolicy', () => {
    it('should delete a policy', async () => {
      const { CompliancePolicyRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = CompliancePolicyRepository.mock.results[0]?.value;
      mockRepo.delete.mockResolvedValue(true);

      const result = await service.deletePolicy('policy-1');

      expect(result).toBe(true);
    });
  });

  // ==================== Compliance Evaluation ====================

  describe('evaluateCompliance', () => {
    it('should evaluate a policy with rules', async () => {
      const { CompliancePolicyRepository, ComplianceEvaluationRepository } = require('../../../repositories/Phase3Repository');
      const mockPolicyRepo = CompliancePolicyRepository.mock.results[0]?.value;
      const mockEvalRepo = ComplianceEvaluationRepository.mock.results[0]?.value;

      mockPolicyRepo.findById.mockResolvedValue({
        id: 'policy-1',
        tenant_id: 'tenant-1',
        rules: [
          { id: 'rule-1', type: 'encryption', name: 'TLS check' },
          { id: 'rule-2', type: 'access_control', name: 'RBAC check' },
        ],
      });

      const createdEval = { id: 'eval-1', status: 'running', score: 0 };
      mockEvalRepo.create.mockResolvedValue(createdEval);
      mockEvalRepo.update.mockResolvedValue({
        ...createdEval,
        status: 'completed',
        score: 100,
        total_checks: 2,
        passed_checks: 2,
        failed_checks: 0,
      });

      const result = await service.evaluateCompliance('tenant-1', 'policy-1');

      expect(result.status).toBe('completed');
      expect(mockEvalRepo.create).toHaveBeenCalled();
      expect(mockEvalRepo.update).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when policy does not exist', async () => {
      const { CompliancePolicyRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = CompliancePolicyRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.evaluateCompliance('tenant-1', 'non-existent'),
      ).rejects.toThrow('Policy not found');
    });

    it('should throw VALIDATION_ERROR when tenant mismatch', async () => {
      const { CompliancePolicyRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = CompliancePolicyRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({
        id: 'policy-1',
        tenant_id: 'other-tenant',
      });

      await expect(
        service.evaluateCompliance('tenant-1', 'policy-1'),
      ).rejects.toThrow('does not belong to this tenant');
    });

    it('should handle policy with no rules (100% score)', async () => {
      const { CompliancePolicyRepository, ComplianceEvaluationRepository } = require('../../../repositories/Phase3Repository');
      const mockPolicyRepo = CompliancePolicyRepository.mock.results[0]?.value;
      const mockEvalRepo = ComplianceEvaluationRepository.mock.results[0]?.value;

      mockPolicyRepo.findById.mockResolvedValue({
        id: 'policy-1',
        tenant_id: 'tenant-1',
        rules: [],
      });

      mockEvalRepo.create.mockResolvedValue({ id: 'eval-1' });
      mockEvalRepo.update.mockResolvedValue({
        id: 'eval-1',
        status: 'completed',
        score: 100,
      });

      const result = await service.evaluateCompliance('tenant-1', 'policy-1');

      expect(result.score).toBe(100);
    });

    it('should detect gaps for unknown rule types', async () => {
      const { CompliancePolicyRepository, ComplianceEvaluationRepository } = require('../../../repositories/Phase3Repository');
      const mockPolicyRepo = CompliancePolicyRepository.mock.results[0]?.value;
      const mockEvalRepo = ComplianceEvaluationRepository.mock.results[0]?.value;

      mockPolicyRepo.findById.mockResolvedValue({
        id: 'policy-1',
        tenant_id: 'tenant-1',
        rules: [
          { id: 'rule-1', type: 'unknown_type', name: 'Unknown check', severity: 'high' },
        ],
      });

      mockEvalRepo.create.mockResolvedValue({ id: 'eval-1' });
      mockEvalRepo.update.mockResolvedValue({
        id: 'eval-1',
        status: 'completed',
        score: 0,
        failed_checks: 1,
      });

      const result = await service.evaluateCompliance('tenant-1', 'policy-1');

      expect(result.failed_checks).toBe(1);
      expect(result.score).toBe(0);
    });
  });

  // ==================== Compliance Report ====================

  describe('getComplianceReport', () => {
    it('should generate a compliance report', async () => {
      const { CompliancePolicyRepository, ComplianceEvaluationRepository } = require('../../../repositories/Phase3Repository');
      const mockPolicyRepo = CompliancePolicyRepository.mock.results[0]?.value;
      const mockEvalRepo = ComplianceEvaluationRepository.mock.results[0]?.value;

      mockPolicyRepo.findById.mockResolvedValue({
        id: 'policy-1',
        tenant_id: 'tenant-1',
        name: 'SOC2',
      });
      mockEvalRepo.findLatestByPolicy.mockResolvedValue({
        id: 'eval-1',
        policy_id: 'policy-1',
        status: 'completed',
        score: 85,
        gaps: [{ id: 'gap-1', severity: 'medium' }],
      });

      const report = await service.getComplianceReport('tenant-1', 'policy-1');

      expect(report.policy.id).toBe('policy-1');
      expect(report.score).toBe(85);
      expect(report.gaps).toHaveLength(1);
    });

    it('should throw when no evaluation exists', async () => {
      const { CompliancePolicyRepository, ComplianceEvaluationRepository } = require('../../../repositories/Phase3Repository');
      const mockPolicyRepo = CompliancePolicyRepository.mock.results[0]?.value;
      const mockEvalRepo = ComplianceEvaluationRepository.mock.results[0]?.value;

      mockPolicyRepo.findById.mockResolvedValue({ id: 'policy-1', tenant_id: 'tenant-1' });
      mockEvalRepo.findLatestByPolicy.mockResolvedValue(undefined);

      await expect(
        service.getComplianceReport('tenant-1', 'policy-1'),
      ).rejects.toThrow('No evaluation found');
    });
  });

  // ==================== Compliance Score ====================

  describe('getComplianceScore', () => {
    it('should calculate overall compliance score', async () => {
      const { CompliancePolicyRepository, ComplianceEvaluationRepository } = require('../../../repositories/Phase3Repository');
      const mockPolicyRepo = CompliancePolicyRepository.mock.results[0]?.value;
      const mockEvalRepo = ComplianceEvaluationRepository.mock.results[0]?.value;

      mockPolicyRepo.findByTenant.mockResolvedValue([
        { id: 'p1', framework_type: 'soc2' },
        { id: 'p2', framework_type: 'iso27001' },
      ]);
      mockEvalRepo.findByTenant.mockResolvedValue([
        { policy_id: 'p1', score: 80, gaps: [{ severity: 'high' }] },
        { policy_id: 'p2', score: 90, gaps: [{ severity: 'critical' }] },
      ]);

      const score = await service.getComplianceScore('tenant-1');

      expect(score.tenantId).toBe('tenant-1');
      expect(score.overallScore).toBe(85);
      expect(score.policiesEvaluated).toBe(2);
      expect(score.openGaps).toBe(2);
      expect(score.criticalGaps).toBe(1);
    });

    it('should return zero score when no evaluations', async () => {
      const { CompliancePolicyRepository, ComplianceEvaluationRepository } = require('../../../repositories/Phase3Repository');
      const mockPolicyRepo = CompliancePolicyRepository.mock.results[0]?.value;
      const mockEvalRepo = ComplianceEvaluationRepository.mock.results[0]?.value;

      mockPolicyRepo.findByTenant.mockResolvedValue([]);
      mockEvalRepo.findByTenant.mockResolvedValue([]);

      const score = await service.getComplianceScore('tenant-1');

      expect(score.overallScore).toBe(0);
      expect(score.policiesEvaluated).toBe(0);
    });
  });

  // ==================== Remediation ====================

  describe('autoRemediateCompliance', () => {
    it('should auto-remediate gaps', async () => {
      const { ComplianceRemediationRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = ComplianceRemediationRepository.mock.results[0]?.value;
      mockRepo.create.mockResolvedValue({
        id: 'remediation-1',
        status: 'completed',
        action_taken: 'Enabled encryption',
      });

      const result = await service.autoRemediateCompliance('tenant-1', [
        { gapId: 'encryption-gap' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });

    it('should handle multiple gaps', async () => {
      const { ComplianceRemediationRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = ComplianceRemediationRepository.mock.results[0]?.value;
      mockRepo.create
        .mockResolvedValueOnce({ id: 'r1', status: 'completed' })
        .mockResolvedValueOnce({ id: 'r2', status: 'completed' });

      const result = await service.autoRemediateCompliance('tenant-1', [
        { gapId: 'encryption-gap' },
        { gapId: 'mfa-gap' },
      ]);

      expect(result).toHaveLength(2);
    });

    it('should throw when no db configured', async () => {
      const noDbService = new ComplianceFrameworkService();

      await expect(
        noDbService.autoRemediateCompliance('tenant-1', [{ gapId: 'gap-1' }]),
      ).rejects.toThrow(OrionError);
    });
  });

  // ==================== Supported Frameworks ====================

  describe('getSupportedFrameworks', () => {
    it('should return all supported frameworks', async () => {
      const frameworks = await service.getSupportedFrameworks();

      expect(frameworks.length).toBeGreaterThanOrEqual(6);
      const ids = frameworks.map((f) => f.id);
      expect(ids).toContain('soc2');
      expect(ids).toContain('iso27001');
      expect(ids).toContain('gdpr');
      expect(ids).toContain('hipaa');
      expect(ids).toContain('pci-dss');
      expect(ids).toContain('nist-csf');
    });

    it('should have valid framework structure', async () => {
      const frameworks = await service.getSupportedFrameworks();

      for (const fw of frameworks) {
        expect(fw.id).toBeDefined();
        expect(fw.name).toBeDefined();
        expect(fw.description).toBeDefined();
        expect(fw.version).toBeDefined();
        expect(Array.isArray(fw.categories)).toBe(true);
        expect(fw.totalControls).toBeGreaterThan(0);
      }
    });
  });

  describe('getFramework', () => {
    it('should return framework by id', async () => {
      const fw = await service.getFramework('soc2');

      expect(fw).toBeDefined();
      expect(fw!.id).toBe('soc2');
      expect(fw!.name).toBe('SOC 2 Type II');
    });

    it('should return undefined for unknown framework', async () => {
      const fw = await service.getFramework('unknown-framework');

      expect(fw).toBeUndefined();
    });
  });

  // ==================== Evidence Collection ====================

  describe('collectEvidence', () => {
    it('should collect evidence', async () => {
      const { ComplianceEvidenceRepository } = require('../../../repositories/ComplianceEvidenceRepository');
      const mockRepo = ComplianceEvidenceRepository.mock.results[0]?.value;
      mockRepo.create.mockResolvedValue({
        id: 'evidence-1',
        tenantId: 'tenant-1',
        policyId: 'policy-1',
        controlId: 'ctrl-1',
        evidenceType: 'document',
        description: 'TLS certificate',
        source: 'aws-console',
        collectedAt: new Date(),
        status: 'collected',
      });

      const result = await service.collectEvidence('tenant-1', 'policy-1', 'ctrl-1', {
        evidenceType: 'document',
        description: 'TLS certificate',
        source: 'aws-console',
      });

      expect(result.id).toBe('evidence-1');
      expect(result.status).toBe('collected');
    });
  });

  describe('getEvidence', () => {
    it('should get evidence for a policy', async () => {
      const { ComplianceEvidenceRepository } = require('../../../repositories/ComplianceEvidenceRepository');
      const mockRepo = ComplianceEvidenceRepository.mock.results[0]?.value;
      mockRepo.findByPolicyId.mockResolvedValue([
        { id: 'e1', tenantId: 't1', policyId: 'p1', controlId: 'c1', evidenceType: 'log', description: 'd', source: 's', collectedAt: new Date(), status: 'verified' },
      ]);

      const result = await service.getEvidence('policy-1');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('verified');
    });
  });

  describe('generateEvidenceCollection', () => {
    it('should generate evidence for a framework', async () => {
      const result = await service.generateEvidenceCollection('tenant-1', 'soc2');

      expect(result.framework.id).toBe('soc2');
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.coveragePercent).toBeGreaterThan(0);
    });

    it('should throw for unknown framework', async () => {
      await expect(
        service.generateEvidenceCollection('tenant-1', 'unknown'),
      ).rejects.toThrow('Framework not found');
    });
  });

  // ==================== Gap Analysis ====================

  describe('performGapAnalysis', () => {
    it('should perform gap analysis for SOC2', async () => {
      const result = await service.performGapAnalysis('tenant-1', 'soc2');

      expect(result.tenantId).toBe('tenant-1');
      expect(result.frameworkId).toBe('soc2');
      expect(result.totalControls).toBe(64);
      expect(result.gaps.length).toBeGreaterThan(0);
      expect(result.overallCompliance).toBeLessThan(100);
      expect(result.evaluatedAt).toBeInstanceOf(Date);
    });

    it('should perform gap analysis for GDPR', async () => {
      const result = await service.performGapAnalysis('tenant-1', 'gdpr');

      expect(result.frameworkId).toBe('gdpr');
      expect(result.gaps.length).toBeGreaterThan(0);
      // GDPR has privacy category, should have data_retention gap
      const gapIds = result.gaps.map((g) => g.controlId);
      expect(gapIds).toContain('data_retention');
    });

    it('should include remediation steps in gaps', async () => {
      const result = await service.performGapAnalysis('tenant-1', 'iso27001');

      for (const gap of result.gaps) {
        expect(gap.remediation).toBeDefined();
        expect(gap.remediation.action).toBeDefined();
        expect(gap.remediation.priority).toBeDefined();
        expect(Array.isArray(gap.remediation.steps)).toBe(true);
        expect(gap.remediation.steps.length).toBeGreaterThan(0);
      }
    });

    it('should throw for unknown framework', async () => {
      await expect(
        service.performGapAnalysis('tenant-1', 'unknown'),
      ).rejects.toThrow('Framework not found');
    });
  });
});
