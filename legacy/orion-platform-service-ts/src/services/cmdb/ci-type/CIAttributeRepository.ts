/**
 * CIAttributeRepository — ci_type_attributes table repository
 *
 * Manages per-type attribute schemas for CI types.
 * Uses BaseRepository pattern aligned with ComplianceRepository.
 */

import { BaseRepository } from '../../../db/base-repository';
import { getCurrentTenantId } from '../../../db/tenant-context-storage';
import { ValidationError, NotFoundError } from '../../../errors';

export interface CIAttributeEntity {
  id: string;
  tenantId: string;
  ciTypeId: string;
  name: string;
  displayName: string;
  dataType: string;
  required: boolean;
  defaultValue: string | null;
  options: any[] | null;
  referenceType: string | null;
  validation: Record<string, any> | null;
  description: string | null;
  sortOrder: number;
  isSystem: boolean;
  isSearchable: boolean;
  isHidden: boolean;
  metadata: Record<string, any>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateAttributeInput {
  ciTypeId: string;
  name: string;
  displayName: string;
  dataType?: string;
  required?: boolean;
  defaultValue?: string;
  options?: any[];
  referenceType?: string;
  validation?: Record<string, any>;
  description?: string;
  sortOrder?: number;
  isSystem?: boolean;
  isSearchable?: boolean;
  isHidden?: boolean;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export class CIAttributeRepository extends BaseRepository<CIAttributeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ci_type_attributes');
  }

