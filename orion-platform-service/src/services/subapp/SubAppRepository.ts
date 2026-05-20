/**
 * SubAppRepository - PostgreSQL Repository for SubApp Configuration
 *
 * Handles CRUD operations for sub-application configurations
 * stored in the subapp_configs table.
 */

import { DatabasePool } from '../database';
import { BaseRepository } from '../../db/base-repository';

// ==================== Types ====================

export interface SubAppConfig {
  id: string;
  name: string;
  key: string;
  version: string;
  entry_dev: string;
  entry_prod: string;
  routes: string[];
  permissions: string[];
  keep_alive: boolean;
  preload: boolean;
  description: string | null;
  icon: string | null;
  status: 'enabled' | 'disabled';
  sort_order: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSubAppInput {
  name: string;
  key: string;
  version?: string;
  entry_dev: string;
  entry_prod: string;
  routes: string[];
  permissions?: string[];
  keep_alive?: boolean;
  preload?: boolean;
  description?: string;
  icon?: string;
  status?: 'enabled' | 'disabled';
  sort_order?: number;
  created_by?: string;
}

export interface UpdateSubAppInput {
  name?: string;
  version?: string;
  entry_dev?: string;
  entry_prod?: string;
  routes?: string[];
  permissions?: string[];
  keep_alive?: boolean;
  preload?: boolean;
  description?: string;
  icon?: string;
  status?: 'enabled' | 'disabled';
  sort_order?: number;
}

export interface SubAppConfigHistory {
  id: string;
  subapp_key: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  changed_by: string | null;
  change_summary: string | null;
  created_at: Date;
}

// ==================== Repository ====================

export class SubAppRepository extends BaseRepository<SubAppConfig> {
  constructor(db: DatabasePool) {
    super(db, 'subapp_configs');
  }

  /**
   * Find all sub-app configurations
   */
  async findAll(): Promise<SubAppConfig[]> {
    const result = await this.db.query(
      `SELECT * FROM subapp_configs ORDER BY sort_order ASC, created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find enabled sub-apps only
   */
  async findEnabled(): Promise<SubAppConfig[]> {
    const result = await this.db.query(
      `SELECT * FROM subapp_configs WHERE status = 'enabled' ORDER BY sort_order ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find by key
   */
  async findByKey(key: string): Promise<SubAppConfig | null> {
    const result = await this.db.query(
      `SELECT * FROM subapp_configs WHERE key = $1`,
      [key],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create new sub-app config
   */
  async create(input: CreateSubAppInput): Promise<SubAppConfig> {
    const result = await this.db.query(
      `INSERT INTO subapp_configs (
        name, key, version, entry_dev, entry_prod, routes, permissions,
        keep_alive, preload, description, icon, status, sort_order, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        input.name,
        input.key,
        input.version || '1.0.0',
        input.entry_dev,
        input.entry_prod,
        JSON.stringify(input.routes),
        JSON.stringify(input.permissions || []),
        input.keep_alive || false,
        input.preload || false,
        input.description || null,
        input.icon || null,
        input.status || 'enabled',
        input.sort_order || 0,
        input.created_by || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update sub-app config
   */
  async update(key: string, input: UpdateSubAppInput): Promise<SubAppConfig | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.version !== undefined) {
      updates.push(`version = $${paramIndex++}`);
      values.push(input.version);
    }
    if (input.entry_dev !== undefined) {
      updates.push(`entry_dev = $${paramIndex++}`);
      values.push(input.entry_dev);
    }
    if (input.entry_prod !== undefined) {
      updates.push(`entry_prod = $${paramIndex++}`);
      values.push(input.entry_prod);
    }
    if (input.routes !== undefined) {
      updates.push(`routes = $${paramIndex++}`);
      values.push(JSON.stringify(input.routes));
    }
    if (input.permissions !== undefined) {
      updates.push(`permissions = $${paramIndex++}`);
      values.push(JSON.stringify(input.permissions));
    }
    if (input.keep_alive !== undefined) {
      updates.push(`keep_alive = $${paramIndex++}`);
      values.push(input.keep_alive);
    }
    if (input.preload !== undefined) {
      updates.push(`preload = $${paramIndex++}`);
      values.push(input.preload);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(input.icon);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(input.sort_order);
    }

    if (updates.length === 0) {
      return this.findByKey(key);
    }

    updates.push(`updated_at = NOW()`);
    values.push(key);

    const result = await this.db.query(
      `UPDATE subapp_configs SET ${updates.join(', ')} WHERE key = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Toggle status
   */
  async toggleStatus(key: string): Promise<SubAppConfig | null> {
    const current = await this.findByKey(key);
    if (!current) return null;

    const newStatus = current.status === 'enabled' ? 'disabled' : 'enabled';
    const result = await this.db.query(
      `UPDATE subapp_configs SET status = $1, updated_at = NOW() WHERE key = $2 RETURNING *`,
      [newStatus, key],
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete sub-app config
   */
  async delete(key: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM subapp_configs WHERE key = $1`,
      [key],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Add history record
   */
  async addHistory(
    subappKey: string,
    action: string,
    oldValue: Record<string, any> | null,
    newValue: Record<string, any> | null,
    changedBy: string | null,
    changeSummary: string | null,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO subapp_config_history (subapp_key, action, old_value, new_value, changed_by, change_summary)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [subappKey, action, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, changedBy, changeSummary],
    );
  }

  /**
   * Get config history
   */
  async getHistory(key: string): Promise<SubAppConfigHistory[]> {
    const result = await this.db.query(
      `SELECT * FROM subapp_config_history WHERE subapp_key = $1 ORDER BY created_at DESC`,
      [key],
    );
    return result.rows.map(row => this.mapHistoryRow(row));
  }

  /**
   * Map database row to entity
   */
  protected mapRowToEntity(row: any): SubAppConfig {
    return {
      id: row.id,
      name: row.name,
      key: row.key,
      version: row.version || '1.0.0',
      entry_dev: row.entry_dev,
      entry_prod: row.entry_prod,
      routes: typeof row.routes === 'string' ? JSON.parse(row.routes) : (row.routes || []),
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : (row.permissions || []),
      keep_alive: row.keep_alive || false,
      preload: row.preload || false,
      description: row.description || null,
      icon: row.icon || null,
      status: row.status || 'enabled',
      sort_order: row.sort_order || 0,
      created_by: row.created_by || null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  protected mapHistoryRow(row: any): SubAppConfigHistory {
    return {
      id: row.id,
      subapp_key: row.subapp_key,
      action: row.action,
      old_value: row.old_value ? (typeof row.old_value === 'string' ? JSON.parse(row.old_value) : row.old_value) : null,
      new_value: row.new_value ? (typeof row.new_value === 'string' ? JSON.parse(row.new_value) : row.new_value) : null,
      changed_by: row.changed_by || null,
      change_summary: row.change_summary || null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

export default SubAppRepository;