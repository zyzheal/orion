import { BaseRepository } from '../db/base-repository';

export interface ConnectorRegistryEntity {
  id: string;
  name: string;
  version: string;
  capabilities: string;
  config: string;
  enabled: boolean;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

export class ConnectorRegistryRepository extends BaseRepository<ConnectorRegistryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'connector_registry');
  }

  async findByName(name: string): Promise<ConnectorRegistryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM connector_registry WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<ConnectorRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM connector_registry WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<ConnectorRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM connector_registry WHERE enabled = TRUE ORDER BY name ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByName(name: string, data: { version: string; capabilities: string; config?: string; tenantId?: string }): Promise<ConnectorRegistryEntity> {
    const existing = await this.findByName(name);
    if (existing) {
      return this.update(existing.id, {
        version: data.version,
        capabilities: data.capabilities,
        config: data.config || '{}',
      });
    }
    return this.create({
      id: `cr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      version: data.version,
      capabilities: data.capabilities,
      config: data.config || '{}',
      enabled: true,
      tenant_id: data.tenantId || 'default',
    });
  }

  protected mapRowToEntity(row: any): ConnectorRegistryEntity {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      capabilities: row.capabilities,
      config: row.config,
      enabled: row.enabled,
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
