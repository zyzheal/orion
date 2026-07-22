/**
 * DeploymentStrategyService 单元测试
 *
 * GAP-CN-03: 渐进式发布（金丝雀/蓝绿/滚动发布）
 */

import {
  DeploymentStrategyService,
  DeploymentStrategyError,
} from '../DeploymentStrategyService';
import { DeploymentStrategy, CanaryConfig, BlueGreenConfig, RollingConfig } from '../../../models/DeploymentStrategy';

// ============================================================================
// Mock Repositories
// ============================================================================

function createMockStrategyRepository() {
  const strategies = new Map<string, any>();

  return {
    findById: async (id: string) => strategies.get(id) || null,
    findByTenant: async (tenantId: string) =>
      Array.from(strategies.values()).filter(s => s.tenant_id === tenantId),
    findByName: async (tenantId: string, name: string) =>
      Array.from(strategies.values()).find(s => s.tenant_id === tenantId && s.name === name) || null,
    findByType: async (tenantId: string, type: string) =>
      Array.from(strategies.values()).filter(s => s.tenant_id === tenantId && s.type === type),
    create: async (input: any) => {
      const entity = {
        id: 'ds-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        tenant_id: input.tenant_id,
        name: input.name,
        type: input.type,
        config: input.config,
        description: input.description,
        enabled: input.enabled ?? true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      strategies.set(entity.id, entity);
      return entity;
    },
    update: async (id: string, updates: any) => {
      const existing = strategies.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updated_at: new Date() };
      strategies.set(id, updated);
      return updated;
    },
    delete: async (id: string) => strategies.delete(id),
    _clear: () => strategies.clear(),
  };
}

