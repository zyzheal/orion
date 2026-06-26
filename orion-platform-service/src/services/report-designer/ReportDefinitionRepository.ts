/**
 * ReportDefinitionRepository
 *
 * Repository for report_definition table.
 * Uses migration 318 as authoritative schema.
 */

import { BaseRepository } from '../../db/base-repository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { ValidationError, NotFoundError } from '../../errors';

export interface ReportDefinitionEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string | null;
  layout: Record<string, any>;
  components: Record<string, any>[];
  datasourceBindings: Record<string, any> | null;
  templateId: string | null;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportDefinitionFilters {
  category?: string;
  enabled?: boolean;
  keyword?: string;
  limit?: number;
  offset?: number;
}

export class ReportDefinitionRepository extends BaseRepository<ReportDefinitionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'report_definition');
  }

  async list(filters: ReportDefinitionFilters = {}): Promise<{ entities: ReportDefinitionEntity[]; total: number }> {
    const tenantId = getCurrentTenantId();
    const { category, enabled, keyword, limit = 20, offset = 0 } = filters;

    let query = `SELECT * FROM report_definition WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (enabled !== undefined) {
      query += ` AND enabled = $${paramIndex}`;
      params.push(enabled);
      paramIndex++;
    }

    if (keyword) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total,
    };
  }

  async getById(id: string): Promise<ReportDefinitionEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM report_definition WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async create(data: Omit<ReportDefinitionEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<ReportDefinitionEntity> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO report_definition (id, tenant_id, name, description, category, layout, components, datasource_bindings, template_id, enabled, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenantId,
        data.name,
        data.description ?? null,
        data.category ?? null,
        JSON.stringify(data.layout),
        JSON.stringify(data.components),
        data.datasourceBindings ? JSON.stringify(data.datasourceBindings) : null,
        data.templateId ?? null,
        data.enabled ?? true,
        data.createdBy ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateById(id: string, data: Partial<Omit<ReportDefinitionEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): Promise<ReportDefinitionEntity> {
    const tenantId = getCurrentTenantId();
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(data.name);
      paramIndex++;
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(data.description);
      paramIndex++;
    }
    if (data.category !== undefined) {
      setClauses.push(`category = $${paramIndex}`);
      params.push(data.category);
      paramIndex++;
    }
    if (data.layout !== undefined) {
      setClauses.push(`layout = $${paramIndex}`);
      params.push(JSON.stringify(data.layout));
      paramIndex++;
    }
    if (data.components !== undefined) {
      setClauses.push(`components = $${paramIndex}`);
      params.push(JSON.stringify(data.components));
      paramIndex++;
    }
    if (data.datasourceBindings !== undefined) {
      setClauses.push(`datasource_bindings = $${paramIndex}`);
      params.push(data.datasourceBindings ? JSON.stringify(data.datasourceBindings) : null);
      paramIndex++;
    }
    if (data.templateId !== undefined) {
      setClauses.push(`template_id = $${paramIndex}`);
      params.push(data.templateId);
      paramIndex++;
    }
    if (data.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex}`);
      params.push(data.enabled);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new ValidationError('No fields to update');
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id, tenantId);

    const query = `
      UPDATE report_definition
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;
    const result = await this.db.query(query, params);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Report definition not found: ${id}`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteById(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `DELETE FROM report_definition WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getByCategory(category: string): Promise<ReportDefinitionEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM report_definition WHERE tenant_id = $1 AND category = $2 ORDER BY name`,
      [tenantId, category],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ReportDefinitionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      category: row.category,
      layout: row.layout ?? {},
      components: row.components ?? [],
      datasourceBindings: row.datasource_bindings,
      templateId: row.template_id,
      enabled: row.enabled,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
