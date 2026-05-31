/**
 * GuardianTaskRepository
 * 执行守护任务数据访问层
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export interface GuardianTaskEntity {
  id: string;
  tenantId: string;
  taskId: string;
  startTime: number;
  globalTimeoutMs: number;
  stepTimeoutMs: number;
  aborted: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class GuardianTaskRepository extends BaseRepository<GuardianTaskEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'guardian_tasks');
  }

  async findByTaskId(taskId: string): Promise<GuardianTaskEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM guardian_tasks WHERE task_id = $1`,
      [taskId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findActive(): Promise<GuardianTaskEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM guardian_tasks WHERE status = 'active' AND aborted = false ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<GuardianTaskEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenant_id: tenantId } });
  }

  async markAborted(taskId: string): Promise<GuardianTaskEntity> {
    const result = await this.db.query(
      `UPDATE guardian_tasks SET aborted = true, status = 'aborted', updated_at = NOW() WHERE task_id = $1 RETURNING *`,
      [taskId],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `GuardianTask with task_id ${taskId} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async markCompleted(taskId: string): Promise<GuardianTaskEntity> {
    const result = await this.db.query(
      `UPDATE guardian_tasks SET status = 'completed', updated_at = NOW() WHERE task_id = $1 RETURNING *`,
      [taskId],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `GuardianTask with task_id ${taskId} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByTaskId(taskId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM guardian_tasks WHERE task_id = $1`,
      [taskId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async list(options: FindAllOptions = {}): Promise<FindAllResult<GuardianTaskEntity>> {
    return this.findAll(options);
  }

  protected mapRowToEntity(row: any): GuardianTaskEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      taskId: row.task_id,
      startTime: row.start_time,
      globalTimeoutMs: row.global_timeout_ms,
      stepTimeoutMs: row.step_timeout_ms,
      aborted: row.aborted ?? false,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
