/**
 * Smart Deploy Service - Unit Tests
 *
 * Tests for all smart deployment components:
 * - DeploymentStrategyEngine
 * - DeploymentVerifier
 * - DeploymentWorkflow
 * - RollbackService
 * - DeploymentHistoryService
 * - SmartDeployService
 *
 * TASK-701: Smart Deployment (智能部署)
 */

import { SmartDeployService } from '../SmartDeployService';
import { DeploymentStrategyEngine } from '../DeploymentStrategyEngine';
import { DeploymentVerifier } from '../DeploymentVerifier';
import { DeploymentWorkflow } from '../DeploymentWorkflow';
import { RollbackService } from '../RollbackService';
import { DeploymentHistoryService } from '../DeploymentHistoryService';
import {
  DeployConfig,
  Deployment,
  DeploymentStatus,
  RollbackInfo,
} from '../types';

// ==================== Mock Event Publisher ====================

const mockEventPublisher = {
  publish: jest.fn().mockResolvedValue('mock-event-id'),
};

// ==================== Helper Functions ====================

function createDeployConfig(overrides?: Partial<DeployConfig>): DeployConfig {
  return {
    appName: 'test-app',
    version: '1.0.0',
    environment: 'staging',
    strategy: 'rolling',
    initiatedBy: 'test-user',
    ...overrides,
  };
}

// ==================== DeploymentStrategyEngine Tests ====================

describe('DeploymentStrategyEngine', () => {
  let engine: DeploymentStrategyEngine;

  beforeEach(() => {
    engine = new DeploymentStrategyEngine({
      eventPublisher: mockEventPublisher as any,
    });
  });

  describe('executeStrategy', () => {
    it('should execute blue-green strategy successfully', async () => {
      const result = await engine.executeStrategy(
        'blue-green',
        { type: 'blue-green' },
        'test-app',
        '1.0.0',
        'staging'
      );

      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.stages.some((s) => s.name.includes('green'))).toBe(true);
      expect(result.stages.some((s) => s.name.includes('traffic'))).toBe(true);
    });

    it('should execute canary strategy with default steps', async () => {
      const result = await engine.executeStrategy(
        'canary',
        { type: 'canary' },
        'test-app',
        '1.0.0',
        'staging'
      );

      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.stages.some((s) => s.name.includes('canary'))).toBe(true);
    });

    it('should execute canary strategy with custom steps', async () => {
      const result = await engine.executeStrategy(
        'canary',
        {
          type: 'canary',
          canarySteps: [20, 60, 100],
        },
        'test-app',
        '1.0.0',
        'staging'
      );

      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThan(0);
    });

    it('should execute rolling strategy successfully', async () => {
      const result = await engine.executeStrategy(
        'rolling',
        { type: 'rolling', maxUnavailable: 1 },
        'test-app',
        '1.0.0',
        'staging'
      );

      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThan(0);
      expect(
        result.stages.some((s) => s.name.includes('rolling'))
      ).toBe(true);
    });

    it('should execute recreate strategy successfully', async () => {
      const result = await engine.executeStrategy(
        'recreate',
        { type: 'recreate' },
        'test-app',
        '1.0.0',
        'staging'
      );

      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThan(0);
      expect(
        result.stages.some((s) => s.name.includes('scale-down'))
      ).toBe(true);
    });

    it('should throw error for unknown strategy', async () => {
      await expect(
        engine.executeStrategy(
          'unknown' as any,
          { type: 'unknown' as any },
          'test-app',
          '1.0.0',
          'staging'
        )
      ).rejects.toThrow('Unknown deployment strategy');
    });
  });

  describe('switchTraffic', () => {
    it('should switch traffic to new version', async () => {
      const result = await engine.switchTraffic('test-app', 'staging', 100);

      expect(result.success).toBe(true);
      expect(result.trafficState.newPercentage).toBe(100);
      expect(result.trafficState.activePercentage).toBe(0);
      expect(result.trafficState.switched).toBe(true);
    });

    it('should switch traffic partially', async () => {
      const result = await engine.switchTraffic('test-app', 'staging', 50);

      expect(result.success).toBe(true);
      expect(result.trafficState.newPercentage).toBe(50);
      expect(result.trafficState.activePercentage).toBe(50);
      expect(result.trafficState.switched).toBe(false);
    });
  });

  describe('verifyHealth', () => {
    it('should verify health successfully', async () => {
      const result = await engine.verifyHealth(
        'test-app',
        '1.0.0',
        'staging'
      );

      expect(result.healthy).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    });
  });

  describe('rollbackTraffic', () => {
    it('should rollback traffic to previous version', async () => {
      // First switch traffic
      await engine.switchTraffic('test-app', 'staging', 100);

      // Then rollback
      const result = await engine.rollbackTraffic('test-app', 'staging');

      expect(result.success).toBe(true);
      expect(result.trafficState.newPercentage).toBe(0);
      expect(result.trafficState.activePercentage).toBe(100);
    });
  });

  describe('getTrafficState', () => {
    it('should return traffic state after switch', async () => {
      await engine.switchTraffic('test-app', 'staging', 75);

      const state = engine.getTrafficState('test-app', 'staging');

      expect(state).toBeDefined();
      expect(state?.newPercentage).toBe(75);
    });

    it('should return undefined for unknown app', () => {
      const state = engine.getTrafficState('unknown-app', 'staging');
      expect(state).toBeUndefined();
    });
  });
});

