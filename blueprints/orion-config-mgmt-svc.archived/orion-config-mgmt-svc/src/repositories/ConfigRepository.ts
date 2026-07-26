/**
 * ConfigRepository - Config version management data access
 * 配置版本管理数据访问层
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../utils/database';

export interface ConfigVersionEntity {
  id: string;
  configKey: string;
  namespace: string;
  version: number;
  value: Record<string, unknown> | string | number | boolean;
  diffFromPrevious: Record<string, unknown> | null;
  createdBy: string;
  commitMessage: string | null;
  createdAt: Date;
}

export interface ConfigItemEntity {
  id: string;
  key: string;
  namespace: string;
  currentVersion: number;
  value: Record<string, unknown> | string | number | boolean;
  status: string;
  environment: string;
  tenantId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ConfigRepository {
  private db: DatabasePool;

  constructor(db: DatabasePool) {
    this.db = db;
  }

  // ==================== Config CRUD ====================

  /**
   * Set a config value, auto-incrementing version and computing diff
   */
  async setConfig(data: {
    key: string;
    namespace: string;
    value: Record<string, unknown> | string | number | boolean;
    createdBy: string;
    commitMessage?: string;
    environment?: string;
    tenantId?: string;
  }): Promise<{ config: ConfigItemEntity; version: ConfigVersionEntity }> {
    const environment = data.environment || 'production';
    const tenantId = data.tenantId || 'system';

    // Check if config exists
    const existing = await this.db.query(
      `SELECT * FROM config_items WHERE key = $1 AND app_id = $2 AND environment = $3 AND tenant_id = $4`,
      [data.key, data.namespace, environment, tenantId],
    );

    let config: ConfigItemEntity;
    let newVersion: number;

    if (existing.rows.length > 0) {
      // Update existing config
      const existingRow = existing.rows[0];
      newVersion = existingRow.current_version + 1;

      // Get previous version value for diff
      const prevResult = await this.db.query(
        `SELECT value FROM config_versions WHERE config_key = $1 AND namespace = $2 AND version = $3`,
        [data.key, data.namespace, existingRow.current_version],
      );
      const prevValue = prevResult.rows.length > 0 ? prevResult.rows[0].value : null;
      const diff = this.computeDiff(prevValue, data.value);

      const configUpdate = await this.db.query(
        `UPDATE config_items SET current_version = $1, value = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [newVersion, JSON.stringify(data.value), existingRow.id],
      );
      config = this.mapConfigRow(configUpdate.rows[0]);

      const versionInsert = await this.db.query(
        `INSERT INTO config_versions (id, config_id, version, value, change_reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [uuidv4(), existingRow.id, newVersion, JSON.stringify(data.value), data.commitMessage || null, data.createdBy],
      );
      const version = this.mapVersionRow(versionInsert.rows[0]);

      return { config, version };
    }

    // Create new config
    newVersion = 1;
    const configInsert = await this.db.query(
      `INSERT INTO config_items (key, app_id, value, environment, tenant_id, created_by, current_version, item_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.key, data.namespace, JSON.stringify(data.value), environment, tenantId, data.createdBy, 1, 'application', 'active'],
    );
    config = this.mapConfigRow(configInsert.rows[0]);

    const versionInsert = await this.db.query(
      `INSERT INTO config_versions (id, config_id, version, value, change_reason, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [uuidv4(), configInsert.rows[0].id, newVersion, JSON.stringify(data.value), data.commitMessage || null, data.createdBy],
    );
    const version = this.mapVersionRow(versionInsert.rows[0]);

    return { config, version };
  }

  /**
   * Get current config by key
   */
  async getConfig(key: string, namespace: string, environment: string = 'production'): Promise<ConfigItemEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM config_items WHERE key = $1 AND app_id = $2 AND environment = $3 AND status = $4`,
      [key, namespace, environment, 'active'],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapConfigRow(result.rows[0]);
  }

  /**
   * List configs with optional filters
   */
  async listConfigs(filters?: {
    namespace?: string;
    environment?: string;
    status?: string;
  }): Promise<ConfigItemEntity[]> {
    let query = `SELECT * FROM config_items WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.namespace) {
      query += ` AND app_id = $${paramIndex}`;
      params.push(filters.namespace);
      paramIndex++;
    }
    if (filters?.environment) {
      query += ` AND environment = $${paramIndex}`;
      params.push(filters.environment);
      paramIndex++;
    }
    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    query += ` ORDER BY updated_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapConfigRow(row));
  }

  // ==================== Version Management ====================

  /**
   * Get a specific version, or latest if version not specified
   */
  async getVersion(configKey: string, namespace: string, version?: number): Promise<ConfigVersionEntity | undefined> {
    // First get the config item ID
    const configResult = await this.db.query(
      `SELECT id FROM config_items WHERE key = $1 AND app_id = $2`,
      [configKey, namespace],
    );
    if (configResult.rows.length === 0) return undefined;
    const configId = configResult.rows[0].id;

    if (version !== undefined) {
      const result = await this.db.query(
        `SELECT * FROM config_versions WHERE config_id = $1 AND version = $2`,
        [configId, version],
      );
      if (result.rows.length === 0) return undefined;
      return this.mapVersionRow(result.rows[0]);
    }

    // Get latest version
    const result = await this.db.query(
      `SELECT * FROM config_versions WHERE config_id = $1
       ORDER BY version DESC LIMIT 1`,
      [configId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapVersionRow(result.rows[0]);
  }

  /**
   * List all versions for a config
   */
  async listVersions(configKey: string, namespace: string): Promise<ConfigVersionEntity[]> {
    // First get the config item ID
    const configResult = await this.db.query(
      `SELECT id FROM config_items WHERE key = $1 AND app_id = $2`,
      [configKey, namespace],
    );
    if (configResult.rows.length === 0) return [];
    const configId = configResult.rows[0].id;

    const result = await this.db.query(
      `SELECT * FROM config_versions WHERE config_id = $1 ORDER BY version ASC`,
      [configId],
    );
    return result.rows.map((row) => this.mapVersionRow(row));
  }

  /**
   * Rollback to a specific version
   */
  async rollback(configKey: string, namespace: string, targetVersion: number, createdBy: string): Promise<{ config: ConfigItemEntity; version: ConfigVersionEntity } | null> {
    // Get the target version
    const target = await this.getVersion(configKey, namespace, targetVersion);
    if (!target) return null;

    // Get current version for diff
    const configResult = await this.db.query(
      `SELECT * FROM config_items WHERE key = $1 AND namespace = $2`,
      [configKey, namespace],
    );
    if (configResult.rows.length === 0) return null;

    const currentConfig = this.mapConfigRow(configResult.rows[0]);
    const diff = this.computeDiff(currentConfig.value, target.value);

    // Create new version (rollback is just a new version with old value)
    const newVersion = currentConfig.currentVersion + 1;
    const versionInsert = await this.db.query(
      `INSERT INTO config_versions (id, config_id, version, value, change_reason, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [uuidv4(), currentConfig.id, newVersion, JSON.stringify(target.value), `Rollback to version ${targetVersion}`, createdBy],
    );
    const version = this.mapVersionRow(versionInsert.rows[0]);

    // Update config
    const configUpdate = await this.db.query(
      `UPDATE config_items SET value = $1, current_version = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(target.value), newVersion, currentConfig.id],
    );
    const config = this.mapConfigRow(configUpdate.rows[0]);

    return { config, version };
  }

  /**
   * Diff between two versions
   */
  async diff(configKey: string, namespace: string, versionA: number, versionB: number): Promise<Record<string, unknown> | null> {
    const vA = await this.getVersion(configKey, namespace, versionA);
    const vB = await this.getVersion(configKey, namespace, versionB);
    if (!vA || !vB) return null;

    return this.computeDiff(vA.value, vB.value);
  }

  // ==================== Utility ====================

  /**
   * Compute diff between two values
   */
  private computeDiff(
    oldValue: Record<string, unknown> | string | number | boolean | null,
    newValue: Record<string, unknown> | string | number | boolean,
  ): Record<string, unknown> {
    if (oldValue === null) {
      return { added: newValue, removed: null, modified: {} };
    }

    const added: Record<string, unknown> = {};
    const removed: Record<string, unknown> = {};
    const modified: Record<string, unknown> = {};

    const oldObj = typeof oldValue === 'object' ? oldValue : { value: oldValue };
    const newObj = typeof newValue === 'object' ? newValue : { value: newValue };

    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      const hasOld = key in oldObj;
      const hasNew = key in newObj;

      if (hasNew && !hasOld) {
        added[key] = newObj[key];
      } else if (!hasNew && hasOld) {
        removed[key] = oldObj[key];
      } else if (hasNew && hasOld && JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        modified[key] = { from: oldObj[key], to: newObj[key] };
      }
    }

    return { added, removed, modified };
  }

  private mapConfigRow(row: any): ConfigItemEntity {
    return {
      id: row.id,
      key: row.key,
      namespace: row.app_id,
      currentVersion: row.current_version,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : (row.value ?? {}),
      status: row.status,
      environment: row.environment,
      tenantId: row.tenant_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapVersionRow(row: any): ConfigVersionEntity {
    return {
      id: row.id,
      configKey: row.config_id,
      namespace: row.namespace || '',
      version: row.version,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : (row.value ?? {}),
      diffFromPrevious: null,
      createdBy: row.changed_by,
      commitMessage: row.change_reason,
      createdAt: row.created_at,
    };
  }
}
