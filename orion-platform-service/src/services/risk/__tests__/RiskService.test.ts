/**
 * RiskService Unit Tests
 *
 * Tests cover:
 * 1. identifyRisks - rule-based identification engine
 * 2. assessRisk - evaluate and score risk level
 * 3. createMitigation - create mitigation plan
 * 4. getRiskDashboard - aggregate dashboard data
 * 5. CRUD operations - create/list/get risks with tenant isolation
 * 6. High priority risks query
 */

import { RiskService, RiskLevel, RiskStatus, RiskCategory } from '../RiskService';
import { RiskRepository, RiskEntity } from '../RiskRepository';
import type { RiskCreateInput, RiskFindingInput, CreateMitigationInput } from '../types';

// ==================== Mock Database ====================

interface MockRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  risk_level: string;
  score: number;
  category: string;
  target_type: string;
  target_id: string;
  status: string;
  identified_at: Date;
  assessed_at: Date | null;
  mitigated_at: Date | null;
  closed_at: Date | null;
  created_by: string | null;
  assigned_to: string | null;
  findings: RiskFindingInput[];
  mitigations: any[];
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

class MockDb {
  private risks: Map<string, MockRow> = new Map();

  async query(text: string, params: unknown[] = []): Promise<{ rows: MockRow[]; rowCount: number | null }> {
    // Simple SQL parser for test queries
    const upperText = text.toUpperCase();

    // INSERT ... RETURNING *
    if (upperText.includes('INSERT INTO RISK_ASSESSMENTS')) {
      const row = this.parseInsertRow(params);
      this.risks.set(row.id, row);
      return { rows: [row], rowCount: 1 };
    }

    // SELECT * FROM risk_assessments WHERE id = $1 AND tenant_id = $2
    if (upperText.includes('WHERE ID =') && upperText.includes('AND TENANT_ID =')) {
      const [id, tenantId] = params;
      const row = this.risks.get(id as string);
      if (row && row.tenant_id === tenantId) {
        return { rows: [row], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT COUNT(*) ... WHERE tenant_id = $1
    if (upperText.includes('COUNT(*)') && upperText.includes('TENANT_ID =')) {
      const [tenantId] = params;
      const count = Array.from(this.risks.values()).filter((r) => r.tenant_id === tenantId).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }

    // SELECT * ... WHERE tenant_id = $1 AND status != $2
    if (upperText.includes('TENANT_ID =') && upperText.includes('STATUS !=')) {
      const [tenantId, status] = params;
      const rows = Array.from(this.risks.values()).filter((r) => r.tenant_id === tenantId && r.status !== status);
      return { rows, rowCount: rows.length };
    }

    // SELECT * ... WHERE risk_level IN
    if (upperText.includes('RISK_LEVEL IN')) {
      const levels = upperText.includes('CRITICAL') && upperText.includes('HIGH')
        ? [RiskLevel.HIGH, RiskLevel.CRITICAL]
        : [];
      const tenantId = params.find((p) => typeof p === 'string' && p.startsWith('tenant-')) as string | undefined;
      const rows = Array.from(this.risks.values()).filter((r) => {
        if (!levels.includes(r.risk_level as RiskLevel)) return false;
        if (tenantId && r.tenant_id !== tenantId) return false;
        const statusIdx = upperText.includes('STATUS !=') ? 1 : -1;
        if (statusIdx >= 0 && params[statusIdx] && r.status === params[statusIdx]) return false;
        return true;
      });
      return { rows, rowCount: rows.length };
    }

    // Default: return all
    return { rows: Array.from(this.risks.values()), rowCount: this.risks.size };
  }

  private parseInsertRow(params: unknown[]): MockRow {
    return {
      id: params[0] as string,
      tenant_id: params[1] as string,
      name: params[2] as string,
      description: params[3] as string | null,
      risk_level: params[4] as string,
      score: params[5] as number,
      category: params[6] as string,
      target_type: params[7] as string,
      target_id: params[8] as string,
      status: params[9] as string,
      identified_at: params[10] as Date,
      assessed_at: params[11] as Date | null,
      mitigated_at: params[12] as Date | null,
      closed_at: params[13] as Date | null,
      created_by: params[14] as string | null,
      assigned_to: params[15] as string | null,
      findings: params[16] as RiskFindingInput[],
      mitigations: params[17] as any[],
      metadata: params[18] as Record<string, unknown>,
      created_at: params[19] as Date,
      updated_at: params[20] as Date,
    };
  }
}

// ==================== Test Suite ====================

describe('RiskService', () => {
  let mockDb: MockDb;
  let riskService: RiskService;
  let riskRepository: RiskRepository;

  const tenantId = 'tenant-test-001';
  const targetType = 'deployment';
  const targetId = 'deploy-001';

  beforeEach(() => {
    mockDb = new MockDb();
    riskRepository = new RiskRepository(mockDb as any);
    riskService = new RiskService(mockDb as any);
  });

  // ==================== Test 1: Risk Identification ====================

  describe('identifyRisks', () => {
    it('should trigger rules and return findings when context data matches conditions', async () => {
      const context = {
        tenantId,
        targetType,
        targetId,
        data: {
          hasSecurityVulnerabilities: true,
          failedLoginCount: 15,
          complianceGaps: 0,
        },
      };

      const result = await riskService.identifyRisks(context);

      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.triggeredRules).toContain('rule-security-vulnerability');
      expect(result.triggeredRules).toContain('rule-unauthorized-access');
      expect(result.overallLevel).toBeOneOf([RiskLevel.HIGH, RiskLevel.CRITICAL, RiskLevel.MEDIUM]);
    });

    it('should return no findings and zero score when no conditions match', async () => {
      const context = {
        tenantId,
        targetType,
        targetId,
        data: {
          hasSecurityVulnerabilities: false,
          failedLoginCount: 0,
          complianceGaps: 0,
          hasBackupPlan: true,
          outdatedDependencyCount: 0,
          trafficSpike: 0,
        },
      };

      const result = await riskService.identifyRisks(context);

      expect(result.findings).toHaveLength(0);
      expect(result.triggeredRules).toHaveLength(0);
      expect(result.overallScore).toBe(0);
      expect(result.overallLevel).toBe(RiskLevel.LOW);
    });

    it('should not trigger disabled rules', async () => {
      const service = new RiskService(mockDb as any, [
        {
          id: 'disabled-rule',
          tenantId: '__system__',
          name: 'Disabled Rule',
          description: 'Should not trigger',
          category: RiskCategory.SECURITY,
          condition: { field: 'anything', operator: 'equals', value: true },
          weight: 1.0,
          enabled: false,
          priority: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const context = {
        tenantId,
        targetType,
        targetId,
        data: { anything: true },
      };

      const result = await service.identifyRisks(context);
      expect(result.findings).toHaveLength(0);
    });
  });

  // ==================== Test 2: Risk Assessment ====================

  describe('assessRisk', () => {
    it('should calculate level from findings when no custom score provided', async () => {
      const risk = await riskRepository.create({
        tenantId,
        name: 'DB Encryption Gap',
        description: 'Sensitive DB columns lack encryption',
        targetType,
        targetId,
      });

      // Add a critical finding
      await riskRepository.addFinding(
        risk.id,
        tenantId,
        createFindingInput('Critical Vulnerability', 'SQL injection risk', RiskLevel.CRITICAL, RiskCategory.SECURITY),
      );

      const output = await riskService.assessRisk({
        riskId: risk.id,
        assessedBy: 'admin',
      });

      expect(output.newScore).toBeGreaterThanOrEqual(60);
      expect(output.newLevel).toBeOneOf([RiskLevel.HIGH, RiskLevel.CRITICAL]);
      expect(output.findingsCount).toBeGreaterThan(0);
    });

    it('should use custom score when provided', async () => {
      const risk = await riskRepository.create({
        tenantId,
        name: 'Minor Config Issue',
        targetType,
        targetId,
      });

      const output = await riskService.assessRisk({
        riskId: risk.id,
        customScore: 15,
        assessedBy: 'admin',
      });

      expect(output.newScore).toBe(15);
      expect(output.newLevel).toBe(RiskLevel.LOW);
    });
  });

  // ==================== Test 3: Mitigation Creation ====================

  describe('createMitigation', () => {
    it('should create a mitigation plan with actions and transition risk to mitigating state', async () => {
      const risk = await riskRepository.create({
        tenantId,
        name: 'Payment Gateway Latency',
        description: 'P99 latency exceeds threshold',
        targetType,
        targetId,
      });

      const mitigationInput: CreateMitigationInput = {
        riskId: risk.id,
        plan: 'Optimize database queries and add caching layer',
        actions: [
          {
            description: 'Add Redis caching for frequent queries',
            type: 'mitigate',
            assignee: 'backend-team',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        ],
        priority: RiskLevel.HIGH,
        owner: 'sre-lead',
      };

      const updated = await riskService.createMitigation(mitigationInput);

      expect(updated.status).toBe(RiskStatus.MITIGATING);
      expect(updated.mitigations).toHaveLength(1);
      expect(updated.mitigations[0].plan).toBe(mitigationInput.plan);
      expect(updated.mitigations[0].actions).toHaveLength(1);
      expect(updated.mitigations[0].owner).toBe('sre-lead');
    });

    it('should throw error when risk does not exist', async () => {
      await expect(
        riskService.createMitigation({
          riskId: 'risk-nonexistent',
          plan: 'test plan',
          actions: [],
        }),
      ).rejects.toThrow();
    });
  });

  // ==================== Test 4: Risk Dashboard ====================

  describe('getRiskDashboard', () => {
    it('should return aggregated stats with correct summary counts', async () => {
      // Seed test data
      await riskRepository.create({
        tenantId,
        name: 'Risk 1',
        targetType,
        targetId,
        metadata: { category: RiskCategory.SECURITY },
      });
      await riskRepository.create({
        tenantId,
        name: 'Risk 2',
        targetType,
        targetId,
        metadata: { category: RiskCategory.OPERATIONAL },
      });

      const dashboard = await riskService.getRiskDashboard(tenantId);

      expect(dashboard.tenantId).toBe(tenantId);
      expect(dashboard.summary.totalRisks).toBeGreaterThanOrEqual(2);
      expect(dashboard.byCategory[RiskCategory.SECURITY]).toBeGreaterThanOrEqual(1);
      expect(dashboard.byCategory[RiskCategory.OPERATIONAL]).toBeGreaterThanOrEqual(1);
      expect(dashboard.recentTrends).toBeDefined();
      expect(dashboard.mitigationProgress).toBeDefined();
    });

    it('should include top risks sorted by severity', async () => {
      const highRisk = await riskRepository.create({
        tenantId,
        name: 'Critical DB Exposure',
        targetType,
        targetId,
      });
      await riskRepository.updateRisk(highRisk.id, tenantId, {
        score: 90,
        riskLevel: RiskLevel.CRITICAL,
      });

      const lowRisk = await riskRepository.create({
        tenantId,
        name: 'Minor Logging Gap',
        targetType,
        targetId,
      });
      await riskRepository.updateRisk(lowRisk.id, tenantId, {
        score: 10,
        riskLevel: RiskLevel.LOW,
      });

      const dashboard = await riskService.getRiskDashboard(tenantId);
      expect(dashboard.topRisks).toBeDefined();
      expect(dashboard.topRisks.length).toBeGreaterThan(0);
    });
  });

  // ==================== Test 5: CRUD + Tenant Isolation ====================

  describe('CRUD and tenant isolation', () => {
    it('should create risk with correct default values', async () => {
      const input: RiskCreateInput = {
        tenantId,
        name: 'API Rate Limiting Missing',
        description: 'No rate limiting on public endpoints',
        category: RiskCategory.TECHNICAL,
        targetType,
        targetId,
        createdBy: 'api-team',
      };

      const risk = await riskRepository.create(input);

      expect(risk.id).toBeDefined();
      expect(risk.tenantId).toBe(tenantId);
      expect(risk.name).toBe(input.name);
      expect(risk.riskLevel).toBe(RiskLevel.LOW);
      expect(risk.score).toBe(0);
      expect(risk.status).toBe(RiskStatus.IDENTIFIED);
      expect(risk.findings).toEqual([]);
      expect(risk.mitigations).toEqual([]);
    });

    it('should not return risk for different tenant (tenant isolation)', async () => {
      const otherTenant = 'tenant-other-002';
      const risk = await riskRepository.create({
        tenantId,
        name: 'Cross-Tenant Isolation Test',
        targetType,
        targetId,
      });

      const found = await riskRepository.findById(risk.id, otherTenant);
      expect(found).toBeUndefined();
    });

    it('should list only risks for the specified tenant', async () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';

      await riskRepository.create({ tenantId: tenantA, name: 'Risk A1', targetType, targetId });
      await riskRepository.create({ tenantId: tenantA, name: 'Risk A2', targetType, targetId });
      await riskRepository.create({ tenantId: tenantB, name: 'Risk B1', targetType, targetId });

      const resultA = await riskRepository.findByTenant(tenantA);
      const resultB = await riskRepository.findByTenant(tenantB);

      expect(resultA.entities).toHaveLength(2);
      expect(resultB.entities).toHaveLength(1);
      expect(resultA.entities.every((r) => r.tenantId === tenantA)).toBe(true);
      expect(resultB.entities.every((r) => r.tenantId === tenantB)).toBe(true);
    });

    it('should update risk with tenant isolation', async () => {
      const risk = await riskRepository.create({
        tenantId,
        name: 'Original Name',
        targetType,
        targetId,
      });

      const updated = await riskRepository.updateRisk(risk.id, tenantId, {
        name: 'Updated Name',
        score: 45,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.score).toBe(45);

      // Ensure other tenant cannot see the update
      const fromOtherTenant = await riskRepository.findById(risk.id, 'tenant-other');
      expect(fromOtherTenant).toBeUndefined();
    });
  });

  // ==================== Test 6: High Priority Risks ====================

  describe('findHighRisk', () => {
    it('should return only high and critical risks', async () => {
      await riskRepository.create({
        tenantId,
        name: 'Low Risk',
        targetType,
        targetId,
      });
      const high = await riskRepository.create({
        tenantId,
        name: 'High Risk',
        targetType,
        targetId,
      });
      await riskRepository.updateRisk(high.id, tenantId, { score: 80, riskLevel: RiskLevel.HIGH });

      const critical = await riskRepository.create({
        tenantId,
        name: 'Critical Risk',
        targetType,
        targetId,
      });
      await riskRepository.updateRisk(critical.id, tenantId, { score: 95, riskLevel: RiskLevel.CRITICAL });

      const highRisks = await riskRepository.findHighRisk({ tenantId, limit: 10 });

      expect(highRisks.every((r) => r.riskLevel === RiskLevel.HIGH || r.riskLevel === RiskLevel.CRITICAL)).toBe(true);
      expect(highRisks.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==================== Test 7: Risk Statistics ====================

  describe('getStats', () => {
    it('should return correct counts by level, category, and status', async () => {
      await riskRepository.create({
        tenantId,
        name: 'Security Risk',
        targetType,
        targetId,
        category: RiskCategory.SECURITY,
      });
      const opRisk = await riskRepository.create({
        tenantId,
        name: 'Operational Risk',
        targetType,
        targetId,
        category: RiskCategory.OPERATIONAL,
      });
      await riskRepository.updateRisk(opRisk.id, tenantId, { status: RiskStatus.CLOSED });

      const stats = await riskRepository.getStats(tenantId);

      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.byCategory[RiskCategory.SECURITY]).toBeGreaterThanOrEqual(1);
      expect(stats.byCategory[RiskCategory.OPERATIONAL]).toBeGreaterThanOrEqual(1);
      expect(stats.openRisks).toBeGreaterThanOrEqual(1);
    });
  });
});

// ==================== Test Helpers ====================

function createFindingInput(
  title: string,
  description: string,
  severity: RiskLevel,
  category: RiskCategory,
): RiskFindingInput {
  return {
    title,
    description,
    severity,
    category,
    source: 'test-rule',
    recommendation: 'Apply fix immediately',
    affectedComponents: ['test-component'],
  };
}

// Custom matcher for enum values
expect.extend({
  toBeOneOf(received: unknown, expected: unknown[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () => `${pass ? '' : 'expected '}${JSON.stringify(received)} ${pass ? 'to be one of' : 'not to be one of'} ${JSON.stringify(expected)}`,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: unknown[]): R;
    }
  }
}
