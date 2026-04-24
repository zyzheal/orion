/**
 * ConfigRepository
 * 配置管理数据访问层
 */

import { BaseRepository } from '../db/base-repository';

export interface ConfigEntity {
  id: string;
  key: string;
  value: Record<string, any>;
  scope: string;      // maps to namespace in DB
  scopeId: string;    // maps to tenant_id in DB
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ConfigRepository extends BaseRepository<ConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'configs');
  }

  /**
   * Find config by key within a scope (namespace)
   */
  async findByKey(key: string, scope?: string, scopeId?: string): Promise<ConfigEntity | undefined> {
    let query = `SELECT * FROM configs WHERE key = $1`;
    const params: any[] = [key];
    let paramIndex = 2;

    if (scope) {
      query += ` AND namespace = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }

    if (scopeId) {
      query += ` AND tenant_id = $${paramIndex}`;
      params.push(scopeId);
    }

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all configs by scope (namespace)
   */
  async findByScope(scope: string, scopeId?: string): Promise<ConfigEntity[]> {
    let query = `SELECT * FROM configs WHERE namespace = $1`;
    const params: any[] = [scope];

    if (scopeId) {
      query += ` AND tenant_id = $2`;
      params.push(scopeId);
    }

    query += ` ORDER BY key ASC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update config value
   */
  async updateValue(id: string, value: Record<string, any>, updatedBy?: string): Promise<ConfigEntity> {
    const result = await this.db.query(
      `UPDATE configs SET value = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(value), id],
    );
    if (result.rows.length === 0) {
      throw new Error(`Config with id ${id} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create new config
   */
  async createConfig(data: {
    key: string;
    value: Record<string, any>;
    scope: string;
    scopeId: string;
    description?: string;
    createdBy?: string;
  }): Promise<ConfigEntity> {
    const result = await this.db.query(
      `INSERT INTO configs (key, value, namespace, tenant_id, description) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.key, JSON.stringify(data.value), data.scope, data.scopeId, data.description ?? null],
    );
    if (result.rows.length === 0) {
      throw new Error('Failed to create config');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ConfigEntity {
    return {
      id: row.id,
      key: row.key,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : (row.value ?? {}),
      scope: row.namespace,
      scopeId: row.tenant_id,
      description: row.description,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}