/**
 * Middleware Operations Service (Phase 4 - Middleware Operations)
 * Middleware health monitoring, connection pool management, message queue tracking
 *
 * Persistence strategy:
 * - Writes: fire-and-forget to PostgreSQL (non-blocking), always update in-memory Map
 * - Reads: try DB first, fall back to in-memory Map on DB failure
 * - Startup: load from DB to hydrate in-memory Maps
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { MiddlewareOpsRepository } from '../../repositories/MiddlewareOpsRepository';

const logger = createLogger('MiddlewareOpsService');

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

// Ephemeral data (not persisted — connection pools, MQ stats are time-series snapshots)
const connectionPools = new Map<string, ConnectionPool>();
const mqStats = new Map<string, MessageQueueStats>();

export class MiddlewareOpsService {
  private instances = new Map<string, MiddlewareInstance>();
  private metrics = new Map<string, MiddlewareMetric>();
  private alerts = new Map<string, MiddlewareAlert>();
  private repo?: MiddlewareOpsRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repo = new MiddlewareOpsRepository(db);
      this.loadFromDb().catch(err => {
        logger.warn({ err }, 'Failed to load middleware data from DB on startup');
      });
    }
  }

  private async loadFromDb(): Promise<void> {
    if (!this.repo) return;
    try {
      // We need to load all tenants' data on startup
      // Using raw queries since findInstancesByTenant requires a specific tenantId
      const instanceResult = await this.repo['db'].query(
        `SELECT * FROM middleware_instances ORDER BY name ASC`,
      );
      for (const row of instanceResult.rows) {
        const instance = this.mapInstanceRow(row);
        this.instances.set(instance.id, instance);
      }

      const alertResult = await this.repo['db'].query(
        `SELECT * FROM middleware_alerts ORDER BY created_at DESC`,
      );
      for (const row of alertResult.rows) {
        const alert = this.mapAlertRow(row);
        this.alerts.set(alert.id, alert);
      }

      logger.info({
        instances: this.instances.size,
        alerts: this.alerts.size,
      }, 'Loaded middleware data from DB');
    } catch (err) {
      logger.warn({ err }, 'Failed to load middleware data from DB');
    }
  }

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
    this.instances.set(instance.id, instance);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveInstance({
        id: instance.id,
        tenantId: instance.tenantId,
        name: instance.name,
        type: instance.type,
        host: instance.host,
        port: instance.port,
        status: instance.status,
        version: instance.version ?? null,
        config: instance.config ?? null,
      }).catch(err => {
        logger.warn({ err, instanceId: instance.id }, 'Failed to persist middleware instance to DB');
      });
    }

    return instance;
  }

  async listInstances(tenantId: string, params?: { type?: string; status?: string }): Promise<MiddlewareInstance[]> {
    if (this.repo) {
      try {
        const rows = await this.repo.findInstancesByTenant(tenantId);
        let result = rows.map(r => ({
          id: r.id,
          tenantId: r.tenantId,
          name: r.name,
          type: r.type as MiddlewareInstance['type'],
          host: r.host,
          port: r.port,
          status: r.status as MiddlewareInstance['status'],
          version: r.version ?? undefined,
          config: r.config ?? undefined,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
        }));
        if (params?.type) result = result.filter((i) => i.type === params.type);
        if (params?.status) result = result.filter((i) => i.status === params.status);
        return result;
      } catch (err) {
        logger.warn({ err, tenantId }, 'DB listInstances failed, falling back to memory');
      }
    }
    let result = Array.from(this.instances.values()).filter((i) => i.tenantId === tenantId);
    if (params?.type) result = result.filter((i) => i.type === params.type);
    if (params?.status) result = result.filter((i) => i.status === params.status);
    return result;
  }

  async getInstance(id: string): Promise<MiddlewareInstance | undefined> {
    return this.instances.get(id);
  }

  async updateInstance(id: string, input: Partial<MiddlewareInstance>): Promise<MiddlewareInstance | undefined> {
    const instance = this.instances.get(id);
    if (!instance) return undefined;
    Object.assign(instance, input, { updatedAt: new Date().toISOString() });
    this.instances.set(id, instance);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveInstance({
        id: instance.id,
        tenantId: instance.tenantId,
        name: instance.name,
        type: instance.type,
        host: instance.host,
        port: instance.port,
        status: instance.status,
        version: instance.version ?? null,
        config: instance.config ?? null,
      }).catch(err => {
        logger.warn({ err, instanceId: id }, 'Failed to persist updated middleware instance to DB');
      });
    }

    return instance;
  }

  async deleteInstance(id: string): Promise<boolean> {
    const deleted = this.instances.delete(id);
    if (deleted && this.repo) {
      this.repo.deleteInstance(id).catch(err => {
        logger.warn({ err, instanceId: id }, 'Failed to delete middleware instance from DB');
      });
    }
    return deleted;
  }

  // Metrics
  async recordMetric(input: { middlewareId: string; metricName: string; value: number; unit: string }, tenantId: string): Promise<MiddlewareMetric> {
    const metric: MiddlewareMetric = {
      id: uuidv4(), tenantId, middlewareId: input.middlewareId,
      metricName: input.metricName, value: input.value, unit: input.unit,
      timestamp: new Date().toISOString(),
    };
    this.metrics.set(metric.id, metric);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveMetric({
        id: metric.id,
        tenantId: metric.tenantId,
        middlewareId: metric.middlewareId,
        metricName: metric.metricName,
        value: metric.value,
        unit: metric.unit,
      }).catch(err => {
        logger.warn({ err, metricId: metric.id }, 'Failed to persist metric to DB');
      });
    }

    return metric;
  }

  async listMetrics(tenantId: string, params?: { middlewareId?: string; metricName?: string }): Promise<MiddlewareMetric[]> {
    if (this.repo) {
      try {
        const rows = await this.repo.findMetricsByTenant(tenantId, params?.middlewareId);
        let result = rows.map(r => ({
          id: r.id,
          tenantId: r.tenantId,
          middlewareId: r.middlewareId,
          metricName: r.metricName,
          value: r.value,
          unit: r.unit,
          timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
        }));
        if (params?.metricName) result = result.filter((m) => m.metricName === params.metricName);
        return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      } catch (err) {
        logger.warn({ err, tenantId }, 'DB listMetrics failed, falling back to memory');
      }
    }
    let result = Array.from(this.metrics.values()).filter((m) => m.tenantId === tenantId);
    if (params?.middlewareId) result = result.filter((m) => m.middlewareId === params.middlewareId);
    if (params?.metricName) result = result.filter((m) => m.metricName === params.metricName);
    return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // Connection Pools (ephemeral — not persisted, only in-memory)
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
      const instance = this.instances.get(input.middlewareId);
      if (instance) {
        await this.createAlert({
          tenantId, middlewareId: input.middlewareId, middlewareName: instance.name,
          alertType: 'connection_pool_exhaustion', severity: 'critical',
          message: `连接池 ${input.poolName} 使用率达 ${utilization.toFixed(0)}%`,
          value: utilization, threshold: 90,
        });
      }
    }

    return pool;
  }

  async listConnectionPools(tenantId: string, params?: { middlewareId?: string }): Promise<ConnectionPool[]> {
    let result = Array.from(connectionPools.values()).filter((p) => p.tenantId === tenantId);
    if (params?.middlewareId) result = result.filter((p) => p.middlewareId === params.middlewareId);
    return result;
  }

  // Message Queue Stats (ephemeral — not persisted, only in-memory)
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
      const instance = this.instances.get(input.middlewareId);
      if (instance) {
        await this.createAlert({
          tenantId, middlewareId: input.middlewareId, middlewareName: instance.name,
          alertType: 'queue_backlog',
          severity: input.messageCount > 50000 ? 'critical' : 'warning',
          message: `消息队列 ${input.queueName} 积压 ${input.messageCount} 条`,
          value: input.messageCount, threshold: 10000,
        });
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
  private async createAlert(input: {
    tenantId: string; middlewareId: string; middlewareName: string;
    alertType: MiddlewareAlert['alertType']; severity: MiddlewareAlert['severity'];
    message: string; value: number; threshold: number;
  }): Promise<MiddlewareAlert> {
    const alert: MiddlewareAlert = {
      id: uuidv4(), tenantId: input.tenantId, middlewareId: input.middlewareId,
      middlewareName: input.middlewareName, alertType: input.alertType,
      severity: input.severity, message: input.message,
      value: input.value, threshold: input.threshold,
      createdAt: new Date().toISOString(),
    };
    this.alerts.set(alert.id, alert);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveAlert({
        id: alert.id,
        tenantId: alert.tenantId,
        middlewareId: alert.middlewareId,
        middlewareName: alert.middlewareName,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold,
      }).catch(err => {
        logger.warn({ err, alertId: alert.id }, 'Failed to persist alert to DB');
      });
    }

    return alert;
  }

  async listAlerts(tenantId: string, params?: { severity?: string; alertType?: string }): Promise<MiddlewareAlert[]> {
    if (this.repo) {
      try {
        const rows = await this.repo.findAlertsByTenant(tenantId);
        let result = rows.map(r => ({
          id: r.id,
          tenantId: r.tenantId,
          middlewareId: r.middlewareId,
          middlewareName: r.middlewareName,
          alertType: r.alertType as MiddlewareAlert['alertType'],
          severity: r.severity as MiddlewareAlert['severity'],
          message: r.message,
          value: r.value,
          threshold: r.threshold,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        }));
        if (params?.severity) result = result.filter((a) => a.severity === params.severity);
        if (params?.alertType) result = result.filter((a) => a.alertType === params.alertType);
        return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (err) {
        logger.warn({ err, tenantId }, 'DB listAlerts failed, falling back to memory');
      }
    }
    let result = Array.from(this.alerts.values()).filter((a) => a.tenantId === tenantId);
    if (params?.severity) result = result.filter((a) => a.severity === params.severity);
    if (params?.alertType) result = result.filter((a) => a.alertType === params.alertType);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteAlert(id: string): Promise<boolean> {
    const deleted = this.alerts.delete(id);
    if (deleted && this.repo) {
      this.repo.deleteAlert(id).catch(err => {
        logger.warn({ err, alertId: id }, 'Failed to delete alert from DB');
      });
    }
    return deleted;
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
    const instances = Array.from(this.instances.values()).filter((i) => i.tenantId === tenantId);
    const healthyCount = instances.filter((i) => i.status === 'healthy').length;
    const degradedCount = instances.filter((i) => i.status === 'degraded').length;
    const unhealthyCount = instances.filter((i) => i.status === 'unhealthy').length;
    const alertList = Array.from(this.alerts.values()).filter((a) => a.tenantId === tenantId);
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

  // ========== Row Mappers ==========

  private mapInstanceRow(row: any): MiddlewareInstance {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type,
      host: row.host,
      port: Number(row.port) || 0,
      status: row.status,
      version: row.version ?? undefined,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config ?? undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }

  private mapAlertRow(row: any): MiddlewareAlert {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      middlewareId: row.middleware_id,
      middlewareName: row.middleware_name,
      alertType: row.alert_type,
      severity: row.severity,
      message: row.message,
      value: Number(row.value) || 0,
      threshold: Number(row.threshold) || 0,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }
}
