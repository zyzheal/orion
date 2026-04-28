/**
 * RiskAssessmentService 单元测试
 */

import { RiskAssessmentService } from '../RiskAssessmentService';
import { DeploymentRisk, RiskLevel } from '../types';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    service = new RiskAssessmentService();
  });

  afterEach(() => {
    service.clearHistory();
  });

  // ==================== assessDeploymentRisk ====================

  describe('assessDeploymentRisk', () => {
    const baseDeploymentRisk: DeploymentRisk = {
      changeScope: ['service-a'],
      changeSize: { filesChanged: 5, linesChanged: 100 },
      timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
      dependencyRisk: { totalDependencies: 2, unhealthyDependencies: 0, criticalDependencies: [] },
      historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
    };

    it('should return a complete risk assessment', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-1',
        deploymentRisk: baseDeploymentRisk,
      });

      expect(assessment.id).toBeDefined();
      expect(assessment.targetType).toBe('deployment');
      expect(assessment.targetId).toBe('deploy-1');
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(100);
      expect(assessment.riskLevel).toBeDefined();
      expect(assessment.factors.length).toBeGreaterThan(0);
      expect(assessment.recommendations.length).toBeGreaterThanOrEqual(0);
      expect(assessment.createdAt).toBeInstanceOf(Date);
    });

    it('should include tenant ID', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-2',
        deploymentRisk: baseDeploymentRisk,
        tenantId: 'tenant-001',
      });

      expect(assessment.tenantId).toBe('tenant-001');
    });

    it('should include health check results when requested', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-3',
        deploymentRisk: baseDeploymentRisk,
        runHealthChecks: true,
        healthCheckParams: {
          pipelineStatus: 'success',
          testResults: { total: 100, passed: 100, failed: 0 },
          codeReviewStatus: 'approved',
        },
      });

      expect(assessment.metadata).toBeDefined();
      expect(assessment.metadata?.healthCheckResult).toBeDefined();
      expect(assessment.metadata?.healthCheckResult.canProceed).toBe(true);
    });

    it('should add block recommendation when health check fails', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-4',
        deploymentRisk: baseDeploymentRisk,
        runHealthChecks: true,
        healthCheckParams: {
          pipelineStatus: 'failed',
          testResults: { total: 100, passed: 100, failed: 0 },
          codeReviewStatus: 'approved',
        },
      });

      const blockRecs = assessment.recommendations.filter((r) => r.type === 'block');
      expect(blockRecs.length).toBeGreaterThan(0);
    });

    it('should assess high risk for risky deployment', async () => {
      const riskyDeployment: DeploymentRisk = {
        changeScope: Array.from({ length: 8 }, (_, i) => `service-${i}`),
        changeSize: { filesChanged: 100, linesChanged: 10000 },
        timeRisk: { isWeekend: true, isAfterHours: true, isHoliday: false, isFriday: false },
        dependencyRisk: {
          totalDependencies: 15,
          unhealthyDependencies: 2,
          criticalDependencies: ['db', 'cache'],
        },
        historicalRisk: { recentFailureRate: 0.30, recentIncidents: 4, averageMTTR: 7200000 },
      };

      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-5',
        deploymentRisk: riskyDeployment,
      });

      expect(assessment.riskLevel).toBe('High');
    });
  });

  // ==================== assessChangeRisk ====================

  describe('assessChangeRisk', () => {
    it('should return a change risk assessment', async () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 10, linesChanged: 200 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 3, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
      };

      const assessment = await service.assessChangeRisk({
        changeId: 'change-1',
        deploymentRisk,
      });

      expect(assessment.id).toBeDefined();
      expect(assessment.targetType).toBe('change');
      expect(assessment.targetId).toBe('change-1');
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(100);
    });

    it('should include tenant ID', async () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const assessment = await service.assessChangeRisk({
        changeId: 'change-2',
        deploymentRisk,
        tenantId: 'tenant-002',
      });

      expect(assessment.tenantId).toBe('tenant-002');
    });
  });

  // ==================== getAssessmentHistory ====================

  describe('getAssessmentHistory', () => {
    beforeEach(async () => {
      const baseRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
      };

      await service.assessDeploymentRisk({
        deploymentId: 'deploy-h1',
        deploymentRisk: baseRisk,
        tenantId: 'tenant-a',
      });

      await service.assessDeploymentRisk({
        deploymentId: 'deploy-h2',
        deploymentRisk: baseRisk,
        tenantId: 'tenant-b',
      });

      await service.assessChangeRisk({
        changeId: 'change-h1',
        deploymentRisk: baseRisk,
        tenantId: 'tenant-a',
      });
    });

    it('should return all assessments by default', async () => {
      const history = await service.getAssessmentHistory();
      expect(history.length).toBe(3);
    });

    it('should filter by targetType', async () => {
      const history = await service.getAssessmentHistory({ targetType: 'deployment' });
      expect(history.length).toBe(2);
      history.forEach((a) => expect(a.targetType).toBe('deployment'));
    });

    it('should filter by tenantId', async () => {
      const history = await service.getAssessmentHistory({ tenantId: 'tenant-a' });
      expect(history.length).toBe(2);
    });

    it('should filter by targetId', async () => {
      const history = await service.getAssessmentHistory({ targetId: 'deploy-h1' });
      expect(history.length).toBe(1);
      expect(history[0].targetId).toBe('deploy-h1');
    });

    it('should limit results', async () => {
      const history = await service.getAssessmentHistory({ limit: 2 });
      expect(history.length).toBe(2);
    });

    it('should return sorted by createdAt desc', async () => {
      const history = await service.getAssessmentHistory();
      for (let i = 1; i < history.length; i++) {
        expect(history[i].createdAt.getTime()).toBeLessThanOrEqual(
          history[i - 1].createdAt.getTime()
        );
      }
    });
  });

  // ==================== getAssessmentById ====================

  describe('getAssessmentById', () => {
    it('should return assessment by ID', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-id-1',
        deploymentRisk: {
          changeScope: ['service-a'],
          changeSize: { filesChanged: 5, linesChanged: 100 },
          timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
          dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
          historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
        },
      });

      const found = await service.getAssessmentById(assessment.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(assessment.id);
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await service.getAssessmentById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ==================== generateReport ====================

  describe('generateReport', () => {
    it('should generate a complete risk report', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-r1',
        deploymentRisk: {
          changeScope: ['service-a', 'service-b'],
          changeSize: { filesChanged: 20, linesChanged: 500 },
          timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
          dependencyRisk: { totalDependencies: 5, unhealthyDependencies: 0, criticalDependencies: [] },
          historicalRisk: { recentFailureRate: 0.10, recentIncidents: 1, averageMTTR: 600000 },
        },
      });

      const report = await service.generateReport(assessment.id);

      expect(report).not.toBeNull();
      expect(report!.id).toBeDefined();
      expect(report!.assessmentId).toBe(assessment.id);
      expect(report!.summary.riskScore).toBe(assessment.riskScore);
      expect(report!.summary.riskLevel).toBe(assessment.riskLevel);
      expect(report!.details.technicalFactors.length).toBeGreaterThan(0);
      expect(report!.details.historicalFactors.length).toBeGreaterThan(0);
      expect(report!.details.organizationalFactors.length).toBeGreaterThan(0);
      expect(report!.recommendations.length).toBeGreaterThan(0);
      expect(report!.generatedAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent assessment', async () => {
      const report = await service.generateReport('non-existent');
      expect(report).toBeNull();
    });

    it('should include health check result in report summary', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-r2',
        deploymentRisk: {
          changeScope: ['service-a'],
          changeSize: { filesChanged: 5, linesChanged: 100 },
          timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
          dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
          historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
        },
        runHealthChecks: true,
        healthCheckParams: {
          pipelineStatus: 'success',
          testResults: { total: 100, passed: 100, failed: 0 },
        },
      });

      const report = await service.generateReport(assessment.id);

      expect(report).not.toBeNull();
      expect(report!.summary.healthCheckResult).toBeDefined();
      expect(report!.summary.healthCheckResult!.canProceed).toBe(true);
    });

    it('should correctly set canDeploy for Critical risk', async () => {
      const riskyDeployment: DeploymentRisk = {
        changeScope: Array.from({ length: 15 }, (_, i) => `service-${i}`),
        changeSize: { filesChanged: 200, linesChanged: 20000 },
        timeRisk: { isWeekend: true, isAfterHours: true, isHoliday: true, isFriday: false },
        dependencyRisk: {
          totalDependencies: 30,
          unhealthyDependencies: 5,
          criticalDependencies: ['db'],
        },
        historicalRisk: { recentFailureRate: 0.70, recentIncidents: 8, averageMTTR: 18000000 },
      };

      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-r3',
        deploymentRisk: riskyDeployment,
      });

      expect(assessment.riskLevel).toBe('Critical');

      const report = await service.generateReport(assessment.id);

      expect(report).not.toBeNull();
      expect(report!.summary.canDeploy).toBe(false);
      expect(report!.summary.criticalRiskCount).toBeGreaterThan(0);
    });
  });

  // ==================== getReportHistory ====================

  describe('getReportHistory', () => {
    beforeEach(async () => {
      const baseRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
      };

      const a1 = await service.assessDeploymentRisk({
        deploymentId: 'deploy-rh1',
        deploymentRisk: baseRisk,
        tenantId: 'tenant-a',
      });
      await service.generateReport(a1.id);

      const a2 = await service.assessDeploymentRisk({
        deploymentId: 'deploy-rh2',
        deploymentRisk: baseRisk,
        tenantId: 'tenant-b',
      });
      await service.generateReport(a2.id);
    });

    it('should return all reports by default', () => {
      const reports = service.getReportHistory();
      expect(reports.length).toBe(2);
    });

    it('should filter by assessmentId', async () => {
      const assessments = await service.getAssessmentHistory({ targetId: 'deploy-rh1' });
      const reports = service.getReportHistory({ assessmentId: assessments[0].id });
      expect(reports.length).toBe(1);
    });

    it('should filter by tenantId', () => {
      const reports = service.getReportHistory({ tenantId: 'tenant-a' });
      expect(reports.length).toBe(1);
    });

    it('should limit results', () => {
      const reports = service.getReportHistory({ limit: 1 });
      expect(reports.length).toBe(1);
    });
  });

  // ==================== getReportById ====================

  describe('getReportById', () => {
    it('should return report by ID', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-rid1',
        deploymentRisk: {
          changeScope: ['service-a'],
          changeSize: { filesChanged: 5, linesChanged: 100 },
          timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
          dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
          historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
        },
      });

      const report = await service.generateReport(assessment.id);
      const found = service.getReportById(report!.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(report!.id);
    });

    it('should return undefined for non-existent ID', () => {
      const found = service.getReportById('non-existent-report');
      expect(found).toBeUndefined();
    });
  });

  // ==================== Service Accessors ====================

  describe('service accessors', () => {
    it('should return health check service', () => {
      const hcs = service.getHealthCheckService();
      expect(hcs).toBeDefined();
    });

    it('should return scoring engine', () => {
      const se = service.getScoringEngine();
      expect(se).toBeDefined();
    });
  });

  // ==================== clearHistory ====================

  describe('clearHistory', () => {
    it('should clear all assessment history', async () => {
      await service.assessDeploymentRisk({
        deploymentId: 'deploy-clear1',
        deploymentRisk: {
          changeScope: ['service-a'],
          changeSize: { filesChanged: 5, linesChanged: 100 },
          timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
          dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
          historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
        },
      });

      expect((await service.getAssessmentHistory()).length).toBe(1);

      service.clearHistory();

      expect((await service.getAssessmentHistory()).length).toBe(0);
      expect(service.getReportHistory().length).toBe(0);
    });
  });
});
