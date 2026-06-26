/**
 * CIMetadataSchemaRepository - PostgreSQL persistence for CMDB metadata-driven core tables
 *
 * Manages ci_metadata_schema and ci_type_attributes tables.
 * Extends BaseRepository for common CRUD operations.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';
import { getCurrentTenantId } from '../db/tenant-context-storage';

// ---- Entity Interfaces ----

export interface CIMetadataSchemaEntity {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  parent_type_id: string | null;
  k8s_type: string | null;
  is_system: boolean;
  status: string;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CITypeAttributeEntity {
  id: string;
  tenant_id: string;
  ci_type_id: string;
  name: string;
  display_name: string;
  data_type: string;
  required: boolean;
  default_value: string | null;
  options: unknown[] | null;
  reference_type: string | null;
  validation: Record<string, unknown> | null;
  description: string | null;
  sort_order: number;
  is_system: boolean;
  is_searchable: boolean;
  is_hidden: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// ---- Input Interfaces ----

export interface CreateCIMetadataSchemaInput {
  tenantId: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  parentTypeId?: string;
  k8sType?: string;
  isSystem?: boolean;
  status?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateCIMetadataSchemaInput {
  displayName?: string;
  description?: string;
  icon?: string;
  parentTypeId?: string;
  k8sType?: string;
  status?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateCITypeAttributeInput {
  tenantId: string;
  ciTypeId: string;
  name: string;
  displayName: string;
  dataType?: string;
  required?: boolean;
  defaultValue?: string;
  options?: unknown[];
  referenceType?: string;
  validation?: Record<string, unknown>;
  description?: string;
  sortOrder?: number;
  isSystem?: boolean;
  isSearchable?: boolean;
  isHidden?: boolean;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateCITypeAttributeInput {
  displayName?: string;
  dataType?: string;
  required?: boolean;
  defaultValue?: string;
  options?: unknown[];
  referenceType?: string;
  validation?: Record<string, unknown>;
  description?: string;
  sortOrder?: number;
  isSearchable?: boolean;
  isHidden?: boolean;
  metadata?: Record<string, unknown>;
}

// ---- Repository ----

/**
 * Repository for ci_metadata_schema table (CI type definitions)
 */
export class CIMetadataSchemaRepository extends BaseRepository<CIMetadataSchemaEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ci_metadata_schema');
  }

  async createSchema(input: CreateCIMetadataSchemaInput): Promise<CIMetadataSchemaEntity> {
    const result = await this.db.query(
      `INSERT INTO ci_metadata_schema (tenant_id, name, display_name, description, icon, parent_type_id, k8s_type, is_system, status, sort_order, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.tenantId,
        input.name,
        input.displayName,
        input.description || null,
        input.icon || null,
        input.parentTypeId || null,
        input.k8sType || null,
        input.isSystem ?? false,
        input.status || 'active',
        input.sortOrder ?? 0,
        JSON.stringify(input.metadata || {}),
        input.createdBy || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateSchema(id: string, input: UpdateCIMetadataSchemaInput): Promise<CIMetadataSchemaEntity | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.displayName !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(input.displayName);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.icon !== undefined) {
      fields.push(`icon = $${paramIndex++}`);
      values.push(input.icon);
    }
    if (input.parentTypeId !== undefined) {
      fields.push(`parent_type_id = $${paramIndex++}`);
      values.push(input.parentTypeId);
    }
    if (input.k8sType !== undefined) {
      fields.push(`k8s_type = $${paramIndex++}`);
      values.push(input.k8sType);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.sortOrder !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`);
      values.push(input.sortOrder);
    }
    if (input.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE ci_metadata_schema SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<FindAllResult<CIMetadataSchemaEntity>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [tenantId];

    if (options?.status) {
      conditions.push('status = $2');
      params.push(options.status);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM ci_metadata_schema WHERE ${whereClause}`,
      params,
    );

    const result = await this.db.query(
      `SELECT * FROM ci_metadata_schema WHERE ${whereClause} ORDER BY sort_order ASC, name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async findByName(tenantId: string, name: string): Promise<CIMetadataSchemaEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ci_metadata_schema WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`,
      [tenantId, name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByK8sType(k8sType: string, tenantId: string): Promise<CIMetadataSchemaEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ci_metadata_schema WHERE k8s_type = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [k8sType, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE ci_metadata_schema SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL AND is_system = FALSE RETURNING id`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): CIMetadataSchemaEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      display_name: row.display_name,
      description: row.description,
      icon: row.icon,
      parent_type_id: row.parent_type_id,
      k8s_type: row.k8s_type,
      is_system: row.is_system,
      status: row.status ?? 'active',
      sort_order: row.sort_order ?? 0,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    };
  }
}