function createMockTrackerRepository() {
  const trackers = new Map<string, any>();
  const healthChecks: any[] = [];

  return {
    findById: async (id: string) => trackers.get(id) || null,
    findByRunId: async (runId: string) => {
      return Array.from(trackers.values()).find(t => t.run_id === runId) || null;
    },
    create: async (input: any) => {
      const tracker = {
        id: 'dst-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        run_id: input.run_id,
        strategy_id: input.strategy_id,
        strategy_type: input.strategy_type,
        current_step: 0,
        total_steps: input.total_steps,
        current_weight: 0,
        status: 'pending',
        rollback_reason: null,
        started_at: new Date(),
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      trackers.set(tracker.id, tracker);
      return tracker;
    },
    advanceStep: async (id: string, step: number, weight: number) => {
      const tracker = trackers.get(id);
      if (!tracker) return null;
      tracker.current_step = step;
      tracker.current_weight = weight;
      tracker.updated_at = new Date();
      trackers.set(id, tracker);
      return tracker;
    },
    updateStatus: async (id: string, status: string, completedAt?: Date) => {
      const tracker = trackers.get(id);
      if (!tracker) return null;
      tracker.status = status;
      tracker.completed_at = completedAt || null;
      tracker.updated_at = new Date();
      trackers.set(id, tracker);
      return tracker;
    },
    setRollbackReason: async (id: string, reason: string) => {
      const tracker = trackers.get(id);
      if (!tracker) return null;
      tracker.rollback_reason = reason;
      tracker.updated_at = new Date();
      trackers.set(id, tracker);
      return tracker;
    },
    recordHealthCheck: async (input: any) => {
      const hc = {
        id: 'hc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        step_tracker_id: input.step_tracker_id,
        step_index: input.step_index,
        endpoint: input.endpoint,
        status_code: input.status_code,
        response_time: input.response_time,
        healthy: input.healthy,
        error_message: input.error_message,
        checked_at: new Date(),
      };
      healthChecks.push(hc);
      return hc;
    },
    getHealthChecks: async (stepTrackerId: string) =>
      healthChecks.filter(hc => hc.step_tracker_id === stepTrackerId),
    getHealthChecksForStep: async (stepTrackerId: string, stepIndex: number) =>
      healthChecks.filter(hc => hc.step_tracker_id === stepTrackerId && hc.step_index === stepIndex),
    isStepHealthy: async (stepTrackerId: string, stepIndex: number) => {
      const checks = healthChecks.filter(
        hc => hc.step_tracker_id === stepTrackerId && hc.step_index === stepIndex
      );
      if (checks.length === 0) return true;
      return checks.every((hc: any) => hc.healthy);
    },
    _clear: () => {
      trackers.clear();
      healthChecks.length = 0;
    },
  };
}

// ============================================================================
// Test Helper: Create service with custom health check behavior
// ============================================================================

function createServiceWithHealthCheck(
  strategyRepo: ReturnType<typeof createMockStrategyRepository>,
  trackerRepo: ReturnType<typeof createMockTrackerRepository>,
  healthCheckBehavior: 'success' | 'fail' | 'fail-at-step1' = 'success'
) {
  class TestableDeploymentStrategyService extends DeploymentStrategyService {
    private callCount = 0;

    protected override async executeHealthCheck(
      endpoint: string,
      timeoutMs: number
    ): Promise<{ statusCode: number | null; errorMessage: string | null }> {
      this.callCount++;

      if (healthCheckBehavior === 'fail') {
        return { statusCode: 503, errorMessage: 'Service unavailable' };
      }

      if (healthCheckBehavior === 'fail-at-step1' && this.callCount > 1) {
        return { statusCode: 503, errorMessage: 'Degraded at step 2' };
      }

      return { statusCode: 200, errorMessage: null };
    }
  }

  return new TestableDeploymentStrategyService(
    strategyRepo as any,
    trackerRepo as any
  );
}

// ============================================================================
// Test Fixtures
// ============================================================================

const canaryConfig: CanaryConfig = {
  steps: [
    { weight: 10, pause: '5m', verification: 'http://localhost:8080/healthz' },
    { weight: 50, pause: '10m', verification: 'http://localhost:8080/healthz' },
    { weight: 100 },
  ],
  autoPromote: true,
  rollbackOnFailure: true,
};

const blueGreenConfig: BlueGreenConfig = {
  activeSlot: 'blue',
  switchMethod: 'instant',
};

const blueGreenGradualConfig: BlueGreenConfig = {
  activeSlot: 'blue',
  switchMethod: 'gradual',
  gradualSteps: [25, 50, 100],
};

const rollingConfig: RollingConfig = {
  batchSize: 2,
  maxUnavailable: 1,
  pauseBetweenBatches: '30s',
};

// ============================================================================
// Tests
// ============================================================================

describe('DeploymentStrategyService — Strategy CRUD', () => {
  let service: DeploymentStrategyService;
  let strategyRepo: ReturnType<typeof createMockStrategyRepository>;
  let trackerRepo: ReturnType<typeof createMockTrackerRepository>;

  beforeEach(() => {
    strategyRepo = createMockStrategyRepository();
    trackerRepo = createMockTrackerRepository();
    service = new DeploymentStrategyService(
      strategyRepo as any,
      trackerRepo as any
    );
  });

  it('should create a canary strategy', async () => {
    const strategy = await service.createStrategy(
      'tenant-1',
      'Canary 10-50-100',
      'canary',
      canaryConfig,
      'Standard canary deployment'
    );

    expect(strategy).toBeDefined();
    expect(strategy.tenantId).toBe('tenant-1');
    expect(strategy.name).toBe('Canary 10-50-100');
    expect(strategy.type).toBe('canary');
    expect(strategy.enabled).toBe(true);
    expect((strategy.config as CanaryConfig).steps).toHaveLength(3);
  });

  it('should create a blue-green strategy', async () => {
    const strategy = await service.createStrategy(
      'tenant-1',
      'BlueGreen Instant',
      'bluegreen',
      blueGreenConfig
    );

    expect(strategy.type).toBe('bluegreen');
    expect((strategy.config as BlueGreenConfig).activeSlot).toBe('blue');
    expect((strategy.config as BlueGreenConfig).switchMethod).toBe('instant');
  });

  it('should create a rolling strategy', async () => {
    const strategy = await service.createStrategy(
      'tenant-1',
      'Rolling 2-per-batch',
      'rolling',
      rollingConfig
    );

    expect(strategy.type).toBe('rolling');
    expect((strategy.config as RollingConfig).batchSize).toBe(2);
  });

  it('should reject canary config with no steps', async () => {
    await expect(
      service.createStrategy('tenant-1', 'Bad Canary', 'canary', {
        steps: [],
      })
    ).rejects.toThrow(DeploymentStrategyError);
  });

  it('should reject canary config with non-increasing weights', async () => {
    await expect(
      service.createStrategy('tenant-1', 'Bad Canary', 'canary', {
        steps: [
          { weight: 50, pause: '5m' },
          { weight: 30, pause: '5m' },
          { weight: 100 },
        ],
      })
    ).rejects.toThrow('Canary step weights must be increasing');
  });

  it('should reject canary config where final step is not 100%', async () => {
    await expect(
      service.createStrategy('tenant-1', 'Bad Canary', 'canary', {
        steps: [
          { weight: 10, pause: '5m' },
          { weight: 50, pause: '5m' },
        ],
      })
    ).rejects.toThrow('Final canary step must have 100% weight');
  });

  it('should reject canary config with weight out of range', async () => {
    await expect(
      service.createStrategy('tenant-1', 'Bad Canary', 'canary', {
        steps: [{ weight: 150, pause: '5m' }, { weight: 100 }],
      })
    ).rejects.toThrow('Canary step weight must be between 0 and 100');
  });

  it('should reject rolling config with batchSize < 1', async () => {
    await expect(
      service.createStrategy('tenant-1', 'Bad Rolling', 'rolling', {
        batchSize: 0,
        maxUnavailable: 1,
      })
    ).rejects.toThrow(DeploymentStrategyError);
  });

  it('should list strategies by tenant', async () => {
    await service.createStrategy('tenant-1', 'Strategy A', 'canary', canaryConfig);
    await service.createStrategy('tenant-1', 'Strategy B', 'bluegreen', blueGreenConfig);
    await service.createStrategy('tenant-2', 'Strategy C', 'canary', canaryConfig);

    const tenant1Strategies = await service.listStrategies('tenant-1');
    expect(tenant1Strategies).toHaveLength(2);
  });

  it('should find strategies by type', async () => {
    await service.createStrategy('tenant-1', 'Canary A', 'canary', canaryConfig);
    await service.createStrategy('tenant-1', 'Canary B', 'canary', canaryConfig);
    await service.createStrategy('tenant-1', 'BlueGreen A', 'bluegreen', blueGreenConfig);

    const canaryStrategies = await service.getStrategiesByType('tenant-1', 'canary');
    expect(canaryStrategies).toHaveLength(2);
  });

  it('should get strategy by ID', async () => {
    const created = await service.createStrategy('tenant-1', 'Test', 'canary', canaryConfig);
    const found = await service.getStrategy(created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Test');
  });

  it('should update a strategy', async () => {
    const created = await service.createStrategy('tenant-1', 'Original', 'canary', canaryConfig);
    const updated = await service.updateStrategy(created.id, {
      name: 'Updated',
      enabled: false,
    });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('Updated');
    expect(updated!.enabled).toBe(false);
  });

  it('should delete a strategy', async () => {
    const created = await service.createStrategy('tenant-1', 'ToDelete', 'canary', canaryConfig);
    const deleted = await service.deleteStrategy(created.id);
    expect(deleted).toBe(true);
    const found = await service.getStrategy(created.id);
    expect(found).toBeNull();
  });
});

describe('DeploymentStrategyService — Canary Deployment', () => {
  let strategyRepo: ReturnType<typeof createMockStrategyRepository>;
  let trackerRepo: ReturnType<typeof createMockTrackerRepository>;

  const deployCalls: number[] = [];
  const stepCompleteCalls: Array<{ step: number; weight: number }> = [];

  beforeEach(() => {
    strategyRepo = createMockStrategyRepository();
    trackerRepo = createMockTrackerRepository();
    deployCalls.length = 0;
    stepCompleteCalls.length = 0;
  });

  it('should execute canary steps sequentially', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await service.createStrategy('tenant-1', 'Canary', 'canary', canaryConfig);

    const status = await service.executeCanary({
      runId: 'run-1',
      strategyId: strategy.id,
      config: canaryConfig,
      onDeploy: async (weight) => deployCalls.push(weight),
      onStepComplete: async (step, weight) => stepCompleteCalls.push({ step, weight }),
    });

    expect(status.status).toBe('completed');
    expect(status.currentStep).toBe(2);
    expect(status.currentWeight).toBe(100);
    expect(status.totalSteps).toBe(3);
    expect(deployCalls).toEqual([10, 50, 100]);
    expect(stepCompleteCalls).toHaveLength(3);
    expect(stepCompleteCalls[0]).toEqual({ step: 0, weight: 10 });
    expect(stepCompleteCalls[2]).toEqual({ step: 2, weight: 100 });
  });

  it('should record health checks for each step', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await service.createStrategy('tenant-1', 'Canary', 'canary', canaryConfig);

    await service.executeCanary({
      runId: 'run-2',
      strategyId: strategy.id,
      config: canaryConfig,
    });

    const finalStatus = await service.getCurrentStatus('run-2');
    // Each step should have at least one health check
    for (const step of finalStatus.steps) {
      expect(step.healthChecks.length).toBeGreaterThan(0);
    }
  });

  it('should rollback on health check failure when rollbackOnFailure is true', async () => {
    // Fail at step 2 (callCount > 1 means second health check)
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'fail-at-step1');
    const strategy = await service.createStrategy('tenant-1', 'Canary', 'canary', canaryConfig);

    const status = await service.executeCanary({
      runId: 'run-3',
      strategyId: strategy.id,
      config: { ...canaryConfig, rollbackOnFailure: true },
    });

    expect(status.status).toBe('rolledback');
    expect(status.rollbackReason).toContain('Health check failed');
  });

  it('should continue on health check failure when rollbackOnFailure is false', async () => {
    // Use always-fail health check
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'fail');
    const config: CanaryConfig = {
      ...canaryConfig,
      rollbackOnFailure: false,
    };

    const strategy = await service.createStrategy('tenant-1', 'Canary', 'canary', config);

    const status = await service.executeCanary({
      runId: 'run-4',
      strategyId: strategy.id,
      config,
    });

    expect(status.status).toBe('failed');
  });

  it('should track step progress correctly', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await service.createStrategy('tenant-1', 'Canary', 'canary', canaryConfig);

    await service.executeCanary({
      runId: 'run-5',
      strategyId: strategy.id,
      config: canaryConfig,
    });

    const status = await service.getCurrentStatus('run-5');

    expect(status.steps).toHaveLength(3);
    expect(status.steps[0].status).toBe('completed');
    expect(status.steps[1].status).toBe('completed');
    expect(status.steps[2].status).toBe('completed');
  });
});

