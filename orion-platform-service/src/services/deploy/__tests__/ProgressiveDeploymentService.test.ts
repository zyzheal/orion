/**
 * Tests for ProgressiveDeploymentService
 */

import {
  ProgressiveDeploymentService,
  ProgressiveDeployConfig,
  ProgressiveDeployStatus,
  ProgressiveDeploymentServiceError,
} from '../ProgressiveDeploymentService';

const DEFAULT_CONFIG: ProgressiveDeployConfig = {
  strategy: 'canary',
  initialTrafficPercent: 10,
  incrementPercent: 10,
  incrementIntervalSeconds: 60,
  autoRollback: true,
  rollbackThreshold: 5,
  healthCheckEndpoint: '/health',
};

describe('ProgressiveDeploymentService', () => {
  let service: ProgressiveDeploymentService;

  beforeEach(() => {
    service = new ProgressiveDeploymentService();
  });

  describe('startProgressiveDeploy', () => {
    it('should start a canary deployment', async () => {
      const result = await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBe('deploy-001');
      expect(result.status.phase).toBe('initial');
      expect(result.status.currentTrafficPercent).toBe(10);
      expect(result.status.targetTrafficPercent).toBe(100);
      expect(result.status.errorRate).toBe(0);
      expect(result.status.startedAt).toBeInstanceOf(Date);
    });

    it('should start with different strategies', async () => {
      const strategies: ProgressiveDeployConfig['strategy'][] = [
        'canary',
        'blue-green',
        'rolling',
        'shadow',
      ];

      for (const strategy of strategies) {
        const config = { ...DEFAULT_CONFIG, strategy };
        const result = await service.startProgressiveDeploy(
          `deploy-${strategy}`,
          config
        );
        expect(result.success).toBe(true);
      }
    });

    it('should start with 0 initial traffic', async () => {
      const config = { ...DEFAULT_CONFIG, initialTrafficPercent: 0 };
      const result = await service.startProgressiveDeploy('deploy-001', config);

      expect(result.status.currentTrafficPercent).toBe(0);
      expect(result.status.phase).toBe('initial');
    });

    it('should throw error for invalid initialTrafficPercent', async () => {
      const config = { ...DEFAULT_CONFIG, initialTrafficPercent: -5 };

      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow(ProgressiveDeploymentServiceError);
      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow('initialTrafficPercent must be between 0 and 100');
    });

    it('should throw error for invalid incrementPercent', async () => {
      const config = { ...DEFAULT_CONFIG, incrementPercent: 0 };

      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow(ProgressiveDeploymentServiceError);
      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow('incrementPercent must be between 1 and 100');
    });

    it('should throw error for invalid rollbackThreshold', async () => {
      const config = { ...DEFAULT_CONFIG, rollbackThreshold: 150 };

      await expect(
        service.startProgressiveDeploy('deploy-001', config)
      ).rejects.toThrow(ProgressiveDeploymentServiceError);
    });

    it('should throw error when deployment already exists', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      await expect(
        service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG)
      ).rejects.toThrow(ProgressiveDeploymentServiceError);
      await expect(
        service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG)
      ).rejects.toThrow('already has an active progressive deployment');
    });
  });

  describe('incrementTraffic', () => {
    it('should increment traffic', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const status = await service.incrementTraffic('deploy-001', DEFAULT_CONFIG);

      expect(status).not.toBeNull();
      expect(status!.currentTrafficPercent).toBe(20);
      expect(status!.phase).toBe('progressing');
      expect(status!.lastIncrementAt).toBeInstanceOf(Date);
    });

    it('should increment through multiple phases', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      // First increment: 10 -> 20
      let status = await service.incrementTraffic('deploy-001', DEFAULT_CONFIG);
      expect(status!.currentTrafficPercent).toBe(20);
      expect(status!.phase).toBe('progressing');

      // Second increment: 20 -> 30
      status = await service.incrementTraffic('deploy-001', DEFAULT_CONFIG);
      expect(status!.currentTrafficPercent).toBe(30);
      expect(status!.phase).toBe('progressing');
    });

    it('should complete when reaching 100%', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 90,
        incrementPercent: 20,
      };
      await service.startProgressiveDeploy('deploy-001', config);

      const status = await service.incrementTraffic('deploy-001', config);

      expect(status).not.toBeNull();
      expect(status!.currentTrafficPercent).toBe(100);
      expect(status!.phase).toBe('complete');
      expect(status!.completedAt).toBeInstanceOf(Date);
    });

    it('should not increment when deployment is complete', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      };
      await service.startProgressiveDeploy('deploy-001', config);
      await service.incrementTraffic('deploy-001', config); // Now complete

      const status = await service.incrementTraffic('deploy-001', config);

      expect(status!.phase).toBe('complete');
      expect(status!.currentTrafficPercent).toBe(100);
    });

    it('should not increment when deployment is rolled back', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.abortDeployment('deploy-001');

      const status = await service.incrementTraffic('deploy-001', DEFAULT_CONFIG);

      expect(status!.phase).toBe('rolled_back');
    });

    it('should return null for non-existent deployment', async () => {
      const status = await service.incrementTraffic('non-existent', DEFAULT_CONFIG);

      expect(status).toBeNull();
    });
  });

  describe('checkAndAutoRollback', () => {
    it('should not trigger rollback when error rate is below threshold', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const shouldRollback = await service.checkAndAutoRollback(
        'deploy-001',
        DEFAULT_CONFIG,
        3 // 3% error rate, threshold is 5%
      );

      expect(shouldRollback).toBe(false);
      const status = await service.getStatus('deploy-001');
      expect(status!.phase).not.toBe('rolled_back');
    });

    it('should trigger rollback when error rate exceeds threshold', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const shouldRollback = await service.checkAndAutoRollback(
        'deploy-001',
        DEFAULT_CONFIG,
        10 // 10% error rate, threshold is 5%
      );

      expect(shouldRollback).toBe(true);
      const status = await service.getStatus('deploy-001');
      expect(status!.phase).toBe('rolled_back');
    });

    it('should trigger rollback when error rate equals threshold', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const shouldRollback = await service.checkAndAutoRollback(
        'deploy-001',
        DEFAULT_CONFIG,
        5 // exactly threshold
      );

      expect(shouldRollback).toBe(true);
    });

    it('should not rollback when autoRollback is disabled', async () => {
      const config = { ...DEFAULT_CONFIG, autoRollback: false };
      await service.startProgressiveDeploy('deploy-001', config);

      const shouldRollback = await service.checkAndAutoRollback(
        'deploy-001',
        config,
        50 // very high error rate
      );

      expect(shouldRollback).toBe(false);
      const status = await service.getStatus('deploy-001');
      expect(status!.phase).not.toBe('rolled_back');
    });

    it('should return false for non-existent deployment', async () => {
      const shouldRollback = await service.checkAndAutoRollback(
        'non-existent',
        DEFAULT_CONFIG,
        10
      );

      expect(shouldRollback).toBe(false);
    });

    it('should update error rate even when not rolling back', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      await service.checkAndAutoRollback('deploy-001', DEFAULT_CONFIG, 2);

      const status = await service.getStatus('deploy-001');
      expect(status!.errorRate).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('should return status for existing deployment', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const status = await service.getStatus('deploy-001');

      expect(status).not.toBeNull();
      expect(status!.deploymentId).toBe('deploy-001');
      expect(status!.phase).toBe('initial');
    });

    it('should return null for non-existent deployment', async () => {
      const status = await service.getStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('abortDeployment', () => {
    it('should abort and rollback deployment', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.incrementTraffic('deploy-001', DEFAULT_CONFIG);

      const result = await service.abortDeployment('deploy-001');

      expect(result).toBe(true);
      const status = await service.getStatus('deploy-001');
      expect(status!.phase).toBe('rolled_back');
    });

    it('should return false for non-existent deployment', async () => {
      const result = await service.abortDeployment('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('listActiveDeployments', () => {
    it('should return all active deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.startProgressiveDeploy('deploy-002', DEFAULT_CONFIG);

      const active = await service.listActiveDeployments();

      expect(active).toHaveLength(2);
    });

    it('should filter out completed deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.startProgressiveDeploy('deploy-002', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      });
      await service.incrementTraffic('deploy-002', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      }); // Now complete

      const active = await service.listActiveDeployments();

      expect(active).toHaveLength(1);
      expect(active[0].deploymentId).toBe('deploy-001');
    });

    it('should filter out rolled back deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);
      await service.startProgressiveDeploy('deploy-002', DEFAULT_CONFIG);
      await service.abortDeployment('deploy-002');

      const active = await service.listActiveDeployments();

      expect(active).toHaveLength(1);
      expect(active[0].deploymentId).toBe('deploy-001');
    });

    it('should return empty array when no active deployments', async () => {
      const active = await service.listActiveDeployments();

      expect(active).toHaveLength(0);
    });
  });

  describe('calculateTrafficWeights', () => {
    it('should calculate correct weights for canary', () => {
      const weights = service.calculateTrafficWeights(10);

      expect(weights.stable).toBe(90);
      expect(weights.canary).toBe(10);
    });

    it('should calculate correct weights at 50%', () => {
      const weights = service.calculateTrafficWeights(50);

      expect(weights.stable).toBe(50);
      expect(weights.canary).toBe(50);
    });

    it('should calculate correct weights at 100%', () => {
      const weights = service.calculateTrafficWeights(100);

      expect(weights.stable).toBe(0);
      expect(weights.canary).toBe(100);
    });

    it('should calculate correct weights at 0%', () => {
      const weights = service.calculateTrafficWeights(0);

      expect(weights.stable).toBe(100);
      expect(weights.canary).toBe(0);
    });
  });

  describe('cleanupCompletedDeployments', () => {
    it('should clean up completed deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      });
      await service.incrementTraffic('deploy-001', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      }); // complete

      const cleaned = await service.cleanupCompletedDeployments();

      expect(cleaned).toBe(1);
      const status = await service.getStatus('deploy-001');
      expect(status).toBeNull();
    });

    it('should clean up old deployments based on age', async () => {
      await service.startProgressiveDeploy('deploy-001', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      });
      await service.incrementTraffic('deploy-001', {
        ...DEFAULT_CONFIG,
        initialTrafficPercent: 95,
        incrementPercent: 10,
      }); // complete

      // Mock time by manually manipulating - set completedAt to past
      const deployment = await service.getStatus('deploy-001');
      if (deployment && deployment.completedAt) {
        // Override completedAt to be in the past
        (deployment as any).completedAt = new Date(Date.now() - 60000);
      }

      // Clean only deployments older than 1 hour - should not delete
      const cleaned = await service.cleanupCompletedDeployments(3600000);

      expect(cleaned).toBe(0);

      // Clean deployments older than 1 second - should delete
      const cleaned2 = await service.cleanupCompletedDeployments(1000);
      expect(cleaned2).toBe(1);
    });

    it('should not clean up active deployments', async () => {
      await service.startProgressiveDeploy('deploy-001', DEFAULT_CONFIG);

      const cleaned = await service.cleanupCompletedDeployments();

      expect(cleaned).toBe(0);
      const status = await service.getStatus('deploy-001');
      expect(status).not.toBeNull();
    });
  });
});