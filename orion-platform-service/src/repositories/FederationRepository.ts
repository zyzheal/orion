/**
 * Federation Repository
 *
 * PostgreSQL persistence for multi-cluster federation.
 */
import { BaseRepository } from '../db/base-repository';

// ==================== Executor ====================

export interface ExecutorEntity {
  id: string;
  cluster_id: string;
  name: string;
  region: string;
  status: string;
  cpu_capacity: number;
  memory_capacity_mb: number;
  cpu_used: number;
  memory_used_mb: number;
  running_jobs: number;
  max_concurrent_jobs: number;
  last_heartbeat: Date | null;
  registered_at: Date;
  labels: Record<string, any>;
}

export class ExecutorRepository extends BaseRepository<ExecutorEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'federation_executors');
  }

  async findAllActive(): Promise<ExecutorEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM federation_executors WHERE status = 'online' ORDER BY name`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByIdWithHealth(id: string): Promise<{ executor: ExecutorEntity; health: ExecutorHealthEntity | null } | undefined> {
    const execResult = await this.db.query(`SELECT * FROM federation_executors WHERE id = $1`, [id]);
    if (execResult.rows.length === 0) return undefined;
    const executor = this.mapRowToEntity(execResult.rows[0]);

    const healthResult = await this.db.query(`SELECT * FROM federation_executor_health WHERE executor_id = $1 ORDER BY last_heartbeat DESC LIMIT 1`, [id]);
    const health = healthResult.rows.length > 0 ? this.mapHealthRow(healthResult.rows[0]) : null;

    return { executor, health };
  }

  async updateHeartbeat(id: string, metrics: { cpu_used?: number; memory_used_mb?: number; running_jobs?: number }): Promise<ExecutorEntity | undefined> {
    const result = await this.db.query(
      `UPDATE federation_executors SET last_heartbeat = NOW(), cpu_used = COALESCE($1, cpu_used), memory_used_mb = COALESCE($2, memory_used_mb), running_jobs = COALESCE($3, running_jobs), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [metrics.cpu_used ?? null, metrics.memory_used_mb ?? null, metrics.running_jobs ?? null, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM federation_executors WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ExecutorEntity {
    return {
      id: row.id,
      cluster_id: row.cluster_id,
      name: row.name,
      region: row.region,
      status: row.status ?? 'online',
      cpu_capacity: row.cpu_capacity ?? 16,
      memory_capacity_mb: row.memory_capacity_mb ?? 32768,
      cpu_used: row.cpu_used ?? 0,
      memory_used_mb: row.memory_used_mb ?? 0,
      running_jobs: row.running_jobs ?? 0,
      max_concurrent_jobs: row.max_concurrent_jobs ?? 10,
      last_heartbeat: row.last_heartbeat,
      registered_at: row.registered_at,
      labels: row.labels ?? {},
    };
  }
}

// ==================== Executor Health ====================

export interface ExecutorHealthEntity {
  id: string;
  executor_id: string;
  status: string;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  running_jobs: number;
  queue_depth: number;
  last_heartbeat: Date;
  response_time_ms: number;
  errors_last_hour: number;
}