describe('DeploymentStrategyService — Blue-Green Deployment', () => {
  let strategyRepo: ReturnType<typeof createMockStrategyRepository>;
  let trackerRepo: ReturnType<typeof createMockTrackerRepository>;

  const switchCalls: string[] = [];

  beforeEach(() => {
    strategyRepo = createMockStrategyRepository();
    trackerRepo = createMockTrackerRepository();
    switchCalls.length = 0;
  });

  it('should execute instant blue-green switch', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await service.createStrategy('tenant-1', 'BG Instant', 'bluegreen', blueGreenConfig);

    const status = await service.executeBlueGreen({
      runId: 'run-bg-1',
      strategyId: strategy.id,
      config: blueGreenConfig,
      onSwitch: async (slot) => switchCalls.push(slot),
    });

    expect(status.status).toBe('completed');
    expect(status.strategyType).toBe('bluegreen');
    expect(switchCalls).toContain('green');
  });

  it('should execute gradual blue-green switch', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await service.createStrategy('tenant-1', 'BG Gradual', 'bluegreen', blueGreenGradualConfig);

    const status = await service.executeBlueGreen({
      runId: 'run-bg-2',
      strategyId: strategy.id,
      config: blueGreenGradualConfig,
      onSwitch: async (slot) => switchCalls.push(slot),
    });

    expect(status.status).toBe('completed');
    expect(switchCalls.length).toBe(3); // 25%, 50%, 100%
  });

  it('should rollback if new slot health check fails before switch', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'fail');
    const strategy = await service.createStrategy('tenant-1', 'BG Fail', 'bluegreen', blueGreenConfig);

    const status = await service.executeBlueGreen({
      runId: 'run-bg-3',
      strategyId: strategy.id,
      config: blueGreenConfig,
    });

    expect(status.status).toBe('failed');
    expect(status.rollbackReason).toContain('New slot health check failed');
  });

  it('should rollback during gradual switch on failure', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'fail-at-step1');
    const strategy = await service.createStrategy('tenant-1', 'BG Gradual Fail', 'bluegreen', blueGreenGradualConfig);

    const status = await service.executeBlueGreen({
      runId: 'run-bg-4',
      strategyId: strategy.id,
      config: blueGreenGradualConfig,
    });

    expect(status.status).toBe('rolledback');
    expect(status.rollbackReason).toContain('gradual switch');
  });
});

