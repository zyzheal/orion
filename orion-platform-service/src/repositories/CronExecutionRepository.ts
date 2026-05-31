/**
 * CronExecutionRepository
 * 定时任务执行记录数据访问层
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export interface CronExecutionEntity {
  id: string;
  jobId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: Record<string, any>;
  errorMessage?: string;
}

export class CronExecutionRepository extends BaseRepository<CronExecutionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cron_executions');
  }

  async findByJobId(jobId: string): Promise<CronExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cron_executions WHERE job_id = $1 ORDER BY started_at DESC`,
      [jobId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRunning(jobId: string): Promise<CronExecutionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cron_executions WHERE job_id = $1 AND status = 'running' ORDER BY started_at DESC LIMIT 1`,
      [jobId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async complete(id: string, status: 'completed' | 'failed', result?: Record<string, any>, errorMessage?: string): Promise<CronExecutionEntity> {
    const completedAt = new Date();
    const queryResult = await this.db.query(
      `UPDATE cron_executions SET status = $1, completed_at = $2, result = $3, error_message = $4 WHERE id = $5 RETURNING *`,
      [status, completedAt, result ? JSON.stringify(result) : null, errorMessage, id],
    );
    if (queryResult.rows.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Cron execution with id ${id} not found`);
    }
    return this.mapRowToEntity(queryResult.rows[0]);
  }

  protected mapRowToEntity(row: any): CronExecutionEntity {
    return {
      id: row.id,
      jobId: row.job_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status as 'running' | 'completed' | 'failed' | 'cancelled',
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
      errorMessage: row.error_message,
    };
  }
}
