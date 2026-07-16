/**
 * QualityGateService 单元测试
 *
 * GAP-CN-04: 代码质量门禁
 */

import {
  QualityGateService,
  QualityGateServiceError,
} from '../QualityGateService';
import { QualityGate, QualityGateRule } from '../../../models/QualityGate';

// ============================================================================
// Mock Repositories
// ============================================================================

function createMockGateRepository() {
  const gates = new Map<string, QualityGate>();

  return {
    findById: async (id: string) => gates.get(id),
    findByTenant: async (tenantId: string, options?: { enabledOnly?: boolean }) => {
      const result = Array.from(gates.values()).filter(g => g.tenantId === tenantId);
      return options?.enabledOnly ? result.filter(g => g.enabled) : result;
    },
    findByName: async (tenantId: string, name: string) => {
      return Array.from(gates.values()).find(g => g.tenantId === tenantId && g.name === name);
    },
    create: async (input: any) => {
      const gate: QualityGate = {
        id: 'gate-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        rules: input.rules,
        externalProvider: input.externalProvider,
        enabled: input.enabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      gates.set(gate.id, gate);
      return gate;
    },
    update: async (id: string, input: any) => {
      const gate = gates.get(id);
      if (!gate) {
        throw new Error(`UPDATE on quality_gates affected no rows (id: ${id})`);
      }
      const updated = { ...gate, ...input, updatedAt: new Date() };
      gates.set(id, updated);
      return updated;
    },
    delete: async (id: string) => {
      return gates.delete(id);
    },
    // Test helper
    _seed: (gate: QualityGate) => gates.set(gate.id, gate),
    _clear: () => gates.clear(),
  };
}

function createMockResultRepository() {
  const results: any[] = [];

  return {
    findByRunId: async (runId: string) => results.filter(r => r.runId === runId),
    findByStageName: async (runId: string, stageName: string) =>
      results.filter(r => r.runId === runId && r.stageName === stageName),
    createResult: async (input: any) => {
      const result = {
        id: input.id,
        gateId: input.gateId,
        gateName: input.gateName,
        runId: input.runId,
        stageName: input.stageName,
        metrics: input.metrics,
        passed: input.passed,
        blockedRules: input.blockedRules,
        warnedRules: input.warnedRules,
        evaluatedAt: input.evaluatedAt,
      };
      results.push(result);
      return result;
    },
    _clear: () => results.length = 0,
  };
}

// ============================================================================
// Test Fixtures
// ============================================================================

const coverageGate: QualityGate = {
  id: 'gate-coverage',
  tenantId: 'tenant-1',
  name: 'Coverage Gate',
  description: 'Minimum 80% code coverage',
  rules: [
    { metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' },
  ],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const multiRuleGate: QualityGate = {
  id: 'gate-multi',
  tenantId: 'tenant-1',
  name: 'Multi-Rule Gate',
  rules: [
    { metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' },
    { metric: 'complexity', operator: '<=', threshold: 10, severity: 'block' },
    { metric: 'duplication', operator: '<=', threshold: 5, severity: 'warn' },
    { metric: 'vulnerabilities', operator: '==', threshold: 0, severity: 'block' },
  ],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const warnOnlyGate: QualityGate = {
  id: 'gate-warn',
  tenantId: 'tenant-1',
  name: 'Warn-Only Gate',
  rules: [
    { metric: 'coverage', operator: '>=', threshold: 90, severity: 'warn' },
  ],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================================================
// Tests
// ============================================================================

describe('QualityGateService', () => {
  let gateRepo: ReturnType<typeof createMockGateRepository>;
  let resultRepo: ReturnType<typeof createMockResultRepository>;
  let service: QualityGateService;

  beforeEach(() => {
    gateRepo = createMockGateRepository();
    resultRepo = createMockResultRepository();
    service = new QualityGateService(gateRepo as any, resultRepo as any);
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create a quality gate with valid rules', async () => {
      const gate = await service.create({
        tenantId: 'tenant-1',
        name: 'Test Gate',
        rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
      });

      expect(gate.id).toBeDefined();
      expect(gate.name).toBe('Test Gate');
      expect(gate.rules).toHaveLength(1);
      expect(gate.enabled).toBe(true);
    });

    it('should reject invalid metric', async () => {
      await expect(
        service.create({
          tenantId: 'tenant-1',
          name: 'Bad Gate',
          rules: [{ metric: 'invalid_metric' as any, operator: '>=', threshold: 80, severity: 'block' }],
        })
      ).rejects.toThrow(QualityGateServiceError);
    });

    it('should reject invalid operator', async () => {
      await expect(
        service.create({
          tenantId: 'tenant-1',
          name: 'Bad Gate',
          rules: [{ metric: 'coverage', operator: '!=' as any, threshold: 80, severity: 'block' }],
        })
      ).rejects.toThrow(QualityGateServiceError);
    });

    it('should reject invalid severity', async () => {
      await expect(
        service.create({
          tenantId: 'tenant-1',
          name: 'Bad Gate',
          rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'critical' as any }],
        })
      ).rejects.toThrow(QualityGateServiceError);
    });

    it('should reject non-number threshold', async () => {
      await expect(
        service.create({
          tenantId: 'tenant-1',
          name: 'Bad Gate',
          rules: [{ metric: 'coverage', operator: '>=', threshold: '80' as any, severity: 'block' }],
        })
      ).rejects.toThrow(QualityGateServiceError);
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should return gates for a tenant', async () => {
      await service.create({
        tenantId: 'tenant-1',
        name: 'Gate 1',
        rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
      });
      await service.create({
        tenantId: 'tenant-2',
        name: 'Gate 2',
        rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
      });

      const results = await service.findByTenant('tenant-1');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Gate 1');
    });

    it('should return empty array when no gates exist', async () => {
      const results = await service.findByTenant('nonexistent');
      expect(results).toEqual([]);
    });
  });

  // ==================== findByName ====================

  describe('findByName', () => {
    it('should find gate by name', async () => {
      await service.create({
        tenantId: 'tenant-1',
        name: 'Unique Gate',
        rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
      });

      const gate = await service.findByName('tenant-1', 'Unique Gate');
      expect(gate).toBeDefined();
      expect(gate!.name).toBe('Unique Gate');
    });

    it('should return undefined for non-existent gate', async () => {
      const gate = await service.findByName('tenant-1', 'nonexistent');
      expect(gate).toBeUndefined();
    });
  });

  // ==================== evaluate ====================

  describe('evaluate', () => {
    it('should pass when all rules are satisfied', () => {
      const result = service.evaluate(coverageGate, {
        metrics: { coverage: 85 },
      });

      expect(result.passed).toBe(true);
      expect(result.blockedRules).toHaveLength(0);
      expect(result.warnedRules).toHaveLength(0);
    });

    it('should fail when coverage is below threshold', () => {
      const result = service.evaluate(coverageGate, {
        metrics: { coverage: 60 },
      });

      expect(result.passed).toBe(false);
      expect(result.blockedRules).toHaveLength(1);
      expect(result.blockedRules[0].reason).toContain('Code Coverage');
      expect(result.blockedRules[0].actualValue).toBe(60);
    });

    it('should pass at exact threshold with >=', () => {
      const result = service.evaluate(coverageGate, {
        metrics: { coverage: 80 },
      });

      expect(result.passed).toBe(true);
    });

    it('should handle multiple rules with mixed pass/fail', () => {
      const result = service.evaluate(multiRuleGate, {
        metrics: {
          coverage: 90,       // >= 80 -> PASS
          complexity: 15,     // <= 10 -> FAIL (block)
          duplication: 8,     // <= 5 -> FAIL (warn)
          vulnerabilities: 0, // == 0 -> PASS
        },
      });

      expect(result.passed).toBe(false);
      expect(result.blockedRules).toHaveLength(1);
      expect(result.blockedRules[0].rule.metric).toBe('complexity');
      expect(result.warnedRules).toHaveLength(1);
      expect(result.warnedRules[0].rule.metric).toBe('duplication');
    });

    it('should pass when only warn rules fail (warn is non-blocking)', () => {
      const result = service.evaluate(warnOnlyGate, {
        metrics: { coverage: 50 }, // < 90, but only warn
      });

      expect(result.passed).toBe(true);
      expect(result.blockedRules).toHaveLength(0);
      expect(result.warnedRules).toHaveLength(1);
    });

    it('should handle missing metrics (default to 0)', () => {
      const result = service.evaluate(coverageGate, {
        metrics: {}, // no coverage metric
      });

      expect(result.passed).toBe(false); // 0 < 80
      expect(result.blockedRules).toHaveLength(1);
    });

    it('should handle all metric types', () => {
      const allMetricsGate: QualityGate = {
        id: 'gate-all',
        tenantId: 'tenant-1',
        name: 'All Metrics',
        rules: [
          { metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' },
          { metric: 'complexity', operator: '<=', threshold: 10, severity: 'block' },
          { metric: 'duplication', operator: '<=', threshold: 5, severity: 'block' },
          { metric: 'security_hotspots', operator: '==', threshold: 0, severity: 'block' },
          { metric: 'bugs', operator: '<=', threshold: 2, severity: 'warn' },
          { metric: 'vulnerabilities', operator: '==', threshold: 0, severity: 'block' },
        ],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.evaluate(allMetricsGate, {
        metrics: {
          coverage: 85,
          complexity: 5,
          duplication: 3,
          security_hotspots: 0,
          bugs: 1,
          vulnerabilities: 0,
        },
      });

      expect(result.passed).toBe(true);
      expect(result.blockedRules).toHaveLength(0);
      expect(result.warnedRules).toHaveLength(0);
    });
  });

  // ==================== isBlocking ====================

  describe('isBlocking', () => {
    it('should return true when blocked rules exist', () => {
      const result = service.evaluate(coverageGate, {
        metrics: { coverage: 50 },
      });

      expect(service.isBlocking(result)).toBe(true);
    });

    it('should return false when no blocked rules', () => {
      const result = service.evaluate(coverageGate, {
        metrics: { coverage: 90 },
      });

      expect(service.isBlocking(result)).toBe(false);
    });

    it('should return false when only warn rules fail', () => {
      const result = service.evaluate(warnOnlyGate, {
        metrics: { coverage: 50 },
      });

      expect(service.isBlocking(result)).toBe(false);
    });
  });

  // ==================== getBlockingReason ====================

  describe('getBlockingReason', () => {
    it('should return reason string when blocked', () => {
      const result = service.evaluate(coverageGate, {
        metrics: { coverage: 50 },
      });

      const reason = service.getBlockingReason(result);
      expect(reason).toContain('Coverage Gate');
      expect(reason).toContain('blocked');
    });

    it('should return null when not blocked', () => {
      const result = service.evaluate(coverageGate, {
        metrics: { coverage: 90 },
      });

      expect(service.getBlockingReason(result)).toBeNull();
    });
  });

  // ==================== evaluateAndStore ====================

  describe('evaluateAndStore', () => {
    it('should evaluate and store result', async () => {
      gateRepo._seed(coverageGate);

      const result = await service.evaluateAndStore({
        gateId: 'gate-coverage',
        runId: 'run-1',
        stageName: 'test',
        metrics: { coverage: 90 },
      });

      expect(result.passed).toBe(true);
      expect(result.runId).toBe('run-1');
      expect(result.stageName).toBe('test');
      expect(result.gateId).toBe('gate-coverage');
      // Verify result was stored
      const storedResults = await service.getResultsForRun('run-1');
      expect(storedResults).toHaveLength(1);
    });

    it('should throw if gate not found', async () => {
      await expect(
        service.evaluateAndStore({
          gateId: 'nonexistent',
          runId: 'run-1',
          stageName: 'test',
          metrics: { coverage: 90 },
        })
      ).rejects.toThrow(QualityGateServiceError);
    });

    it('should throw if gate is disabled', async () => {
      const disabledGate: QualityGate = {
        ...coverageGate,
        id: 'gate-disabled',
        enabled: false,
      };
      gateRepo._seed(disabledGate);

      await expect(
        service.evaluateAndStore({
          gateId: 'gate-disabled',
          runId: 'run-1',
          stageName: 'test',
          metrics: { coverage: 90 },
        })
      ).rejects.toThrow(QualityGateServiceError);
    });

    it('should store failed evaluation result', async () => {
      gateRepo._seed(coverageGate);

      const result = await service.evaluateAndStore({
        gateId: 'gate-coverage',
        runId: 'run-2',
        stageName: 'build',
        metrics: { coverage: 50 },
      });

      expect(result.passed).toBe(false);
      expect(result.blockedRules).toHaveLength(1);
      // Verify result was stored
      const storedResults = await service.getResultsForRun('run-2');
      expect(storedResults).toHaveLength(1);
    });
  });

  // ==================== getResultsForRun ====================

  describe('getResultsForRun', () => {
    it('should return results for a run', async () => {
      gateRepo._seed(coverageGate);

      await service.evaluateAndStore({
        gateId: 'gate-coverage',
        runId: 'run-1',
        stageName: 'build',
        metrics: { coverage: 90 },
      });

      const results = await service.getResultsForRun('run-1');
      expect(results).toHaveLength(1);
      expect(results[0].runId).toBe('run-1');
    });

    it('should return empty array for non-existent run', async () => {
      const results = await service.getResultsForRun('nonexistent');
      expect(results).toEqual([]);
    });
  });

  // ==================== getResultsForStage ====================

  describe('getResultsForStage', () => {
    it('should return results for a specific stage', async () => {
      gateRepo._seed(coverageGate);

      await service.evaluateAndStore({
        gateId: 'gate-coverage',
        runId: 'run-1',
        stageName: 'build',
        metrics: { coverage: 90 },
      });
      await service.evaluateAndStore({
        gateId: 'gate-coverage',
        runId: 'run-1',
        stageName: 'test',
        metrics: { coverage: 85 },
      });

      const results = await service.getResultsForStage('run-1', 'build');
      expect(results).toHaveLength(1);
      expect(results[0].stageName).toBe('build');
    });
  });

  // ==================== update and delete ====================

  describe('update', () => {
    it('should update gate name', async () => {
      const gate = await service.create({
        tenantId: 'tenant-1',
        name: 'Old Name',
        rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
      });

      const updated = await service.update(gate.id, { name: 'New Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
    });

    it('should throw for non-existent gate', async () => {
      await expect(
        service.update('nonexistent', { name: 'New Name' })
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete a gate', async () => {
      const gate = await service.create({
        tenantId: 'tenant-1',
        name: 'Delete Me',
        rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
      });

      const deleted = await service.delete(gate.id);
      expect(deleted).toBe(true);

      const found = await service.findById(gate.id);
      expect(found).toBeUndefined();
    });
  });

  // ==================== Comparison operators ====================

  describe('comparison operators', () => {
    it('should handle < operator', () => {
      const gate: QualityGate = {
        id: 'g1', tenantId: 't1', name: 'test',
        rules: [{ metric: 'complexity', operator: '<', threshold: 10, severity: 'block' }],
        enabled: true, createdAt: new Date(), updatedAt: new Date(),
      };

      expect(service.evaluate(gate, { metrics: { complexity: 5 } }).passed).toBe(true);
      expect(service.evaluate(gate, { metrics: { complexity: 10 } }).passed).toBe(false);
      expect(service.evaluate(gate, { metrics: { complexity: 15 } }).passed).toBe(false);
    });

    it('should handle <= operator', () => {
      const gate: QualityGate = {
        id: 'g2', tenantId: 't1', name: 'test',
        rules: [{ metric: 'complexity', operator: '<=', threshold: 10, severity: 'block' }],
        enabled: true, createdAt: new Date(), updatedAt: new Date(),
      };

      expect(service.evaluate(gate, { metrics: { complexity: 5 } }).passed).toBe(true);
      expect(service.evaluate(gate, { metrics: { complexity: 10 } }).passed).toBe(true);
      expect(service.evaluate(gate, { metrics: { complexity: 15 } }).passed).toBe(false);
    });

    it('should handle > operator', () => {
      const gate: QualityGate = {
        id: 'g3', tenantId: 't1', name: 'test',
        rules: [{ metric: 'coverage', operator: '>', threshold: 80, severity: 'block' }],
        enabled: true, createdAt: new Date(), updatedAt: new Date(),
      };

      expect(service.evaluate(gate, { metrics: { coverage: 90 } }).passed).toBe(true);
      expect(service.evaluate(gate, { metrics: { coverage: 80 } }).passed).toBe(false);
      expect(service.evaluate(gate, { metrics: { coverage: 70 } }).passed).toBe(false);
    });

    it('should handle == operator', () => {
      const gate: QualityGate = {
        id: 'g4', tenantId: 't1', name: 'test',
        rules: [{ metric: 'vulnerabilities', operator: '==', threshold: 0, severity: 'block' }],
        enabled: true, createdAt: new Date(), updatedAt: new Date(),
      };

      expect(service.evaluate(gate, { metrics: { vulnerabilities: 0 } }).passed).toBe(true);
      expect(service.evaluate(gate, { metrics: { vulnerabilities: 1 } }).passed).toBe(false);
    });
  });

  // ==================== Database unavailable ====================

  describe('without database', () => {
    beforeEach(() => {
      service = new QualityGateService(null, null);
    });

    it('should evaluate without database', () => {
      const result = service.evaluate(coverageGate, {
        metrics: { coverage: 90 },
      });
      expect(result.passed).toBe(true);
    });

    it('should return empty list for findByTenant', async () => {
      const results = await service.findByTenant('tenant-1');
      expect(results).toEqual([]);
    });

    it('should reject create', async () => {
      await expect(
        service.create({
          tenantId: 'tenant-1',
          name: 'Test',
          rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
        })
      ).rejects.toThrow('Database not available');
    });

    it('should return empty list for getResultsForRun', async () => {
      const results = await service.getResultsForRun('run-1');
      expect(results).toEqual([]);
    });
  });
});