describe('DeploymentStrategyService — Rolling Deployment', () => {
  let strategyRepo: ReturnType<typeof createMockStrategyRepository>;
  let trackerRepo: ReturnType<typeof createMockTrackerRepository>;

  const batchCalls: number[] = [];

  beforeEach(() => {
    strategyRepo = createMockStrategyRepository();
    trackerRepo = createMockTrackerRepository();
    batchCalls.length = 0;
  });

  it('should execute rolling deployment with batches', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await service.createStrategy('tenant-1', 'Rolling', 'rolling', rollingConfig);

    const status = await service.executeRolling({
      runId: 'run-roll-1',
      strategyId: strategy.id,
      config: rollingConfig,
      totalInstances: 6,
      onBatchComplete: async (batch) => batchCalls.push(batch),
    });

    expect(status.status).toBe('completed');
    expect(status.totalSteps).toBe(3); // 6 instances / 2 per batch = 3 batches
    expect(batchCalls).toEqual([0, 1, 2]);
  });

  it('should rollback on batch health check failure', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'fail');
    const strategy = await service.createStrategy('tenant-1', 'Rolling Fail', 'rolling', rollingConfig);

    const status = await service.executeRolling({
      runId: 'run-roll-2',
      strategyId: strategy.id,
      config: rollingConfig,
      totalInstances: 6,
    });

    expect(status.status).toBe('rolledback');
    expect(status.rollbackReason).toContain('health check failed');
  });

  it('should calculate correct number of batches for uneven division', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await service.createStrategy('tenant-1', 'Rolling Uneven', 'rolling', rollingConfig);

    // 7 instances with batch size 2 = 4 batches (2+2+2+1)
    const status = await service.executeRolling({
      runId: 'run-roll-3',
      strategyId: strategy.id,
      config: rollingConfig,
      totalInstances: 7,
    });

    expect(status.status).toBe('completed');
    expect(status.totalSteps).toBe(4);
  });
});

