/**
 * HeartbeatRegistryRepository
 * 心跳注册数据访问层
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export interface HeartbeatRegistryEntity {
  id: string;
  tenantId: string;
  taskId: string;
  intervalMs: number;
  timeoutMs: number;
  lastBeat: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class HeartbeatRegistryRepository extends BaseRepository<HeartbeatRegistryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'heartbeat_registry');
  }

  async findByTaskId(taskId: string): Promise<HeartbeatRegistryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM heartbeat_registry WHERE task_id = $1`,
      [taskId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findActive(): Promise<HeartbeatRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM heartbeat_registry WHERE status = 'active' ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<HeartbeatRegistryEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenant_id: tenantId } });
  }

  async updateLastBeat(taskId: string, lastBeat: number): Promise<HeartbeatRegistryEntity> {
    const result = await this.db.query(
      `UPDATE heartbeat_registry SET last_beat = $1, updated_at = NOW() WHERE task_id = $2 RETURNING *`,
      [lastBeat, taskId],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `HeartbeatRegistry with task_id ${taskId} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async markTimeout(taskId: string): Promise<HeartbeatRegistryEntity> {
    const result = await this.db.query(
      `UPDATE heartbeat_registry SET status = 'timeout', updated_at = NOW() WHERE task_id = $1 RETURNING *`,
      [taskId],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `HeartbeatRegistry with task_id ${taskId} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByTaskId(taskId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM heartbeat_registry WHERE task_id = $1`,
      [taskId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async list(options: FindAllOptions = {}): Promise<FindAllResult<HeartbeatRegistryEntity>> {
    return this.findAll(options);
  }

  protected mapRowToEntity(row: any): HeartbeatRegistryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      taskId: row.task_id,
      intervalMs: row.interval_ms,
      timeoutMs: row.timeout_ms,
      lastBeat: row.last_beat,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
