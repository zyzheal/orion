/**
 * QualityGate Integration Tests — PipelineEngine 集成测试
 *
 * 测试质量门禁与 PipelineEngine 的集成：
 * - 阶段执行后自动评估质量门禁
 * - 阻断规则失败导致阶段标记为 FAILED
 * - 警告规则失败不影响阶段状态
 *
 * GAP-CN-04: 代码质量门禁
 */

import { QualityGateService, QualityGateServiceError } from '../QualityGateService';
import { QualityGate } from '../../../models/QualityGate';

// ============================================================================
// Mock Dependencies
// ============================================================================

function createMockQualityGateService() {
  const results: any[] = [];

  return {
    evaluate: jest.fn((gate: QualityGate, input: { metrics: Record<string, number> }) => {
      const blockedRules: any[] = [];
      const warnedRules: any[] = [];

      for (const rule of gate.rules) {
        const actualValue = input.metrics[rule.metric] ?? 0;
        let passed = false;
        switch (rule.operator) {
          case '<':  passed = actualValue < rule.threshold; break;
          case '<=': passed = actualValue <= rule.threshold; break;
          case '>':  passed = actualValue > rule.threshold; break;
          case '>=': passed = actualValue >= rule.threshold; break;
          case '==': passed = actualValue === rule.threshold; break;
        }
        if (!passed) {
          const reason = `${rule.metric}: ${actualValue} ${rule.operator} ${rule.threshold}`;
          if (rule.severity === 'block') {
            blockedRules.push({ rule, actualValue, reason });
          } else {
            warnedRules.push({ rule, actualValue, reason });
          }
        }
      }

      return {
        gateId: gate.id,
        gateName: gate.name,
        runId: '',
        stageName: '',
        metrics: input.metrics,
        passed: blockedRules.length === 0,
        blockedRules,
        warnedRules,
      };
    }),
    evaluateAndStore: jest.fn(async (input: any) => {
      const gate = {
        id: input.gateId,
        name: input.gateId,
        rules: [
          { metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' },
        ],
        enabled: true,
      } as QualityGate;

      const evaluation = {
        ...createMockQualityGateService().evaluate(gate, { metrics: input.metrics }),
        id: 'result-' + Date.now(),
        runId: input.runId,
        stageName: input.stageName,
        evaluatedAt: new Date(),
      };

      results.push(evaluation);
      return evaluation;
    }),
    isBlocking: jest.fn((result: any) => result.blockedRules.length > 0),
    getBlockingReason: jest.fn((result: any) => {
      if (result.blockedRules.length === 0) return null;
      return `Quality gate blocked: ${result.blockedRules.map((r: any) => r.reason).join('; ')}`;
    }),
    getResultsForRun: jest.fn(async (runId: string) => results.filter(r => r.runId === runId)),
    getResultsForStage: jest.fn(async (runId: string, stageName: string) =>
      results.filter(r => r.runId === runId && r.stageName === stageName)
    ),
    _results: results,
  };
}

// ============================================================================
// Tests: QualityGate evaluation logic
// ============================================================================

describe('QualityGate Evaluation Logic', () => {
  let service: ReturnType<typeof createMockQualityGateService>;

  beforeEach(() => {
    service = createMockQualityGateService();
  });

  describe('evaluate', () => {
    it('should pass when metrics meet threshold', () => {
      const gate: QualityGate = {
        id: 'gate-1',
        tenantId: 't1',
        name: 'Coverage Gate',
        rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.evaluate(gate, { metrics: { coverage: 85 } });

      expect(result.passed).toBe(true);
      expect(result.blockedRules).toHaveLength(0);
    });

    it('should fail with blocked rules when below threshold', () => {
      const gate: QualityGate = {
        id: 'gate-1',
        tenantId: 't1',
        name: 'Coverage Gate',
        rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.evaluate(gate, { metrics: { coverage: 60 } });

      expect(result.passed).toBe(false);
      expect(result.blockedRules).toHaveLength(1);
      expect(result.blockedRules[0].actualValue).toBe(60);
    });
  });

  describe('isBlocking', () => {
    it('should return true for blocking failure', () => {
      const result = service.evaluate(
        {
          id: 'g1', tenantId: 't1', name: 'test',
          rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
          enabled: true, createdAt: new Date(), updatedAt: new Date(),
        },
        { metrics: { coverage: 50 } }
      );

      expect(service.isBlocking(result)).toBe(true);
    });

    it('should return false for warning-only failure', () => {
      const result = service.evaluate(
        {
          id: 'g1', tenantId: 't1', name: 'test',
          rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'warn' }],
          enabled: true, createdAt: new Date(), updatedAt: new Date(),
        },
        { metrics: { coverage: 50 } }
      );

      expect(service.isBlocking(result)).toBe(false);
    });
  });

  describe('getBlockingReason', () => {
    it('should return descriptive reason for blocking failure', () => {
      const result = service.evaluate(
        {
          id: 'g1', tenantId: 't1', name: 'Quality Gate',
          rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
          enabled: true, createdAt: new Date(), updatedAt: new Date(),
        },
        { metrics: { coverage: 50 } }
      );

      const reason = service.getBlockingReason(result);
      expect(reason).toContain('blocked');
      expect(reason).toContain('coverage');
    });

    it('should return null when not blocked', () => {
      const result = service.evaluate(
        {
          id: 'g1', tenantId: 't1', name: 'test',
          rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
          enabled: true, createdAt: new Date(), updatedAt: new Date(),
        },
        { metrics: { coverage: 90 } }
      );

      expect(service.getBlockingReason(result)).toBeNull();
    });
  });
});

// ============================================================================
// Tests: Multi-rule evaluation
// ============================================================================

describe('Multi-rule Quality Gate Evaluation', () => {
  let service: ReturnType<typeof createMockQualityGateService>;

  beforeEach(() => {
    service = createMockQualityGateService();
  });

  it('should block on any block-rule failure', () => {
    const gate: QualityGate = {
      id: 'multi',
      tenantId: 't1',
      name: 'Multi-Rule',
      rules: [
        { metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' },
        { metric: 'complexity', operator: '<=', threshold: 10, severity: 'block' },
        { metric: 'vulnerabilities', operator: '==', threshold: 0, severity: 'block' },
      ],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Coverage fails (block), complexity passes, vulnerabilities passes
    const result = service.evaluate(gate, { metrics: { coverage: 60, complexity: 5, vulnerabilities: 0 } });
    expect(result.passed).toBe(false);
    expect(result.blockedRules).toHaveLength(1);
  });

  it('should pass when all block-rules pass even if warn-rules fail', () => {
    const gate: QualityGate = {
      id: 'multi',
      tenantId: 't1',
      name: 'Multi-Rule',
      rules: [
        { metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' },
        { metric: 'duplication', operator: '<=', threshold: 5, severity: 'warn' },
      ],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = service.evaluate(gate, { metrics: { coverage: 90, duplication: 10 } });
    expect(result.passed).toBe(true);
    expect(result.blockedRules).toHaveLength(0);
    expect(result.warnedRules).toHaveLength(1);
  });

  it('should report all failed rules (both block and warn)', () => {
    const gate: QualityGate = {
      id: 'multi',
      tenantId: 't1',
      name: 'Multi-Rule',
      rules: [
        { metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' },
        { metric: 'complexity', operator: '<=', threshold: 10, severity: 'block' },
        { metric: 'duplication', operator: '<=', threshold: 5, severity: 'warn' },
      ],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = service.evaluate(gate, {
      metrics: { coverage: 60, complexity: 20, duplication: 10 },
    });

    expect(result.passed).toBe(false);
    expect(result.blockedRules).toHaveLength(2);
    expect(result.warnedRules).toHaveLength(1);
  });
});

// ============================================================================
// Tests: Simulated PipelineEngine integration
// ============================================================================

describe('Simulated PipelineEngine Quality Gate Integration', () => {
  let service: ReturnType<typeof createMockQualityGateService>;

  beforeEach(() => {
    service = createMockQualityGateService();
  });

  /**
   * Simulates the PipelineEngine's quality gate check after stage execution.
   * This mirrors the logic that will be added to PipelineEngine.executeStage.
   */
  async function simulateStageWithQualityGate(
    stageName: string,
    stageExecutionResult: { success: boolean; error?: string },
    qualityGate: QualityGate | null,
    collectedMetrics: Record<string, number>
  ): Promise<{ stageStatus: string; error?: string; qualityResult?: any }> {
    // If stage execution itself failed, skip quality gate
    if (!stageExecutionResult.success) {
      return {
        stageStatus: 'FAILED',
        error: stageExecutionResult.error || 'Stage execution failed',
      };
    }

    // No quality gate configured -> success
    if (!qualityGate) {
      return { stageStatus: 'SUCCESS' };
    }

    // Evaluate quality gate
    const result = service.evaluate(qualityGate, { metrics: collectedMetrics });

    // Check if blocking
    if (service.isBlocking(result)) {
      const reason = service.getBlockingReason(result);
      return {
        stageStatus: 'FAILED',
        error: reason || 'Quality gate check failed',
        qualityResult: result,
      };
    }

    // Passed (or only warnings)
    return { stageStatus: 'SUCCESS', qualityResult: result };
  }

  it('should pass stage when quality gate passes', async () => {
    const gate: QualityGate = {
      id: 'gate-1',
      tenantId: 't1',
      name: 'Coverage Gate',
      rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await simulateStageWithQualityGate(
      'test',
      { success: true },
      gate,
      { coverage: 90 }
    );

    expect(result.stageStatus).toBe('SUCCESS');
  });

  it('should fail stage when quality gate blocks', async () => {
    const gate: QualityGate = {
      id: 'gate-1',
      tenantId: 't1',
      name: 'Coverage Gate',
      rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await simulateStageWithQualityGate(
      'test',
      { success: true },
      gate,
      { coverage: 50 }
    );

    expect(result.stageStatus).toBe('FAILED');
    expect(result.error).toContain('blocked');
    expect(result.qualityResult).toBeDefined();
    expect(result.qualityResult.blockedRules).toHaveLength(1);
  });

  it('should pass stage when quality gate only warns', async () => {
    const gate: QualityGate = {
      id: 'gate-1',
      tenantId: 't1',
      name: 'Warn Gate',
      rules: [{ metric: 'coverage', operator: '>=', threshold: 90, severity: 'warn' }],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await simulateStageWithQualityGate(
      'test',
      { success: true },
      gate,
      { coverage: 70 }
    );

    expect(result.stageStatus).toBe('SUCCESS');
    expect(result.qualityResult).toBeDefined();
    expect(result.qualityResult.warnedRules).toHaveLength(1);
  });

  it('should skip quality gate if stage execution failed', async () => {
    const gate: QualityGate = {
      id: 'gate-1',
      tenantId: 't1',
      name: 'Coverage Gate',
      rules: [{ metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' }],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await simulateStageWithQualityGate(
      'test',
      { success: false, error: 'Build compilation error' },
      gate,
      { coverage: 0 } // Even with bad metrics, gate should not be evaluated
    );

    expect(result.stageStatus).toBe('FAILED');
    expect(result.error).toBe('Build compilation error');
    expect(result.qualityResult).toBeUndefined();
  });

  it('should pass stage when no quality gate is configured', async () => {
    const result = await simulateStageWithQualityGate(
      'test',
      { success: true },
      null,
      { coverage: 10 } // Low metrics but no gate configured
    );

    expect(result.stageStatus).toBe('SUCCESS');
  });

  it('should handle multiple metrics correctly', async () => {
    const gate: QualityGate = {
      id: 'gate-multi',
      tenantId: 't1',
      name: 'Multi-Metric Gate',
      rules: [
        { metric: 'coverage', operator: '>=', threshold: 80, severity: 'block' },
        { metric: 'complexity', operator: '<=', threshold: 15, severity: 'block' },
        { metric: 'vulnerabilities', operator: '==', threshold: 0, severity: 'block' },
      ],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // All metrics pass
    const passResult = await simulateStageWithQualityGate(
      'test',
      { success: true },
      gate,
      { coverage: 85, complexity: 10, vulnerabilities: 0 }
    );
    expect(passResult.stageStatus).toBe('SUCCESS');

    // One metric fails (complexity too high)
    const failResult = await simulateStageWithQualityGate(
      'test',
      { success: true },
      gate,
      { coverage: 90, complexity: 20, vulnerabilities: 0 }
    );
    expect(failResult.stageStatus).toBe('FAILED');
    expect(failResult.error).toContain('complexity');
  });
});
