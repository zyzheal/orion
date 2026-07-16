/**
 * Metric Storage Repository
 *
 * Data access layer for metric_registry and metric_data_points tables.
 * Replaces Map-based storage in MetricCollector with PostgreSQL persistence.
 */

import { DatabasePool } from '../database';
import { MetricQuery } from './MetricCollector';
import { MetricAggregation, DataPoint, MetricSeries } from './types';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

// ==================== Registry Types ====================

export interface MetricRegistryRecord {
  id: string;
  tenant_id: string;
  name: string;
  unit: string;
  default_tags: Record<string, string>;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMetricRegistryInput {
  tenant_id?: string;
  name: string;
  unit: string;
  default_tags?: Record<string, string>;
  description?: string;
}

// ==================== Data Point Types ====================

export interface MetricDataPointRecord {
  id: number;
  tenant_id: string;
  metric_name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

export interface InsertDataPointInput {
  tenant_id?: string;
  metric_name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

// ==================== Repository Interface ====================

export interface MetricStorageRepository {
  // Registry operations
  registerMetric(input: CreateMetricRegistryInput): Promise<MetricRegistryRecord>;
  unregisterMetric(name: string): Promise<boolean>;
  getAllRegisteredMetrics(): Promise<string[]>;
  getMetricRegistry(name: string): Promise<MetricRegistryRecord | null>;

  // Data point operations
  insertDataPoint(input: InsertDataPointInput): Promise<void>;
  queryMetricSeries(query: MetricQuery, tenantId?: string): Promise<MetricSeries>;
  getLatestValue(name: string, tags?: Record<string, string>, tenantId?: string): Promise<number | null>;

  // Maintenance
  pruneExpired(retentionMs: number, tenantId?: string): Promise<number>;
  clearAll(tenantId?: string): Promise<void>;
}

// ==================== PostgreSQL Implementation ====================

export class PostgresMetricStorageRepository implements MetricStorageRepository {
  constructor(private pool: DatabasePool) {}

  async registerMetric(input: CreateMetricRegistryInput): Promise<MetricRegistryRecord> {
    const tenantId = input.tenant_id || getCurrentTenantId();
    const defaultTags = input.default_tags || {};
    const result = await this.pool.query(
      `INSERT INTO metric_registry (tenant_id, name, unit, default_tags, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET
         unit = EXCLUDED.unit,
         default_tags = EXCLUDED.default_tags,
         description = EXCLUDED.description,
         updated_at = NOW()
       RETURNING *`,
      [tenantId, input.name, input.unit, JSON.stringify(defaultTags), input.description || null]
    );
    return this.mapRegistryRow(result.rows[0]);
  }

  async unregisterMetric(name: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM metric_registry WHERE name = $1',
      [name]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getAllRegisteredMetrics(): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT name FROM metric_registry ORDER BY created_at DESC'
    );
    return result.rows.map((row: any) => row.name);
  }

  async getMetricRegistry(name: string): Promise<MetricRegistryRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM metric_registry WHERE name = $1',
      [name]
    );
    return result.rows.length > 0 ? this.mapRegistryRow(result.rows[0]) : null;
  }

