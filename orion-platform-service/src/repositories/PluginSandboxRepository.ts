/**
 * PluginSandboxRepository
 * Plugin Sandbox execution records data access layer
 */

import { BaseRepository } from '../db/base-repository';
import { NotFoundError } from '../errors';

export interface PluginSandboxTaskEntity {
  id: string;
  tenantId: string;
  pluginId: string;
  taskType: string;
  inputData: Record<string, any>;
  outputData: Record<string, any> | null;
  status: string;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export class PluginSandboxRepository extends BaseRepository<PluginSandboxTaskEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'plugin_sandbox_tasks');
  }

  async findByPluginId(pluginId: string, tenantId: string, limit: number = 20): Promise<PluginSandboxTaskEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_sandbox_tasks WHERE plugin_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT $3`,
      [pluginId, tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string, tenantId?: string): Promise<PluginSandboxTaskEntity[]> {
    const query = tenantId
      ? `SELECT * FROM plugin_sandbox_tasks WHERE status = $1 AND tenant_id = $2 ORDER BY created_at DESC`
      : `SELECT * FROM plugin_sandbox_tasks WHERE status = $1 ORDER BY created_at DESC`;
    const params = tenantId ? [status, tenantId] : [status];
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, errorMessage?: string): Promise<PluginSandboxTaskEntity> {
    const setFields = ['status = $2', 'updated_at = NOW()'];
    const params: any[] = [id, status];
    let paramIdx = 3;

    if (status === 'running') {
      setFields.push(`started_at = NOW()`);
    }
    if (status === 'completed' || status === 'failed') {
      setFields.push(`completed_at = NOW()`);
    }
    if (errorMessage) {
      setFields.push(`error_message = $${paramIdx}`);
      params.push(errorMessage);
      paramIdx++;
    }

    const result = await this.db.query(
      `UPDATE plugin_sandbox_tasks SET ${setFields.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('PluginSandboxTask', id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateOutput(id: string, outputData: Record<string, any>): Promise<PluginSandboxTaskEntity> {
    const result = await this.db.query(
      `UPDATE plugin_sandbox_tasks SET output_data = $2, completed_at = NOW() WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(outputData)],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('PluginSandboxTask', id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): PluginSandboxTaskEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pluginId: row.plugin_id,
      taskType: row.task_type,
      inputData: typeof row.input_data === 'string' ? JSON.parse(row.input_data || '{}') : (row.input_data || {}),
      outputData: row.output_data ? (typeof row.output_data === 'string' ? JSON.parse(row.output_data) : row.output_data) : null,
      status: row.status,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
}