  /**
   * List all attributes for a given CI type, ordered by sort_order.
   */
  async listByType(typeId: string): Promise<CIAttributeEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM ci_type_attributes WHERE ci_type_id = $1 AND tenant_id = $2 AND deleted_at IS NULL ORDER BY sort_order ASC`,
      [typeId, tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Get a single attribute by ID (soft-delete aware).
   */
  async getAttributeById(id: string): Promise<CIAttributeEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM ci_type_attributes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create a new attribute for a CI type.
   */
  async createAttribute(input: CreateAttributeInput): Promise<CIAttributeEntity> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO ci_type_attributes
        (tenant_id, ci_type_id, name, display_name, data_type, required, default_value,
         options, reference_type, validation, description, sort_order, is_system,
         is_searchable, is_hidden, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        tenantId,
        input.ciTypeId,
        input.name,
        input.displayName,
        input.dataType ?? 'string',
        input.required ?? false,
        input.defaultValue ?? null,
        input.options ? JSON.stringify(input.options) : null,
        input.referenceType ?? null,
        input.validation ? JSON.stringify(input.validation) : null,
        input.description ?? null,
        input.sortOrder ?? 0,
        input.isSystem ?? false,
        input.isSearchable ?? true,
        input.isHidden ?? false,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update an existing attribute.
   */
  async updateAttribute(id: string, data: Partial<CreateAttributeInput>): Promise<CIAttributeEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, { column: string; transform?: (v: any) => any }> = {
      name: { column: 'name' },
      displayName: { column: 'display_name' },
      dataType: { column: 'data_type' },
      required: { column: 'required' },
      defaultValue: { column: 'default_value' },
      options: { column: 'options', transform: (v: any) => JSON.stringify(v) },
      referenceType: { column: 'reference_type' },
      validation: { column: 'validation', transform: (v: any) => JSON.stringify(v) },
      description: { column: 'description' },
      sortOrder: { column: 'sort_order' },
      isSystem: { column: 'is_system' },
      isSearchable: { column: 'is_searchable' },
      isHidden: { column: 'is_hidden' },
      metadata: { column: 'metadata', transform: (v: any) => JSON.stringify(v) },
    };

    for (const [key, config] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${config.column} = $${paramIndex}`);
        values.push(config.transform ? config.transform((data as any)[key]) : (data as any)[key]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new ValidationError('Update requires at least one field');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE ci_type_attributes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Attribute not found: ${id}`);
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Soft-delete an attribute.
   */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE ci_type_attributes SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Soft-delete all attributes for a given CI type.
   */
  async softDeleteByType(typeId: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE ci_type_attributes SET deleted_at = NOW(), updated_at = NOW() WHERE ci_type_id = $1 AND deleted_at IS NULL`,
      [typeId],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Bulk upsert attributes for a CI type.
   * Deletes existing non-system attributes and re-creates from the provided list.
   * Wrapped in a transaction to ensure atomicity.
   */
  async upsertBulk(typeId: string, attributes: CreateAttributeInput[]): Promise<CIAttributeEntity[]> {
    const tenantId = getCurrentTenantId();
    const dbWithTx = this.db as any;

    if (dbWithTx.transaction) {
      return dbWithTx.transaction(async (client: any) => {
        await client.query(
          `UPDATE ci_type_attributes SET deleted_at = NOW(), updated_at = NOW()
           WHERE ci_type_id = $1 AND is_system = FALSE AND deleted_at IS NULL`,
          [typeId],
        );

        const created: CIAttributeEntity[] = [];
        for (let i = 0; i < attributes.length; i++) {
          const attr = attributes[i];
          const result = await client.query(
            `INSERT INTO ci_type_attributes
              (tenant_id, ci_type_id, name, display_name, data_type, required, default_value,
               options, reference_type, validation, description, sort_order, is_system,
               is_searchable, is_hidden, metadata, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
             RETURNING *`,
            [
              tenantId, typeId, attr.name, attr.displayName, attr.dataType ?? 'string',
              attr.required ?? false, attr.defaultValue ?? null,
              attr.options ? JSON.stringify(attr.options) : null,
              attr.referenceType ?? null,
              attr.validation ? JSON.stringify(attr.validation) : null,
              attr.description ?? null, attr.sortOrder ?? i, attr.isSystem ?? false,
              attr.isSearchable ?? true, attr.isHidden ?? false,
              JSON.stringify(attr.metadata ?? {}), attr.createdBy ?? null,
            ],
          );
          created.push(this.mapRowToEntity(result.rows[0]));
        }
        return created;
      });
    }

    // Fallback without transaction
    await this.db.query(
      `UPDATE ci_type_attributes SET deleted_at = NOW(), updated_at = NOW()
       WHERE ci_type_id = $1 AND is_system = FALSE AND deleted_at IS NULL`,
      [typeId],
    );

    const created: CIAttributeEntity[] = [];
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      const result = await this.db.query(
        `INSERT INTO ci_type_attributes
          (tenant_id, ci_type_id, name, display_name, data_type, required, default_value,
           options, reference_type, validation, description, sort_order, is_system,
           is_searchable, is_hidden, metadata, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          tenantId, typeId, attr.name, attr.displayName, attr.dataType ?? 'string',
          attr.required ?? false, attr.defaultValue ?? null,
          attr.options ? JSON.stringify(attr.options) : null,
          attr.referenceType ?? null,
          attr.validation ? JSON.stringify(attr.validation) : null,
          attr.description ?? null, attr.sortOrder ?? i, attr.isSystem ?? false,
          attr.isSearchable ?? true, attr.isHidden ?? false,
          JSON.stringify(attr.metadata ?? {}), attr.createdBy ?? null,
        ],
      );
      created.push(this.mapRowToEntity(result.rows[0]));
    }

    return created;
  }

  protected mapRowToEntity(row: any): CIAttributeEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ciTypeId: row.ci_type_id,
      name: row.name,
      displayName: row.display_name,
      dataType: row.data_type,
      required: row.required,
      defaultValue: row.default_value ?? null,
      options: typeof row.options === 'string' ? JSON.parse(row.options) : (row.options ?? null),
      referenceType: row.reference_type ?? null,
      validation: typeof row.validation === 'string' ? JSON.parse(row.validation) : (row.validation ?? null),
      description: row.description ?? null,
      sortOrder: row.sort_order,
      isSystem: row.is_system,
      isSearchable: row.is_searchable,
      isHidden: row.is_hidden,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? null,
    };
  }
}
