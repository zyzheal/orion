import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface OtelCollectorConfigEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  configType: string;  // receiver/processor/exporter/connector
  configYaml: string;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class OtelCollectorConfigRepository extends BaseRepository<OtelCollectorConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'otel_collector_configs');
  }

  async findByTenant(tenantId: string): Promise<OtelCollectorConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM otel_collector_configs WHERE tenant_id = $1 ORDER BY config_type, name ASC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByType(tenantId: string, configType: string): Promise<OtelCollectorConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM otel_collector_configs WHERE tenant_id = $1 AND config_type = $2 ORDER BY name ASC`,
      [tenantId, configType],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findEnabled(tenantId: string): Promise<OtelCollectorConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM otel_collector_configs WHERE tenant_id = $1 AND enabled = true ORDER BY config_type, name ASC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): OtelCollectorConfigEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      configType: row.config_type,
      configYaml: row.config_yaml,
      enabled: row.enabled,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
