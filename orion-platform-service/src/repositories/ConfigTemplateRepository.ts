/**
 * ConfigTemplateRepository - Database layer for Config Template operations
 *
 * Provides CRUD + versioning for configuration templates.
 * Supports multi-tenant isolation via tenant_id.
 */

import { BaseRepository } from '../../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';
import { ConfigTemplate, ConfigTemplateVersion, CreateConfigTemplateInput, CreateConfigTemplateVersionInput } from '../../services/config-mgmt/types';

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
  async create(tenantId: string, input: CreateConfigTemplateInput): Promise<ConfigTemplateEntity> {
    const id = `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO config_templates (id, tenant_id, name, description, category, config_data, target_environment, is_active, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $8, NOW(), NOW())
       RETURNING *`,
      [
        id,
        tenantId,
        input.name,
        input.description ?? null,
        input.category ?? null,
        JSON.stringify(input.configData),
        input.targetEnvironment || 'dev',
        input.createdBy,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find template by ID (tenant-scoped).
   */
  async findById(id: string, tenantId: string): Promise<ConfigTemplateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM config_templates WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return undefined;
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
   * Update template.
   */
  async update(id: string, tenantId: string, input: CreateConfigTemplateInput & { updatedBy: string }): Promise<ConfigTemplateEntity> {
    const result = await this.db.query(
      `UPDATE config_templates
       SET name = $1, description = $2, category = $3, config_data = $4, target_environment = $5, updated_by = $6, updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [
        input.name,
        input.description ?? null,
        input.category ?? null,
        JSON.stringify(input.configData),
        input.targetEnvironment || 'dev',
        input.updatedBy,
        id,
        tenantId,
      ]
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Config template ${id} not found`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete template (tenant-scoped).
   */
  async delete(id: string, tenantId: string): Promise<boolean> {
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
      configData: typeof row.config_data === 'string' ? JSON.parse(row.config_data) : (row.config_data ?? {}),
      targetEnvironment: row.target_environment,
      isActive: row.is_active,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  protected mapRowToVersionEntity(row: any): ConfigTemplateVersionEntity {
    return {
      id: row.id,
      templateId: row.template_id,
      tenant_id: row.tenant_id,
      configData: typeof row.config_data === 'string' ? JSON.parse(row.config_data) : (row.config_data ?? {}),
      version: row.version,
      changeLog: row.change_log,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}