export class ExecutorHealthRepository extends BaseRepository<ExecutorHealthEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'federation_executor_health');
  }

  async findByExecutor(executorId: string): Promise<ExecutorHealthEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM federation_executor_health WHERE executor_id = $1 ORDER BY last_heartbeat DESC LIMIT 1`,
      [executorId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapHealthRow(result.rows[0]);
  }

  async findAllLatest(): Promise<ExecutorHealthEntity[]> {
    const result = await this.db.query(
      `SELECT DISTINCT ON (executor_id) * FROM federation_executor_health ORDER BY executor_id, last_heartbeat DESC`,
    );
    return result.rows.map(row => this.mapHealthRow(row));
  }

  async upsert(data: Omit<ExecutorHealthEntity, 'id'>): Promise<ExecutorHealthEntity> {
    const result = await this.db.query(
      `INSERT INTO federation_executor_health (executor_id, status, cpu_usage_pct, memory_usage_pct, running_jobs, queue_depth, last_heartbeat, response_time_ms, errors_last_hour)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (executor_id) DO UPDATE SET
         status = EXCLUDED.status,
         cpu_usage_pct = EXCLUDED.cpu_usage_pct,
         memory_usage_pct = EXCLUDED.memory_usage_pct,
         running_jobs = EXCLUDED.running_jobs,
         queue_depth = EXCLUDED.queue_depth,
         last_heartbeat = EXCLUDED.last_heartbeat,
         response_time_ms = EXCLUDED.response_time_ms,
         errors_last_hour = EXCLUDED.errors_last_hour,
         updated_at = NOW()
       RETURNING *`,
      [data.executor_id, data.status, data.cpu_usage_pct, data.memory_usage_pct, data.running_jobs, data.queue_depth, data.last_heartbeat, data.response_time_ms, data.errors_last_hour],
    );
    return this.mapHealthRow(result.rows[0]);
  }

  private mapHealthRow(row: any): ExecutorHealthEntity {
    return {
      id: row.id,
      executor_id: row.executor_id,
      status: row.status,
      cpu_usage_pct: row.cpu_usage_pct,
      memory_usage_pct: row.memory_usage_pct,
      running_jobs: row.running_jobs,
      queue_depth: row.queue_depth,
      last_heartbeat: row.last_heartbeat,
      response_time_ms: row.response_time_ms,
      errors_last_hour: row.errors_last_hour,
    };
  }
}

// ==================== Cluster Record ====================

export interface ClusterRecordEntity {
  id: string;
  cluster_name: string;
  region: string;
  endpoint: string;
  kube_config_ref: string | null;
  status: string;
  node_count: number | null;
  cpu_capacity: number | null;
  memory_capacity: number | null;
  registered_at: Date;
  last_heartbeat: Date | null;
}

export class ClusterRecordRepository extends BaseRepository<ClusterRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'federation_clusters');
  }

  async findByName(name: string): Promise<ClusterRecordEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM federation_clusters WHERE cluster_name = $1 ORDER BY registered_at DESC LIMIT 1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByStatus(status: string): Promise<ClusterRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM federation_clusters WHERE status = $1 ORDER BY cluster_name`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findAllActive(): Promise<ClusterRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM federation_clusters WHERE status = 'active' ORDER BY cluster_name`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateHeartbeat(id: string): Promise<ClusterRecordEntity | undefined> {
    const result = await this.db.query(
      `UPDATE federation_clusters SET last_heartbeat = NOW(), status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ClusterRecordEntity {
    return {
      id: row.id,
      cluster_name: row.cluster_name,
      region: row.region,
      endpoint: row.endpoint,
      kube_config_ref: row.kube_config_ref,
      status: row.status ?? 'unknown',
      node_count: row.node_count,
      cpu_capacity: row.cpu_capacity,
      memory_capacity: row.memory_capacity,
      registered_at: row.registered_at,
      last_heartbeat: row.last_heartbeat,
    };
  }
}

// ==================== Health Check Result ====================

export interface HealthCheckResultEntity {
  id: string;
  cluster_id: string;
  check_type: string;
  status: string;
  latency_ms: number | null;
  details: Record<string, any> | null;
  checked_at: Date;
}

export class HealthCheckResultRepository extends BaseRepository<HealthCheckResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'federation_health_checks');
  }

  async findByCluster(clusterId: string, limit?: number): Promise<HealthCheckResultEntity[]> {
    let query = `SELECT * FROM federation_health_checks WHERE cluster_id = $1 ORDER BY checked_at DESC`;
    const params: any[] = [clusterId];
    if (limit) {
      query += ` LIMIT $2`;
      params.push(limit);
    }
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async batchCreate(results: Omit<HealthCheckResultEntity, 'id'>[]): Promise<HealthCheckResultEntity[]> {
    const created: HealthCheckResultEntity[] = [];
    for (const r of results) {
      const result = await this.db.query(
        `INSERT INTO federation_health_checks (cluster_id, check_type, status, latency_ms, details, checked_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [r.clusterId, r.check_type, r.status, r.latency_ms, r.details ? JSON.stringify(r.details) : null, r.checked_at],
      );
      created.push(this.mapRowToEntity(result.rows[0]));
    }
    return created;
  }

  protected mapRowToEntity(row: any): HealthCheckResultEntity {
    return {
      id: row.id,
      cluster_id: row.cluster_id,
      check_type: row.check_type,
      status: row.status,
      latency_ms: row.latency_ms,
      details: row.details,
      checked_at: row.checked_at,
    };
  }
}
