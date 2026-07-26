/**
 * Federation Repository - PostgreSQL Implementation
 *
 * Executor and ExecutorHealth repositories using PostgreSQL.
 * Used by FederationService.
 */

import { DatabasePool } from '../utils/database';

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

export interface ExecutorHealthEntity {
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

export class ExecutorRepository {
  constructor(private pool: DatabasePool) {}

  async create(data: Partial<ExecutorEntity> & { id: string }): Promise<ExecutorEntity> {
    const result = await this.pool.query(
      `INSERT INTO federation_executors (id, cluster_id, name, region, status, cpu_capacity, memory_capacity_mb, cpu_used, memory_used_mb, running_jobs, max_concurrent_jobs, last_heartbeat, registered_at, labels)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        data.id,
        data.cluster_id || '',
        data.name || '',
        data.region || '',
        data.status || 'online',
        data.cpu_capacity || 16,
        data.memory_capacity_mb || 32768,
        data.cpu_used || 0,
        data.memory_used_mb || 0,
        data.running_jobs || 0,
        data.max_concurrent_jobs || 10,
        data.last_heartbeat || new Date(),
        data.registered_at || new Date(),
        JSON.stringify(data.labels || {}),
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<ExecutorEntity | null> {
    const result = await this.pool.query('SELECT * FROM federation_executors WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findAll(options?: { limit?: number }): Promise<{ entities: ExecutorEntity[] }> {
    const limit = options?.limit || 100;
    const result = await this.pool.query('SELECT * FROM federation_executors LIMIT $1', [limit]);
    return { entities: result.rows.map(this.mapRow) };
  }

  async findAllActive(): Promise<ExecutorEntity[]> {
    const result = await this.pool.query('SELECT * FROM federation_executors WHERE status = $1', ['online']);
    return result.rows.map(this.mapRow);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM federation_executors WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async updateHeartbeat(id: string, data: { cpu_used?: number; memory_used_mb?: number; running_jobs?: number }): Promise<boolean> {
    const updates: string[] = ['last_heartbeat = NOW()'];
    const params: unknown[] = [id];
    let paramIndex = 2;

    if (data.cpu_used !== undefined) {
      updates.push(`cpu_used = $${paramIndex++}`);
      params.push(data.cpu_used);
    }
    if (data.memory_used_mb !== undefined) {
      updates.push(`memory_used_mb = $${paramIndex++}`);
      params.push(data.memory_used_mb);
    }
    if (data.running_jobs !== undefined) {
      updates.push(`running_jobs = $${paramIndex++}`);
      params.push(data.running_jobs);
    }

    const result = await this.pool.query(
      `UPDATE federation_executors SET ${updates.join(', ')} WHERE id = $1`,
      params
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: Record<string, unknown>): ExecutorEntity {
    return {
      id: row.id as string,
      cluster_id: row.cluster_id as string,
      name: row.name as string,
      region: row.region as string,
      status: row.status as string,
      cpu_capacity: row.cpu_capacity as number,
      memory_capacity_mb: row.memory_capacity_mb as number,
      cpu_used: row.cpu_used as number,
      memory_used_mb: row.memory_used_mb as number,
      running_jobs: row.running_jobs as number,
      max_concurrent_jobs: row.max_concurrent_jobs as number,
      last_heartbeat: row.last_heartbeat ? new Date(row.last_heartbeat as string) : null,
      registered_at: new Date(row.registered_at as string),
      labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : (row.labels || {}),
    };
  }
}

export class ExecutorHealthRepository {
  constructor(private pool: DatabasePool) {}

  async upsert(data: Partial<ExecutorHealthEntity> & { executor_id: string }): Promise<ExecutorHealthEntity> {
    const result = await this.pool.query(
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
         errors_last_hour = EXCLUDED.errors_last_hour
       RETURNING *`,
      [
        data.executor_id,
        data.status || 'healthy',
        data.cpu_usage_pct || 0,
        data.memory_usage_pct || 0,
        data.running_jobs || 0,
        data.queue_depth || 0,
        data.last_heartbeat || new Date(),
        data.response_time_ms || 0,
        data.errors_last_hour || 0,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByExecutor(executorId: string): Promise<ExecutorHealthEntity | null> {
    const result = await this.pool.query('SELECT * FROM federation_executor_health WHERE executor_id = $1', [executorId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findAllLatest(): Promise<ExecutorHealthEntity[]> {
    const result = await this.pool.query('SELECT * FROM federation_executor_health');
    return result.rows.map(this.mapRow);
  }

  private mapRow(row: Record<string, unknown>): ExecutorHealthEntity {
    return {
      executor_id: row.executor_id as string,
      status: row.status as string,
      cpu_usage_pct: row.cpu_usage_pct as number,
      memory_usage_pct: row.memory_usage_pct as number,
      running_jobs: row.running_jobs as number,
      queue_depth: row.queue_depth as number,
      last_heartbeat: new Date(row.last_heartbeat as string),
      response_time_ms: row.response_time_ms as number,
      errors_last_hour: row.errors_last_hour as number,
    };
  }
}