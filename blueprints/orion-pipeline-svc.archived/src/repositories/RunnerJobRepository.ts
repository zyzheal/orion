/**
 * RunnerJobRepository — Runner 任务追踪数据访问层 (GAP-CN-07)
 *
 * 负责 runner_jobs 表的 CRUD 操作，支持按 runner、task、status 查询，
 * 以及任务状态变更（完成/失败标记）。
 */

import { Pool } from 'pg';
import { RunnerJob, RunnerJobStatus, RunnerJobCreateInput } from '../models/RunnerJob';

export { RunnerJob, RunnerJobStatus, RunnerJobCreateInput } from '../models/RunnerJob';

/**
 * PostgreSQL RunnerJob Repository 实现
 */
export class PostgresRunnerJobRepository {
  constructor(private pool: Pool) {}

  /**
   * 创建 RunnerJob 记录
   */
  async create(input: RunnerJobCreateInput): Promise<RunnerJob> {
    const query = `
      INSERT INTO runner_jobs (
        id, runner_id, task_id, stage_id, run_id, tenant_id, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const id = crypto.randomUUID();
    const now = new Date();

    const result = await this.pool.query(query, [
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

  /**
   * 按 ID 查找 RunnerJob
   */
  async findById(id: string): Promise<RunnerJob | null> {
    const query = 'SELECT * FROM runner_jobs WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * 按 Run ID 查找所有 RunnerJobs
   */
  async findByRunId(runId: string): Promise<RunnerJob[]> {
    const query = 'SELECT * FROM runner_jobs WHERE run_id = $1 ORDER BY created_at DESC';
    const result = await this.pool.query(query, [runId]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  /**
   * 按 Runner ID 查找所有 RunnerJobs
   */
  async findByRunnerId(runnerId: string): Promise<RunnerJob[]> {
    const query = 'SELECT * FROM runner_jobs WHERE runner_id = $1 ORDER BY created_at DESC';
    const result = await this.pool.query(query, [runnerId]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  /**
   * 按状态查找 RunnerJobs
   */
  async findByStatus(status: RunnerJobStatus): Promise<RunnerJob[]> {
    const query = 'SELECT * FROM runner_jobs WHERE status = $1 ORDER BY created_at DESC';
    const result = await this.pool.query(query, [status]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  /**
   * 按 Task ID 查找 RunnerJob（唯一）
   */
  async findByTaskId(taskId: string): Promise<RunnerJob | null> {
    const query = 'SELECT * FROM runner_jobs WHERE task_id = $1 LIMIT 1';
    const result = await this.pool.query(query, [taskId]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * 标记任务为完成
   */
  async markComplete(id: string, resultData?: Record<string, unknown>): Promise<RunnerJob | null> {
    const query = `
      UPDATE runner_jobs SET
        status = 'completed',
        result = $2,
        completed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const dbResult = await this.pool.query(query, [id, resultData ? JSON.stringify(resultData) : null]);
    return dbResult.rows.length > 0 ? this.mapRow(dbResult.rows[0]) : null;
  }

  /**
   * 标记任务为运行中
   */
  async markRunning(id: string): Promise<RunnerJob | null> {
    const query = `
      UPDATE runner_jobs SET
        status = 'running',
        started_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const dbResult = await this.pool.query(query, [id]);
    return dbResult.rows.length > 0 ? this.mapRow(dbResult.rows[0]) : null;
  }

  /**
   * 标记任务为失败
   */
  async markFailed(id: string, error: string): Promise<RunnerJob | null> {
    const query = `
      UPDATE runner_jobs SET
        status = 'failed',
        error = $2,
        completed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const dbResult = await this.pool.query(query, [id, error]);
    return dbResult.rows.length > 0 ? this.mapRow(dbResult.rows[0]) : null;
  }

  /**
   * 标记任务为已取消
   */
  async markCancelled(id: string): Promise<RunnerJob | null> {
    const query = `
      UPDATE runner_jobs SET
        status = 'cancelled',
        completed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const dbResult = await this.pool.query(query, [id]);
    return dbResult.rows.length > 0 ? this.mapRow(dbResult.rows[0]) : null;
  }

  /**
   * 删除 RunnerJob 记录
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM runner_jobs WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 将数据库行映射为 RunnerJob 实体
   */
  private mapRow(row: any): RunnerJob {
    return {
      id: row.id,
      runnerId: row.runner_id,
      taskId: row.task_id,
      stageId: row.stage_id,
      runId: row.run_id,
      tenantId: row.tenant_id,
      status: row.status as RunnerJobStatus,
      result: row.result
        ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result)
        : undefined,
      error: row.error,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }
}

// Backward-compatible export alias
export const RunnerJobRepository = PostgresRunnerJobRepository;
export type RunnerJobRepository = PostgresRunnerJobRepository;
