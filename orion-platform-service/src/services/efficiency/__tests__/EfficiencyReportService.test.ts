/**
 * EfficiencyReportService - Unit Tests
 *
 * Tests for efficiency report generation, team metrics, project metrics,
 * period comparison, report history, and data injection.
 */

import { EfficiencyReportService } from '../EfficiencyReportService';
import { DeploymentRecord, PipelineCompletionRecord } from '../types';

// Mock DoraMetricsService
jest.mock('../DoraMetricsService', () => {
  return {
    DoraMetricsService: jest.fn().mockImplementation(() => ({
      buildTimeWindow: jest.fn().mockReturnValue({
        window: 'week',
        size: 1,
        start: new Date('2026-01-01'),
        end: new Date('2026-01-08'),
      }),
      generateReport: jest.fn().mockReturnValue({
        deploymentFrequency: { totalDeployments: 10 },
        leadTimeForChanges: { averageLeadTimeMs: 3600000 },
        changeFailureRate: { rate: 5 },
        meanTimeToRecovery: { averageRecoveryMs: 1800000 },
      }),
    })),
  };
});

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

describe('EfficiencyReportService', () => {
  let service: EfficiencyReportService;

  const samplePipeline: PipelineCompletionRecord = {
    id: 'pipe-1',
    pipelineId: 'pipeline-1',
    tenantId: 'tenant-1',
    status: 'success',
    durationMs: 120000,
    completedAt: new Date('2026-01-03'),
  } as PipelineCompletionRecord;

  const failedPipeline: PipelineCompletionRecord = {
    id: 'pipe-2',
    pipelineId: 'pipeline-2',
    tenantId: 'tenant-1',
    status: 'failed',
    durationMs: 60000,
    completedAt: new Date('2026-01-04'),
  } as PipelineCompletionRecord;

  const sampleDeployment: DeploymentRecord = {
    id: 'deploy-1',
    tenantId: 'tenant-1',
    status: 'success',
    deployedAt: new Date('2026-01-03'),
  } as DeploymentRecord;

  const failedDeployment: DeploymentRecord = {
    id: 'deploy-2',
    tenantId: 'tenant-1',
    status: 'failed',
    deployedAt: new Date('2026-01-05'),
  } as DeploymentRecord;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EfficiencyReportService();
  });

  // ==================== generateReport ====================

  describe('generateReport', () => {
    it('should generate a report with default parameters', () => {
      service.injectGlobalData('tenant-1', [sampleDeployment], [samplePipeline]);

      const report = service.generateReport('tenant-1');

      expect(report.reportId).toBe('mock-uuid');
      expect(report.tenantId).toBe('tenant-1');
      expect(report.timeWindow).toBe('week');
      expect(report.windowSize).toBe(1);
      expect(report.generatedAt).toBeDefined();
    });

    it('should calculate pipeline metrics correctly', () => {
      service.injectGlobalData('tenant-1', [], [samplePipeline, failedPipeline]);

      const report = service.generateReport('tenant-1');

      expect(report.totalPipelineRuns).toBe(2);
      expect(report.pipelineSuccessRate).toBe(50);
    });

    it('should count deployments in window', () => {
      service.injectGlobalData('tenant-1', [sampleDeployment, failedDeployment], []);

      const report = service.generateReport('tenant-1');

      expect(report.totalDeployments).toBe(2);
    });

    it('should return null DORA metrics when no data', () => {
      const report = service.generateReport('empty-tenant');

      expect(report.doraMetrics).toBeNull();
      expect(report.totalPipelineRuns).toBe(0);
      expect(report.totalDeployments).toBe(0);
    });

    it('should support different time windows', () => {
      service.injectGlobalData('tenant-1', [], [samplePipeline]);

      const report = service.generateReport('tenant-1', 'month', 2);

      expect(report.timeWindow).toBe('month');
      expect(report.windowSize).toBe(2);
    });

    it('should round success rate to 2 decimal places', () => {
      service.injectGlobalData('tenant-1', [], [
        samplePipeline,
        samplePipeline,
        samplePipeline,
        failedPipeline,
      ]);

      const report = service.generateReport('tenant-1');

      expect(report.pipelineSuccessRate).toBe(75);
    });

    it('should limit report history to 50 entries', () => {
      service.injectGlobalData('tenant-1', [], [samplePipeline]);

      for (let i = 0; i < 55; i++) {
        service.generateReport('tenant-1');
      }

      const history = service.getReportHistory('tenant-1', 100);
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  // ==================== getTeamMetrics ====================

  describe('getTeamMetrics', () => {
    it('should return default metrics for unknown team', () => {
      const metrics = service.getTeamMetrics('tenant-1', 'unknown-team');

      expect(metrics.teamId).toBe('unknown-team');
      expect(metrics.teamName).toBe('Team unknown-team');
      expect(metrics.activeMembers).toBe(0);
      expect(metrics.completedPipelines).toBe(0);
      expect(metrics.successRate).toBe(0);
    });

    it('should calculate team metrics correctly', () => {
      service.registerTeam('team-1', 'Engineering', 5, [samplePipeline, failedPipeline], [sampleDeployment]);

      const metrics = service.getTeamMetrics('tenant-1', 'team-1');

      expect(metrics.teamId).toBe('team-1');
      expect(metrics.teamName).toBe('Engineering');
      expect(metrics.activeMembers).toBe(5);
      expect(metrics.completedPipelines).toBe(2);
      expect(metrics.successRate).toBe(50);
      expect(metrics.deploymentCount).toBe(1);
    });

    it('should calculate change failure rate', () => {
      service.registerTeam('team-1', 'Eng', 3, [], [sampleDeployment, failedDeployment]);

      const metrics = service.getTeamMetrics('tenant-1', 'team-1');

      expect(metrics.changeFailureRate).toBe(50);
    });

    it('should handle team with no data', () => {
      service.registerTeam('team-empty', 'Empty', 0, [], []);

      const metrics = service.getTeamMetrics('tenant-1', 'team-empty');

      expect(metrics.completedPipelines).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageExecutionTimeMs).toBe(0);
    });
  });

  // ==================== getProjectMetrics ====================

  describe('getProjectMetrics', () => {
    it('should return default metrics for unknown project', () => {
      const metrics = service.getProjectMetrics('tenant-1', 'unknown-project');

      expect(metrics.projectId).toBe('unknown-project');
      expect(metrics.projectName).toBe('Project unknown-project');
      expect(metrics.totalPipelines).toBe(0);
    });

    it('should calculate project metrics correctly', () => {
      service.registerProject('proj-1', 'Orion', [samplePipeline, failedPipeline], [sampleDeployment], 42);

      const metrics = service.getProjectMetrics('tenant-1', 'proj-1');

      expect(metrics.projectId).toBe('proj-1');
      expect(metrics.projectName).toBe('Orion');
      expect(metrics.totalPipelines).toBe(2);
      expect(metrics.successRate).toBe(50);
      expect(metrics.deploymentCount).toBe(1);
      expect(metrics.commitCount).toBe(42);
    });

    it('should handle project with no data', () => {
      service.registerProject('proj-empty', 'Empty', [], []);

      const metrics = service.getProjectMetrics('tenant-1', 'proj-empty');

      expect(metrics.totalPipelines).toBe(0);
      expect(metrics.successRate).toBe(0);
    });
  });

  // ==================== comparePeriods ====================

  describe('comparePeriods', () => {
    it('should compare two time periods', () => {
      service.injectGlobalData('tenant-1', [sampleDeployment, failedDeployment], [samplePipeline, failedPipeline]);

      const comparison = service.comparePeriods(
        'tenant-1',
        { label: 'Week 1', start: new Date('2026-01-01'), end: new Date('2026-01-04') },
        { label: 'Week 2', start: new Date('2026-01-04'), end: new Date('2026-01-08') }
      );

      expect(comparison.periodA.label).toBe('Week 1');
      expect(comparison.periodB.label).toBe('Week 2');
      expect(comparison.changes).toBeDefined();
      expect(typeof comparison.changes.pipelineRuns).toBe('number');
    });

    it('should handle empty periods', () => {
      const comparison = service.comparePeriods(
        'tenant-1',
        { label: 'Empty A', start: new Date('2026-01-01'), end: new Date('2026-01-02') },
        { label: 'Empty B', start: new Date('2026-01-03'), end: new Date('2026-01-04') }
      );

      expect(comparison.periodA.pipelineRuns).toBe(0);
      expect(comparison.periodB.pipelineRuns).toBe(0);
      expect(comparison.changes.pipelineRuns).toBe(0);
    });

    it('should compute 100% change when going from 0 to positive', () => {
      service.injectGlobalData('tenant-1', [sampleDeployment], []);

      const comparison = service.comparePeriods(
        'tenant-1',
        { label: 'Before', start: new Date('2025-01-01'), end: new Date('2025-01-02') },
        { label: 'After', start: new Date('2026-01-01'), end: new Date('2026-01-08') }
      );

      expect(comparison.changes.deployments).toBe(100);
    });
  });

  // ==================== getReportHistory ====================

  describe('getReportHistory', () => {
    it('should return report history', () => {
      service.injectGlobalData('tenant-1', [sampleDeployment], [samplePipeline]);

      service.generateReport('tenant-1');
      service.generateReport('tenant-1');

      const history = service.getReportHistory('tenant-1');

      expect(history).toHaveLength(2);
    });

    it('should respect limit parameter', () => {
      service.injectGlobalData('tenant-1', [sampleDeployment], [samplePipeline]);

      for (let i = 0; i < 5; i++) {
        service.generateReport('tenant-1');
      }

      const history = service.getReportHistory('tenant-1', 3);

      expect(history).toHaveLength(3);
    });

    it('should return empty array for unknown tenant', () => {
      const history = service.getReportHistory('unknown');

      expect(history).toHaveLength(0);
    });
  });

  // ==================== registerTeam ====================

  describe('registerTeam', () => {
    it('should register team data', () => {
      service.registerTeam('team-1', 'DevOps', 10, [samplePipeline], [sampleDeployment]);

      const metrics = service.getTeamMetrics('tenant-1', 'team-1');

      expect(metrics.teamName).toBe('DevOps');
      expect(metrics.activeMembers).toBe(10);
    });

    it('should allow re-registering team data', () => {
      service.registerTeam('team-1', 'Old Name', 5, [], []);
      service.registerTeam('team-1', 'New Name', 8, [samplePipeline], []);

      const metrics = service.getTeamMetrics('tenant-1', 'team-1');

      expect(metrics.teamName).toBe('New Name');
      expect(metrics.activeMembers).toBe(8);
    });
  });

  // ==================== registerProject ====================

  describe('registerProject', () => {
    it('should register project data', () => {
      service.registerProject('proj-1', 'MyProject', [samplePipeline], [sampleDeployment], 15);

      const metrics = service.getProjectMetrics('tenant-1', 'proj-1');

      expect(metrics.projectName).toBe('MyProject');
      expect(metrics.commitCount).toBe(15);
    });

    it('should default commits to 0', () => {
      service.registerProject('proj-1', 'MyProject', [], []);

      const metrics = service.getProjectMetrics('tenant-1', 'proj-1');

      expect(metrics.commitCount).toBe(0);
    });
  });

  // ==================== injectGlobalData ====================

  describe('injectGlobalData', () => {
    it('should inject deployment and pipeline data', () => {
      service.injectGlobalData('tenant-1', [sampleDeployment], [samplePipeline]);

      const report = service.generateReport('tenant-1');

      expect(report.doraMetrics).not.toBeNull();
    });

    it('should overwrite previous data for same tenant', () => {
      service.injectGlobalData('tenant-1', [sampleDeployment], [samplePipeline]);
      service.injectGlobalData('tenant-1', [], []);

      const report = service.generateReport('tenant-1');

      expect(report.doraMetrics).toBeNull();
    });
  });

  // ==================== constructor ====================

  describe('constructor', () => {
    it('should initialize without db', () => {
      const svc = new EfficiencyReportService();
      expect(svc).toBeDefined();
    });

    it('should initialize with db for PostgreSQL persistence', () => {
      const mockDb = { query: jest.fn() };
      const svc = new EfficiencyReportService(mockDb);
      expect(svc).toBeDefined();
    });
  });
});
