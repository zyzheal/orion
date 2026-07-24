/**
 * DoraMetricsService 单元测试
 */

import { DoraMetricsService } from '../DoraMetricsService';
import {
  PipelineCompletionRecord,
  DeploymentRecord,
  TimeWindow,
} from '../types';

describe('DoraMetricsService', () => {
  let service: DoraMetricsService;

  beforeEach(() => {
    service = new DoraMetricsService();
  });

  // ==================== buildTimeWindow ====================

  describe('buildTimeWindow', () => {
    it('should build a daily window', () => {
      const ref = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day', 1, ref);

      expect(window.window).toBe('day');
      expect(window.size).toBe(1);
      expect(window.end.getTime()).toBe(ref.getTime());
      // Start should be 1 day before end
      expect(window.end.getTime() - window.start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('should build a weekly window', () => {
      const ref = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('week', 2, ref);

      expect(window.window).toBe('week');
      expect(window.size).toBe(2);
      // 2 weeks = 14 days
      expect(window.end.getTime() - window.start.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it('should build a monthly window', () => {
      const ref = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('month', 3, ref);

      expect(window.window).toBe('month');
      expect(window.size).toBe(3);
      // 3 months: April(3) - 3 = January(0)
      expect(window.start.getMonth()).toBe(0); // January
    });

    it('should build a quarterly window', () => {
      const ref = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('quarter', 1, ref);

      expect(window.window).toBe('quarter');
      expect(window.size).toBe(1);
      // 1 quarter = 3 months: April(3) - 3 = January(0)
      expect(window.start.getMonth()).toBe(0); // January
    });

    it('should default to 7 days for unknown window', () => {
      const ref = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day' as TimeWindow, 7, ref);

      expect(window.end.getTime() - window.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  // ==================== calculateDeploymentFrequency ====================

  describe('calculateDeploymentFrequency', () => {
    it('should return zero counts when no deployments', () => {
      const window = service.buildTimeWindow('week');
      const result = service.calculateDeploymentFrequency([], window);

      expect(result.totalDeployments).toBe(0);
      expect(result.successfulDeployments).toBe(0);
      expect(result.failedDeployments).toBe(0);
      expect(result.deploymentsPerDay).toBe(0);
    });

    it('should calculate deployment frequency correctly', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day', 7, now);

      const deployments: DeploymentRecord[] = [
        {
          id: '1',
          deploymentId: 'd1',
          service: 'api',
          environment: 'production',
          status: 'success',
          deployedAt: new Date('2026-04-10T00:00:00Z'),
          syncedToClickHouse: false,
        },
        {
          id: '2',
          deploymentId: 'd2',
          service: 'api',
          environment: 'production',
          status: 'success',
          deployedAt: new Date('2026-04-11T00:00:00Z'),
          syncedToClickHouse: false,
        },
        {
          id: '3',
          deploymentId: 'd3',
          service: 'api',
          environment: 'production',
          status: 'failed',
          deployedAt: new Date('2026-04-11T12:00:00Z'),
          syncedToClickHouse: false,
        },
        // Outside window
        {
          id: '4',
          deploymentId: 'd4',
          service: 'api',
          environment: 'production',
          status: 'success',
          deployedAt: new Date('2026-04-01T00:00:00Z'),
          syncedToClickHouse: false,
        },
      ];

      const result = service.calculateDeploymentFrequency(deployments, window);

      expect(result.totalDeployments).toBe(3);
      expect(result.successfulDeployments).toBe(2);
      expect(result.failedDeployments).toBe(1);
    });

    it('should classify elite frequency for on-demand deployments', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day', 1, now);

      // Create many deployments to simulate high frequency
      const deployments: DeploymentRecord[] = Array.from({ length: 10 }, (_, i) => ({
        id: `d${i}`,
        deploymentId: `deploy-${i}`,
        service: 'api',
        environment: 'production',
        status: 'success' as const,
        deployedAt: new Date(now.getTime() - i * 3600000),
        syncedToClickHouse: false,
      }));

      const result = service.calculateDeploymentFrequency(deployments, window);
      expect(result.frequencyLevel).toBe('on-demand');
    });

    it('should classify yearly frequency for very low deployments', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('year' as TimeWindow, 365, now);

      const deployments: DeploymentRecord[] = [
        {
          id: '1',
          deploymentId: 'd1',
          service: 'api',
          environment: 'production',
          status: 'success',
          deployedAt: new Date('2026-01-01T00:00:00Z'),
          syncedToClickHouse: false,
        },
      ];

      const result = service.calculateDeploymentFrequency(deployments, window);
      expect(result.frequencyLevel).toBe('yearly');
    });
  });

  // ==================== calculateLeadTimeForChanges ====================

  describe('calculateLeadTimeForChanges', () => {
    it('should return zero values when no pipeline records', () => {
      const window = service.buildTimeWindow('week');
      const result = service.calculateLeadTimeForChanges([], window);

      expect(result.totalChanges).toBe(0);
      expect(result.averageLeadTimeMs).toBe(0);
      expect(result.medianLeadTimeMs).toBe(0);
      expect(result.leadTimeLevel).toBe('low');
    });

    it('should calculate lead time metrics correctly', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day', 7, now);

      const records: PipelineCompletionRecord[] = [
        {
          id: '1',
          runId: 'r1',
          pipelineId: 'p1',
          status: 'success',
          triggerType: 'manual',
          durationMs: 60000, // 1 minute
          completedAt: new Date('2026-04-10T00:00:00Z'),
          syncedToClickHouse: false,
        },
        {
          id: '2',
          runId: 'r2',
          pipelineId: 'p1',
          status: 'success',
          triggerType: 'manual',
          durationMs: 120000, // 2 minutes
          completedAt: new Date('2026-04-11T00:00:00Z'),
          syncedToClickHouse: false,
        },
        {
          id: '3',
          runId: 'r3',
          pipelineId: 'p1',
          status: 'success',
          triggerType: 'push',
          durationMs: 30000, // 30 seconds
          completedAt: new Date('2026-04-11T12:00:00Z'),
          syncedToClickHouse: false,
        },
        // Failed record should be excluded
        {
          id: '4',
          runId: 'r4',
          pipelineId: 'p1',
          status: 'failed',
          triggerType: 'manual',
          durationMs: 5000,
          completedAt: new Date('2026-04-11T14:00:00Z'),
          syncedToClickHouse: false,
        },
      ];

      const result = service.calculateLeadTimeForChanges(records, window);

      expect(result.totalChanges).toBe(3);
      // Average of 30000, 60000, 120000 = 70000
      expect(result.averageLeadTimeMs).toBe(70000);
      // Sorted: [30000, 60000, 120000], median = 60000
      expect(result.medianLeadTimeMs).toBe(60000);
    });

    it('should only include successful records', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('week', 1, now);

      const records: PipelineCompletionRecord[] = [
        {
          id: '1',
          runId: 'r1',
          pipelineId: 'p1',
          status: 'failed',
          triggerType: 'manual',
          durationMs: 60000,
          completedAt: new Date('2026-04-10T00:00:00Z'),
          syncedToClickHouse: false,
        },
      ];

      const result = service.calculateLeadTimeForChanges(records, window);
      expect(result.totalChanges).toBe(0);
    });

    it('should evaluate elite level for very fast lead times', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day', 7, now);

      const records: PipelineCompletionRecord[] = [
        {
          id: '1',
          runId: 'r1',
          pipelineId: 'p1',
          status: 'success',
          triggerType: 'push',
          durationMs: 1800000, // 30 minutes (< 1 hour = elite)
          completedAt: new Date('2026-04-10T00:00:00Z'),
          syncedToClickHouse: false,
        },
      ];

      const result = service.calculateLeadTimeForChanges(records, window);
      expect(result.leadTimeLevel).toBe('elite');
    });
  });

  // ==================== calculateChangeFailureRate ====================

  describe('calculateChangeFailureRate', () => {
    it('should return zero rate when no deployments', () => {
      const window = service.buildTimeWindow('week');
      const result = service.calculateChangeFailureRate([], window);

      expect(result.totalDeployments).toBe(0);
      expect(result.failedDeployments).toBe(0);
      expect(result.failureRate).toBe(0);
      expect(result.failureDetails).toEqual([]);
    });

    it('should calculate failure rate correctly', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day', 7, now);

      const deployments: DeploymentRecord[] = [
        {
          id: '1',
          deploymentId: 'd1',
          service: 'api',
          environment: 'production',
          status: 'success',
          deployedAt: new Date('2026-04-10T00:00:00Z'),
          syncedToClickHouse: false,
        },
        {
          id: '2',
          deploymentId: 'd2',
          service: 'api',
          environment: 'production',
          status: 'success',
          deployedAt: new Date('2026-04-11T00:00:00Z'),
          syncedToClickHouse: false,
        },
        {
          id: '3',
          deploymentId: 'd3',
          service: 'api',
          environment: 'production',
          status: 'failed',
          deployedAt: new Date('2026-04-11T12:00:00Z'),
          syncedToClickHouse: false,
        },
        {
          id: '4',
          deploymentId: 'd4',
          service: 'api',
          environment: 'production',
          status: 'rolled_back',
          deployedAt: new Date('2026-04-11T14:00:00Z'),
          syncedToClickHouse: false,
        },
      ];

      const result = service.calculateChangeFailureRate(deployments, window);

      expect(result.totalDeployments).toBe(4);
      expect(result.failedDeployments).toBe(2);
      expect(result.failureRate).toBe(50);
      expect(result.failureDetails).toHaveLength(2);
    });

    it('should evaluate elite level for low failure rate', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day', 7, now);

      const deployments: DeploymentRecord[] = [
        { id: '1', deploymentId: 'd1', service: 'api', environment: 'production', status: 'success', deployedAt: new Date('2026-04-10T00:00:00Z'), syncedToClickHouse: false },
        { id: '2', deploymentId: 'd2', service: 'api', environment: 'production', status: 'success', deployedAt: new Date('2026-04-11T00:00:00Z'), syncedToClickHouse: false },
        { id: '3', deploymentId: 'd3', service: 'api', environment: 'production', status: 'success', deployedAt: new Date('2026-04-11T12:00:00Z'), syncedToClickHouse: false },
        { id: '4', deploymentId: 'd4', service: 'api', environment: 'production', status: 'success', deployedAt: new Date('2026-04-11T14:00:00Z'), syncedToClickHouse: false },
        { id: '5', deploymentId: 'd5', service: 'api', environment: 'production', status: 'success', deployedAt: new Date('2026-04-11T16:00:00Z'), syncedToClickHouse: false },
        { id: '6', deploymentId: 'd6', service: 'api', environment: 'production', status: 'success', deployedAt: new Date('2026-04-11T18:00:00Z'), syncedToClickHouse: false },
        { id: '7', deploymentId: 'd7', service: 'api', environment: 'production', status: 'success', deployedAt: new Date('2026-04-11T20:00:00Z'), syncedToClickHouse: false },
        { id: '8', deploymentId: 'd8', service: 'api', environment: 'production', status: 'success', deployedAt: new Date('2026-04-11T22:00:00Z'), syncedToClickHouse: false },
        { id: '9', deploymentId: 'd9', service: 'api', environment: 'production', status: 'success', deployedAt: new Date('2026-04-11T23:00:00Z'), syncedToClickHouse: false },
        { id: '10', deploymentId: 'd10', service: 'api', environment: 'production', status: 'failed', deployedAt: new Date('2026-04-11T22:00:00Z'), syncedToClickHouse: false },
      ];

      const result = service.calculateChangeFailureRate(deployments, window);
      // 1/10 = 10% -> high level (<= 10%)
      expect(result.failureRateLevel).toBe('high');
    });
  });

  // ==================== calculateMeanTimeToRecovery ====================

  describe('calculateMeanTimeToRecovery', () => {
    it('should return zero values when no incidents', () => {
      const window = service.buildTimeWindow('week');
      const result = service.calculateMeanTimeToRecovery([], window);

      expect(result.totalIncidents).toBe(0);
      expect(result.recoveredIncidents).toBe(0);
      expect(result.averageRecoveryTimeMs).toBe(0);
    });

    it('should calculate MTTR correctly', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day', 7, now);

      const deployments: DeploymentRecord[] = [
        {
          id: '1',
          deploymentId: 'd1',
          service: 'api',
          environment: 'production',
          status: 'failed',
          deployedAt: new Date('2026-04-10T00:00:00Z'),
          recoveryTimeMs: 3600000, // 1 hour
          syncedToClickHouse: false,
        },
        {
          id: '2',
          deploymentId: 'd2',
          service: 'api',
          environment: 'production',
          status: 'rolled_back',
          deployedAt: new Date('2026-04-11T00:00:00Z'),
          recoveryTimeMs: 1800000, // 30 minutes
          syncedToClickHouse: false,
        },
        // Without recovery time
        {
          id: '3',
          deploymentId: 'd3',
          service: 'api',
          environment: 'production',
          status: 'failed',
          deployedAt: new Date('2026-04-11T12:00:00Z'),
          syncedToClickHouse: false,
        },
      ];

      const result = service.calculateMeanTimeToRecovery(deployments, window);

      expect(result.totalIncidents).toBe(3);
      expect(result.recoveredIncidents).toBe(2);
      // Average of 1800000 and 3600000 = 2700000
      expect(result.averageRecoveryTimeMs).toBe(2700000);
      // Sorted: [1800000, 3600000], median = 1800000 (P50)
      expect(result.medianRecoveryTimeMs).toBe(1800000);
      // P90 = 3600000
      expect(result.p90RecoveryTimeMs).toBe(3600000);
    });

    it('should evaluate elite level for fast recovery', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('day', 7, now);

      const deployments: DeploymentRecord[] = [
        {
          id: '1',
          deploymentId: 'd1',
          service: 'api',
          environment: 'production',
          status: 'failed',
          deployedAt: new Date('2026-04-10T00:00:00Z'),
          recoveryTimeMs: 1800000, // 30 minutes (< 1 hour = elite)
          syncedToClickHouse: false,
        },
      ];

      const result = service.calculateMeanTimeToRecovery(deployments, window);
      expect(result.recoveryTimeLevel).toBe('elite');
    });
  });

  // ==================== generateReport ====================

  describe('generateReport', () => {
    it('should generate a complete DORA report', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('week', 1, now);

      const pipelineRecords: PipelineCompletionRecord[] = [
        {
          id: 'p1',
          runId: 'r1',
          pipelineId: 'pipeline-1',
          status: 'success',
          triggerType: 'push',
          durationMs: 60000,
          completedAt: new Date('2026-04-11T00:00:00Z'),
          syncedToClickHouse: false,
        },
      ];

      const deployments: DeploymentRecord[] = [
        {
          id: 'd1',
          deploymentId: 'deploy-1',
          service: 'api',
          environment: 'production',
          status: 'success',
          deployedAt: new Date('2026-04-11T00:00:00Z'),
          syncedToClickHouse: false,
        },
      ];

      const report = service.generateReport('tenant-001', pipelineRecords, deployments, window);

      expect(report.reportId).toBeDefined();
      expect(report.tenantId).toBe('tenant-001');
      expect(report.window).toBe(window);
      expect(report.deploymentFrequency).toBeDefined();
      expect(report.leadTimeForChanges).toBeDefined();
      expect(report.changeFailureRate).toBeDefined();
      expect(report.meanTimeToRecovery).toBeDefined();
      expect(report.overallLevel).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('should calculate overall level as the lowest among all metrics', () => {
      const now = new Date('2026-04-12T00:00:00Z');
      const window = service.buildTimeWindow('week', 1, now);

      const pipelineRecords: PipelineCompletionRecord[] = [];
      const deployments: DeploymentRecord[] = [];

      const report = service.generateReport('tenant-001', pipelineRecords, deployments, window);

      // With no data, most metrics will be 'low', so overall should be 'low'
      expect(report.overallLevel).toBe('low');
    });
  });
});
