/**
 * EnvProfileRepository
 *
 * Data access layer for env_profiles table.
 * Provides CRUD for environment-specific configuration profiles.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError } from '../errors';
import type { EnvProfileEntity, EnvProfileFilter } from '../../models/EnvProfile';

export class EnvProfileRepository extends BaseRepository<EnvProfileEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'env_profiles');
  }

  /**
   * Create an environment profile.
   */
  async create(data: Omit<EnvProfileEntity, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<EnvProfileEntity, 'id'>>): Promise<EnvProfileEntity> {
    const columns = ['tenant_id', 'name', 'environment', 'variables', 'description'];
    const values = [
      data.tenant_id,
      data.name,
      data.environment,
      data.variables ?? {},
      data.description ?? null,
    ];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO env_profiles (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(`INSERT into env_profiles returned no rows`, 'OPERATION_FAILED');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find by tenant, name, and environment.
   */
  async findByTenantNameAndEnv(tenantId: string, name: string, environment: string): Promise<EnvProfileEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM env_profiles WHERE tenant_id = $1 AND name = $2 AND environment = $3`,
      [tenantId, name, environment],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * Find all profiles for a tenant, optionally filtered.
   */
  async findByFilter(filter: EnvProfileFilter): Promise<EnvProfileEntity[]> {
    let query = 'SELECT * FROM env_profiles WHERE 1=1';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter.tenantId) {
      query += ` AND tenant_id = $${paramIdx++}`;
      params.push(filter.tenantId);
    }
    if (filter.name) {
      query += ` AND name = $${paramIdx++}`;
      params.push(filter.name);
    }
    if (filter.environment) {
      query += ` AND environment = $${paramIdx++}`;
      params.push(filter.environment);
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all environments for a named profile.
   */
  async findEnvironmentsForProfile(tenantId: string, name: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT environment FROM env_profiles WHERE tenant_id = $1 AND name = $2 ORDER BY environment`,
      [tenantId, name],
    );
    return result.rows.map(row => row.environment);
  }

  /**
   * Update an environment profile.
   */
  async update(id: string, data: Partial<EnvProfileEntity>): Promise<EnvProfileEntity> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      params.push(data.name);
    }
    if (data.environment !== undefined) {
      updates.push(`environment = $${paramIdx++}`);
      params.push(data.environment);
    }
    if (data.variables !== undefined) {
      updates.push(`variables = $${paramIdx++}`);
      params.push(data.variables);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      params.push(data.description);
    }

    if (updates.length === 0) {
      throw new OrionError('No fields to update', 'INVALID_INPUT');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE env_profiles SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
    const result = await this.db.query(query, params);

    if (result.rows.length === 0) {
      throw new OrionError(`UPDATE on env_profiles affected no rows (id: ${id})`, 'OPERATION_FAILED');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete an environment profile.
   */
  async delete(id: string): Promise<void> {
    const result = await this.db.query('DELETE FROM env_profiles WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new OrionError(`DELETE from env_profiles affected no rows (id: ${id})`, 'OPERATION_FAILED');
    }
  }

  // ==================== Pagination ====================

  async list(options: FindAllOptions = {}): Promise<FindAllResult<EnvProfileEntity>> {
    return this.findAll(options);
  }

  // ==================== Mapping ====================

  protected mapRowToEntity(row: any): EnvProfileEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      environment: row.environment,
      variables: row.variables ?? {},
      description: row.description ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // Public mapper for testing
  mapRowToEntityPublic(row: any): EnvProfileEntity {
    return this.mapRowToEntity(row);
  }
}
