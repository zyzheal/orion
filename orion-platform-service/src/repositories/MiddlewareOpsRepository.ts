/**
 * MiddlewareOpsRepository - PostgreSQL persistence for middleware operations
 *
 * Persists middleware instances, metrics, connection pools, MQ stats, and alerts.
 * Writes are fire-and-forget; reads try DB first then fall back to memory.
 */

import { BaseRepository } from '../db/base-repository';

export interface MiddlewareInstanceEntity {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  host: string;
  port: number;
  status: string;
  version: string | null;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MiddlewareMetricEntity {
  id: string;
  tenantId: string;
  middlewareId: string;
  metricName: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface ConnectionPoolEntity {
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
  timestamp: Date;
}

export interface MqStatsEntity {
  id: string;
  tenantId: string;
  middlewareId: string;
  queueName: string;
  messageCount: number;
  consumerCount: number;
  messagesPerSecond: number;
  avgLatencyMs: number;
  deadLetterCount: number;
  timestamp: Date;
}

export interface MiddlewareAlertEntity {
  id: string;
  tenantId: string;
  middlewareId: string;
  middlewareName: string;
  alertType: string;
  severity: string;
  message: string;
  value: number;
  threshold: number;
  createdAt: Date;
}

export class MiddlewareOpsRepository extends BaseRepository<MiddlewareInstanceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'middleware_instances');
  }

  // ========== Instances ==========

  async saveInstance(instance: Omit<MiddlewareInstanceEntity, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO middleware_instances (id, tenant_id, name, type, host, port, status, version, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, host = EXCLUDED.host, port = EXCLUDED.port, config = EXCLUDED.config, updated_at = now()`,
      [instance.id, instance.tenantId, instance.name, instance.type, instance.host, instance.port, instance.status, instance.version, instance.config ? JSON.stringify(instance.config) : null],
    );
  }

  async findInstancesByTenant(tenantId: string): Promise<MiddlewareInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM middleware_instances WHERE tenant_id = $1 ORDER BY name ASC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapInstanceRow(r));
  }

  async findInstanceById(id: string): Promise<MiddlewareInstanceEntity | null> {
    const result = await this.db.query(`SELECT * FROM middleware_instances WHERE id = $1`, [id]);
    return result.rows.length > 0 ? this.mapInstanceRow(result.rows[0]) : null;
  }

  async deleteInstance(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM middleware_instances WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ========== Metrics ==========

  async saveMetric(metric: Omit<MiddlewareMetricEntity, 'timestamp'>): Promise<void> {
    await this.db.query(
      `INSERT INTO middleware_metrics (id, tenant_id, middleware_id, metric_name, value, unit)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [metric.id, metric.tenantId, metric.middlewareId, metric.metricName, metric.value, metric.unit],
    );
  }

  async findMetricsByTenant(tenantId: string, middlewareId?: string): Promise<MiddlewareMetricEntity[]> {
    if (middlewareId) {
      const result = await this.db.query(
        `SELECT * FROM middleware_metrics WHERE tenant_id = $1 AND middleware_id = $2 ORDER BY timestamp DESC LIMIT 1000`,
        [tenantId, middlewareId],
      );
      return result.rows.map(r => this.mapMetricRow(r));
    }
    const result = await this.db.query(
      `SELECT * FROM middleware_metrics WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT 1000`,
      [tenantId],
    );
    return result.rows.map(r => this.mapMetricRow(r));
  }

  // ========== Alerts ==========

  async saveAlert(alert: Omit<MiddlewareAlertEntity, 'createdAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO middleware_alerts (id, tenant_id, middleware_id, middleware_name, alert_type, severity, message, value, threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [alert.id, alert.tenantId, alert.middlewareId, alert.middlewareName, alert.alertType, alert.severity, alert.message, alert.value, alert.threshold],
    );
  }

  async findAlertsByTenant(tenantId: string): Promise<MiddlewareAlertEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM middleware_alerts WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapAlertRow(r));
  }

  async deleteAlert(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM middleware_alerts WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ========== Row Mappers ==========

  private mapInstanceRow(row: any): MiddlewareInstanceEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type,
      host: row.host,
      port: Number(row.port) || 0,
      status: row.status,
      version: row.version,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  private mapMetricRow(row: any): MiddlewareMetricEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      middlewareId: row.middleware_id,
      metricName: row.metric_name,
      value: Number(row.value) || 0,
      unit: row.unit,
      timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
    };
  }

  private mapAlertRow(row: any): MiddlewareAlertEntity {
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
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  protected mapRowToEntity(row: any): MiddlewareInstanceEntity {
    return this.mapInstanceRow(row);
  }
}
