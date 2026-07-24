import { TenantAwareRepository, TenantAwareFindOptions } from '../db/tenant-aware-repository';

export interface PluginExecutionEntity {
  id: string;
  tenantId?: string;
  pluginId: string;
  triggeredBy: string | null;
  input: Record<string, any>;
  output: Record<string, any> | null;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export class PluginExecutionRepository extends TenantAwareRepository<PluginExecutionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'plugin_executions');
  }

  async findByPluginId(pluginId: string, limit?: number): Promise<PluginExecutionEntity[]> {
    const tenantId = this.getCurrentTenantId();
    const limitValue = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM plugin_executions WHERE plugin_id = $1 AND tenant_id = $2 ORDER BY started_at DESC LIMIT $3`,
      [pluginId, tenantId, limitValue],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<PluginExecutionEntity[]> {
    const tenantId = this.getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM plugin_executions WHERE status = $1 AND tenant_id = $2 ORDER BY started_at DESC`,
      [status, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateResult(id: string, output: Record<string, any>, status: string, completedAt: Date, error?: string): Promise<void> {
    const tenantId = this.getCurrentTenantId();
    const query = error
      ? `UPDATE plugin_executions SET output = $1, status = $2, completed_at = $3, error = $4 WHERE id = $5 AND tenant_id = $6`
      : `UPDATE plugin_executions SET output = $1, status = $2, completed_at = $3 WHERE id = $4 AND tenant_id = $5`;
    const params = error
      ? [JSON.stringify(output), status, completedAt, error, id, tenantId]
      : [JSON.stringify(output), status, completedAt, id, tenantId];
    await this.db.query(query, params);
  }

  async findRecent(limit: number = 100): Promise<PluginExecutionEntity[]> {
    const tenantId = this.getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM plugin_executions WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): PluginExecutionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
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