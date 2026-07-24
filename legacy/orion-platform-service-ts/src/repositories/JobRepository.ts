/**
 * JobRepository - PostgreSQL data access layer for queue jobs
 *
 * Handles CRUD operations and queue-specific queries
 * (priority dequeue, retry scheduling, statistics).
 */

import type {
  Job,
  JobStatus,
  ListJobsOptions,
} from '../models/Job';

export interface JobRepository {
  create(job: Job): Promise<Job>;
  findById(id: string): Promise<Job | undefined>;
  findByTenant(tenantId: string, options?: { limit?: number; offset?: number }): Promise<Job[]>;
  findPending(limit?: number): Promise<Job[]>;
  findByStatus(status: JobStatus, options?: { limit?: number }): Promise<Job[]>;
  update(id: string, updates: Partial<Job>): Promise<Job | undefined>;
  delete(id: string): Promise<boolean>;
  countByStatus(status?: JobStatus): Promise<number>;
  countByOptions(options: ListJobsOptions): Promise<number>;
  getStats(): Promise<Record<string, number>>;
  getAverageTimes(): Promise<{ avgWaitTime: number; avgExecutionTime: number }>;
}

export class PostgresJobRepository implements JobRepository {
  constructor(private db: any) {}

  async create(job: Job): Promise<Job> {
    const query = `
      INSERT INTO queue_jobs (
        id, tenant_id, queue_name, job_type, payload, status, priority,
        max_attempts, attempts, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const now = new Date();
    const result = await this.db.query(query, [
      job.id,
      job.tenantId ?? null,
      job.queueName,
      job.jobType,
      JSON.stringify(job.payload),
      job.status,
      job.priority,
      job.maxAttempts,
      job.attempts,
      now,
      now,
    ]);

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<Job | undefined> {
    const result = await this.db.query(
      'SELECT * FROM queue_jobs WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : undefined;
  }

  async findByTenant(
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Job[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM queue_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );
    return result.rows.map((row: any) => this.mapRow(row));
  }

  /**
   * Find pending jobs ordered by priority (desc) then created_at (asc).
   * Uses FOR UPDATE SKIP LOCKED to avoid concurrent workers picking the same job.
   */
  async findPending(limit: number = 10): Promise<Job[]> {
    const result = await this.db.query(
      `SELECT * FROM queue_jobs
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY priority DESC, created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findByStatus(
    status: JobStatus,
    options?: { limit?: number }
  ): Promise<Job[]> {
    const limit = options?.limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM queue_jobs WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
      [status, limit]
    );
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async update(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }
    if (updates.result !== undefined) {
      fields.push(`result = $${paramIndex}`);
      values.push(updates.result !== null ? JSON.stringify(updates.result) : null);
      paramIndex++;
    }
    if (updates.errorMessage !== undefined) {
      fields.push(`error_message = $${paramIndex}`);
      values.push(updates.errorMessage);
      paramIndex++;
    }
    if (updates.attempts !== undefined) {
      fields.push(`attempts = $${paramIndex}`);
      values.push(updates.attempts);
      paramIndex++;
    }
    if (updates.nextRetryAt !== undefined) {
      fields.push(`next_retry_at = $${paramIndex}`);
      values.push(updates.nextRetryAt);
      paramIndex++;
    }
    if (updates.startedAt !== undefined) {
      fields.push(`started_at = $${paramIndex}`);
      values.push(updates.startedAt);
      paramIndex++;
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex}`);
      values.push(updates.completedAt);
      paramIndex++;
    }
    if (updates.priority !== undefined) {
      fields.push(`priority = $${paramIndex}`);
      values.push(updates.priority);
      paramIndex++;
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);

    values.push(id);
    const query = `UPDATE queue_jobs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const dbResult = await this.db.query(query, values);
    return dbResult.rows.length > 0 ? this.mapRow(dbResult.rows[0]) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM queue_jobs WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async countByStatus(status?: JobStatus): Promise<number> {
    let query: string;
    let params: any[];

    if (status) {
      query = 'SELECT COUNT(*) as count FROM queue_jobs WHERE status = $1';
      params = [status];
    } else {
      query = 'SELECT COUNT(*) as count FROM queue_jobs';
      params = [];
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10) || 0;
  }

  async countByOptions(options: ListJobsOptions): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM queue_jobs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }
    if (options.queueName) {
      query += ` AND queue_name = $${paramIndex}`;
      params.push(options.queueName);
      paramIndex++;
    }
    if (options.tenantId) {
      query += ` AND tenant_id = $${paramIndex}`;
      params.push(options.tenantId);
      paramIndex++;
    }
    if (options.jobType) {
      query += ` AND job_type = $${paramIndex}`;
      params.push(options.jobType);
      paramIndex++;
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10) || 0;
  }

  async getStats(): Promise<Record<string, number>> {
    const result = await this.db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM queue_jobs
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10) || 0,
      pending: parseInt(row.pending, 10) || 0,
      running: parseInt(row.running, 10) || 0,
      completed: parseInt(row.completed, 10) || 0,
      failed: parseInt(row.failed, 10) || 0,
      cancelled: parseInt(row.cancelled, 10) || 0,
    };
  }

  async getAverageTimes(): Promise<{ avgWaitTime: number; avgExecutionTime: number }> {
    const result = await this.db.query(`
      SELECT
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (started_at - created_at)) * 1000
        ), 0) as avg_wait_ms,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
        ), 0) as avg_exec_ms
      FROM queue_jobs
      WHERE started_at IS NOT NULL AND completed_at IS NOT NULL
    `);

    const row = result.rows[0];
    return {
      avgWaitTime: Math.round(parseFloat(row.avg_wait_ms) || 0),
      avgExecutionTime: Math.round(parseFloat(row.avg_exec_ms) || 0),
    };
  }

  private mapRow(row: any): Job {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      queueName: row.queue_name,
      jobType: row.job_type,
      payload: row.payload ? (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) : {},
      status: row.status as JobStatus,
      priority: row.priority ?? 0,
      result: row.result ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) : null,
      errorMessage: row.error_message,
      maxAttempts: row.max_attempts ?? 3,
      attempts: row.attempts ?? 0,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
