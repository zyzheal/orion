/**
 * CITypeRepository — ci_metadata_schema table repository
 *
 * Manages CI type definitions (logical "CI Type") with tenant isolation via RLS.
 * Uses BaseRepository pattern aligned with ComplianceRepository.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../../../db/base-repository';
import { getCurrentTenantId } from '../../../db/tenant-context-storage';

export interface CITypeEntity {
  id: string;
  tenantId: string;
  name: string;
  displayName: string;
  description: string | null;
  icon: string | null;
  parentTypeId: string | null;
  k8sType: string | null;
  isSystem: boolean;
  status: string;
  sortOrder: number;
  metadata: Record<string, any>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CITypeFilters {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class CITypeRepository extends BaseRepository<CITypeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ci_metadata_schema');
  }

  /**
   * List CI types for the current tenant, excluding soft-deleted records.
   */
  async listTypes(filters: CITypeFilters = {}): Promise<FindAllResult<CITypeEntity>> {
    const tenantId = getCurrentTenantId();
    const { status, search, limit = 100, offset = 0 } = filters;

    let query = `SELECT * FROM ci_metadata_schema WHERE tenant_id = $1 AND deleted_at IS NULL`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY sort_order ASC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return {
      entities: result.rows.map((row) => this.mapRowToEntity(row)),
      total,
    };
  }

  /**
   * Get a single CI type by ID (soft-delete aware).
   */
  async getTypeById(id: string): Promise<CITypeEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM ci_metadata_schema WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Get a CI type by name within the current tenant.
   */
  async getByName(name: string): Promise<CITypeEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM ci_metadata_schema WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`,
      [tenantId, name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Get a CI type with all its attributes loaded.
   */
  async getWithAttributes(id: string): Promise<{ type: CITypeEntity; attributes: any[] } | undefined> {
    const type = await this.getTypeById(id);
    if (!type) return undefined;

    const attrResult = await this.db.query(
      `SELECT * FROM ci_type_attributes WHERE ci_type_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC`,
      [id],
    );

    return { type, attributes: attrResult.rows };
  }

  /**
   * Soft-delete a CI type by setting deleted_at.
   */
  async softDelete(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `UPDATE ci_metadata_schema SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): CITypeEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      displayName: row.display_name,
      description: row.description ?? null,
      icon: row.icon ?? null,
      parentTypeId: row.parent_type_id ?? null,
      k8sType: row.k8s_type ?? null,
      isSystem: row.is_system,
      status: row.status,
      sortOrder: row.sort_order,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? null,
    };
  }
}
