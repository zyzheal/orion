import { BaseRepository } from '../db/base-repository';

export interface PluginExecutionEntity {
  id: string;
  pluginId: string;
  triggeredBy: string | null;
  input: Record<string, any>;
  output: Record<string, any> | null;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export class PluginExecutionRepository extends BaseRepository<PluginExecutionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'plugin_executions');
  }

  async findByPluginId(pluginId: string, limit?: number): Promise<PluginExecutionEntity[]> {
    const limitValue = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM plugin_executions WHERE plugin_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [pluginId, limitValue],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<PluginExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_executions WHERE status = $1 ORDER BY started_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateResult(id: string, output: Record<string, any>, status: string, completedAt: Date, error?: string): Promise<void> {
    const query = error
      ? `UPDATE plugin_executions SET output = $1, status = $2, completed_at = $3, error = $4 WHERE id = $5`
      : `UPDATE plugin_executions SET output = $1, status = $2, completed_at = $3 WHERE id = $4`;
    const params = error
      ? [JSON.stringify(output), status, completedAt, error, id]
      : [JSON.stringify(output), status, completedAt, id];
    await this.db.query(query, params);
  }

  async findRecent(limit: number = 100): Promise<PluginExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_executions ORDER BY started_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): PluginExecutionEntity {
    return {
      id: row.id,
      pluginId: row.plugin_id,
      triggeredBy: row.triggered_by,
      input: row.input ?? {},
      output: row.output,
      status: row.status ?? 'running',
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error,
    };
  }
}