// ==================== DeploymentVerifier Tests ====================

describe('DeploymentVerifier', () => {
  let verifier: DeploymentVerifier;

  beforeEach(() => {
    verifier = new DeploymentVerifier();
  });

  describe('verifyHealth', () => {
    it('should verify health endpoints', async () => {
      const results = await verifier.verifyHealth(
        'test-app',
        '1.0.0',
        'staging'
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].endpoint).toBeDefined();
      expect(results[0].checkedAt).toBeDefined();
    });

    it('should verify with custom health check config', async () => {
      const results = await verifier.verifyHealth(
        'test-app',
        '1.0.0',
        'staging',
        {
          endpoint: '/api/v1/health',
          expectedStatus: 200,
          timeoutMs: 3000,
          retries: 2,
        }
      );

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('verifyMetrics', () => {
    it('should verify metrics', async () => {
      const results = await verifier.verifyMetrics(
        'test-app',
        '1.0.0',
        'staging'
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.metricName === 'error_rate')).toBe(true);
      expect(results.some((r) => r.metricName === 'latency_p95')).toBe(true);
    });

    it('should verify with custom thresholds', async () => {
      const results = await verifier.verifyMetrics(
        'test-app',
        '1.0.0',
        'staging',
        {
          maxErrorRate: 1,
          maxLatencyP50: 100,
          maxLatencyP95: 300,
          maxLatencyP99: 800,
          minThroughput: 200,
        }
      );

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('compareWithPrevious', () => {
    it('should compare with no previous deployment', async () => {
      const deployment: Deployment = {
        id: 'deploy-1',
        appName: 'test-app',
        version: '1.0.0',
        environment: 'staging',
        strategy: 'rolling',
        status: 'completed',
        stages: [],
        currentStageIndex: 0,
        initiatedBy: 'test-user',
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await verifier.compareWithPrevious(deployment);

      expect(result.currentDeploymentId).toBe('deploy-1');
      expect(result.previousDeploymentId).toBe('none');
      expect(result.isImprovement).toBe(true);
    });

    it('should compare with previous deployment', async () => {
      const currentDeployment: Deployment = {
        id: 'deploy-2',
        appName: 'test-app',
        version: '2.0.0',
        environment: 'staging',
        strategy: 'rolling',
        status: 'completed',
        stages: [],
        currentStageIndex: 0,
        initiatedBy: 'test-user',
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const previousDeployment: Deployment = {
        id: 'deploy-1',
        appName: 'test-app',
        version: '1.0.0',
        environment: 'staging',
        strategy: 'rolling',
        status: 'completed',
        stages: [],
        currentStageIndex: 0,
        initiatedBy: 'test-user',
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await verifier.compareWithPrevious(
        currentDeployment,
        previousDeployment
      );

      expect(result.currentDeploymentId).toBe('deploy-2');
      expect(result.previousDeploymentId).toBe('deploy-1');
      expect(result.metricComparison.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
    });
  });

  describe('generateVerificationReport', () => {
    it('should generate comprehensive verification report', async () => {
      const deployment: Deployment = {
        id: 'deploy-1',
        appName: 'test-app',
        version: '1.0.0',
        environment: 'staging',
        strategy: 'rolling',
        status: 'completed',
        stages: [],
        currentStageIndex: 0,
        initiatedBy: 'test-user',
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const report = await verifier.generateVerificationReport(deployment);

      expect(report.deploymentId).toBe('deploy-1');
      expect(report.overallStatus).toBeDefined();
      expect(report.healthChecks.length).toBeGreaterThan(0);
      expect(report.metrics.length).toBeGreaterThan(0);
      expect(report.summary).toBeDefined();
      expect(report.verifiedAt).toBeDefined();
    });
  });
});

// ==================== RollbackService Tests ====================

describe('RollbackService', () => {
  let rollbackService: RollbackService;

  beforeEach(() => {
    rollbackService = new RollbackService({
      eventPublisher: mockEventPublisher as any,
    });
  });

  function createDeployment(status: DeploymentStatus): Deployment {
    return {
      id: 'deploy-rollback-1',
      appName: 'test-app',
      version: '1.0.0',
      environment: 'staging',
      strategy: 'rolling',
      status,
      stages: [],
      currentStageIndex: 0,
      initiatedBy: 'test-user',
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  describe('triggerRollback', () => {
    it('should trigger rollback for completed deployment', async () => {
      const deployment = createDeployment('completed');

      const rollback = await rollbackService.triggerRollback(
        deployment,
        'Manual rollback',
        'test-user'
      );

      expect(rollback.id).toBeDefined();
      expect(rollback.deploymentId).toBe('deploy-rollback-1');
      expect(rollback.reason).toBe('Manual rollback');
      expect(rollback.triggeredBy).toBe('test-user');
      expect(rollback.status).toBe('pending');
    });

    it('should trigger rollback for failed deployment', async () => {
      const deployment = createDeployment('failed');

      const rollback = await rollbackService.triggerRollback(
        deployment,
        'Auto rollback on failure',
        'system'
      );

      expect(rollback.status).toBe('pending');
    });

    it('should throw error for pending deployment', async () => {
      const deployment = createDeployment('pending');

      await expect(
        rollbackService.triggerRollback(
          deployment,
          'Cannot rollback pending',
          'test-user'
        )
      ).rejects.toThrow('Cannot rollback deployment');
    });

    it('should throw error for already rolled back deployment', async () => {
      const deployment = createDeployment('rolled_back');

      await expect(
        rollbackService.triggerRollback(
          deployment,
          'Already rolled back',
          'test-user'
        )
      ).rejects.toThrow('Cannot rollback deployment');
    });

    it('should trigger rollback with target version', async () => {
      const deployment = createDeployment('completed');

      const rollback = await rollbackService.triggerRollback(
        deployment,
        'Rollback to specific version',
        'test-user',
        '0.9.0'
      );

      expect(rollback.targetVersion).toBe('0.9.0');
    });

    it('should publish rollback started event', async () => {
      const deployment = createDeployment('completed');

      await rollbackService.triggerRollback(
        deployment,
        'Test rollback',
        'test-user'
      );

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'deployment.rollback_started',
        expect.objectContaining({
          deploymentId: 'deploy-rollback-1',
          reason: 'Test rollback',
        }),
        expect.anything()
      );
    });
  });

  describe('executeRollback', () => {
    it('should execute rollback successfully', async () => {
      const deployment = createDeployment('completed');
      const rollback = await rollbackService.triggerRollback(
        deployment,
        'Test rollback',
        'test-user'
      );

      const result = await rollbackService.executeRollback(
        deployment,
        rollback
      );

      expect(result.rollback.status).toBe('completed');
      expect(result.rollback.completedAt).toBeDefined();
      expect(result.deployment.status).toBe('rolled_back');
    });
  });

  describe('getRollbackHistory', () => {
    it('should return rollback history', async () => {
      const deployment = createDeployment('completed');

      await rollbackService.triggerRollback(
        deployment,
        'Rollback 1',
        'test-user'
      );
      await rollbackService.triggerRollback(
        deployment,
        'Rollback 2',
        'test-user'
      );

      const history = await rollbackService.getRollbackHistory('deploy-rollback-1');

      expect(history.length).toBe(2);
    });

    it('should return empty array for no history', async () => {
      const history = await rollbackService.getRollbackHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('isRollbackable', () => {
    it('should return true for completed status', () => {
      expect(rollbackService.isRollbackable('completed')).toBe(true);
    });

    it('should return true for failed status', () => {
      expect(rollbackService.isRollbackable('failed')).toBe(true);
    });

    it('should return true for verifying status', () => {
      expect(rollbackService.isRollbackable('verifying')).toBe(true);
    });

    it('should return false for pending status', () => {
      expect(rollbackService.isRollbackable('pending')).toBe(false);
    });
  });

  describe('findPreviousVersion', () => {
    it('should find previous version', () => {
      const deployment = createDeployment('completed');
      deployment.version = '1.0.1';

      const previous = rollbackService.findPreviousVersion(deployment);
      expect(previous).toBe('1.0.0');
    });

    it('should return fallback version for version 1.0.0', () => {
      const deployment = createDeployment('completed');
      deployment.version = '1.0.0';

      const previous = rollbackService.findPreviousVersion(deployment);
      // Falls back to a simulated previous version
      expect(previous).toBe('0.9.0');
    });
  });
});

// ==================== DeploymentHistoryService Tests ====================

describe('DeploymentHistoryService', () => {
  let historyService: DeploymentHistoryService;

  beforeEach(() => {
    historyService = new DeploymentHistoryService();
  });

  function createDeployment(overrides?: Partial<Deployment>): Deployment {
    return {
      id: `deploy-hist-${Date.now()}-${Math.random()}`,
      appName: 'test-app',
      version: '1.0.0',
      environment: 'staging',
      strategy: 'rolling',
      status: 'completed',
      stages: [],
      currentStageIndex: 0,
      initiatedBy: 'test-user',
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  describe('recordDeployment', () => {
    it('should record a deployment', async () => {
      const deployment = createDeployment();

      const recorded = await historyService.recordDeployment(deployment);

      expect(recorded.id).toBe(deployment.id);
    });

    it('should add audit trail entry', async () => {
      const deployment = createDeployment();

      await historyService.recordDeployment(deployment);
      const auditTrail = await historyService.getAuditTrail(deployment.id);

      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail[0].action).toBe('deployment_created');
    });
  });

  describe('getDeployment', () => {
    it('should get deployment by ID', async () => {
      const deployment = createDeployment();
      await historyService.recordDeployment(deployment);

      const found = await historyService.getDeployment(deployment.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(deployment.id);
    });

    it('should return null for non-existent deployment', async () => {
      const found = await historyService.getDeployment('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return all deployments', async () => {
      await historyService.recordDeployment(createDeployment({ appName: 'app-1' }));
      await historyService.recordDeployment(createDeployment({ appName: 'app-2' }));

      const history = await historyService.getHistory();

      expect(history.total).toBe(2);
      expect(history.data.length).toBe(2);
    });

    it('should filter by app name', async () => {
      await historyService.recordDeployment(createDeployment({ appName: 'app-1' }));
      await historyService.recordDeployment(createDeployment({ appName: 'app-2' }));

      const history = await historyService.getHistory({ appName: 'app-1' });

      expect(history.total).toBe(1);
      expect(history.data[0].appName).toBe('app-1');
    });

    it('should filter by environment', async () => {
      await historyService.recordDeployment(
        createDeployment({ environment: 'staging' })
      );
      await historyService.recordDeployment(
        createDeployment({ environment: 'prod' })
      );

      const history = await historyService.getHistory({
        environment: 'staging',
      });

      expect(history.total).toBe(1);
    });

    it('should filter by status', async () => {
      await historyService.recordDeployment(
        createDeployment({ status: 'completed' })
      );
      await historyService.recordDeployment(
        createDeployment({ status: 'failed' })
      );

      const history = await historyService.getHistory({ status: 'failed' });

      expect(history.total).toBe(1);
      expect(history.data[0].status).toBe('failed');
    });

    it('should filter by strategy', async () => {
      await historyService.recordDeployment(
        createDeployment({ strategy: 'blue-green' })
      );
      await historyService.recordDeployment(
        createDeployment({ strategy: 'canary' })
      );

      const history = await historyService.getHistory({ strategy: 'canary' });

      expect(history.total).toBe(1);
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await historyService.recordDeployment(createDeployment());
      }

      const history = await historyService.getHistory({ limit: 2, offset: 0 });

      expect(history.data.length).toBe(2);
      expect(history.total).toBe(5);
    });

    it('should sort by startedAt descending', async () => {
      const d1 = createDeployment({
        startedAt: new Date('2024-01-01'),
      });
      const d2 = createDeployment({
        startedAt: new Date('2024-01-02'),
      });

      await historyService.recordDeployment(d1);
      await historyService.recordDeployment(d2);

      const history = await historyService.getHistory();

      expect(history.data[0].startedAt.getTime()).toBeGreaterThan(
        history.data[1].startedAt.getTime()
      );
    });
  });

  describe('getMetrics', () => {
    it('should calculate deployment metrics', async () => {
      await historyService.recordDeployment(
        createDeployment({ status: 'completed' })
      );
      await historyService.recordDeployment(
        createDeployment({ status: 'completed' })
      );
      await historyService.recordDeployment(
        createDeployment({ status: 'failed' })
      );
      await historyService.recordDeployment(
        createDeployment({ status: 'rolled_back' })
      );

      const metrics = await historyService.getMetrics();

      expect(metrics.totalDeployments).toBe(4);
      expect(metrics.successfulDeployments).toBe(2);
      expect(metrics.failedDeployments).toBe(1);
      expect(metrics.rolledBackDeployments).toBe(1);
      expect(metrics.successRate).toBe(50);
      expect(metrics.rollbackRate).toBe(25);
      expect(metrics.byStrategy).toBeDefined();
      expect(metrics.byEnvironment).toBeDefined();
      expect(metrics.byStatus).toBeDefined();
    });

    it('should filter metrics by app name', async () => {
      await historyService.recordDeployment(
        createDeployment({ appName: 'app-1', status: 'completed' })
      );
      await historyService.recordDeployment(
        createDeployment({ appName: 'app-2', status: 'failed' })
      );

      const metrics = await historyService.getMetrics({ appName: 'app-1' });

      expect(metrics.totalDeployments).toBe(1);
      expect(metrics.successRate).toBe(100);
    });

    it('should return zero metrics for empty history', async () => {
      const metrics = await historyService.getMetrics();

      expect(metrics.totalDeployments).toBe(0);
      expect(metrics.successRate).toBe(0);
    });
  });

  describe('getByAppName', () => {
    it('should get deployments by app name', async () => {
      await historyService.recordDeployment(
        createDeployment({ appName: 'app-1' })
      );
      await historyService.recordDeployment(
        createDeployment({ appName: 'app-2' })
      );
      await historyService.recordDeployment(
        createDeployment({ appName: 'app-1' })
      );

      const deployments = await historyService.getByAppName('app-1');

      expect(deployments.length).toBe(2);
      expect(deployments.every((d) => d.appName === 'app-1')).toBe(true);
    });
  });

  describe('getLatestDeployment', () => {
    it('should get latest deployment for app in environment', async () => {
      await historyService.recordDeployment(
        createDeployment({
          appName: 'app-1',
          environment: 'staging',
          startedAt: new Date('2024-01-01'),
        })
      );
      await historyService.recordDeployment(
        createDeployment({
          appName: 'app-1',
          environment: 'staging',
          startedAt: new Date('2024-01-02'),
        })
      );

      const latest = await historyService.getLatestDeployment('app-1', 'staging');

      expect(latest).toBeDefined();
      expect(latest?.startedAt.getTime()).toBe(
        new Date('2024-01-02').getTime()
      );
    });

    it('should return null for no deployments', async () => {
      const latest = await historyService.getLatestDeployment(
        'non-existent',
        'staging'
      );
      expect(latest).toBeNull();
    });
  });

  describe('getLastSuccessfulDeployment', () => {
    it('should get last successful deployment', async () => {
      await historyService.recordDeployment(
        createDeployment({
          appName: 'app-1',
          environment: 'staging',
          status: 'failed',
          startedAt: new Date('2024-01-01'),
        })
      );
      await historyService.recordDeployment(
        createDeployment({
          appName: 'app-1',
          environment: 'staging',
          status: 'completed',
          startedAt: new Date('2024-01-02'),
        })
      );

      const latest = await historyService.getLastSuccessfulDeployment(
        'app-1',
        'staging'
      );

      expect(latest).toBeDefined();
      expect(latest?.status).toBe('completed');
    });
  });
});

// ==================== DeploymentWorkflow Tests ====================

describe('DeploymentWorkflow', () => {
  let workflow: DeploymentWorkflow;

  beforeEach(() => {
    workflow = new DeploymentWorkflow({
      eventPublisher: mockEventPublisher as any,
    });
  });

  describe('startDeployment', () => {
    it('should start and complete a deployment', async () => {
      const config = createDeployConfig();

      const deployment = await workflow.startDeployment(config);

      expect(deployment.id).toBeDefined();
      expect(deployment.appName).toBe('test-app');
      expect(deployment.version).toBe('1.0.0');
      expect(deployment.environment).toBe('staging');
      expect(deployment.status).toBe('completed');
      expect(deployment.stages.length).toBeGreaterThan(0);
    });

    it('should use specified strategy', async () => {
      const config = createDeployConfig({ strategy: 'canary' });

      const deployment = await workflow.startDeployment(config);

      expect(deployment.strategy).toBe('canary');
    });

    it('should validate config and fail on invalid', async () => {
      const config = createDeployConfig();
      (config as any).appName = '';

      const deployment = await workflow.startDeployment(config);

      expect(deployment.status).toBe('failed');
    });
  });

  describe('executeStage', () => {
    it('should execute a specific stage', async () => {
      const config = createDeployConfig();
      const deployment = await workflow.startDeployment(config);

      if (deployment.stages.length > 0) {
        // Create a new workflow with the same history service
        const workflow2 = new DeploymentWorkflow({
          eventPublisher: mockEventPublisher as any,
          historyService: workflow.getHistoryService(),
          rollbackService: workflow.getRollbackService(),
        });

        const result = await workflow2.executeStage(deployment.id, 0);

        expect(result.success).toBe(true);
        expect(result.stage).toBeDefined();
      }
    });

    it('should throw error for non-existent deployment', async () => {
      await expect(
        workflow.executeStage('non-existent', 0)
      ).rejects.toThrow('not found');
    });

    it('should throw error for invalid stage index', async () => {
      const config = createDeployConfig();
      const deployment = await workflow.startDeployment(config);

      await expect(
        workflow.executeStage(deployment.id, 999)
      ).rejects.toThrow('out of range');
    });
  });

  describe('verifyDeployment', () => {
    it('should verify a deployment', async () => {
      const config = createDeployConfig();
      const deployment = await workflow.startDeployment(config);

      const result = await workflow.verifyDeployment(deployment.id);

      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report?.deploymentId).toBe(deployment.id);
    });
  });
});

// ==================== SmartDeployService Tests ====================

describe('SmartDeployService', () => {
  let smartDeployService: SmartDeployService;

  beforeEach(() => {
    smartDeployService = new SmartDeployService({
      eventPublisher: mockEventPublisher as any,
    });
  });

  describe('deploy', () => {
    it('should deploy with specified strategy', async () => {
      const config = createDeployConfig({ strategy: 'blue-green' });

      const deployment = await smartDeployService.deploy(config);

      expect(deployment.id).toBeDefined();
      expect(deployment.strategy).toBe('blue-green');
      expect(deployment.appName).toBe('test-app');
    });

    it('should auto-select strategy based on environment', async () => {
      // Don't specify strategy to test auto-selection
      const prodConfig = createDeployConfig({ environment: 'prod', strategy: undefined });
      const prodDeployment = await smartDeployService.deploy(prodConfig);
      expect(prodDeployment.strategy).toBe('blue-green');

      const devConfig = createDeployConfig({ environment: 'dev', strategy: undefined });
      const devDeployment = await smartDeployService.deploy(devConfig);
      expect(devDeployment.strategy).toBe('recreate');

      const stagingConfig = createDeployConfig({ environment: 'staging', strategy: undefined });
      const stagingDeployment = await smartDeployService.deploy(stagingConfig);
      expect(stagingDeployment.strategy).toBe('canary');
    });

    it('should fail on invalid config', async () => {
      const config = createDeployConfig();
      (config as any).appName = '';

      const deployment = await smartDeployService.deploy(config);

      expect(deployment.status).toBe('failed');
    });
  });

  describe('getStatus', () => {
    it('should get deployment status', async () => {
      const config = createDeployConfig();
      const deployment = await smartDeployService.deploy(config);

      const status = await smartDeployService.getStatus(deployment.id);

      expect(status).toBeDefined();
      expect(status?.id).toBe(deployment.id);
    });

    it('should return null for non-existent deployment', async () => {
      const status = await smartDeployService.getStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should get deployment history', async () => {
      await smartDeployService.deploy(createDeployConfig({ appName: 'app-1' }));
      await smartDeployService.deploy(createDeployConfig({ appName: 'app-2' }));

      const history = await smartDeployService.getHistory();

      expect(history.total).toBe(2);
    });
  });

  describe('getMetrics', () => {
    it('should get deployment metrics', async () => {
      await smartDeployService.deploy(createDeployConfig());

      const metrics = await smartDeployService.getMetrics();

      expect(metrics.totalDeployments).toBe(1);
    });
  });

  describe('getAuditTrail', () => {
    it('should get audit trail', async () => {
      const deployment = await smartDeployService.deploy(createDeployConfig());

      const auditTrail = await smartDeployService.getAuditTrail(
        deployment.id
      );

      expect(auditTrail.length).toBeGreaterThan(0);
    });
  });

  describe('rollback', () => {
    it('should rollback a deployment', async () => {
      const deployment = await smartDeployService.deploy(createDeployConfig());

      const result = await smartDeployService.rollback(
        deployment.id,
        'Manual rollback',
        'test-user'
      );

      expect(result.rollback.status).toBe('completed');
      expect(result.deployment.status).toBe('rolled_back');
    });

    it('should throw error for non-existent deployment', async () => {
      await expect(
        smartDeployService.rollback('non-existent', 'reason', 'user')
      ).rejects.toThrow('not found');
    });
  });

  describe('cancelDeployment', () => {
    it('should not be able to cancel completed deployment', async () => {
      const deployment = await smartDeployService.deploy(createDeployConfig());

      // Deployment completes synchronously in tests, so cancel should fail
      await expect(
        smartDeployService.cancelDeployment(deployment.id, 'test-user')
      ).rejects.toThrow('Cannot cancel deployment');
    });
  });

  describe('getByAppName', () => {
    it('should get deployments by app name', async () => {
      await smartDeployService.deploy(
        createDeployConfig({ appName: 'app-1' })
      );
      await smartDeployService.deploy(
        createDeployConfig({ appName: 'app-2' })
      );

      const deployments = await smartDeployService.getByAppName('app-1');

      expect(deployments.length).toBe(1);
      expect(deployments[0].appName).toBe('app-1');
    });
  });

  describe('getLatestDeployment', () => {
    it('should get latest deployment', async () => {
      await smartDeployService.deploy(
        createDeployConfig({ appName: 'app-1', environment: 'staging' })
      );

      const latest = await smartDeployService.getLatestDeployment(
        'app-1',
        'staging'
      );

      expect(latest).toBeDefined();
      expect(latest?.appName).toBe('app-1');
    });
  });

  describe('getRollbackHistory', () => {
    it('should get rollback history', async () => {
      const deployment = await smartDeployService.deploy(createDeployConfig());

      // First rollback changes deployment to 'rolled_back'
      await smartDeployService.rollback(
        deployment.id,
        'Rollback 1',
        'test-user'
      );

      const history = await smartDeployService.getRollbackHistory(
        deployment.id
      );

      expect(history.length).toBe(1);
      expect(history[0].reason).toBe('Rollback 1');
    });
  });
});
