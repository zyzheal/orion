/**
 * PluginRegistryRepository
 * Plugin Registry data access layer (plugin-spi)
 */

import { BaseRepository } from '../db/base-repository';

export interface PluginRegistryEntity {
  id: string;
  name: string;
  version: string;
  description: string | null;
  author: string | null;
  status: string;
  installDate: Date;
  enabledDate: Date | null;
  errorMessage: string | null;
  config: Record<string, any>;
  manifest: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class PluginRegistryRepository extends BaseRepository<PluginRegistryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'plugin_registry');
  }

  async findByName(name: string): Promise<PluginRegistryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM plugin_registry WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByStatus(status: string): Promise<PluginRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_registry WHERE status = $1 ORDER BY created_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, errorMessage?: string): Promise<PluginRegistryEntity> {
    const setFields = ['status = $2', 'updated_at = NOW()'];
    const params: any[] = [id, status];
    let paramIdx = 3;

    if (status === 'enabled') {
      setFields.push(`enabled_date = NOW()`);
    }
    if (errorMessage) {
      setFields.push(`error_message = $${paramIdx}`);
      params.push(errorMessage);
      paramIdx++;
    }

    const result = await this.db.query(
      `UPDATE plugin_registry SET ${setFields.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new Error(`Plugin registry entry ${id} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateConfig(id: string, config: Record<string, any>): Promise<PluginRegistryEntity> {
    const result = await this.db.query(
      `UPDATE plugin_registry SET config = config || $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(config)],
    );
    if (result.rows.length === 0) {
      throw new Error(`Plugin registry entry ${id} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async existsByName(name: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM plugin_registry WHERE name = $1 LIMIT 1`,
      [name],
    );
    return result.rows.length > 0;
  }

  async countAll(): Promise<number> {
    const result = await this.db.query(`SELECT COUNT(*) as count FROM plugin_registry`);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): PluginRegistryEntity {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      author: row.author,
      status: row.status,
      installDate: row.install_date,
      enabledDate: row.enabled_date,
      errorMessage: row.error_message,
      config: row.config ?? {},
      manifest: row.manifest ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
