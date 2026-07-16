/**
 * PluginVersionSnapshotRepository
 * Plugin version snapshot data access layer (plugin-spi hot reload)
 */

import { BaseRepository } from '../db/base-repository';

export interface PluginVersionSnapshotEntity {
  id: string;
  pluginId: string;
  version: string;
  manifest: Record<string, any>;
  config: Record<string, any>;
  status: string;
  checksum: string | null;
  snapshotAt: Date;
  createdAt: Date;
}

export class PluginVersionSnapshotRepository extends BaseRepository<PluginVersionSnapshotEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'plugin_version_snapshots');
  }

  async findByPluginId(pluginId: string, limit: number = 5): Promise<PluginVersionSnapshotEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_version_snapshots WHERE plugin_id = $1 ORDER BY snapshot_at DESC LIMIT $2`,
      [pluginId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findLatestByPluginId(pluginId: string): Promise<PluginVersionSnapshotEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM plugin_version_snapshots WHERE plugin_id = $1 ORDER BY snapshot_at DESC LIMIT 1`,
      [pluginId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByPluginIdAndVersion(pluginId: string, version: string): Promise<PluginVersionSnapshotEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM plugin_version_snapshots WHERE plugin_id = $1 AND version = $2 ORDER BY snapshot_at DESC LIMIT 1`,
      [pluginId, version],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async pruneOldSnapshots(pluginId: string, keepCount: number = 5): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM plugin_version_snapshots WHERE id IN (
        SELECT id FROM plugin_version_snapshots WHERE plugin_id = $1
        ORDER BY snapshot_at DESC OFFSET $2
      )`,
      [pluginId, keepCount],
    );
    return result.rowCount ?? 0;
  }

  async countByPluginId(pluginId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM plugin_version_snapshots WHERE plugin_id = $1`,
      [pluginId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): PluginVersionSnapshotEntity {
    return {
      id: row.id,
      pluginId: row.plugin_id,
      version: row.version,
      manifest: row.manifest ?? {},
      config: row.config ?? {},
      status: row.status,
      checksum: row.checksum,
      snapshotAt: row.snapshot_at,
      createdAt: row.created_at,
    };
  }
}
