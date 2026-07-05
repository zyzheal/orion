/**
 * ConfigVersionRepository — Data access layer for config_versions and config_snapshots tables
 *
 * Encapsulates all raw SQL for configuration version management.
 * Follows the Repository pattern used across the codebase.
 */

import { DatabasePool } from '../services/database';

// ==================== Entities ====================

export interface ConfigVersionEntity {
  id: string;
  domain: string;
  key: string;
  oldValue: string;     // JSON string (JSONB in DB)
  newValue: string;     // JSON string (JSONB in DB)
  changedBy: string;
  changedAt: Date;
  changeType: 'create' | 'update' | 'delete';
  version: number;
  comment?: string;
  checksum: string;
}

export interface ConfigSnapshotEntity {
  id: string;
  tenantId: string;
  snapshotName: string;
  createdBy: string;
  createdAt: Date;
  configData: string;   // JSON string (JSONB in DB)
  checksum: string;
  description?: string;
}

// ==================== Query Params ====================

export interface FindVersionsParams {
  domain?: string;
  key?: string;
  limit?: number;
}

export interface FindSnapshotsParams {
  tenantId: string;
  limit?: number;
}

// ==================== Repository ====================

export class ConfigVersionRepository {
  constructor(private pool: DatabasePool) {}

  // ---- Config Versions ----

  async insertVersion(entity: ConfigVersionEntity): Promise<void> {
    await this.pool.query(
      `INSERT INTO config_versions
       (id, domain, key, old_value, new_value, changed_by, change_type, version, comment, checksum, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entity.id,
        entity.domain,
        entity.key,
        entity.oldValue,
        entity.newValue,
        entity.changedBy,
        entity.changeType,
        entity.version,
        entity.comment ?? null,
        entity.checksum,
        entity.changedAt,
      ],
    );
  }

  async findVersions(params: FindVersionsParams): Promise<ConfigVersionEntity[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.domain !== undefined) {
      conditions.push(`domain = $${idx++}`);
      values.push(params.domain);
    }
    if (params.key !== undefined) {
      conditions.push(`key = $${idx++}`);
      values.push(params.key);
    }

    let query = 'SELECT * FROM config_versions';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ` ORDER BY changed_at DESC LIMIT $${idx++}`;
    values.push(params.limit ?? 50);

    const result = await this.pool.query(query, values);
    return result.rows.map(this.mapRowToVersion);
  }

  async findVersionById(id: string): Promise<ConfigVersionEntity | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM config_versions WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToVersion(result.rows[0]);
  }

  async getMaxVersion(domain: string, key: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT MAX(version) AS max_version FROM config_versions WHERE domain = $1 AND key = $2',
      [domain, key],
    );
    return result.rows[0]?.max_version ?? 0;
  }

  // ---- Config Snapshots ----

  async insertSnapshot(entity: ConfigSnapshotEntity): Promise<void> {
    await this.pool.query(
      `INSERT INTO config_snapshots
       (id, tenant_id, snapshot_name, created_by, config_data, checksum, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entity.id,
        entity.tenantId,
        entity.snapshotName,
        entity.createdBy,
        entity.configData,
        entity.checksum,
        entity.description ?? null,
        entity.createdAt,
      ],
    );
  }

  async findSnapshotById(id: string, tenantId: string): Promise<ConfigSnapshotEntity | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM config_snapshots WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToSnapshot(result.rows[0]);
  }

  async findSnapshots(params: FindSnapshotsParams): Promise<ConfigSnapshotEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM config_snapshots WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [params.tenantId, params.limit ?? 20],
    );
    return result.rows.map(this.mapRowToSnapshot);
  }

  async deleteSnapshot(id: string, tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM config_snapshots WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rowCount > 0;
  }

  // ==================== Mappers ====================

  private mapRowToVersion(row: any): ConfigVersionEntity {
    return {
      id: row.id,
      domain: row.domain,
      key: row.key,
      oldValue: row.old_value,
      newValue: row.new_value,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      changeType: row.change_type,
      version: row.version,
      comment: row.comment,
      checksum: row.checksum,
    };
  }

  private mapRowToSnapshot(row: any): ConfigSnapshotEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      snapshotName: row.snapshot_name,
      createdBy: row.created_by,
      createdAt: row.created_at,
      configData: row.config_data,
      checksum: row.checksum,
      description: row.description,
    };
  }
}
