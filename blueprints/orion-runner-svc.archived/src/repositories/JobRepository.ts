/**
 * JobRepository — Runner 任务追踪数据访问层
 *
 * 负责 runner_jobs 表的 CRUD 操作，支持 runner 执行任务的本地追踪，
 * 包括状态变更、执行结果记录、历史查询。
 */

import type { IDbAdapter } from '../db/database';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunnerJob {
  id: string;
  runnerId: string;
  taskId: string;
  tenantId: string;
  taskType: string;
  status: JobStatus;
  parameters?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface JobCreateInput {
  runnerId: string;
  taskId: string;
  tenantId: string;
  taskType: string;
  parameters?: Record<string, unknown>;
}

export class JobRepository {
  constructor(private pool: IDbAdapter) {}

  async create(input: JobCreateInput): Promise<RunnerJob> {
    const id = crypto.randomUUID();
    const now = new Date();
    const result = await this.pool.query(
      `INSERT INTO runner_jobs
       (id, runner_id, task_id, tenant_id, task_type, status, parameters, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        input.runnerId,
        input.taskId,
        input.tenantId,
        input.taskType,
        'pending',
        input.parameters ? JSON.stringify(input.parameters) : null,
        now,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<RunnerJob | null> {
    const result = await this.pool.query('SELECT * FROM runner_jobs WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByRunnerId(runnerId: string, limit = 50): Promise<RunnerJob[]> {
    const result = await this.pool.query(
      'SELECT * FROM runner_jobs WHERE runner_id = $1 ORDER BY created_at DESC LIMIT $2',
      [runnerId, limit],
    );
    return result.rows.map(r => this.mapRow(r));
  }

  async findByStatus(status: JobStatus, limit = 50): Promise<RunnerJob[]> {
    const result = await this.pool.query(
      'SELECT * FROM runner_jobs WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
      [status, limit],
    );
    return result.rows.map(r => this.mapRow(r));
  }

  async findByTenant(tenantId: string, limit = 50): Promise<RunnerJob[]> {
    const result = await this.pool.query(
      'SELECT * FROM runner_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [tenantId, limit],
    );
    return result.rows.map(r => this.mapRow(r));
  }

  async markRunning(id: string): Promise<RunnerJob | null> {
    const result = await this.pool.query(
      `UPDATE runner_jobs SET status = 'running', started_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markComplete(
    id: string,
    output: { result?: Record<string, unknown>; stdout?: string; stderr?: string; exitCode?: number; duration?: number },
  ): Promise<RunnerJob | null> {
    const result = await this.pool.query(
      `UPDATE runner_jobs SET
       status = 'completed',
       result = $2,
       stdout = $3,
       stderr = $4,
       exit_code = $5,
       duration = $6,
       completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        output.result ? JSON.stringify(output.result) : null,
        output.stdout ?? null,
        output.stderr ?? null,
        output.exitCode ?? null,
        output.duration ?? null,
      ],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markFailed(id: string, error: string, stderr?: string, duration?: number): Promise<RunnerJob | null> {
    const result = await this.pool.query(
      `UPDATE runner_jobs SET
       status = 'failed',
       error = $2,
       stderr = $3,
       duration = $4,
       completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, error, stderr ?? null, duration ?? null],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markCancelled(id: string): Promise<RunnerJob | null> {
    const result = await this.pool.query(
      `UPDATE runner_jobs SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM runner_jobs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async countByRunner(runnerId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) FROM runner_jobs WHERE runner_id = $1',
      [runnerId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  private mapRow(row: any): RunnerJob {
    return {
      id: row.id,
      runnerId: row.runner_id,
      taskId: row.task_id,
      tenantId: row.tenant_id,
      taskType: row.task_type,
      status: row.status as JobStatus,
      parameters: row.parameters
        ? (typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters)
        : undefined,
      result: row.result
        ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result)
        : undefined,
      error: row.error,
      stdout: row.stdout,
      stderr: row.stderr,
      exitCode: row.exit_code ?? undefined,
      duration: row.duration ?? undefined,
      createdAt: row.created_at.toISOString(),
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    };
  }
}
