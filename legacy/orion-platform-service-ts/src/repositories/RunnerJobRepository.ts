/**
 * RunnerJob Repository — 构建资源池 (GAP-CN-07)
 *
 * 数据访问层，负责 RunnerJob 的 CRUD 和查询操作。
 */

import {
  RunnerJob,
  RunnerJobCreateInput,
  RunnerJobStatus,
} from '../models/RunnerJob';

export interface RunnerJobRepository {
  create(input: RunnerJobCreateInput): Promise<RunnerJob>;
  findById(id: string): Promise<RunnerJob | undefined>;
  findByRunnerId(runnerId: string): Promise<RunnerJob[]>;
  findByStatus(status: RunnerJobStatus): Promise<RunnerJob[]>;
  findByTaskId(taskId: string): Promise<RunnerJob | undefined>;
  markComplete(id: string, result?: Record<string, unknown>): Promise<RunnerJob | undefined>;
  markFailed(id: string, error: string): Promise<RunnerJob | undefined>;
  delete(id: string): Promise<boolean>;
}

export class PostgresRunnerJobRepository implements RunnerJobRepository {
  constructor(private db: any) {}

  async create(input: RunnerJobCreateInput): Promise<RunnerJob> {
    const query = `
      INSERT INTO runner_jobs (
        id, runner_id, task_id, stage_id, run_id, tenant_id, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const id = this.generateId();
    const now = new Date();

    const result = await this.db.query(query, [
      id,
      input.runnerId,
      input.taskId,
      input.stageId || null,
      input.runId || null,
      input.tenantId,
      'pending',
      now,
    ]);

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<RunnerJob | undefined> {
    const query = 'SELECT * FROM runner_jobs WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : undefined;
  }

  async findByRunnerId(runnerId: string): Promise<RunnerJob[]> {
    const query = 'SELECT * FROM runner_jobs WHERE runner_id = $1 ORDER BY created_at DESC';
    const result = await this.db.query(query, [runnerId]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findByStatus(status: RunnerJobStatus): Promise<RunnerJob[]> {
    const query = 'SELECT * FROM runner_jobs WHERE status = $1 ORDER BY created_at DESC';
    const result = await this.db.query(query, [status]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findByTaskId(taskId: string): Promise<RunnerJob | undefined> {
    const query = 'SELECT * FROM runner_jobs WHERE task_id = $1 LIMIT 1';
    const result = await this.db.query(query, [taskId]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : undefined;
  }

  async markComplete(id: string, result?: Record<string, unknown>): Promise<RunnerJob | undefined> {
    const query = `
      UPDATE runner_jobs SET
        status = 'completed',
        result = $2,
        completed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const dbResult = await this.db.query(query, [id, result ? JSON.stringify(result) : null]);
    return dbResult.rows.length > 0 ? this.mapRow(dbResult.rows[0]) : undefined;
  }

  async markFailed(id: string, error: string): Promise<RunnerJob | undefined> {
    const query = `
      UPDATE runner_jobs SET
        status = 'failed',
        error = $2,
        completed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const dbResult = await this.db.query(query, [id, error]);
    return dbResult.rows.length > 0 ? this.mapRow(dbResult.rows[0]) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM runner_jobs WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): RunnerJob {
    return {
      id: row.id,
      runnerId: row.runner_id,
      taskId: row.task_id,
      stageId: row.stage_id,
      runId: row.run_id,
      tenantId: row.tenant_id,
      status: row.status as RunnerJobStatus,
      result: row.result ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) : undefined,
      error: row.error,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as any).randomUUID();
    }
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