  async insertDataPoint(input: InsertDataPointInput): Promise<void> {
    const tenantId = input.tenant_id || getCurrentTenantId();
    const tags = input.tags || {};
    const timestamp = input.timestamp || new Date();
    await this.pool.query(
      `INSERT INTO metric_data_points (tenant_id, metric_name, value, tags, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, input.metric_name, input.value, JSON.stringify(tags), timestamp]
    );
  }

  async queryMetricSeries(query: MetricQuery, tenantId?: string): Promise<MetricSeries> {
    const conditions: string[] = ['metric_name = $1'];
    const params: any[] = [query.name];
    let paramIndex = 2;

    if (tenantId) {
      conditions.push(`tenant_id = $${paramIndex}`);
      params.push(tenantId);
      paramIndex++;
    }

    if (query.startTime) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(query.startTime);
      paramIndex++;
    }

    if (query.endTime) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(query.endTime);
      paramIndex++;
    }

    // Tag filtering using JSONB containment
    if (query.tags && Object.keys(query.tags).length > 0) {
      conditions.push(`tags @> $${paramIndex}`);
      params.push(JSON.stringify(query.tags));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const dataResult = await this.pool.query(
      `SELECT value, timestamp FROM metric_data_points
       WHERE ${whereClause}
       ORDER BY timestamp ASC`,
      params
    );

    const points: DataPoint[] = dataResult.rows.map((row: any) => ({
      timestamp: new Date(row.timestamp),
      value: row.value,
    }));

    // Apply max points limit (sampling)
    let sampledPoints = points;
    if (query.maxPoints && points.length > query.maxPoints) {
      const step = Math.ceil(points.length / query.maxPoints);
      sampledPoints = [];
      for (let i = 0; i < points.length && sampledPoints.length < query.maxPoints; i += step) {
        sampledPoints.push(points[i]);
      }
    }

    const values = sampledPoints.map(p => p.value);
    const aggregation = this.computeAggregation(values);

    const windowStart = sampledPoints.length > 0 ? sampledPoints[0].timestamp : new Date();
    const windowEnd = sampledPoints.length > 0 ? sampledPoints[sampledPoints.length - 1].timestamp : new Date();

    return {
      name: query.name,
      dataPoints: sampledPoints,
      aggregation,
      tags: query.tags,
      windowStart,
      windowEnd,
    };
  }

  async getLatestValue(name: string, tags?: Record<string, string>, tenantId?: string): Promise<number | null> {
    const conditions: string[] = ['metric_name = $1'];
    const params: any[] = [name];
    let paramIndex = 2;

    if (tenantId) {
      conditions.push(`tenant_id = $${paramIndex}`);
      params.push(tenantId);
      paramIndex++;
    }

    if (tags && Object.keys(tags).length > 0) {
      conditions.push(`tags @> $${paramIndex}`);
      params.push(JSON.stringify(tags));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await this.pool.query(
      `SELECT value FROM metric_data_points
       WHERE ${whereClause}
       ORDER BY timestamp DESC
       LIMIT 1`,
      params
    );

    return result.rows.length > 0 ? result.rows[0].value : null;
  }

  async pruneExpired(retentionMs: number, tenantId?: string): Promise<number> {
    const cutoff = new Date(Date.now() - retentionMs);
    const conditions: string[] = ['timestamp < $1'];
    const params: any[] = [cutoff];

    if (tenantId) {
      conditions.push(`tenant_id = $2`);
      params.push(tenantId);
    }

    const whereClause = conditions.join(' AND ');

    const result = await this.pool.query(
      `DELETE FROM metric_data_points WHERE ${whereClause}`,
      params
    );
    return result.rowCount || 0;
  }

  async clearAll(tenantId?: string): Promise<void> {
    if (tenantId) {
      await this.pool.query('DELETE FROM metric_data_points WHERE tenant_id = $1', [tenantId]);
      await this.pool.query('DELETE FROM metric_registry WHERE tenant_id = $1', [tenantId]);
    } else {
      await this.pool.query('TRUNCATE metric_data_points, metric_registry');
    }
  }

  // ==================== Private Helpers ====================

  private mapRegistryRow(row: any): MetricRegistryRecord {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      unit: row.unit,
      default_tags: row.default_tags || {},
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private computeAggregation(values: number[]): MetricAggregation {
    if (values.length === 0) {
      return { avg: 0, max: 0, min: 0, p99: 0, p95: 0, count: 0, sum: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;

    return {
      avg: Math.round(avg * 100) / 100,
      max: sorted[sorted.length - 1],
      min: sorted[0],
      p99: this.percentile(sorted, 99),
      p95: this.percentile(sorted, 95),
      count: values.length,
      sum: Math.round(sum * 100) / 100,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}
