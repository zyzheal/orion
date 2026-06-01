/**
 * ProcessRegistryRepository
 * 进程注册数据访问层
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export interface ProcessRegistryEntity {
  id: string;
  tenantId: string;
  taskId: string;
  pid: number;
  pgid: number | null;
  containerId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProcessRegistryRepository extends BaseRepository<ProcessRegistryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'process_registry');
  }

  async findByTaskId(taskId: string): Promise<ProcessRegistryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM process_registry WHERE task_id = $1`,
      [taskId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findActive(): Promise<ProcessRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM process_registry WHERE status = 'active' ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<ProcessRegistryEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenant_id: tenantId } });
  }

  async markKilled(taskId: string): Promise<ProcessRegistryEntity> {
    const result = await this.db.query(
      `UPDATE process_registry SET status = 'killed', updated_at = NOW() WHERE task_id = $1 RETURNING *`,
      [taskId],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`ProcessRegistry with task_id ${taskId} not found`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByTaskId(taskId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM process_registry WHERE task_id = $1`,
      [taskId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async list(options: FindAllOptions = {}): Promise<FindAllResult<ProcessRegistryEntity>> {
    return this.findAll(options);
  }

  protected mapRowToEntity(row: any): ProcessRegistryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      taskId: row.task_id,
      pid: row.pid,
      pgid: row.pgid ?? null,
      containerId: row.container_id ?? null,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
