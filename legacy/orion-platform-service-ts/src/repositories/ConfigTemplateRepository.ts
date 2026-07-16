/**
 * ConfigTemplateRepository - Database layer for Config Template operations
 *
 * Provides CRUD + versioning for configuration templates.
 * Supports multi-tenant isolation via tenant_id.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';
import { ConfigTemplate, ConfigTemplateVersion, CreateConfigTemplateInput, CreateConfigTemplateVersionInput, UpdateConfigTemplateInput } from '../services/config-mgmt/types';

export interface ConfigTemplateEntity {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  category?: string;
  config_data: Record<string, any>;
  target_environment: string;
  is_active: boolean;
  created_by: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConfigTemplateVersionEntity {
  id: string;
  template_id: string;
  tenant_id: string;
  config_data: Record<string, any>;
  version: number;
  change_log?: string;
  created_by: string;
  created_at: Date;
}

export class ConfigTemplateRepository extends BaseRepository<ConfigTemplateEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'config_templates');
  }

  /**
   * Create a new config template.
   */
  async create(data: Partial<ConfigTemplateEntity>): Promise<ConfigTemplateEntity> {
    const id = `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tenantId = (data as any).tenantId || this.getTenantId();
    const result = await this.db.query(
      `INSERT INTO config_templates (id, tenant_id, name, description, category, config_data, target_environment, is_active, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $8, NOW(), NOW())
       RETURNING *`,
      [
        id,
        tenantId,
        data.name,
        data.description ?? null,
        data.category ?? null,
        JSON.stringify((data as any).configData),
        data.target_environment || 'dev',
        (data as any).createdBy,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update template (partial update).
   */
  async update(id: string, data: Partial<ConfigTemplateEntity>): Promise<ConfigTemplateEntity> {
    const tenantId = this.getTenantId();
    const fields: string[] = ['updated_at = NOW()', `updated_by = $1`];
    const params: any[] = [(data as any).updatedBy];
    let idx = 2;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); params.push(data.name); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); params.push(data.description ?? null); }
    if (data.category !== undefined) { fields.push(`category = $${idx++}`); params.push(data.category ?? null); }
    if ((data as any).configData !== undefined) { fields.push(`config_data = $${idx++}`); params.push(JSON.stringify((data as any).configData)); }
    if (data.target_environment !== undefined) { fields.push(`target_environment = $${idx++}`); params.push(data.target_environment); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); params.push(data.is_active); }

    params.push(id, tenantId);
    const result = await this.db.query(
      `UPDATE config_templates SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Config template ${id} not found`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }
  async findById(id: string): Promise<ConfigTemplateEntity | null> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM config_templates WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * List all templates for a tenant with optional category filter.
   */
  async findByTenant(tenantId: string, category?: string): Promise<ConfigTemplateEntity[]> {
    let query = `SELECT * FROM config_templates WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Delete template (tenant-scoped).
   */
  async delete(id: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `DELETE FROM config_templates WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Create a new version for a template.
   */
  async createVersion(tenantId: string, input: CreateConfigTemplateVersionInput): Promise<ConfigTemplateVersionEntity> {
    const id = `tmpl-ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Get current max version for this template
    const maxVersionResult = await this.db.query(
      `SELECT MAX(version) as max_version FROM config_template_versions WHERE template_id = $1 AND tenant_id = $2`,
      [input.templateId, tenantId]
    );
    const nextVersion = (maxVersionResult.rows[0]?.max_version || 0) + 1;

    const result = await this.db.query(
      `INSERT INTO config_template_versions (id, template_id, tenant_id, config_data, version, change_log, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [id, input.templateId, tenantId, JSON.stringify(input.configData), nextVersion, input.changeLog ?? null, input.createdBy]
    );
    return this.mapRowToVersionEntity(result.rows[0]);
  }

  /**
   * List all versions for a template (tenant-scoped).
   */
  async listVersions(templateId: string, tenantId: string): Promise<ConfigTemplateVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM config_template_versions WHERE template_id = $1 AND tenant_id = $2 ORDER BY version DESC`,
      [templateId, tenantId]
    );
    return result.rows.map(row => this.mapRowToVersionEntity(row));
  }

  // ---- Helpers ----

  protected mapRowToEntity(row: any): ConfigTemplateEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      category: row.category,
      config_data: typeof row.config_data === 'string' ? JSON.parse(row.config_data) : (row.config_data ?? {}),
      target_environment: row.target_environment,
      is_active: row.is_active,
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  protected mapRowToVersionEntity(row: any): ConfigTemplateVersionEntity {
    return {
      id: row.id,
      template_id: row.template_id,
      tenant_id: row.tenant_id,
      config_data: typeof row.config_data === 'string' ? JSON.parse(row.config_data) : (row.config_data ?? {}),
      version: row.version,
      change_log: row.change_log,
      created_by: row.created_by,
      created_at: row.created_at,
    };
  }
}
