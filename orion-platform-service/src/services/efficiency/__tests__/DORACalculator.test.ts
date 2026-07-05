/**
 * DORACalculator 单元测试
 */

import { DORACalculator } from '../DORACalculator';
import {
  DeploymentRecord,
  PipelineCompletionRecord,
  IncidentRecord,
} from '../types';

describe('DORACalculator', () => {
  let calculator: DORACalculator;

  beforeEach(() => {
    calculator = new DORACalculator();
  });

  function createDeployments(count: number, baseTime: number): DeploymentRecord[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `d-${i}`,
      deploymentId: `deploy-${i}`,
      service: 'api',
      environment: 'production',
      status: i % 5 === 0 ? 'failed' : 'success',
      deployedAt: new Date(baseTime - i * 86400000),
      recoveryTimeMs: i % 5 === 0 ? 3600000 : undefined,
      syncedToClickHouse: false,
    }));
  }

  function createPipelineRecords(count: number, baseTime: number): PipelineCompletionRecord[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `p-${i}`,
      runId: `run-${i}`,
      pipelineId: 'pipe-1',
      status: 'success',
      triggerType: 'push',
      durationMs: 120000 + i * 10000,
      completedAt: new Date(baseTime - i * 86400000),
      syncedToClickHouse: false,
    }));
  }

  // ==================== calculateDeploymentFrequency ====================

  describe('calculateDeploymentFrequency', () => {
    it('should calculate deployment frequency with met status', async () => {
      const now = Date.now();
      const deployments = createDeployments(30, now);

      const result = await calculator.calculateDeploymentFrequency('tenant-1', deployments, 'week', 1);

      expect(result.value).toBeGreaterThan(0);
      expect(typeof result.trend).toBe('string');
      expect(['up', 'down', 'stable']).toContain(result.trend);
      expect(result.target).toBe(3);
      expect(['met', 'warning', 'missed']).toContain(result.status);
    });

    it('should return missed status for low deployment frequency', async () => {
      const now = Date.now();
      const deployments = createDeployments(1, now);

      const result = await calculator.calculateDeploymentFrequency('tenant-1', deployments, 'month', 1);

      expect(result.status).toBe('missed');
    });

    it('should save snapshot for trend tracking', async () => {
      const now = Date.now();
      const deployments = createDeployments(10, now);

      const first = await calculator.calculateDeploymentFrequency('tenant-1', deployments, 'week', 1);
      const second = await calculator.calculateDeploymentFrequency('tenant-1', deployments, 'week', 1);

      expect(first).toBeDefined();
      expect(second).toBeDefined();
    });
  });

  // ==================== calculateLeadTime ====================

  describe('calculateLeadTime', () => {
    it('should calculate lead time correctly', async () => {
      const now = Date.now();
      const pipelines = createPipelineRecords(5, now);

      const result = await calculator.calculateLeadTime('tenant-1', pipelines, [], 'week', 1);

      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(['up', 'down', 'stable']).toContain(result.trend);
      expect(result.target).toBe(24);
    });

    it('should invert trend for lead time (lower is better)', async () => {
      const now = Date.now();
      const pipelines = createPipelineRecords(10, now);

      // First call sets baseline
      await calculator.calculateLeadTime('tenant-1', pipelines, [], 'week', 1);
      // Second call should show a trend (inverted)
      const result = await calculator.calculateLeadTime('tenant-1', pipelines, [], 'week', 1);

      expect(['up', 'down', 'stable']).toContain(result.trend);
    });
  });

  // ==================== calculateChangeFailureRate ====================

  describe('calculateChangeFailureRate', () => {
    it('should calculate change failure rate', async () => {
      const now = Date.now();
      const deployments = createDeployments(10, now);

      const result = await calculator.calculateChangeFailureRate('tenant-1', deployments, 'week', 1);

      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
      expect(result.target).toBe(5);
    });

    it('should return met status for low failure rate', async () => {
      const now = Date.now();
      const deployments: DeploymentRecord[] = Array.from({ length: 20 }, (_, i) => ({
        id: `d-${i}`,
        deploymentId: `deploy-${i}`,
        service: 'api',
        environment: 'production',
        status: 'success',
        deployedAt: new Date(now - i * 86400000),
        syncedToClickHouse: false,
      }));

      const result = await calculator.calculateChangeFailureRate('tenant-1', deployments, 'week', 1);
      expect(result.status).toBe('met');
      expect(result.value).toBe(0);
    });
  });

  // ==================== calculateMTTR ====================

  describe('calculateMTTR', () => {
    it('should calculate MTTR correctly', async () => {
      const now = Date.now();
      const deployments: DeploymentRecord[] = [
        {
          id: 'd1', deploymentId: 'deploy-1', service: 'api', environment: 'production',
          status: 'failed', deployedAt: new Date(now - 86400000),
          recoveryTimeMs: 1800000, syncedToClickHouse: false,
        },
        {
          id: 'd2', deploymentId: 'deploy-2', service: 'api', environment: 'production',
          status: 'failed', deployedAt: new Date(now - 172800000),
          recoveryTimeMs: 3600000, syncedToClickHouse: false,
        },
      ];

      const result = await calculator.calculateMTTR('tenant-1', deployments, [], 'week', 1);

      expect(result.value).toBeGreaterThan(0);
      expect(result.target).toBe(1);
    });
  });

  // ==================== calculateAllDORA ====================

  describe('calculateAllDORA', () => {
    it('should calculate all DORA metrics at once', async () => {
      const now = Date.now();
      const deployments = createDeployments(10, now);
      const pipelines = createPipelineRecords(5, now);

      const result = await calculator.calculateAllDORA('tenant-1', deployments, pipelines, [], 'week', 1);

      expect(result.deploymentFrequency).toBeDefined();
      expect(result.leadTime).toBeDefined();
      expect(result.changeFailureRate).toBeDefined();
      expect(result.mttr).toBeDefined();
      expect(result.computedAt).toBeInstanceOf(Date);
    });
  });

  // ==================== getDORATrend ====================

  describe('getDORATrend', () => {
    it('should return trend comparison with current and previous periods', async () => {
      const now = Date.now();
      // Create deployments spanning the last 2 weeks
      const deployments: DeploymentRecord[] = Array.from({ length: 20 }, (_, i) => ({
        id: `d-${i}`,
        deploymentId: `deploy-${i}`,
        service: 'api',
        environment: 'production',
        status: 'success',
        deployedAt: new Date(now - i * 86400000),
        syncedToClickHouse: false,
      }));
      const pipelines: PipelineCompletionRecord[] = Array.from({ length: 10 }, (_, i) => ({
        id: `p-${i}`,
        runId: `run-${i}`,
        pipelineId: 'pipe-1',
        status: 'success',
        triggerType: 'push',
        durationMs: 120000,
        completedAt: new Date(now - i * 86400000),
        syncedToClickHouse: false,
      }));

      const trend = await calculator.getDORATrend('tenant-1', deployments, pipelines, [], 'day', 7);

      expect(trend.current).toBeDefined();
      expect(trend.previous).toBeDefined();
      expect(trend.changes).toBeDefined();
      expect(typeof trend.changes.deploymentFrequency).toBe('number');
      expect(typeof trend.changes.leadTime).toBe('number');
      expect(typeof trend.changes.changeFailureRate).toBe('number');
      expect(typeof trend.changes.mttr).toBe('number');
      expect(trend.currentPeriod).toBeDefined();
      expect(trend.previousPeriod).toBeDefined();
    });

    it('should calculate percentage changes correctly', async () => {
      const now = Date.now();
      // Create more deployments in the recent window
      const deployments: DeploymentRecord[] = [
        // Recent week: 10 deployments
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `recent-${i}`,
          deploymentId: `deploy-recent-${i}`,
          service: 'api',
          environment: 'production',
          status: 'success' as const,
          deployedAt: new Date(now - i * 86400000),
          syncedToClickHouse: false,
        })),
        // Previous week: 5 deployments
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `prev-${i}`,
          deploymentId: `deploy-prev-${i}`,
          service: 'api',
          environment: 'production',
          status: 'success' as const,
          deployedAt: new Date(now - (i + 7) * 86400000),
          syncedToClickHouse: false,
        })),
      ];
      const pipelines: PipelineCompletionRecord[] = [];

      const trend = await calculator.getDORATrend('tenant-1', deployments, pipelines, [], 'day', 7);

      // Recent week has more deployments, so change should be positive
      expect(trend.changes.deploymentFrequency).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', async () => {
      const trend = await calculator.getDORATrend('tenant-1', [], [], [], 'week', 1);

      expect(trend.current.deploymentFrequency.value).toBe(0);
      expect(trend.previous.deploymentFrequency.value).toBe(0);
      expect(trend.changes.deploymentFrequency).toBe(0);
    });

    it('should include all four metric changes', async () => {
      const now = Date.now();
      const deployments = createDeployments(14, now);
      const pipelines = createPipelineRecords(7, now);
      const incidents: IncidentRecord[] = [];

      const trend = await calculator.getDORATrend('tenant-1', deployments, pipelines, incidents, 'day', 7);

      expect(trend.changes).toHaveProperty('deploymentFrequency');
      expect(trend.changes).toHaveProperty('leadTime');
      expect(trend.changes).toHaveProperty('changeFailureRate');
      expect(trend.changes).toHaveProperty('mttr');
    });
  });
});
