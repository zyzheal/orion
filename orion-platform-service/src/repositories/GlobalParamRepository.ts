/**
 * GlobalParamRepository
 *
 * Data access layer for global_params table.
 * Provides CRUD for cross-pipeline shared parameters.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError } from '../errors';
import type { GlobalParamEntity } from '../../models/GlobalParam';

export class GlobalParamRepository extends BaseRepository<GlobalParamEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'global_params');
  }

  /**
   * Create a global parameter.
   */
  async create(data: Omit<GlobalParamEntity, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<GlobalParamEntity, 'id'>>): Promise<GlobalParamEntity> {
    const columns = ['tenant_id', 'key', 'value', 'description', 'is_secret', 'scope', 'expires_at'];
    const values = [
      data.tenant_id,
      data.key,
      data.value,
      data.description ?? null,
      data.is_secret,
      data.scope,
      data.expires_at ?? null,
    ];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO global_params (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(`INSERT into global_params returned no rows`, 'OPERATION_FAILED');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find by tenant and key.
   */
  async findByTenantAndKey(tenantId: string, key: string): Promise<GlobalParamEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM global_params WHERE tenant_id = $1 AND key = $2 AND (expires_at IS NULL OR expires_at > NOW())`,
      [tenantId, key],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * Find all params for a tenant, optionally filtered by scope.
   */
  async findByTenant(tenantId: string, scope?: string): Promise<GlobalParamEntity[]> {
    let query = 'SELECT * FROM global_params WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];

    if (scope) {
      query += ` AND scope = $${params.length + 1}`;
      params.push(scope);
    }

    query += ' AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY key ASC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find global-scoped params (accessible by all tenants).
   */
  async findGlobalParams(): Promise<GlobalParamEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM global_params WHERE scope = 'global' AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY key ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find by pipeline scope.
   */
  async findByPipeline(tenantId: string, pipelineId: string): Promise<GlobalParamEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM global_params WHERE tenant_id = $1 AND scope = 'pipeline' AND key = $2 AND (expires_at IS NULL OR expires_at > NOW())`,
      [tenantId, pipelineId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update a global parameter.
   */
  async update(id: string, data: Partial<GlobalParamEntity>): Promise<GlobalParamEntity> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (data.value !== undefined) {
      updates.push(`value = $${paramIdx++}`);
      params.push(data.value);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      params.push(data.description);
    }
    if (data.is_secret !== undefined) {
      updates.push(`is_secret = $${paramIdx++}`);
      params.push(data.is_secret);
    }
    if (data.scope !== undefined) {
      updates.push(`scope = $${paramIdx++}`);
      params.push(data.scope);
    }
    if (data.expires_at !== undefined) {
      updates.push(`expires_at = $${paramIdx++}`);
      params.push(data.expires_at);
    }

    if (updates.length === 0) {
      throw new OrionError('No fields to update', 'INVALID_INPUT');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE global_params SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
    const result = await this.db.query(query, params);

    if (result.rows.length === 0) {
      throw new OrionError(`UPDATE on global_params affected no rows (id: ${id})`, 'OPERATION_FAILED');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete a global parameter.
   */
  async delete(id: string): Promise<void> {
    const result = await this.db.query('DELETE FROM global_params WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new OrionError(`DELETE from global_params affected no rows (id: ${id})`, 'OPERATION_FAILED');
    }
  }

  /**
   * Delete expired parameters.
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM global_params WHERE expires_at IS NOT NULL AND expires_at <= NOW()',
    );
    return result.rowCount ?? 0;
  }

  // ==================== Pagination ====================

  async list(options: FindAllOptions = {}): Promise<FindAllResult<GlobalParamEntity>> {
    return this.findAll(options);
  }

  // ==================== Mapping ====================

  protected mapRowToEntity(row: any): GlobalParamEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      key: row.key,
      value: row.value,
      description: row.description ?? null,
      is_secret: row.is_secret,
      scope: row.scope,
      expires_at: row.expires_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // Public mapper for testing
  mapRowToEntityPublic(row: any): GlobalParamEntity {
    return this.mapRowToEntity(row);
  }
}
