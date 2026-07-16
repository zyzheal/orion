/**
 * Risk Assessment Types & Constants Tests
 *
 * Covers: DEFAULT_HEALTH_CHECK_CONFIG, type guards, type compatibility,
 * index barrel exports.
 */

import {
  DEFAULT_HEALTH_CHECK_CONFIG,
} from '../types';

import type {
  RiskLevel,
  RiskFactorCategory,
  RiskTargetType,
  RiskFactor,
  DeploymentRisk,
  RiskAssessment,
  RiskRecommendation,
  HealthCheckStatus,
  HealthCheck,
  HealthCheckResult,
  RiskReport,
  RiskAssessmentEventData,
  PipelineCompletedForRiskData,
  CodePRMergedData,
  RiskAssessmentServiceConfig,
  HealthCheckConfig,
} from '../types';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Risk Assessment Types & Constants', () => {
  // =========================================================================
  // DEFAULT_HEALTH_CHECK_CONFIG
  // =========================================================================

  describe('DEFAULT_HEALTH_CHECK_CONFIG', () => {
    it('should have all required fields', () => {
      expect(DEFAULT_HEALTH_CHECK_CONFIG).toBeDefined();
      expect(DEFAULT_HEALTH_CHECK_CONFIG.checkPipelineStatus).toBe(true);
      expect(DEFAULT_HEALTH_CHECK_CONFIG.checkTestResults).toBe(true);
      expect(DEFAULT_HEALTH_CHECK_CONFIG.checkCodeReview).toBe(true);
      expect(DEFAULT_HEALTH_CHECK_CONFIG.checkDependencyHealth).toBe(true);
      expect(DEFAULT_HEALTH_CHECK_CONFIG.checkRollbackReadiness).toBe(true);
      expect(DEFAULT_HEALTH_CHECK_CONFIG.timeoutMs).toBe(30000);
    });

    it('should have boolean values for check flags', () => {
      expect(typeof DEFAULT_HEALTH_CHECK_CONFIG.checkPipelineStatus).toBe('boolean');
      expect(typeof DEFAULT_HEALTH_CHECK_CONFIG.checkTestResults).toBe('boolean');
      expect(typeof DEFAULT_HEALTH_CHECK_CONFIG.checkCodeReview).toBe('boolean');
      expect(typeof DEFAULT_HEALTH_CHECK_CONFIG.checkDependencyHealth).toBe('boolean');
      expect(typeof DEFAULT_HEALTH_CHECK_CONFIG.checkRollbackReadiness).toBe('boolean');
    });

    it('should have a positive timeout', () => {
      expect(DEFAULT_HEALTH_CHECK_CONFIG.timeoutMs).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Type compatibility checks (compile-time verification via runtime objects)
  // =========================================================================

  describe('Type compatibility - RiskFactor', () => {
    it('should accept valid RiskFactor object', () => {
      const factor: RiskFactor = {
        name: 'Change Size',
        weight: 0.3,
        score: 45,
        description: 'Large change size increases risk',
        category: 'technical',
      };

      expect(factor.name).toBe('Change Size');
      expect(factor.weight).toBeGreaterThanOrEqual(0);
      expect(factor.weight).toBeLessThanOrEqual(1);
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(100);
      expect(['technical', 'historical', 'organizational']).toContain(factor.category);
    });
  });

  describe('Type compatibility - RiskAssessment', () => {
    it('should accept valid RiskAssessment object', () => {
      const assessment: RiskAssessment = {
        id: 'assess-1',
        targetType: 'deployment',
        targetId: 'deploy-1',
        riskScore: 65,
        riskLevel: 'High',
        factors: [],
        recommendations: [],
        createdAt: new Date(),
        tenantId: 't1',
      };

      expect(assessment.id).toBe('assess-1');
      expect(['deployment', 'change', 'pipeline', 'infrastructure']).toContain(assessment.targetType);
      expect(['Low', 'Medium', 'High', 'Critical']).toContain(assessment.riskLevel);
    });

    it('should accept optional metadata', () => {
      const assessment: RiskAssessment = {
        id: 'assess-1',
        targetType: 'change',
        targetId: 'change-1',
        riskScore: 30,
        riskLevel: 'Low',
        factors: [],
        recommendations: [],
        createdAt: new Date(),
        metadata: { key: 'value' },
      };

      expect(assessment.metadata).toEqual({ key: 'value' });
    });
  });

  describe('Type compatibility - DeploymentRisk', () => {
    it('should accept valid DeploymentRisk object', () => {
      const risk: DeploymentRisk = {
        changeScope: ['service-a', 'service-b'],
        changeSize: { filesChanged: 15, linesChanged: 500 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 10, unhealthyDependencies: 1, criticalDependencies: ['db'] },
        historicalRisk: { recentFailureRate: 0.1, recentIncidents: 2, averageMTTR: 30000 },
      };

      expect(risk.changeScope).toHaveLength(2);
      expect(risk.changeSize.filesChanged).toBe(15);
      expect(risk.timeRisk.isWeekend).toBe(false);
      expect(risk.dependencyRisk.criticalDependencies).toContain('db');
      expect(risk.historicalRisk.recentFailureRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Type compatibility - RiskRecommendation', () => {
    it('should accept valid RiskRecommendation', () => {
      const rec: RiskRecommendation = {
        id: 'rec-1',
        type: 'warn',
        title: 'High change size',
        description: 'Consider splitting the change',
        priority: 'high',
      };

      expect(['block', 'warn', 'info', 'suggestion']).toContain(rec.type);
      expect(['critical', 'high', 'medium', 'low']).toContain(rec.priority);
    });

    it('should accept optional relatedFactor', () => {
      const rec: RiskRecommendation = {
        id: 'rec-1',
        type: 'info',
        title: 'Info',
        description: 'Details',
        relatedFactor: 'change-size',
        priority: 'low',
      };

      expect(rec.relatedFactor).toBe('change-size');
    });
  });

  describe('Type compatibility - HealthCheckResult', () => {
    it('should accept valid HealthCheckResult', () => {
      const check: HealthCheck = {
        id: 'check-1',
        checkName: 'Pipeline Status',
        status: 'pass',
        details: 'All stages passed',
        duration: 1500,
        timestamp: new Date(),
      };

      const result: HealthCheckResult = {
        totalChecks: 5,
        passed: 4,
        failed: 1,
        warnings: 0,
        skipped: 0,
        canProceed: false,
        checks: [check],
        executedAt: new Date(),
      };

      expect(result.totalChecks).toBe(result.passed + result.failed + result.warnings + result.skipped);
      expect(result.checks[0].status).toBe('pass');
      expect(['pass', 'fail', 'warn', 'skip']).toContain(check.status);
    });
  });

  describe('Type compatibility - RiskReport', () => {
    it('should accept valid RiskReport', () => {
      const report: RiskReport = {
        id: 'report-1',
        assessmentId: 'assess-1',
        summary: {
          riskScore: 65,
          riskLevel: 'High',
          canDeploy: true,
          criticalRiskCount: 1,
        },
        details: {
          technicalFactors: [],
          historicalFactors: [],
          organizationalFactors: [],
        },
        recommendations: [],
        generatedAt: new Date(),
        tenantId: 't1',
      };

      expect(report.summary.riskScore).toBe(65);
      expect(report.details.technicalFactors).toEqual([]);
    });

    it('should accept optional healthCheckResult in summary', () => {
      const report: RiskReport = {
        id: 'report-1',
        assessmentId: 'assess-1',
        summary: {
          riskScore: 50,
          riskLevel: 'Medium',
          canDeploy: true,
          criticalRiskCount: 0,
          healthCheckResult: {
            totalChecks: 3,
            passed: 3,
            failed: 0,
            warnings: 0,
            skipped: 0,
            canProceed: true,
            checks: [],
            executedAt: new Date(),
          },
        },
        details: { technicalFactors: [], historicalFactors: [], organizationalFactors: [] },
        recommendations: [],
        generatedAt: new Date(),
      };

      expect(report.summary.healthCheckResult?.canProceed).toBe(true);
    });
  });

  describe('Type compatibility - RiskAssessmentEventData', () => {
    it('should accept valid event data', () => {
      const event: RiskAssessmentEventData = {
        assessmentId: 'a1',
        targetType: 'deployment',
        targetId: 'd1',
        riskScore: 45,
        riskLevel: 'Medium',
        healthCheckPassed: true,
        canProceed: true,
        criticalFactorCount: 0,
        timestamp: new Date().toISOString(),
      };

      expect(event.canProceed).toBe(true);
      expect(event.timestamp).toBeDefined();
    });
  });

  describe('Type compatibility - PipelineCompletedForRiskData', () => {
    it('should accept valid pipeline event data', () => {
      const event: PipelineCompletedForRiskData = {
        pipelineId: 'p1',
        runId: 'r1',
        status: 'success',
        triggerType: 'push',
        gitRef: 'refs/heads/main',
        gitSha: 'abc123',
        durationMs: 60000,
        timestamp: new Date().toISOString(),
      };

      expect(event.pipelineId).toBe('p1');
      expect(event.gitRef).toBe('refs/heads/main');
    });
  });

  describe('Type compatibility - CodePRMergedData', () => {
    it('should accept valid PR merge event data', () => {
      const event: CodePRMergedData = {
        prId: 'pr-1',
        repositoryId: 'repo-1',
        targetBranch: 'main',
        mergeSha: 'abc123',
        timestamp: new Date().toISOString(),
      };

      expect(event.prId).toBe('pr-1');
      expect(event.targetBranch).toBe('main');
    });
  });

  describe('Type compatibility - RiskAssessmentServiceConfig', () => {
    it('should accept minimal config', () => {
      const config: RiskAssessmentServiceConfig = {};
      expect(config).toBeDefined();
    });

    it('should accept full config', () => {
      const config: RiskAssessmentServiceConfig = {
        eventBus: { publish: jest.fn() },
        streamName: 'risk-events',
        consumerGroup: 'risk-group',
        thresholds: { lowMax: 30, mediumMax: 60, highMax: 80 },
        healthCheckConfig: DEFAULT_HEALTH_CHECK_CONFIG,
      };

      expect(config.thresholds?.lowMax).toBe(30);
      expect(config.healthCheckConfig?.timeoutMs).toBe(30000);
    });
  });

  // =========================================================================
  // Index barrel exports
  // =========================================================================

  describe('index barrel exports', () => {
    it('should export RiskScoringEngine and constants', async () => {
      const mod = await import('../index');
      expect(mod.RiskScoringEngine).toBeDefined();
      expect(mod.DEFAULT_WEIGHTS).toBeDefined();
      expect(mod.RISK_LEVEL_THRESHOLDS).toBeDefined();
    });

    it('should export HealthCheckService', async () => {
      const mod = await import('../index');
      expect(mod.HealthCheckService).toBeDefined();
    });

    it('should export RiskAssessmentService', async () => {
      const mod = await import('../index');
      expect(mod.RiskAssessmentService).toBeDefined();
    });

    it('should export RiskEventSubscriber', async () => {
      const mod = await import('../index');
      expect(mod.RiskEventSubscriber).toBeDefined();
    });

    it('should export types', async () => {
      const mod = await import('../index');
      expect(mod.DEFAULT_HEALTH_CHECK_CONFIG).toBeDefined();
    });
  });
});