/**
 * Repository for ci_type_attributes table
 */
export class CITypeAttributeRepository extends BaseRepository<CITypeAttributeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ci_type_attributes');
  }

  async createAttribute(input: CreateCITypeAttributeInput): Promise<CITypeAttributeEntity> {
    const result = await this.db.query(
      `INSERT INTO ci_type_attributes (tenant_id, ci_type_id, name, display_name, data_type, required, default_value, options, reference_type, validation, description, sort_order, is_system, is_searchable, is_hidden, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        input.tenantId,
        input.ciTypeId,
        input.name,
        input.displayName,
        input.dataType || 'string',
        input.required ?? false,
        input.defaultValue || null,
        input.options ? JSON.stringify(input.options) : null,
        input.referenceType || null,
        input.validation ? JSON.stringify(input.validation) : null,
        input.description || null,
        input.sortOrder ?? 0,
        input.isSystem ?? false,
        input.isSearchable ?? true,
        input.isHidden ?? false,
        JSON.stringify(input.metadata || {}),
        input.createdBy || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateAttribute(id: string, input: UpdateCITypeAttributeInput): Promise<CITypeAttributeEntity | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.displayName !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(input.displayName);
    }
    if (input.dataType !== undefined) {
      fields.push(`data_type = $${paramIndex++}`);
      values.push(input.dataType);
    }
    if (input.required !== undefined) {
      fields.push(`required = $${paramIndex++}`);
      values.push(input.required);
    }
    if (input.defaultValue !== undefined) {
      fields.push(`default_value = $${paramIndex++}`);
      values.push(input.defaultValue);
    }
    if (input.options !== undefined) {
      fields.push(`options = $${paramIndex++}`);
      values.push(JSON.stringify(input.options));
    }
    if (input.referenceType !== undefined) {
      fields.push(`reference_type = $${paramIndex++}`);
      values.push(input.referenceType);
    }
    if (input.validation !== undefined) {
      fields.push(`validation = $${paramIndex++}`);
      values.push(JSON.stringify(input.validation));
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.sortOrder !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`);
      values.push(input.sortOrder);
    }
    if (input.isSearchable !== undefined) {
      fields.push(`is_searchable = $${paramIndex++}`);
      values.push(input.isSearchable);
    }
    if (input.isHidden !== undefined) {
      fields.push(`is_hidden = $${paramIndex++}`);
      values.push(input.isHidden);
    }
    if (input.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE ci_type_attributes SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByType(ciTypeId: string, tenantId: string): Promise<CITypeAttributeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ci_type_attributes WHERE ci_type_id = $1 AND tenant_id = $2 AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC`,
      [ciTypeId, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE ci_type_attributes SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL AND is_system = FALSE RETURNING id`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): CITypeAttributeEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      ci_type_id: row.ci_type_id,
      name: row.name,
      display_name: row.display_name,
      data_type: row.data_type ?? 'string',
      required: row.required ?? false,
      default_value: row.default_value,
      options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
      reference_type: row.reference_type,
      validation: typeof row.validation === 'string' ? JSON.parse(row.validation) : row.validation,
      description: row.description,
      sort_order: row.sort_order ?? 0,
      is_system: row.is_system ?? false,
      is_searchable: row.is_searchable ?? true,
      is_hidden: row.is_hidden ?? false,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    };
  }
}
