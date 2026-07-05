/**
 * ConfigSnapshotRepository — Data access layer for config_snapshots table
 *
 * Encapsulates all raw SQL for config snapshot management.
 * Extends BaseRepository for standard CRUD with automatic tenant isolation.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

// ==================== Entity ====================

export interface ConfigSnapshotEntity {
  id: string;
  configId: string;
  name: string;
  data: Record<string, any>;    // JSONB in DB
  createdBy: string;
  createdAt: Date;
}

// ==================== Query Params ====================

export interface FindByConfigIdParams {
  configId: string;
  limit?: number;
}

// ==================== Repository ====================

export class ConfigSnapshotRepository extends BaseRepository<ConfigSnapshotEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    super(db, 'config_snapshots');
  }

  // ---- Custom Queries ----

  /**
   * Find all snapshots for a specific config entry
   */
  async findByConfigId(params: FindByConfigIdParams): Promise<ConfigSnapshotEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM config_snapshots WHERE config_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [params.configId, params.limit ?? 50],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Delete snapshots older than the specified number of days
   * Returns the number of rows deleted
   */
  async deleteOld(retentionDays: number): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM config_snapshots WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [retentionDays],
    );
    return result.rowCount ?? 0;
  }

  // ==================== Mapper ====================

  protected mapRowToEntity(row: any): ConfigSnapshotEntity {
    return {
      id: row.id,
      configId: row.config_id,
      name: row.name,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : (row.data ?? {}),
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}
