import { BaseRepository } from '../db/base-repository';

export interface IntegrationConfigEntity {
  id: string;
  tenantId: string;
  provider: string;
  name: string;
  config: Record<string, any>;
  status: string;
  lastSyncAt: Date | null;
  syncStatus: string | null;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class IntegrationConfigRepository extends BaseRepository<IntegrationConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'integration_configs');
  }

  async findByTenantId(tenantId: string, limit: number = 50): Promise<IntegrationConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM integration_configs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByProvider(provider: string): Promise<IntegrationConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM integration_configs WHERE provider = $1 ORDER BY created_at DESC`,
      [provider],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): IntegrationConfigEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider,
      name: row.name,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
      status: row.status,
      lastSyncAt: row.last_sync_at,
      syncStatus: row.sync_status,
      errorMessage: row.error_message,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
