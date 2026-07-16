/**
 * ApiVersionRepository - PostgreSQL Repository for API Versions
 */

import { DatabasePool } from '../services/database';
import { BaseRepository } from '../db/base-repository';

export interface ApiVersionEntity {
  id: string;
  tenantId: string;
  apiId: string;
  version: string;
  definition: Record<string, unknown>;
  status: 'active' | 'deprecated' | 'archived';
  createdAt: Date;
  deprecatedAt: Date | null;
}

export interface CreateApiVersionInput {
  id: string;
  tenantId: string;
  apiId: string;
  version: string;
  definition: Record<string, unknown>;
}

export class ApiVersionRepository extends BaseRepository<ApiVersionEntity> {
  constructor(db: DatabasePool) {
    super(db, 'api_versions');
  }

  async findByTenant(tenantId: string): Promise<ApiVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM api_versions WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByApiId(apiId: string): Promise<ApiVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM api_versions WHERE api_id = $1 ORDER BY created_at DESC`,
      [apiId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async createVersion(input: CreateApiVersionInput): Promise<ApiVersionEntity> {
    const result = await this.db.query(
      `INSERT INTO api_versions (id, tenant_id, api_id, version, definition, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [
        input.id,
        input.tenantId,
        input.apiId,
        input.version,
        JSON.stringify(input.definition),
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: 'active' | 'deprecated' | 'archived'): Promise<ApiVersionEntity | null> {
    const deprecatedAt = status === 'deprecated' ? 'NOW()' : 'deprecated_at';
    const result = await this.db.query(
      `UPDATE api_versions SET status = $1, deprecated_at = ${status === 'deprecated' ? 'NOW()' : 'NULL'}, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteVersion(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM api_versions WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ApiVersionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      apiId: row.api_id,
      version: row.version,
      definition: row.definition || {},
      status: row.status || 'active',
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      deprecatedAt: row.deprecated_at ? new Date(row.deprecated_at) : null,
    };
  }
}