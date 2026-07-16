/**
 * DeploymentStrategy 模型测试
 */
import {
  createDeploymentStrategy,
  createDeploymentStepTracker,
  createHealthCheckResult,
} from '../DeploymentStrategy';

describe('DeploymentStrategy', () => {
  describe('createDeploymentStrategy', () => {
    it('should create canary strategy', () => {
      const strategy = createDeploymentStrategy({
        tenantId: 't1',
        name: 'canary-strategy',
        type: 'canary',
        config: {
          steps: [{ weight: 10, pause: '5m' }, { weight: 100 }],
          autoPromote: true,
          rollbackOnFailure: true,
        },
      });

      expect(strategy.id).toBeDefined();
      expect(strategy.tenantId).toBe('t1');
      expect(strategy.name).toBe('canary-strategy');
      expect(strategy.type).toBe('canary');
      expect(strategy.enabled).toBe(true);
      expect(strategy.createdAt).toBeInstanceOf(Date);
    });

    it('should create bluegreen strategy', () => {
      const strategy = createDeploymentStrategy({
        tenantId: 't1',
        name: 'bg-strategy',
        type: 'bluegreen',
        config: {
          activeSlot: 'blue',
          switchMethod: 'instant',
        },
      });

      expect(strategy.type).toBe('bluegreen');
    });

    it('should create rolling strategy', () => {
      const strategy = createDeploymentStrategy({
        tenantId: 't1',
        name: 'rolling',
        type: 'rolling',
        config: {
          batchSize: 3,
          maxUnavailable: 1,
        },
      });

      expect(strategy.type).toBe('rolling');
    });

    it('should default enabled to true', () => {
      const strategy = createDeploymentStrategy({
        tenantId: 't1',
        name: 's1',
        type: 'canary',
        config: { steps: [] },
        enabled: false,
      });

      expect(strategy.enabled).toBe(false);
    });
  });

  describe('createDeploymentStepTracker', () => {
    it('should create tracker', () => {
      const tracker = createDeploymentStepTracker({
        runId: 'run-1',
        strategyId: 'strat-1',
        strategyType: 'canary',
        totalSteps: 3,
      });

      expect(tracker.id).toBeDefined();
      expect(tracker.runId).toBe('run-1');
      expect(tracker.strategyId).toBe('strat-1');
      expect(tracker.strategyType).toBe('canary');
      expect(tracker.currentStep).toBe(0);
      expect(tracker.totalSteps).toBe(3);
      expect(tracker.currentWeight).toBe(0);
      expect(tracker.status).toBe('pending');
      expect(tracker.healthChecks).toEqual([]);
    });
  });

  describe('createHealthCheckResult', () => {
    it('should create healthy result', () => {
      const result = createHealthCheckResult('tracker-1', 0, '/healthz', true, {
        statusCode: 200,
        responseTime: 50,
      });

      expect(result.id).toBeDefined();
      expect(result.stepTrackerId).toBe('tracker-1');
      expect(result.stepIndex).toBe(0);
      expect(result.endpoint).toBe('/healthz');
      expect(result.healthy).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBe(50);
      expect(result.errorMessage).toBeNull();
      expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it('should create unhealthy result', () => {
      const result = createHealthCheckResult('tracker-1', 1, '/healthz', false, {
        statusCode: 503,
        errorMessage: 'Service unavailable',
      });

      expect(result.healthy).toBe(false);
      expect(result.statusCode).toBe(503);
      expect(result.errorMessage).toBe('Service unavailable');
    });

    it('should default optional fields to null', () => {
      const result = createHealthCheckResult('t1', 0, '/health', true);

      expect(result.statusCode).toBeNull();
      expect(result.responseTime).toBeNull();
      expect(result.errorMessage).toBeNull();
    });
  });
});
