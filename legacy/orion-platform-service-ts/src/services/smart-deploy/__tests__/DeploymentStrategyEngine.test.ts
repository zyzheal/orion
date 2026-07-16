/**
 * DeploymentStrategyEngine - Comprehensive Tests
 *
 * Tests for all 4 deployment strategies (blue-green, canary, rolling, recreate),
 * traffic management, health verification, and event publishing.
 */

import { DeploymentStrategyEngine } from '../DeploymentStrategyEngine';
import type { IEventPublisher } from '../types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('uuid', () => ({ v4: () => 'mock-uuid-' + Date.now() }));
jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

function createMockEventPublisher(): IEventPublisher {
  return {
    publish: jest.fn().mockResolvedValue('event-id-1'),
  };
}

function createMockDb() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DeploymentStrategyEngine', () => {
  let engine: DeploymentStrategyEngine;
  let eventPublisher: IEventPublisher;

  beforeEach(() => {
    eventPublisher = createMockEventPublisher();
    engine = new DeploymentStrategyEngine({ eventPublisher });
  });

  // ─── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create engine without options', () => {
      const e = new DeploymentStrategyEngine();
      expect(e).toBeDefined();
    });

    it('should create engine with event publisher', () => {
      const e = new DeploymentStrategyEngine({ eventPublisher });
      expect(e).toBeDefined();
    });

    it('should create engine with database', () => {
      const db = createMockDb();
      const e = new DeploymentStrategyEngine({ db, tenantId: 't1' });
      expect(e).toBeDefined();
    });

    it('should use default tenant id when not specified', () => {
      const e = new DeploymentStrategyEngine();
      expect(e).toBeDefined();
    });
  });

  // ─── executeStrategy ──────────────────────────────────────────────────────

  describe('executeStrategy', () => {
    it('should throw on unknown strategy type', async () => {
      await expect(
        engine.executeStrategy('unknown' as any, { type: 'unknown' as any }, 'app', '1.0', 'prod')
      ).rejects.toThrow('Unknown deployment strategy');
    });
  });

  // ─── Blue-Green Strategy ──────────────────────────────────────────────────

  describe('blue-green strategy', () => {
    it('should execute blue-green deployment successfully', async () => {
      const result = await engine.executeStrategy(
        'blue-green',
        { type: 'blue-green' },
        'my-app',
        '1.0.0',
        'production'
      );

      expect(result.success).toBe(true);
      expect(result.stages.length).toBe(4);
      expect(result.stages[0].name).toBe('deploy-green');
      expect(result.stages[1].name).toBe('health-check-green');
      expect(result.stages[2].name).toBe('switch-traffic');
      expect(result.stages[3].name).toBe('post-switch-verification');
    });

    it('should complete all stages for blue-green', async () => {
      const result = await engine.executeStrategy(
        'blue-green',
        { type: 'blue-green' },
        'my-app',
        '1.0.0',
        'production'
      );

      for (const stage of result.stages) {
        expect(stage.status).toBe('completed');
      }
    });

    it('should publish traffic switched event for blue-green', async () => {
      await engine.executeStrategy(
        'blue-green',
        { type: 'blue-green' },
        'my-app',
        '1.0.0',
        'production'
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'deployment.traffic_switched',
        expect.objectContaining({
          appName: 'my-app',
          version: '1.0.0',
          strategy: 'blue-green',
          trafficPercentage: 100,
        }),
        expect.any(Object)
      );
    });

    it('should execute all steps within each stage', async () => {
      const result = await engine.executeStrategy(
        'blue-green',
        { type: 'blue-green' },
        'my-app',
        '1.0.0',
        'production'
      );

      for (const stage of result.stages) {
        for (const step of stage.steps) {
          expect(step.status).toBe('completed');
          expect(step.startedAt).toBeDefined();
          expect(step.completedAt).toBeDefined();
        }
      }
    });
  });

  // ─── Canary Strategy ──────────────────────────────────────────────────────

  describe('canary strategy', () => {
    it('should execute canary deployment with default steps [10, 50, 100]', async () => {
      const result = await engine.executeStrategy(
        'canary',
        { type: 'canary' },
        'my-app',
        '1.0.0',
        'staging'
      );

      expect(result.success).toBe(true);
      // deploy-canary + canary-promotion-2 + canary-promotion-3 + final-verification
      expect(result.stages.length).toBe(4);
    });

    it('should execute canary with custom steps', async () => {
      const result = await engine.executeStrategy(
        'canary',
        { type: 'canary', canarySteps: [5, 25, 50, 100] },
        'my-app',
        '1.0.0',
        'staging'
      );

      expect(result.success).toBe(true);
      // deploy-canary + 3 promotions + final-verification = 5
      expect(result.stages.length).toBe(5);
    });

    it('should publish canary promotion events', async () => {
      await engine.executeStrategy(
        'canary',
        { type: 'canary' },
        'my-app',
        '1.0.0',
        'staging'
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'deployment.traffic_switched',
        expect.objectContaining({
          strategy: 'canary',
          trafficPercentage: 10,
        }),
        expect.any(Object)
      );

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'deployment.canary_promoted',
        expect.objectContaining({
          strategy: 'canary',
        }),
        expect.any(Object)
      );
    });
  });

  // ─── Rolling Strategy ─────────────────────────────────────────────────────

  describe('rolling strategy', () => {
    it('should execute rolling deployment successfully', async () => {
      const result = await engine.executeStrategy(
        'rolling',
        { type: 'rolling' },
        'my-app',
        '1.0.0',
        'production'
      );

      expect(result.success).toBe(true);
      expect(result.stages.length).toBe(3);
      expect(result.stages[0].name).toBe('pre-deployment-check');
      expect(result.stages[1].name).toBe('rolling-update');
      expect(result.stages[2].name).toBe('post-deployment-verification');
    });

    it('should create batch steps based on maxUnavailable', async () => {
      const result = await engine.executeStrategy(
        'rolling',
        { type: 'rolling', maxUnavailable: 1 },
        'my-app',
        '1.0.0',
        'production'
      );

      const rollingStage = result.stages[1];
      // 3 replicas / 1 maxUnavailable = 3 batches, each with replace + health-check = 6 steps
      expect(rollingStage.steps.length).toBe(6);
    });

    it('should complete all steps in rolling update', async () => {
      const result = await engine.executeStrategy(
        'rolling',
        { type: 'rolling' },
        'my-app',
        '1.0.0',
        'production'
      );

      for (const stage of result.stages) {
        expect(stage.status).toBe('completed');
        for (const step of stage.steps) {
          expect(step.status).toBe('completed');
        }
      }
    });
  });

  // ─── Recreate Strategy ────────────────────────────────────────────────────

  describe('recreate strategy', () => {
    it('should execute recreate deployment successfully', async () => {
      const result = await engine.executeStrategy(
        'recreate',
        { type: 'recreate' },
        'my-app',
        '1.0.0',
        'dev'
      );

      expect(result.success).toBe(true);
      expect(result.stages.length).toBe(3);
      expect(result.stages[0].name).toBe('scale-down-old-version');
      expect(result.stages[1].name).toBe('deploy-new-version');
      expect(result.stages[2].name).toBe('health-verification');
    });

    it('should complete all stages for recreate', async () => {
      const result = await engine.executeStrategy(
        'recreate',
        { type: 'recreate' },
        'my-app',
        '1.0.0',
        'dev'
      );

      for (const stage of result.stages) {
        expect(stage.status).toBe('completed');
      }
    });
  });

  // ─── switchTraffic ────────────────────────────────────────────────────────

  describe('switchTraffic', () => {
    it('should switch traffic to 100%', async () => {
      const result = await engine.switchTraffic('my-app', 'production', 100);

      expect(result.success).toBe(true);
      expect(result.trafficState.activePercentage).toBe(0);
      expect(result.trafficState.newPercentage).toBe(100);
      expect(result.trafficState.switched).toBe(true);
    });

    it('should switch traffic to partial percentage', async () => {
      const result = await engine.switchTraffic('my-app', 'production', 50);

      expect(result.success).toBe(true);
      expect(result.trafficState.activePercentage).toBe(50);
      expect(result.trafficState.newPercentage).toBe(50);
      expect(result.trafficState.switched).toBe(false);
    });

    it('should default to 100% if no percentage specified', async () => {
      const result = await engine.switchTraffic('my-app', 'production');

      expect(result.trafficState.newPercentage).toBe(100);
      expect(result.trafficState.switched).toBe(true);
    });
  });

  // ─── verifyHealth ─────────────────────────────────────────────────────────

  describe('verifyHealth', () => {
    it('should verify health successfully without base URL', async () => {
      const result = await engine.verifyHealth('my-app', '1.0.0', 'production');

      expect(result.healthy).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should use custom health check config', async () => {
      const result = await engine.verifyHealth('my-app', '1.0.0', 'production', {
        endpoint: '/custom/health',
        expectedStatus: 200,
        timeoutMs: 1000,
        retries: 1,
        retryIntervalMs: 100,
      });

      expect(result.healthy).toBe(true);
    });
  });

  // ─── rollbackTraffic ──────────────────────────────────────────────────────

  describe('rollbackTraffic', () => {
    it('should rollback traffic to 100% old version', async () => {
      const result = await engine.rollbackTraffic('my-app', 'production');

      expect(result.success).toBe(true);
      expect(result.trafficState.activePercentage).toBe(100);
      expect(result.trafficState.newPercentage).toBe(0);
      expect(result.trafficState.switched).toBe(false);
    });
  });

  // ─── getTrafficState ──────────────────────────────────────────────────────

  describe('getTrafficState', () => {
    it('should return undefined when no traffic repo', async () => {
      const result = await engine.getTrafficState('my-app', 'production');
      expect(result).toBeUndefined();
    });
  });

  // ─── Event publishing edge cases ──────────────────────────────────────────

  describe('event publishing', () => {
    it('should not throw when event publisher is not configured', async () => {
      const engineNoPub = new DeploymentStrategyEngine();
      await expect(
        engineNoPub.executeStrategy('blue-green', { type: 'blue-green' }, 'app', '1.0', 'prod')
      ).resolves.toBeDefined();
    });

    it('should not throw when event publisher fails', async () => {
      const failPublisher: IEventPublisher = {
        publish: jest.fn().mockRejectedValue(new Error('publish failed')),
      };
      const engineFail = new DeploymentStrategyEngine({ eventPublisher: failPublisher });

      await expect(
        engineFail.executeStrategy('blue-green', { type: 'blue-green' }, 'app', '1.0', 'prod')
      ).resolves.toBeDefined();
    });
  });
});
