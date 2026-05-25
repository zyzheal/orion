/**
 * Middleware Operations Service (Phase 4 - Middleware Operations)
 * Middleware health monitoring, connection pool management, message queue tracking
 */

import { v4 as uuidv4 } from 'uuid';

export interface MiddlewareInstance {
  id: string;
  tenantId: string;
  name: string;
  type: 'redis' | 'kafka' | 'rabbitmq' | 'mysql' | 'postgresql' | 'elasticsearch' | 'mongodb' | 'nginx';
  host: string;
  port: number;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  version?: string;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MiddlewareMetric {
  id: string;
  tenantId: string;
  middlewareId: string;
  metricName: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface ConnectionPool {
  id: string;
  tenantId: string;
  middlewareId: string;
  poolName: string;
  active: number;
  idle: number;
  max: number;
  waiting: number;
  totalCreated: number;
  totalClosed: number;
  timestamp: string;
}

export interface MessageQueueStats {
  id: string;
  tenantId: string;
  middlewareId: string;
  queueName: string;
  messageCount: number;
  consumerCount: number;
  messagesPerSecond: number;
  avgLatencyMs: number;
  deadLetterCount: number;
  timestamp: string;
}

export interface MiddlewareAlert {
  id: string;
  tenantId: string;
  middlewareId: string;
  middlewareName: string;
  alertType: 'connection_pool_exhaustion' | 'high_latency' | 'queue_backlog' | 'node_down' | 'replication_lag';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  createdAt: string;
}

const middlewareInstances = new Map<string, MiddlewareInstance>();
const metrics = new Map<string, MiddlewareMetric>();
const connectionPools = new Map<string, ConnectionPool>();
const mqStats = new Map<string, MessageQueueStats>();
const alerts = new Map<string, MiddlewareAlert>();

export class MiddlewareOpsService {
  // Instance CRUD
  async createInstance(input: {
    name: string; type: string; host: string; port: number;
    version?: string; config?: Record<string, unknown>;
  }, tenantId: string): Promise<MiddlewareInstance> {
    const instance: MiddlewareInstance = {
      id: uuidv4(), tenantId, name: input.name,
      type: input.type as MiddlewareInstance['type'],
      host: input.host, port: input.port, status: 'healthy',
      version: input.version, config: input.config,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    middlewareInstances.set(instance.id, instance);
    return instance;
  }

  async listInstances(tenantId: string, params?: { type?: string; status?: string }): Promise<MiddlewareInstance[]> {
    let result = Array.from(middlewareInstances.values()).filter((i) => i.tenantId === tenantId);
    if (params?.type) result = result.filter((i) => i.type === params.type);
    if (params?.status) result = result.filter((i) => i.status === params.status);
    return result;
  }

  async getInstance(id: string): Promise<MiddlewareInstance | undefined> {
    return middlewareInstances.get(id);
  }

  async updateInstance(id: string, input: Partial<MiddlewareInstance>): Promise<MiddlewareInstance | undefined> {
    const instance = middlewareInstances.get(id);
    if (!instance) return undefined;
    Object.assign(instance, input, { updatedAt: new Date().toISOString() });
    middlewareInstances.set(id, instance);
    return instance;
  }

  async deleteInstance(id: string): Promise<boolean> {
    return middlewareInstances.delete(id);
  }

  // Metrics
  async recordMetric(input: { middlewareId: string; metricName: string; value: number; unit: string }, tenantId: string): Promise<MiddlewareMetric> {
    const metric: MiddlewareMetric = {
      id: uuidv4(), tenantId, middlewareId: input.middlewareId,
      metricName: input.metricName, value: input.value, unit: input.unit,
      timestamp: new Date().toISOString(),
    };
    metrics.set(metric.id, metric);
    return metric;
  }

  async listMetrics(tenantId: string, params?: { middlewareId?: string; metricName?: string }): Promise<MiddlewareMetric[]> {
    let result = Array.from(metrics.values()).filter((m) => m.tenantId === tenantId);
    if (params?.middlewareId) result = result.filter((m) => m.middlewareId === params.middlewareId);
    if (params?.metricName) result = result.filter((m) => m.metricName === params.metricName);
    return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // Connection Pools
  async recordConnectionPool(input: { middlewareId: string; poolName: string; active: number; idle: number; max: number; waiting: number }, tenantId: string): Promise<ConnectionPool> {
    const pool: ConnectionPool = {
      id: uuidv4(), tenantId, middlewareId: input.middlewareId, poolName: input.poolName,
      active: input.active, idle: input.idle, max: input.max, waiting: input.waiting,
      totalCreated: input.active + input.idle, totalClosed: 0,
      timestamp: new Date().toISOString(),
    };
    connectionPools.set(pool.id, pool);

    // Check for pool exhaustion
    const utilization = (input.active / input.max) * 100;
    if (utilization >= 90) {
      const instance = middlewareInstances.get(input.middlewareId);
      if (instance) {
        const alert: MiddlewareAlert = {
          id: uuidv4(), tenantId, middlewareId: input.middlewareId,
          middlewareName: instance.name, alertType: 'connection_pool_exhaustion',
          severity: 'critical', message: `连接池 ${input.poolName} 使用率达 ${utilization.toFixed(0)}%`,
          value: utilization, threshold: 90, createdAt: new Date().toISOString(),
        };
        alerts.set(alert.id, alert);
      }
    }

    return pool;
  }

  async listConnectionPools(tenantId: string, params?: { middlewareId?: string }): Promise<ConnectionPool[]> {
    let result = Array.from(connectionPools.values()).filter((p) => p.tenantId === tenantId);
    if (params?.middlewareId) result = result.filter((p) => p.middlewareId === params.middlewareId);
    return result;
  }

  // Message Queue Stats
  async recordMqStats(input: { middlewareId: string; queueName: string; messageCount: number; consumerCount: number; messagesPerSecond: number; avgLatencyMs: number; deadLetterCount: number }, tenantId: string): Promise<MessageQueueStats> {
    const stats: MessageQueueStats = {
      id: uuidv4(), tenantId, middlewareId: input.middlewareId, queueName: input.queueName,
      messageCount: input.messageCount, consumerCount: input.consumerCount,
      messagesPerSecond: input.messagesPerSecond, avgLatencyMs: input.avgLatencyMs,
      deadLetterCount: input.deadLetterCount, timestamp: new Date().toISOString(),
    };
    mqStats.set(stats.id, stats);

    // Check for queue backlog
    if (input.messageCount > 10000) {
      const instance = middlewareInstances.get(input.middlewareId);
      if (instance) {
        const alert: MiddlewareAlert = {
          id: uuidv4(), tenantId, middlewareId: input.middlewareId,
          middlewareName: instance.name, alertType: 'queue_backlog',
          severity: input.messageCount > 50000 ? 'critical' : 'warning',
          message: `消息队列 ${input.queueName} 积压 ${input.messageCount} 条`,
          value: input.messageCount, threshold: 10000, createdAt: new Date().toISOString(),
        };
        alerts.set(alert.id, alert);
      }
    }

    return stats;
  }

  async listMqStats(tenantId: string, params?: { middlewareId?: string }): Promise<MessageQueueStats[]> {
    let result = Array.from(mqStats.values()).filter((s) => s.tenantId === tenantId);
    if (params?.middlewareId) result = result.filter((s) => s.middlewareId === params.middlewareId);
    return result;
  }

  // Alerts
  async listAlerts(tenantId: string, params?: { severity?: string; alertType?: string }): Promise<MiddlewareAlert[]> {
    let result = Array.from(alerts.values()).filter((a) => a.tenantId === tenantId);
    if (params?.severity) result = result.filter((a) => a.severity === params.severity);
    if (params?.alertType) result = result.filter((a) => a.alertType === params.alertType);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteAlert(id: string): Promise<boolean> {
    return alerts.delete(id);
  }

  // Health Summary
  async getHealthSummary(tenantId: string): Promise<{
    totalInstances: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    totalAlerts: number;
    criticalAlerts: number;
    healthScore: number;
  }> {
    const instances = Array.from(middlewareInstances.values()).filter((i) => i.tenantId === tenantId);
    const healthyCount = instances.filter((i) => i.status === 'healthy').length;
    const degradedCount = instances.filter((i) => i.status === 'degraded').length;
    const unhealthyCount = instances.filter((i) => i.status === 'unhealthy').length;
    const alertList = Array.from(alerts.values()).filter((a) => a.tenantId === tenantId);
    const criticalAlerts = alertList.filter((a) => a.severity === 'critical').length;

    const healthScore = instances.length > 0
      ? Math.round(((healthyCount * 100 + degradedCount * 50 + unhealthyCount * 0) / instances.length))
      : 100;

    return {
      totalInstances: instances.length,
      healthyCount, degradedCount, unhealthyCount,
      totalAlerts: alertList.length, criticalAlerts, healthScore,
    };
  }
}
