/**
 * ConfigSchemaRepository - Database layer for Config Schema operations
 *
 * Provides CRUD operations for JSON Schema definitions used to validate
 * configuration values. Supports multi-tenant isolation via tenant_id.
 */

import { BaseRepository } from '../../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

export interface ConfigSchemaEntity {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  schema: Record<string, any>;
  config_key?: string;
  version: number;
  is_active: boolean;
  created_by: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

export class ConfigSchemaRepository extends BaseRepository<ConfigSchemaEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'config_schemas');
  }

  /**
   * Create a new config schema for a tenant.
   */
  async create(tenantId: string, input: {
    name: string;
    description?: string;
    schema: Record<string, any>;
    configKey?: string;
    createdBy: string;
  }): Promise<ConfigSchemaEntity> {
    const id = `config-schema-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO config_schemas (id, tenant_id, name, description, schema, config_key, version, is_active, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, true, $7, $7, NOW(), NOW())
       RETURNING *`,
      [id, tenantId, input.name, input.description ?? null, input.schema, input.configKey ?? null, input.createdBy]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find schema by ID (tenant-scoped).
   */
  async findById(id: string, tenantId: string): Promise<ConfigSchemaEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM config_schemas WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find schema by name within a tenant.
   */
  async findByName(tenantId: string, name: string): Promise<ConfigSchemaEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM config_schemas WHERE tenant_id = $1 AND name = $2`,
      [tenantId, name]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * List all schemas for a tenant with optional filtering.
   */
  async findByTenantId(tenantId: string, options?: {
    configKey?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ConfigSchemaEntity[]> {
    let query = `SELECT * FROM config_schemas WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.configKey) {
      query += ` AND config_key = $${paramIndex}`;
      params.push(options.configKey);
      paramIndex++;
    }

    if (options?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(options.isActive);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    if (options?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
      paramIndex++;
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update an existing schema.
   */
  async update(id: string, tenantId: string, updates: {
    name?: string;
    description?: string;
    schema?: Record<string, any>;
    configKey?: string;
    isActive?: boolean;
    updatedBy: string;
  }): Promise<ConfigSchemaEntity> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new OrionError(`Config schema '${id}' not found`, ErrorCode.NOT_FOUND);
    }

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(updates.name);
      paramIndex++;
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(updates.description);
      paramIndex++;
    }
    if (updates.schema !== undefined) {
      setClauses.push(`schema = $${paramIndex}`);
      params.push(updates.schema);
      paramIndex++;
    }
    if (updates.configKey !== undefined) {
      setClauses.push(`config_key = $${paramIndex}`);
      params.push(updates.configKey);
      paramIndex++;
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex}`);
      params.push(updates.isActive);
      paramIndex++;
    }

    // Always bump version on update
    setClauses.push(`version = config_schemas.version + 1`);
    setClauses.push(`updated_by = $${paramIndex}`);
    params.push(updates.updatedBy);
    paramIndex++;
    setClauses.push(`updated_at = NOW()`);

    params.push(id, tenantId);
    const query = `
      UPDATE config_schemas
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) {
      throw new OrionError(`Config schema '${id}' not found`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Soft-delete a schema by setting is_active = false.
   */
  async deactivate(id: string, tenantId: string, updatedBy: string): Promise<ConfigSchemaEntity> {
    return this.update(id, tenantId, { isActive: false, updatedBy });
  }

  /**
   * Delete a schema permanently.
   */
  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM config_schemas WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count schemas for a tenant.
   */
  async countByTenantId(tenantId: string, options?: { configKey?: string; isActive?: boolean }): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM config_schemas WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.configKey) {
      query += ` AND config_key = $${paramIndex}`;
      params.push(options.configKey);
      paramIndex++;
    }
    if (options?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(options.isActive);
      paramIndex++;
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Map database row to entity.
   */
  protected mapRowToEntity(row: any): ConfigSchemaEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      schema: typeof row.schema === 'string' ? JSON.parse(row.schema) : (row.schema ?? {}),
      config_key: row.config_key,
      version: row.version ?? 1,
      is_active: row.is_active ?? true,
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
