/**
 * Comprehensive tests for MiddlewareOpsService
 * Covers: Instance CRUD, Metrics, Connection Pools, Message Queue Stats, Alerts, Health Summary
 */

// Module-level Maps need to be cleared between tests
// Use jest.resetModules + dynamic import for isolation
let MiddlewareOpsService: typeof import('../MiddlewareOpsService').MiddlewareOpsService;

beforeEach(() => {
  jest.resetModules();
  // Re-import after resetModules so module-level Maps are fresh
  MiddlewareOpsService = require('../MiddlewareOpsService').MiddlewareOpsService;
});

describe('MiddlewareOpsService', () => {
  let service: InstanceType<typeof MiddlewareOpsService>;
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';

  beforeEach(() => {
    service = new MiddlewareOpsService();
  });

  // ===== Instance CRUD =====

  describe('createInstance', () => {
    it('should create an instance with all required fields', async () => {
      const result = await service.createInstance(
        { name: 'redis-prod', type: 'redis', host: '10.0.0.1', port: 6379 },
        tenantA,
      );

      expect(result.id).toBeDefined();
      expect(result.name).toBe('redis-prod');
      expect(result.type).toBe('redis');
      expect(result.host).toBe('10.0.0.1');
      expect(result.port).toBe(6379);
      expect(result.tenantId).toBe(tenantA);
      expect(result.status).toBe('healthy');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create an instance with optional fields', async () => {
      const result = await service.createInstance(
        { name: 'kafka-prod', type: 'kafka', host: '10.0.0.2', port: 9092, version: '3.5.0', config: { maxPartitions: 100 } },
        tenantA,
      );

      expect(result.version).toBe('3.5.0');
      expect(result.config).toEqual({ maxPartitions: 100 });
    });

    it('should assign unique IDs to different instances', async () => {
      const inst1 = await service.createInstance({ name: 'a', type: 'redis', host: 'h1', port: 1 }, tenantA);
      const inst2 = await service.createInstance({ name: 'b', type: 'redis', host: 'h2', port: 2 }, tenantA);
      expect(inst1.id).not.toBe(inst2.id);
    });
  });

  describe('getInstance', () => {
    it('should return instance by id', async () => {
      const created = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      const found = await service.getInstance(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('redis-1');
    });

    it('should return undefined for non-existent id', async () => {
      const result = await service.getInstance('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('listInstances', () => {
    it('should list instances for a tenant', async () => {
      await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h1', port: 6379 }, tenantA);
      await service.createInstance({ name: 'kafka-1', type: 'kafka', host: 'h2', port: 9092 }, tenantA);
      await service.createInstance({ name: 'redis-2', type: 'redis', host: 'h3', port: 6379 }, tenantB);

      const result = await service.listInstances(tenantA);
      expect(result).toHaveLength(2);
      expect(result.every((i) => i.tenantId === tenantA)).toBe(true);
    });

    it('should return empty array for tenant with no instances', async () => {
      const result = await service.listInstances('empty-tenant');
      expect(result).toHaveLength(0);
    });

    it('should filter by type', async () => {
      await service.createInstance({ name: 'r1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      await service.createInstance({ name: 'k1', type: 'kafka', host: 'h', port: 9092 }, tenantA);
      await service.createInstance({ name: 'r2', type: 'redis', host: 'h', port: 6379 }, tenantA);

      const result = await service.listInstances(tenantA, { type: 'redis' });
      expect(result).toHaveLength(2);
      expect(result.every((i) => i.type === 'redis')).toBe(true);
    });

    it('should filter by status', async () => {
      const inst = await service.createInstance({ name: 'r1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      await service.createInstance({ name: 'r2', type: 'redis', host: 'h', port: 6379 }, tenantA);
      // Update one to degraded
      await service.updateInstance(inst.id, { status: 'degraded' });

      const result = await service.listInstances(tenantA, { status: 'degraded' });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('degraded');
    });

    it('should filter by both type and status', async () => {
      const inst = await service.createInstance({ name: 'r1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      await service.createInstance({ name: 'k1', type: 'kafka', host: 'h', port: 9092 }, tenantA);
      await service.updateInstance(inst.id, { status: 'unhealthy' });

      const result = await service.listInstances(tenantA, { type: 'redis', status: 'unhealthy' });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('redis');
      expect(result[0].status).toBe('unhealthy');
    });

    it('should respect tenant isolation', async () => {
      await service.createInstance({ name: 'a', type: 'redis', host: 'h', port: 1 }, tenantA);
      await service.createInstance({ name: 'b', type: 'redis', host: 'h', port: 2 }, tenantB);

      const resultA = await service.listInstances(tenantA);
      const resultB = await service.listInstances(tenantB);
      expect(resultA).toHaveLength(1);
      expect(resultB).toHaveLength(1);
      expect(resultA[0].name).toBe('a');
      expect(resultB[0].name).toBe('b');
    });
  });

  describe('updateInstance', () => {
    it('should update instance fields', async () => {
      const created = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      const updated = await service.updateInstance(created.id, { name: 'redis-updated', status: 'degraded' });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('redis-updated');
      expect(updated!.status).toBe('degraded');
      expect(updated!.host).toBe('h'); // unchanged field
    });

    it('should update the updatedAt timestamp', async () => {
      const created = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      // Small delay to ensure different timestamp
      const updated = await service.updateInstance(created.id, { name: 'new' });
      expect(updated!.updatedAt).toBeDefined();
      expect(updated!.updatedAt >= created.updatedAt).toBe(true);
    });

    it('should return undefined for non-existent id', async () => {
      const result = await service.updateInstance('non-existent', { name: 'x' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteInstance', () => {
    it('should delete an existing instance', async () => {
      const created = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      const deleted = await service.deleteInstance(created.id);
      expect(deleted).toBe(true);

      const found = await service.getInstance(created.id);
      expect(found).toBeUndefined();
    });

    it('should return false for non-existent id', async () => {
      const result = await service.deleteInstance('non-existent');
      expect(result).toBe(false);
    });
  });

  // ===== Metrics =====

  describe('recordMetric', () => {
    it('should record a metric with all fields', async () => {
      const inst = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      const metric = await service.recordMetric(
        { middlewareId: inst.id, metricName: 'connections.active', value: 42, unit: 'count' },
        tenantA,
      );

      expect(metric.id).toBeDefined();
      expect(metric.middlewareId).toBe(inst.id);
      expect(metric.metricName).toBe('connections.active');
      expect(metric.value).toBe(42);
      expect(metric.unit).toBe('count');
      expect(metric.tenantId).toBe(tenantA);
      expect(metric.timestamp).toBeDefined();
    });
  });

  describe('listMetrics', () => {
    it('should list all metrics for a tenant', async () => {
      await service.recordMetric({ middlewareId: 'm1', metricName: 'cpu', value: 50, unit: '%' }, tenantA);
      await service.recordMetric({ middlewareId: 'm1', metricName: 'mem', value: 512, unit: 'MB' }, tenantA);
      await service.recordMetric({ middlewareId: 'm2', metricName: 'cpu', value: 30, unit: '%' }, tenantB);

      const result = await service.listMetrics(tenantA);
      expect(result).toHaveLength(2);
    });

    it('should filter by middlewareId', async () => {
      await service.recordMetric({ middlewareId: 'm1', metricName: 'cpu', value: 50, unit: '%' }, tenantA);
      await service.recordMetric({ middlewareId: 'm2', metricName: 'cpu', value: 30, unit: '%' }, tenantA);

      const result = await service.listMetrics(tenantA, { middlewareId: 'm1' });
      expect(result).toHaveLength(1);
      expect(result[0].middlewareId).toBe('m1');
    });

    it('should filter by metricName', async () => {
      await service.recordMetric({ middlewareId: 'm1', metricName: 'cpu', value: 50, unit: '%' }, tenantA);
      await service.recordMetric({ middlewareId: 'm1', metricName: 'mem', value: 512, unit: 'MB' }, tenantA);

      const result = await service.listMetrics(tenantA, { metricName: 'cpu' });
      expect(result).toHaveLength(1);
      expect(result[0].metricName).toBe('cpu');
    });

    it('should sort by timestamp descending', async () => {
      await service.recordMetric({ middlewareId: 'm1', metricName: 'cpu', value: 50, unit: '%' }, tenantA);
      await service.recordMetric({ middlewareId: 'm1', metricName: 'mem', value: 512, unit: 'MB' }, tenantA);

      const result = await service.listMetrics(tenantA);
      // Verify sort is non-ascending by timestamp (newer first)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].timestamp >= result[i + 1].timestamp).toBe(true);
      }
    });

    it('should return empty array when no metrics exist', async () => {
      const result = await service.listMetrics('empty-tenant');
      expect(result).toHaveLength(0);
    });
  });

  // ===== Connection Pools =====

  describe('recordConnectionPool', () => {
    it('should record connection pool stats', async () => {
      const pool = await service.recordConnectionPool(
        { middlewareId: 'm1', poolName: 'default', active: 10, idle: 5, max: 100, waiting: 0 },
        tenantA,
      );

      expect(pool.id).toBeDefined();
      expect(pool.poolName).toBe('default');
      expect(pool.active).toBe(10);
      expect(pool.idle).toBe(5);
      expect(pool.max).toBe(100);
      expect(pool.waiting).toBe(0);
      expect(pool.totalCreated).toBe(15); // active + idle
      expect(pool.totalClosed).toBe(0);
      expect(pool.tenantId).toBe(tenantA);
    });

    it('should trigger critical alert when utilization >= 90%', async () => {
      const inst = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      await service.recordConnectionPool(
        { middlewareId: inst.id, poolName: 'default', active: 90, idle: 5, max: 100, waiting: 10 },
        tenantA,
      );

      const alerts = await service.listAlerts(tenantA);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('connection_pool_exhaustion');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].value).toBe(90);
      expect(alerts[0].threshold).toBe(90);
      expect(alerts[0].middlewareName).toBe('redis-1');
    });

    it('should not trigger alert when utilization < 90%', async () => {
      const inst = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      await service.recordConnectionPool(
        { middlewareId: inst.id, poolName: 'default', active: 50, idle: 10, max: 100, waiting: 0 },
        tenantA,
      );

      const alerts = await service.listAlerts(tenantA);
      expect(alerts).toHaveLength(0);
    });

    it('should not create alert if middleware instance not found', async () => {
      // No instance created, just record pool
      await service.recordConnectionPool(
        { middlewareId: 'non-existent', poolName: 'default', active: 95, idle: 5, max: 100, waiting: 0 },
        tenantA,
      );

      const alerts = await service.listAlerts(tenantA);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('listConnectionPools', () => {
    it('should list pools for a tenant', async () => {
      await service.recordConnectionPool({ middlewareId: 'm1', poolName: 'p1', active: 5, idle: 5, max: 50, waiting: 0 }, tenantA);
      await service.recordConnectionPool({ middlewareId: 'm2', poolName: 'p2', active: 3, idle: 2, max: 30, waiting: 0 }, tenantB);

      const result = await service.listConnectionPools(tenantA);
      expect(result).toHaveLength(1);
      expect(result[0].poolName).toBe('p1');
    });

    it('should filter by middlewareId', async () => {
      await service.recordConnectionPool({ middlewareId: 'm1', poolName: 'p1', active: 5, idle: 5, max: 50, waiting: 0 }, tenantA);
      await service.recordConnectionPool({ middlewareId: 'm2', poolName: 'p2', active: 3, idle: 2, max: 30, waiting: 0 }, tenantA);

      const result = await service.listConnectionPools(tenantA, { middlewareId: 'm1' });
      expect(result).toHaveLength(1);
      expect(result[0].middlewareId).toBe('m1');
    });

    it('should return empty array for tenant with no pools', async () => {
      const result = await service.listConnectionPools('empty-tenant');
      expect(result).toHaveLength(0);
    });
  });

  // ===== Message Queue Stats =====

  describe('recordMqStats', () => {
    it('should record message queue stats', async () => {
      const stats = await service.recordMqStats(
        { middlewareId: 'm1', queueName: 'orders', messageCount: 100, consumerCount: 5, messagesPerSecond: 20, avgLatencyMs: 10, deadLetterCount: 0 },
        tenantA,
      );

      expect(stats.id).toBeDefined();
      expect(stats.queueName).toBe('orders');
      expect(stats.messageCount).toBe(100);
      expect(stats.consumerCount).toBe(5);
      expect(stats.messagesPerSecond).toBe(20);
      expect(stats.avgLatencyMs).toBe(10);
      expect(stats.deadLetterCount).toBe(0);
    });

    it('should trigger warning alert when messageCount > 10000 and <= 50000', async () => {
      const inst = await service.createInstance({ name: 'rabbitmq-1', type: 'rabbitmq', host: 'h', port: 5672 }, tenantA);
      await service.recordMqStats(
        { middlewareId: inst.id, queueName: 'orders', messageCount: 15000, consumerCount: 2, messagesPerSecond: 5, avgLatencyMs: 50, deadLetterCount: 0 },
        tenantA,
      );

      const alerts = await service.listAlerts(tenantA);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('queue_backlog');
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].message).toContain('15000');
      expect(alerts[0].middlewareName).toBe('rabbitmq-1');
    });

    it('should trigger critical alert when messageCount > 50000', async () => {
      const inst = await service.createInstance({ name: 'rabbitmq-1', type: 'rabbitmq', host: 'h', port: 5672 }, tenantA);
      await service.recordMqStats(
        { middlewareId: inst.id, queueName: 'orders', messageCount: 60000, consumerCount: 2, messagesPerSecond: 5, avgLatencyMs: 50, deadLetterCount: 0 },
        tenantA,
      );

      const alerts = await service.listAlerts(tenantA);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].threshold).toBe(10000);
    });

    it('should not trigger alert when messageCount <= 10000', async () => {
      const inst = await service.createInstance({ name: 'rabbitmq-1', type: 'rabbitmq', host: 'h', port: 5672 }, tenantA);
      await service.recordMqStats(
        { middlewareId: inst.id, queueName: 'orders', messageCount: 5000, consumerCount: 2, messagesPerSecond: 5, avgLatencyMs: 50, deadLetterCount: 0 },
        tenantA,
      );

      const alerts = await service.listAlerts(tenantA);
      expect(alerts).toHaveLength(0);
    });

    it('should not create alert if middleware instance not found', async () => {
      await service.recordMqStats(
        { middlewareId: 'non-existent', queueName: 'q', messageCount: 60000, consumerCount: 1, messagesPerSecond: 1, avgLatencyMs: 100, deadLetterCount: 0 },
        tenantA,
      );

      const alerts = await service.listAlerts(tenantA);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('listMqStats', () => {
    it('should list mq stats for a tenant', async () => {
      await service.recordMqStats({ middlewareId: 'm1', queueName: 'q1', messageCount: 10, consumerCount: 1, messagesPerSecond: 1, avgLatencyMs: 5, deadLetterCount: 0 }, tenantA);
      await service.recordMqStats({ middlewareId: 'm2', queueName: 'q2', messageCount: 20, consumerCount: 2, messagesPerSecond: 2, avgLatencyMs: 5, deadLetterCount: 0 }, tenantB);

      const result = await service.listMqStats(tenantA);
      expect(result).toHaveLength(1);
      expect(result[0].queueName).toBe('q1');
    });

    it('should filter by middlewareId', async () => {
      await service.recordMqStats({ middlewareId: 'm1', queueName: 'q1', messageCount: 10, consumerCount: 1, messagesPerSecond: 1, avgLatencyMs: 5, deadLetterCount: 0 }, tenantA);
      await service.recordMqStats({ middlewareId: 'm2', queueName: 'q2', messageCount: 20, consumerCount: 2, messagesPerSecond: 2, avgLatencyMs: 5, deadLetterCount: 0 }, tenantA);

      const result = await service.listMqStats(tenantA, { middlewareId: 'm1' });
      expect(result).toHaveLength(1);
      expect(result[0].middlewareId).toBe('m1');
    });

    it('should return empty array for tenant with no mq stats', async () => {
      const result = await service.listMqStats('empty-tenant');
      expect(result).toHaveLength(0);
    });
  });

  // ===== Alerts =====

  describe('listAlerts', () => {
    it('should list all alerts for a tenant', async () => {
      const inst = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      // Generate two alerts: one pool exhaustion, one queue backlog
      await service.recordConnectionPool({ middlewareId: inst.id, poolName: 'p1', active: 95, idle: 5, max: 100, waiting: 0 }, tenantA);
      await service.recordMqStats({ middlewareId: inst.id, queueName: 'q1', messageCount: 20000, consumerCount: 1, messagesPerSecond: 1, avgLatencyMs: 100, deadLetterCount: 0 }, tenantA);

      const result = await service.listAlerts(tenantA);
      expect(result).toHaveLength(2);
    });

    it('should filter by severity', async () => {
      const inst = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      // Pool exhaustion is always critical
      await service.recordConnectionPool({ middlewareId: inst.id, poolName: 'p1', active: 95, idle: 5, max: 100, waiting: 0 }, tenantA);
      // Queue backlog with 15000 is warning
      await service.recordMqStats({ middlewareId: inst.id, queueName: 'q1', messageCount: 15000, consumerCount: 1, messagesPerSecond: 1, avgLatencyMs: 100, deadLetterCount: 0 }, tenantA);

      const critical = await service.listAlerts(tenantA, { severity: 'critical' });
      expect(critical).toHaveLength(1);
      expect(critical[0].alertType).toBe('connection_pool_exhaustion');

      const warning = await service.listAlerts(tenantA, { severity: 'warning' });
      expect(warning).toHaveLength(1);
      expect(warning[0].alertType).toBe('queue_backlog');
    });

    it('should filter by alertType', async () => {
      const inst = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      await service.recordConnectionPool({ middlewareId: inst.id, poolName: 'p1', active: 95, idle: 5, max: 100, waiting: 0 }, tenantA);
      await service.recordMqStats({ middlewareId: inst.id, queueName: 'q1', messageCount: 20000, consumerCount: 1, messagesPerSecond: 1, avgLatencyMs: 100, deadLetterCount: 0 }, tenantA);

      const result = await service.listAlerts(tenantA, { alertType: 'queue_backlog' });
      expect(result).toHaveLength(1);
      expect(result[0].alertType).toBe('queue_backlog');
    });

    it('should sort alerts by createdAt descending', async () => {
      const inst = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      await service.recordConnectionPool({ middlewareId: inst.id, poolName: 'p1', active: 95, idle: 5, max: 100, waiting: 0 }, tenantA);
      await service.recordMqStats({ middlewareId: inst.id, queueName: 'q1', messageCount: 20000, consumerCount: 1, messagesPerSecond: 1, avgLatencyMs: 100, deadLetterCount: 0 }, tenantA);

      const result = await service.listAlerts(tenantA);
      expect(result[0].createdAt >= result[1].createdAt).toBe(true);
    });

    it('should respect tenant isolation for alerts', async () => {
      const instA = await service.createInstance({ name: 'r-a', type: 'redis', host: 'h', port: 6379 }, tenantA);
      const instB = await service.createInstance({ name: 'r-b', type: 'redis', host: 'h', port: 6379 }, tenantB);
      await service.recordConnectionPool({ middlewareId: instA.id, poolName: 'p', active: 95, idle: 5, max: 100, waiting: 0 }, tenantA);
      await service.recordConnectionPool({ middlewareId: instB.id, poolName: 'p', active: 95, idle: 5, max: 100, waiting: 0 }, tenantB);

      const alertsA = await service.listAlerts(tenantA);
      const alertsB = await service.listAlerts(tenantB);
      expect(alertsA).toHaveLength(1);
      expect(alertsB).toHaveLength(1);
      expect(alertsA[0].middlewareName).toBe('r-a');
      expect(alertsB[0].middlewareName).toBe('r-b');
    });
  });

  describe('deleteAlert', () => {
    it('should delete an existing alert', async () => {
      const inst = await service.createInstance({ name: 'redis-1', type: 'redis', host: 'h', port: 6379 }, tenantA);
      await service.recordConnectionPool({ middlewareId: inst.id, poolName: 'p1', active: 95, idle: 5, max: 100, waiting: 0 }, tenantA);
      const alerts = await service.listAlerts(tenantA);
      expect(alerts).toHaveLength(1);

      const deleted = await service.deleteAlert(alerts[0].id);
      expect(deleted).toBe(true);

      const remaining = await service.listAlerts(tenantA);
      expect(remaining).toHaveLength(0);
    });

    it('should return false for non-existent alert', async () => {
      const result = await service.deleteAlert('non-existent');
      expect(result).toBe(false);
    });
  });

  // ===== Health Summary =====

  describe('getHealthSummary', () => {
    it('should return correct health summary with mixed statuses', async () => {
      const i1 = await service.createInstance({ name: 'r1', type: 'redis', host: 'h', port: 1 }, tenantA);
      const i2 = await service.createInstance({ name: 'r2', type: 'redis', host: 'h', port: 2 }, tenantA);
      const i3 = await service.createInstance({ name: 'r3', type: 'redis', host: 'h', port: 3 }, tenantA);
      const i4 = await service.createInstance({ name: 'r4', type: 'redis', host: 'h', port: 4 }, tenantA);

      await service.updateInstance(i2.id, { status: 'degraded' });
      await service.updateInstance(i3.id, { status: 'unhealthy' });
      // i1 and i4 remain healthy

      // Generate some alerts
      await service.recordConnectionPool({ middlewareId: i3.id, poolName: 'p', active: 95, idle: 5, max: 100, waiting: 0 }, tenantA);

      const summary = await service.getHealthSummary(tenantA);
      expect(summary.totalInstances).toBe(4);
      expect(summary.healthyCount).toBe(2);
      expect(summary.degradedCount).toBe(1);
      expect(summary.unhealthyCount).toBe(1);
      expect(summary.totalAlerts).toBe(1);
      expect(summary.criticalAlerts).toBe(1);
      // healthScore = (2*100 + 1*50 + 1*0) / 4 = 250/4 = 62.5 → round → 63
      expect(summary.healthScore).toBe(63);
    });

    it('should return 100 health score when no instances exist', async () => {
      const summary = await service.getHealthSummary('empty-tenant');
      expect(summary.totalInstances).toBe(0);
      expect(summary.healthyCount).toBe(0);
      expect(summary.degradedCount).toBe(0);
      expect(summary.unhealthyCount).toBe(0);
      expect(summary.totalAlerts).toBe(0);
      expect(summary.criticalAlerts).toBe(0);
      expect(summary.healthScore).toBe(100);
    });

    it('should return 100 health score when all instances healthy', async () => {
      await service.createInstance({ name: 'r1', type: 'redis', host: 'h', port: 1 }, tenantA);
      await service.createInstance({ name: 'r2', type: 'redis', host: 'h', port: 2 }, tenantA);

      const summary = await service.getHealthSummary(tenantA);
      expect(summary.healthScore).toBe(100);
    });

    it('should return 0 health score when all instances unhealthy', async () => {
      const i1 = await service.createInstance({ name: 'r1', type: 'redis', host: 'h', port: 1 }, tenantA);
      const i2 = await service.createInstance({ name: 'r2', type: 'redis', host: 'h', port: 2 }, tenantA);
      await service.updateInstance(i1.id, { status: 'unhealthy' });
      await service.updateInstance(i2.id, { status: 'unhealthy' });

      const summary = await service.getHealthSummary(tenantA);
      expect(summary.healthScore).toBe(0);
    });

    it('should count only critical alerts', async () => {
      const inst = await service.createInstance({ name: 'r1', type: 'redis', host: 'h', port: 1 }, tenantA);
      // Critical: pool exhaustion
      await service.recordConnectionPool({ middlewareId: inst.id, poolName: 'p', active: 95, idle: 5, max: 100, waiting: 0 }, tenantA);
      // Warning: queue backlog
      await service.recordMqStats({ middlewareId: inst.id, queueName: 'q', messageCount: 15000, consumerCount: 1, messagesPerSecond: 1, avgLatencyMs: 50, deadLetterCount: 0 }, tenantA);

      const summary = await service.getHealthSummary(tenantA);
      expect(summary.totalAlerts).toBe(2);
      expect(summary.criticalAlerts).toBe(1);
    });
  });

  // ===== Cross-cutting: multiple middleware types =====

  describe('supported middleware types', () => {
    it('should support all declared middleware types', async () => {
      const types = ['redis', 'kafka', 'rabbitmq', 'mysql', 'postgresql', 'elasticsearch', 'mongodb', 'nginx'] as const;
      for (const type of types) {
        const inst = await service.createInstance({ name: `${type}-1`, type, host: 'localhost', port: 1000 }, tenantA);
        expect(inst.type).toBe(type);
      }
      const all = await service.listInstances(tenantA);
      expect(all).toHaveLength(types.length);
    });
  });
});
