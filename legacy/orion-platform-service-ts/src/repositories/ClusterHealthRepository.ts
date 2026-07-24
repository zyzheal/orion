/**
 * ClusterHealthRepository
 *
 * PostgreSQL Repository for cluster health monitoring data.
 * Covers cluster records, health checks, metrics, and anomalies.
 */

import { BaseRepository } from '../db/base-repository';

// ─── Cluster Record ──────────────────────────────────────────────────────

export interface ClusterRecordEntity {
  id: string;
  tenantId: string;
  name: string;
  endpoint: string;
  region: string;
  status: string;
  nodeCount: number;
  lastHealthCheck: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ClusterRecordRepository extends BaseRepository<ClusterRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cluster_records');
  }

  async findByTenantId(tenantId: string): Promise<ClusterRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cluster_records WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateLastHealthCheck(id: string): Promise<void> {
    await this.db.query(
      `UPDATE cluster_records SET last_health_check = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.query(
      `UPDATE cluster_records SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );
  }

  protected mapRowToEntity(row: any): ClusterRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      endpoint: row.endpoint,
      region: row.region,
      status: row.status,
      nodeCount: row.node_count,
      lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

// ─── Health Check ────────────────────────────────────────────────────────

export interface HealthCheckEntity {
  id: string;
  clusterId: string;
  clusterName: string | null;
  status: string;
  apiServerReachable: boolean;
  apiServerLatencyMs: number;
  nodeCount: number;
  nodeReadyCount: number;
  podCount: number;
  cpuUsagePct: number;
  memoryUsagePct: number;
  diskUsagePct: number;
  anomalies: string[];
  checkedAt: Date;
  createdAt: Date;
}

export class ClusterHealthCheckRepository extends BaseRepository<HealthCheckEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cluster_health_checks');
  }

  async findByClusterId(clusterId: string, limit: number = 100): Promise<HealthCheckEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cluster_health_checks WHERE cluster_id = $1 ORDER BY checked_at DESC LIMIT $2`,
      [clusterId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getLatestByClusterId(clusterId: string): Promise<HealthCheckEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cluster_health_checks WHERE cluster_id = $1 ORDER BY checked_at DESC LIMIT 1`,
      [clusterId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): HealthCheckEntity {
    return {
      id: row.id,
      clusterId: row.cluster_id,
      clusterName: row.cluster_name,
      status: row.status,
      apiServerReachable: row.api_server_reachable,
      apiServerLatencyMs: row.api_server_latency_ms,
      nodeCount: row.node_count,
      nodeReadyCount: row.node_ready_count,
      podCount: row.pod_count,
      cpuUsagePct: parseFloat(row.cpu_usage_pct) || 0,
      memoryUsagePct: parseFloat(row.memory_usage_pct) || 0,
      diskUsagePct: parseFloat(row.disk_usage_pct) || 0,
      anomalies: Array.isArray(row.anomalies) ? row.anomalies : JSON.parse(row.anomalies || '[]'),
      checkedAt: row.checked_at ? new Date(row.checked_at) : new Date(),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

// ─── Cluster Metrics ─────────────────────────────────────────────────────

export interface ClusterMetricsEntity {
  id: string;
  clusterId: string;
  clusterName: string | null;
  timeWindow: string;
  cpuUsageAvg: number;
  cpuUsageMax: number;
  memoryUsageAvg: number;
  memoryUsageMax: number;
  networkInBytes: number;
  networkOutBytes: number;
  podCountAvg: number;
  podRestartCount: number;
  errorCount: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
  collectedAt: Date;
  createdAt: Date;
}

export class ClusterMetricsRepository extends BaseRepository<ClusterMetricsEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cluster_metrics');
  }

  async findByClusterId(clusterId: string, timeWindow?: string, limit: number = 200): Promise<ClusterMetricsEntity[]> {
    let query = `SELECT * FROM cluster_metrics WHERE cluster_id = $1`;
    const params: unknown[] = [clusterId];
    let paramIndex = 2;

    if (timeWindow) {
      query += ` AND time_window = $${paramIndex++}`;
      params.push(timeWindow);
    }

    query += ` ORDER BY collected_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getLatestByClusterId(clusterId: string, timeWindow: string): Promise<ClusterMetricsEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cluster_metrics WHERE cluster_id = $1 AND time_window = $2 ORDER BY collected_at DESC LIMIT 1`,
      [clusterId, timeWindow],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ClusterMetricsEntity {
    return {
      id: row.id,
      clusterId: row.cluster_id,
      clusterName: row.cluster_name,
      timeWindow: row.time_window,
      cpuUsageAvg: parseFloat(row.cpu_usage_avg) || 0,
      cpuUsageMax: parseFloat(row.cpu_usage_max) || 0,
      memoryUsageAvg: parseFloat(row.memory_usage_avg) || 0,
      memoryUsageMax: parseFloat(row.memory_usage_max) || 0,
      networkInBytes: parseInt(row.network_in_bytes) || 0,
      networkOutBytes: parseInt(row.network_out_bytes) || 0,
      podCountAvg: row.pod_count_avg,
      podRestartCount: row.pod_restart_count,
      errorCount: row.error_count,
      latencyP50Ms: parseFloat(row.latency_p50_ms) || 0,
      latencyP99Ms: parseFloat(row.latency_p99_ms) || 0,
      collectedAt: row.collected_at ? new Date(row.collected_at) : new Date(),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

// ─── Cluster Anomalies ───────────────────────────────────────────────────

export interface ClusterAnomalyEntity {
  id: string;
  clusterId: string;
  clusterName: string | null;
  anomalyType: string;
  severity: string;
  description: string | null;
  detectedAt: Date;
  metricsSnapshot: Record<string, any>;
  createdAt: Date;
}

export class ClusterAnomalyRepository extends BaseRepository<ClusterAnomalyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cluster_anomalies');
  }

  async findByClusterId(clusterId: string, limit: number = 50): Promise<ClusterAnomalyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cluster_anomalies WHERE cluster_id = $1 ORDER BY detected_at DESC LIMIT $2`,
      [clusterId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findBySeverity(severity: string, limit: number = 50): Promise<ClusterAnomalyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cluster_anomalies WHERE severity = $1 ORDER BY detected_at DESC LIMIT $2`,
      [severity, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async createBatch(anomalies: Array<{
    clusterId: string;
    clusterName: string;
    anomalyType: string;
    severity: string;
    description: string;
    detectedAt: Date;
    metricsSnapshot: Record<string, any>;
  }>): Promise<void> {
    for (const anomaly of anomalies) {
      await this.create({
        id: `${anomaly.clusterId}-${anomaly.anomalyType}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        cluster_id: anomaly.clusterId,
        cluster_name: anomaly.clusterName,
        anomaly_type: anomaly.anomalyType,
        severity: anomaly.severity,
        description: anomaly.description,
        detected_at: anomaly.detectedAt,
        metrics_snapshot: anomaly.metricsSnapshot,
      });
    }
  }

  protected mapRowToEntity(row: any): ClusterAnomalyEntity {
    return {
      id: row.id,
      clusterId: row.cluster_id,
      clusterName: row.cluster_name,
      anomalyType: row.anomaly_type,
      severity: row.severity,
      description: row.description,
      detectedAt: row.detected_at ? new Date(row.detected_at) : new Date(),
      metricsSnapshot: row.metrics_snapshot || {},
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