describe('DeploymentStrategyService — Rollback', () => {
  let service: DeploymentStrategyService;
  let strategyRepo: ReturnType<typeof createMockStrategyRepository>;
  let trackerRepo: ReturnType<typeof createMockTrackerRepository>;

  beforeEach(() => {
    strategyRepo = createMockStrategyRepository();
    trackerRepo = createMockTrackerRepository();
    service = new DeploymentStrategyService(
      strategyRepo as any,
      trackerRepo as any
    );
  });

  it('should rollback a running deployment', async () => {
    const testService = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await testService.createStrategy('tenant-1', 'Canary', 'canary', canaryConfig);

    // Start canary
    await testService.executeCanary({
      runId: 'run-rb-1',
      strategyId: strategy.id,
      config: canaryConfig,
    });

    // Manual rollback
    await service.rollback('run-rb-1', 'Manual rollback by user');

    const status = await service.getCurrentStatus('run-rb-1');
    expect(status.status).toBe('rolledback');
    expect(status.rollbackReason).toBe('Manual rollback by user');
  });

  it('should throw if no tracker found for rollback', async () => {
    await expect(
      service.rollback('nonexistent-run', 'test')
    ).rejects.toThrow(DeploymentStrategyError);
  });

  it('should throw if tracker repo is unavailable for rollback', async () => {
    const noTrackerService = new DeploymentStrategyService(strategyRepo as any, null);
    await expect(
      noTrackerService.rollback('run-1', 'test')
    ).rejects.toThrow('Step tracker repository not available');
  });
});

describe('DeploymentStrategyService — Status Query', () => {
  let service: DeploymentStrategyService;
  let strategyRepo: ReturnType<typeof createMockStrategyRepository>;
  let trackerRepo: ReturnType<typeof createMockTrackerRepository>;

  beforeEach(() => {
    strategyRepo = createMockStrategyRepository();
    trackerRepo = createMockTrackerRepository();
    service = new DeploymentStrategyService(
      strategyRepo as any,
      trackerRepo as any
    );
  });

  it('should return current status after canary deployment', async () => {
    const testService = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await testService.createStrategy('tenant-1', 'Canary', 'canary', canaryConfig);

    await testService.executeCanary({
      runId: 'run-status-1',
      strategyId: strategy.id,
      config: canaryConfig,
    });

    const status = await service.getCurrentStatus('run-status-1');

    expect(status.runId).toBe('run-status-1');
    expect(status.strategyId).toBe(strategy.id);
    expect(status.strategyType).toBe('canary');
    expect(status.currentStep).toBe(2);
    expect(status.currentWeight).toBe(100);
    expect(status.totalSteps).toBe(3);
    expect(status.steps).toHaveLength(3);
  });

  it('should throw if no tracker found for status', async () => {
    await expect(
      service.getCurrentStatus('nonexistent-run')
    ).rejects.toThrow(DeploymentStrategyError);
  });

  it('should return status without DB when repo unavailable', async () => {
    const noTrackerService = new DeploymentStrategyService(strategyRepo as any, null);
    await expect(
      noTrackerService.getCurrentStatus('run-1')
    ).rejects.toThrow('Step tracker repository not available');
  });
});

