import { BaseRepository } from '../db/base-repository';

export interface ConfigEntryEntity {
  id: string;
  tenant_id: string;
  key: string;
  value: Record<string, any>;
  version: number;
  environment: string;
  status: string;
  description?: string;
  encrypted: boolean;
  tags: string[];
  created_by?: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConfigEntryHistoryEntity {
  id: string;
  config_id: string;
  old_value: Record<string, any> | null;
  new_value: Record<string, any>;
  changed_by?: string;
  change_log?: string;
  version: number;
  created_at: Date;
}

export class ConfigEntryRepository extends BaseRepository<ConfigEntryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'config_entries');
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<ConfigEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM config_entries WHERE tenant_id = $1 ORDER BY key ASC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByKey(tenantId: string, key: string): Promise<ConfigEntryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM config_entries WHERE tenant_id = $1 AND key = $2`,
      [tenantId, key],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsert(
    tenantId: string,
    key: string,
    value: Record<string, any>,
    changedBy?: string,
  ): Promise<ConfigEntryEntity> {
    const id = `config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO config_entries (id, tenant_id, key, value, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $4, version = config_entries.version + 1, updated_at = NOW()
       RETURNING *`,
      [id, tenantId, key, value],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateByKey(key: string, value: Record<string, any>): Promise<ConfigEntryEntity | undefined> {
    const result = await this.db.query(
      `UPDATE config_entries SET value = $1, version = version + 1, updated_at = NOW() WHERE key = $2 RETURNING *`,
      [value, key],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByKey(tenantId: string, key: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM config_entries WHERE tenant_id = $1 AND key = $2`,
      [tenantId, key],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findHistory(configId: string, limit: number = 10): Promise<ConfigEntryHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM config_entry_history WHERE config_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [configId, limit],
    );
    return result.rows.map(row => ({
      id: row.id,
      config_id: row.config_id,
      old_value: row.old_value,
      new_value: row.new_value,
      changed_by: row.changed_by,
      change_log: row.change_log,
      version: row.version ?? 1,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    }));
  }

  async findHistoryByKey(tenantId: string, key: string, limit: number = 10): Promise<ConfigEntryHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT ch.* FROM config_entry_history ch
       JOIN config_entries c ON ch.config_id = c.id
       WHERE c.tenant_id = $1 AND c.key = $2
       ORDER BY ch.created_at DESC LIMIT $3`,
      [tenantId, key, limit],
    );
    return result.rows.map(row => ({
      id: row.id,
      config_id: row.config_id,
      old_value: row.old_value,
      new_value: row.new_value,
      changed_by: row.changed_by,
      change_log: row.change_log,
      version: row.version ?? 1,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    }));
  }

  async createHistory(entry: {
    config_id: string;
    old_value: Record<string, any> | null;
    new_value: Record<string, any>;
    changed_by?: string;
    change_log?: string;
    version?: number;
  }): Promise<ConfigEntryHistoryEntity> {
    const id = `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO config_entry_history (id, config_id, old_value, new_value, changed_by, change_log, version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [id, entry.config_id, entry.old_value, entry.new_value, entry.changed_by ?? null, entry.change_log ?? null, entry.version ?? 1],
    );
    return {
      id: result.rows[0].id,
      config_id: result.rows[0].config_id,
      old_value: result.rows[0].old_value,
      new_value: result.rows[0].new_value,
      changed_by: result.rows[0].changed_by,
      change_log: result.rows[0].change_log,
      version: result.rows[0].version ?? 1,
      created_at: result.rows[0].created_at ? new Date(result.rows[0].created_at) : new Date(),
    };
  }

  protected mapRowToEntity(row: any): ConfigEntryEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      key: row.key,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : (row.value ?? {}),
      version: row.version ?? 1,
      environment: row.environment ?? 'default',
      status: row.status ?? 'active',
      description: row.description,
      encrypted: row.encrypted ?? false,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? []),
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
