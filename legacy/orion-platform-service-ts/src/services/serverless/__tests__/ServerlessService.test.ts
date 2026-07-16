/**
 * ServerlessService 单元测试
 *
 * 测试 Serverless 函数生命周期：CRUD、部署、调用、触发器、日志、指标、自动伸缩。
 */

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + (globalThis.__uuidCounter = (globalThis.__uuidCounter || 0) + 1)),
}));

// Use isolateModules to get fresh module-level state for each test
let ServerlessService: any;
let OrionError: any;
let service: any;
const tenantId = 'tenant-1';

function loadService() {
  jest.isolateModules(() => {
    const mod = require('../ServerlessService');
    ServerlessService = mod.ServerlessService;
    // Import OrionError from the same module context
    const errMod = require('../../../errors');
    OrionError = errMod.OrionError;
  });
  service = new ServerlessService();
}

describe('ServerlessService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).__uuidCounter = 0;
    loadService();
  });

  // Helper to create a deployed function
  async function createDeployedFunction(overrides?: Record<string, any>): Promise<any> {
    const fn = await service.createFunction({
      name: 'test-func',
      runtime: 'nodejs18',
      handler: 'index.handler',
      code: 'console.log("hello")',
      ...overrides,
    }, tenantId);
    await service.deployFunction(fn.id, tenantId);
    return fn;
  }

  // ==================== Function CRUD ====================

  describe('createFunction', () => {
    it('should create function with defaults', async () => {
      const fn = await service.createFunction({
        name: 'my-func',
        runtime: 'nodejs18',
        handler: 'index.handler',
        code: 'code',
      }, tenantId);

      expect(fn.name).toBe('my-func');
      expect(fn.runtime).toBe('nodejs18');
      expect(fn.handler).toBe('index.handler');
      expect(fn.status).toBe('draft');
      expect(fn.version).toBe(1);
      expect(fn.memory).toBe(256);
      expect(fn.timeout).toBe(30);
      expect(fn.replicas.min).toBe(0);
      expect(fn.replicas.max).toBe(10);
      expect(fn.replicas.current).toBe(0);
      expect(fn.triggerIds).toEqual([]);
      expect(fn.tenantId).toBe(tenantId);
    });

    it('should create function with custom values', async () => {
      const fn = await service.createFunction({
        name: 'custom-func',
        runtime: 'python3.11',
        handler: 'app.main',
        code: 'code',
        description: 'A custom function',
        memory: 512,
        timeout: 60,
        environment: { KEY: 'value' },
        replicas: { min: 1, max: 5 },
      }, tenantId);

      expect(fn.description).toBe('A custom function');
      expect(fn.memory).toBe(512);
      expect(fn.timeout).toBe(60);
      expect(fn.environment).toEqual({ KEY: 'value' });
      expect(fn.replicas.min).toBe(1);
      expect(fn.replicas.max).toBe(5);
    });
  });

  describe('getFunction', () => {
    it('should return function by id', async () => {
      const created = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const result = await service.getFunction(created.id, tenantId);
      expect(result?.id).toBe(created.id);
    });

    it('should return undefined for non-existent id', async () => {
      const result = await service.getFunction('non-existent', tenantId);
      expect(result).toBeUndefined();
    });

    it('should return undefined for wrong tenant', async () => {
      const created = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const result = await service.getFunction(created.id, 'other-tenant');
      expect(result).toBeUndefined();
    });
  });

  describe('listFunctions', () => {
    beforeEach(async () => {
      await service.createFunction({ name: 'f1', runtime: 'nodejs18', handler: 'h', code: 'c' }, tenantId);
      await service.createFunction({ name: 'f2', runtime: 'python3.11', handler: 'h', code: 'c' }, tenantId);
      await service.createFunction({ name: 'f3', runtime: 'nodejs18', handler: 'h', code: 'c' }, 'other-tenant');
    });

    it('should list functions for tenant', async () => {
      const result = await service.listFunctions(tenantId);
      expect(result).toHaveLength(2);
    });

    it('should filter by runtime', async () => {
      const result = await service.listFunctions(tenantId, { runtime: 'nodejs18' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('f1');
    });

    it('should filter by status', async () => {
      const result = await service.listFunctions(tenantId, { status: 'draft' });
      expect(result).toHaveLength(2);
    });

    it('should return empty for non-existent tenant', async () => {
      const result = await service.listFunctions('nobody');
      expect(result).toHaveLength(0);
    });
  });

  describe('updateFunction', () => {
    it('should update function fields', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const updated = await service.updateFunction(fn.id, tenantId, {
        name: 'updated-func',
        memory: 1024,
        description: 'updated',
      });

      expect(updated?.name).toBe('updated-func');
      expect(updated?.memory).toBe(1024);
      expect(updated?.description).toBe('updated');
    });

    it('should update replicas', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
        replicas: { min: 1, max: 5 },
      }, tenantId);

      const updated = await service.updateFunction(fn.id, tenantId, {
        replicas: { min: 2, max: 10 },
      });

      expect(updated?.replicas.min).toBe(2);
      expect(updated?.replicas.max).toBe(10);
    });

    it('should return undefined for non-existent function', async () => {
      const result = await service.updateFunction('non-existent', tenantId, { name: 'new' });
      expect(result).toBeUndefined();
    });

    it('should return undefined for wrong tenant', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const result = await service.updateFunction(fn.id, 'other-tenant', { name: 'new' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteFunction', () => {
    it('should delete function and associated resources', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      // Create trigger
      await service.createTrigger({
        functionId: fn.id, type: 'http', name: 'trigger', config: {},
      }, tenantId);

      // Deploy
      await service.deployFunction(fn.id, tenantId);

      const result = await service.deleteFunction(fn.id, tenantId);
      expect(result).toBe(true);

      // Verify function is gone
      const retrieved = await service.getFunction(fn.id, tenantId);
      expect(retrieved).toBeUndefined();

      // Verify triggers are gone
      const triggers = await service.listTriggers(tenantId);
      expect(triggers).toHaveLength(0);
    });

    it('should return false for non-existent function', async () => {
      expect(await service.deleteFunction('non-existent', tenantId)).toBe(false);
    });

    it('should return false for wrong tenant', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      expect(await service.deleteFunction(fn.id, 'other-tenant')).toBe(false);
    });
  });

  // ==================== Deployment ====================

  describe('deployFunction', () => {
    it('should deploy function successfully', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
        replicas: { min: 2, max: 10 },
      }, tenantId);

      const deployment = await service.deployFunction(fn.id, tenantId);

      expect(deployment.status).toBe('success');
      expect(deployment.version).toBe(1);
      expect(deployment.completedAt).toBeDefined();

      // Verify function state changed
      const updated = await service.getFunction(fn.id, tenantId);
      expect(updated?.status).toBe('deployed');
      expect(updated?.version).toBe(2);
      expect(updated?.endpoint).toContain('serverless.orion.dev');
      expect(updated?.replicas.current).toBe(2); // min=2
    });

    it('should throw for non-existent function', async () => {
      await expect(service.deployFunction('non-existent', tenantId))
        .rejects.toThrow(OrionError);
    });

    it('should throw for wrong tenant', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      await expect(service.deployFunction(fn.id, 'other-tenant'))
        .rejects.toThrow(OrionError);
    });
  });

  describe('listDeployments', () => {
    it('should list deployments for function', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      await service.deployFunction(fn.id, tenantId);
      await service.deployFunction(fn.id, tenantId);

      const deployments = await service.listDeployments(fn.id, tenantId);
      expect(deployments).toHaveLength(2);
    });

    it('should return empty for function with no deployments', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const deployments = await service.listDeployments(fn.id, tenantId);
      expect(deployments).toHaveLength(0);
    });
  });

  // ==================== Invocation ====================

  describe('invokeFunction', () => {
    it('should invoke deployed function', async () => {
      const fn = await createDeployedFunction();
      const result = await service.invokeFunction(fn.id, tenantId, { key: 'value' });

      expect(result.status).toBe(200);
      expect(result.requestId).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.result).toBeDefined();
    });

    it('should throw for non-existent function', async () => {
      await expect(service.invokeFunction('non-existent', tenantId))
        .rejects.toThrow(OrionError);
    });

    it('should throw for undeployed function', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      await expect(service.invokeFunction(fn.id, tenantId))
        .rejects.toThrow(OrionError);
    });
  });

  // ==================== Triggers ====================

  describe('createTrigger', () => {
    it('should create trigger for function', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const trigger = await service.createTrigger({
        functionId: fn.id,
        type: 'http',
        name: 'api-trigger',
        config: { method: 'GET', path: '/api' },
      }, tenantId);

      expect(trigger.type).toBe('http');
      expect(trigger.name).toBe('api-trigger');
      expect(trigger.enabled).toBe(true);
      expect(trigger.functionId).toBe(fn.id);

      // Verify function has trigger linked
      const updated = await service.getFunction(fn.id, tenantId);
      expect(updated?.triggerIds).toContain(trigger.id);
    });

    it('should throw for non-existent function', async () => {
      await expect(service.createTrigger({
        functionId: 'non-existent', type: 'http', name: 't', config: {},
      }, tenantId)).rejects.toThrow(OrionError);
    });
  });

  describe('listTriggers', () => {
    it('should list triggers for tenant', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      await service.createTrigger({ functionId: fn.id, type: 'http', name: 't1', config: {} }, tenantId);
      await service.createTrigger({ functionId: fn.id, type: 'cron', name: 't2', config: { schedule: '* * * * *' } }, tenantId);

      const triggers = await service.listTriggers(tenantId);
      expect(triggers).toHaveLength(2);
    });

    it('should filter by type', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      await service.createTrigger({ functionId: fn.id, type: 'http', name: 't1', config: {} }, tenantId);
      await service.createTrigger({ functionId: fn.id, type: 'cron', name: 't2', config: {} }, tenantId);

      const triggers = await service.listTriggers(tenantId, { type: 'http' });
      expect(triggers).toHaveLength(1);
    });

    it('should filter by functionId', async () => {
      const fn1 = await service.createFunction({ name: 'f1', runtime: 'nodejs18', handler: 'h', code: 'c' }, tenantId);
      const fn2 = await service.createFunction({ name: 'f2', runtime: 'nodejs18', handler: 'h', code: 'c' }, tenantId);

      await service.createTrigger({ functionId: fn1.id, type: 'http', name: 't1', config: {} }, tenantId);
      await service.createTrigger({ functionId: fn2.id, type: 'http', name: 't2', config: {} }, tenantId);

      const triggers = await service.listTriggers(tenantId, { functionId: fn1.id });
      expect(triggers).toHaveLength(1);
    });
  });

  describe('getTrigger', () => {
    it('should return trigger by id', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const trigger = await service.createTrigger({
        functionId: fn.id, type: 'http', name: 't', config: {},
      }, tenantId);

      const result = await service.getTrigger(trigger.id, tenantId);
      expect(result?.id).toBe(trigger.id);
    });

    it('should return undefined for wrong tenant', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const trigger = await service.createTrigger({
        functionId: fn.id, type: 'http', name: 't', config: {},
      }, tenantId);

      const result = await service.getTrigger(trigger.id, 'other-tenant');
      expect(result).toBeUndefined();
    });
  });

  describe('deleteTrigger', () => {
    it('should delete trigger and unlink from function', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const trigger = await service.createTrigger({
        functionId: fn.id, type: 'http', name: 't', config: {},
      }, tenantId);

      const result = await service.deleteTrigger(trigger.id, tenantId);
      expect(result).toBe(true);

      // Verify trigger is gone
      const retrieved = await service.getTrigger(trigger.id, tenantId);
      expect(retrieved).toBeUndefined();

      // Verify function triggerIds updated
      const updated = await service.getFunction(fn.id, tenantId);
      expect(updated?.triggerIds).not.toContain(trigger.id);
    });

    it('should return false for non-existent trigger', async () => {
      expect(await service.deleteTrigger('non-existent', tenantId)).toBe(false);
    });

    it('should return false for wrong tenant', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const trigger = await service.createTrigger({
        functionId: fn.id, type: 'http', name: 't', config: {},
      }, tenantId);

      expect(await service.deleteTrigger(trigger.id, 'other-tenant')).toBe(false);
    });
  });

  // ==================== Logs ====================

  describe('getFunctionLogs', () => {
    it('should return logs after deployment', async () => {
      const fn = await createDeployedFunction();
      const logs = await service.getFunctionLogs(fn.id, tenantId);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].functionId).toBe(fn.id);
    });

    it('should filter by level', async () => {
      const fn = await createDeployedFunction();
      const logs = await service.getFunctionLogs(fn.id, tenantId, { level: 'info' });

      logs.forEach(l => expect(l.level).toBe('info'));
    });

    it('should respect limit', async () => {
      const fn = await createDeployedFunction();
      const logs = await service.getFunctionLogs(fn.id, tenantId, { limit: 1 });

      expect(logs).toHaveLength(1);
    });
  });

  // ==================== Metrics ====================

  describe('recordMetric', () => {
    it('should record metric', async () => {
      const metric = await service.recordMetric('fn-1', tenantId, {
        invocations: 10, errors: 1, avgDuration: 100,
        p95Duration: 150, p99Duration: 200, avgMemoryUsed: 128,
        throttledRequests: 0, activeConnections: 2, cpuUtilization: 45,
      });

      expect(metric.functionId).toBe('fn-1');
      expect(metric.invocations).toBe(10);
      expect(metric.cpuUtilization).toBe(45);
    });
  });

  describe('getFunctionMetrics', () => {
    it('should return metrics for function', async () => {
      await service.recordMetric('fn-1', tenantId, {
        invocations: 10, errors: 0, avgDuration: 100,
        p95Duration: 150, p99Duration: 200, avgMemoryUsed: 128,
        throttledRequests: 0, activeConnections: 2, cpuUtilization: 45,
      });

      const metrics = await service.getFunctionMetrics('fn-1', tenantId);
      expect(metrics).toHaveLength(1);
    });

    it('should return empty for function with no metrics', async () => {
      const metrics = await service.getFunctionMetrics('fn-nope', tenantId);
      expect(metrics).toHaveLength(0);
    });
  });

  describe('getAggregateMetrics', () => {
    it('should aggregate metrics for tenant', async () => {
      const fn = await service.createFunction({
        name: 'my-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);
      await service.deployFunction(fn.id, tenantId);

      const agg = await service.getAggregateMetrics(tenantId);
      expect(agg.totalFunctions).toBe(1);
      expect(agg.deployedFunctions).toBe(1);
      expect(agg.totalInvocations).toBeGreaterThanOrEqual(0);
    });

    it('should return zeros for tenant with no functions', async () => {
      const agg = await service.getAggregateMetrics('empty-tenant');
      expect(agg.totalFunctions).toBe(0);
      expect(agg.deployedFunctions).toBe(0);
      expect(agg.errorRate).toBe(0);
    });
  });

  // ==================== Auto-scaling ====================

  describe('evaluateAutoScaling', () => {
    it('should suggest scale_down when no metrics', async () => {
      const fn = await createDeployedFunction({ replicas: { min: 0, max: 5 } });
      const results = await service.evaluateAutoScaling(tenantId);

      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('scale_down');
      expect(results[0].reason).toContain('无指标数据');
    });

    it('should suggest scale_up when CPU > 70%', async () => {
      const fn = await createDeployedFunction({ replicas: { min: 1, max: 5 } });

      // Record high CPU metric
      await service.recordMetric(fn.id, tenantId, {
        invocations: 100, errors: 0, avgDuration: 100,
        p95Duration: 150, p99Duration: 200, avgMemoryUsed: 200,
        throttledRequests: 0, activeConnections: 3, cpuUtilization: 80,
      });

      const results = await service.evaluateAutoScaling(tenantId);
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('scale_up');
    });

    it('should suggest scale_down when CPU < 20% and replicas > min', async () => {
      const fn = await createDeployedFunction({ replicas: { min: 0, max: 5 } });

      // Record low CPU metric
      await service.recordMetric(fn.id, tenantId, {
        invocations: 5, errors: 0, avgDuration: 50,
        p95Duration: 80, p99Duration: 100, avgMemoryUsed: 50,
        throttledRequests: 0, activeConnections: 3, cpuUtilization: 10,
      });

      const results = await service.evaluateAutoScaling(tenantId);
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('scale_down');
    });

    it('should suggest no_change when CPU is normal', async () => {
      const fn = await createDeployedFunction({ replicas: { min: 1, max: 5 } });

      await service.recordMetric(fn.id, tenantId, {
        invocations: 50, errors: 0, avgDuration: 100,
        p95Duration: 150, p99Duration: 200, avgMemoryUsed: 128,
        throttledRequests: 0, activeConnections: 2, cpuUtilization: 50,
      });

      const results = await service.evaluateAutoScaling(tenantId);
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('no_change');
    });

    it('should not suggest scale_down when already at min', async () => {
      const fn = await createDeployedFunction({ replicas: { min: 2, max: 5 } });

      // Deployed function has replicas.current = max(min, 1) = 2
      // With low CPU and current=min, should not scale down further
      await service.recordMetric(fn.id, tenantId, {
        invocations: 5, errors: 0, avgDuration: 50,
        p95Duration: 80, p99Duration: 100, avgMemoryUsed: 50,
        throttledRequests: 0, activeConnections: 2, cpuUtilization: 10,
      });

      const results = await service.evaluateAutoScaling(tenantId);
      expect(results[0].action).toBe('no_change');
    });

    it('should return empty for tenant with no deployed functions', async () => {
      await service.createFunction({
        name: 'draft-func', runtime: 'nodejs18', handler: 'h', code: 'c',
      }, tenantId);

      const results = await service.evaluateAutoScaling(tenantId);
      expect(results).toHaveLength(0);
    });
  });
});