describe('DeploymentStrategyService — Health Check', () => {
  let strategyRepo: ReturnType<typeof createMockStrategyRepository>;
  let trackerRepo: ReturnType<typeof createMockTrackerRepository>;

  beforeEach(() => {
    strategyRepo = createMockStrategyRepository();
    trackerRepo = createMockTrackerRepository();
  });

  it('should record health check results', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    const strategy = await service.createStrategy('tenant-1', 'Canary', 'canary', canaryConfig);

    const tracker = await trackerRepo.create({
      run_id: 'run-hc-1',
      strategy_id: strategy.id,
      strategy_type: 'canary',
      total_steps: 3,
    });

    const result = await service.runHealthCheck(
      tracker.id,
      0,
      'http://localhost:8080/healthz'
    );

    expect(result).toHaveProperty('healthy');
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('responseTime');
    expect(result).toHaveProperty('errorMessage');
  });

  it('should handle health check errors gracefully', async () => {
    const service = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'fail');
    const strategy = await service.createStrategy('tenant-1', 'Canary', 'canary', canaryConfig);

    const tracker = await trackerRepo.create({
      run_id: 'run-hc-2',
      strategy_id: strategy.id,
      strategy_type: 'canary',
      total_steps: 3,
    });

    const result = await service.runHealthCheck(
      tracker.id,
      0,
      'http://localhost:9999/healthz'
    );

    expect(result.healthy).toBe(false);
    expect(result.errorMessage).toBe('Service unavailable');
    expect(result.statusCode).toBe(503);
  });
});

describe('DeploymentStrategyService — DB Unavailable', () => {
  let strategyRepo: ReturnType<typeof createMockStrategyRepository>;

  beforeEach(() => {
    strategyRepo = createMockStrategyRepository();
  });

  it('should throw when strategy repo is unavailable', async () => {
    const service = new DeploymentStrategyService(null, null);
    await expect(
      service.createStrategy('tenant-1', 'Test', 'canary', canaryConfig)
    ).rejects.toThrow('Database not available');
  });

  it('should return empty list when strategy repo is unavailable', async () => {
    const service = new DeploymentStrategyService(null, null);
    const result = await service.listStrategies('tenant-1');
    expect(result).toEqual([]);
  });

  it('should return null when getting strategy with unavailable repo', async () => {
    const service = new DeploymentStrategyService(null, null);
    const result = await service.getStrategy('some-id');
    expect(result).toBeNull();
  });

  it('should throw when executing canary without tracker repo', async () => {
    const service = new DeploymentStrategyService(strategyRepo as any, null);
    await expect(
      service.executeCanary({
        runId: 'run-1',
        strategyId: 'ds-1',
        config: canaryConfig,
      })
    ).rejects.toThrow('Step tracker repository not available');
  });

  it('should throw when getting status without tracker repo', async () => {
    const service = new DeploymentStrategyService(strategyRepo as any, null);
    await expect(
      service.getCurrentStatus('run-1')
    ).rejects.toThrow('Step tracker repository not available');
  });
});

describe('DeploymentStrategyService — Duration Parsing', () => {
  let service: DeploymentStrategyService;
  let strategyRepo: ReturnType<typeof createMockStrategyRepository>;
  let trackerRepo: ReturnType<typeof createMockTrackerRepository>;

  beforeEach(() => {
    strategyRepo = createMockStrategyRepository();
    trackerRepo = createMockTrackerRepository();
    service = new DeploymentStrategyService(
      strategyRepo as any,
      trackerRepo as any
    );
  });

  it('should correctly handle various pause durations', async () => {
    const testService = createServiceWithHealthCheck(strategyRepo, trackerRepo, 'success');
    // This verifies the parseDuration method indirectly
    // by checking that canary with various pause values doesn't throw
    const configWithVariousDurations: CanaryConfig = {
      steps: [
        { weight: 10, pause: '30s' },
        { weight: 50, pause: '5m' },
        { weight: 100, pause: '1h' },
      ],
      rollbackOnFailure: true,
    };

    const strategy = await testService.createStrategy(
      'tenant-1',
      'Various Durations',
      'canary',
      configWithVariousDurations
    );

    // Should not throw even with various durations
    const status = await testService.executeCanary({
      runId: 'run-duration',
      strategyId: strategy.id,
      config: configWithVariousDurations,
    });

    expect(status.status).toBe('completed');
  });
});
