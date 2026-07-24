/**
 * EnvironmentRepository
 * Data access layer for pipeline environments (GAP-CN-02).
 * Supports CRUD and tenant/name-based lookups for deployment environments.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError } from '../errors';

/**
 * Environment entity mapped from pipeline_environments table.
 */
export interface EnvironmentEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  variables: Record<string, string>;
  approvalRequired: boolean;
  approvalCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class EnvironmentRepository extends BaseRepository<EnvironmentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'pipeline_environments');
  }

  /**
   * Override create to map entity properties to database column names.
   * Entity uses camelCase, DB uses snake_case.
   */
  async create(data: Omit<EnvironmentEntity, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<EnvironmentEntity, 'id'>>): Promise<EnvironmentEntity> {
    const columns = ['tenant_id', 'name', 'description', 'display_order', 'variables', 'approval_required', 'approval_count'];
    const values = [
      data.tenantId,
      data.name,
      data.description ?? null,
      data.displayOrder,
      data.variables,
      data.approvalRequired,
      data.approvalCount,
    ];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO pipeline_environments (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(`INSERT into pipeline_environments returned no rows`, 'OPERATION_FAILED')
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all environments for a specific tenant, ordered by display_order.
   */
  async findByTenant(tenantId: string): Promise<EnvironmentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_environments WHERE tenant_id = $1 ORDER BY display_order ASC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find environment by tenant and name (unique constraint).
   */
  async findByTenantAndName(tenantId: string, name: string): Promise<EnvironmentEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_environments WHERE tenant_id = $1 AND name = $2`,
      [tenantId, name],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * List environments with pagination.
   */
  async list(options: FindAllOptions = {}): Promise<FindAllResult<EnvironmentEntity>> {
    return this.findAll(options);
  }

  protected mapRowToEntity(row: any): EnvironmentEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      displayOrder: row.display_order ?? 0,
      variables: row.variables ?? {},
      approvalRequired: row.approval_required ?? false,
      approvalCount: row.approval_count ?? 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Public method for testing (expose protected mapper)
  mapRowToEntityPublic(row: any): EnvironmentEntity {
    return this.mapRowToEntity(row);
  }
}
