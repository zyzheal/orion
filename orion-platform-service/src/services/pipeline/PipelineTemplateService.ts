/**
 * PipelineTemplateService - Pipeline template management
 *
 * Handles template CRUD, versioning, and instantiation.
 */

import { DatabasePool } from '../database';

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  defaultValue?: string | number | boolean | string[];
  required: boolean;
}

export interface Template {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: 'language' | 'platform' | 'purpose' | 'custom';
  tags: string[];
  yamlDefinition: string;
  parameters: TemplateParameter[];
  version: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  rating?: number;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  yamlDefinition: string;
  parameters: TemplateParameter[];
  changeSummary: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface CreateTemplateInput {
  tenantId: string;
  name: string;
  description?: string;
  category?: 'language' | 'platform' | 'purpose' | 'custom';
  tags?: string[];
  yamlDefinition: string;
  parameters?: TemplateParameter[];
  createdBy?: string;
}

export interface InstantiateTemplateInput {
  name: string;
  tenantId: string;
  projectId?: string;
  params?: Record<string, any>;
  createdBy?: string;
}

export class PipelineTemplateService {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  // ==================== Template CRUD ====================

  /**
   * List templates with optional filters
   */
  async listTemplates(options: {
    tenantId: string;
    category?: string;
    tag?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Template[]; total: number }> {
    const { tenantId, category, tag, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (tag) {
      whereClause += ` AND tags @> ARRAY[$${paramIndex}]::text[]`;
      params.push(tag);
      paramIndex++;
    }

    // Count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM pipeline_templates ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data
    params.push(limit, offset);
    const dataResult = await this.pool.query(
      `SELECT * FROM pipeline_templates ${whereClause}
       ORDER BY usage_count DESC, created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      data: dataResult.rows.map((r: any) => this.mapTemplate(r)),
      total,
    };
  }

  /**
   * Get template by ID
   */
  async getTemplateById(tenantId: string, templateId: string): Promise<Template | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_templates WHERE id = $1 AND tenant_id = $2',
      [templateId, tenantId]
    );
    if (!result.rows[0]) return null;
    return this.mapTemplate(result.rows[0]);
  }

  /**
   * Create a new template
   */
  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    const result = await this.pool.query(
      `INSERT INTO pipeline_templates
        (tenant_id, name, description, category, tags, yaml_definition, parameters, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.tenantId,
        input.name,
        input.description || null,
        input.category || 'custom',
        input.tags || [],
        input.yamlDefinition,
        JSON.stringify(input.parameters || []),
        input.createdBy || null,
      ]
    );
    return this.mapTemplate(result.rows[0]);
  }

  /**
   * Update a template
   */
  async updateTemplate(
    tenantId: string,
    templateId: string,
    updates: {
      name?: string;
      description?: string;
      tags?: string[];
      yamlDefinition?: string;
      parameters?: TemplateParameter[];
    }
  ): Promise<Template | null> {
    const existing = await this.getTemplateById(tenantId, templateId);
    if (!existing) return null;

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      params.push(updates.name);
      setClauses.push(`name = $${paramIndex++}`);
    }
    if (updates.description !== undefined) {
      params.push(updates.description);
      setClauses.push(`description = $${paramIndex++}`);
    }
    if (updates.tags !== undefined) {
      params.push(updates.tags);
      setClauses.push(`tags = $${paramIndex++}`);
    }
    if (updates.yamlDefinition !== undefined) {
      params.push(updates.yamlDefinition);
      setClauses.push(`yaml_definition = $${paramIndex++}`);
      // Also create a new version
      const currentVersion = existing.version;
      await this.createTemplateVersion(templateId, currentVersion + 1, updates.yamlDefinition, updates.parameters || existing.parameters, 'Template updated', updates.yamlDefinition !== existing.yamlDefinition ? updates.yamlDefinition : undefined);
    }
    if (updates.parameters !== undefined) {
      params.push(JSON.stringify(updates.parameters));
      setClauses.push(`parameters = $${paramIndex++}`);
    }

    if (setClauses.length === 0) {
      return existing;
    }

    params.push(templateId, tenantId);
    setClauses.push(`updated_at = NOW()`);

    const result = await this.pool.query(
      `UPDATE pipeline_templates SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    return result.rows[0] ? this.mapTemplate(result.rows[0]) : null;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(tenantId: string, templateId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM pipeline_templates WHERE id = $1 AND tenant_id = $2',
      [templateId, tenantId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ==================== Template Versions ====================

  /**
   * Create a new template version
   */
  async createTemplateVersion(
    templateId: string,
    version: number,
    yamlDefinition: string,
    parameters: TemplateParameter[],
    changeSummary?: string,
    createdBy?: string
  ): Promise<TemplateVersion> {
    const result = await this.pool.query(
      `INSERT INTO pipeline_template_versions
        (template_id, version, yaml_definition, parameters, change_summary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [templateId, version, yamlDefinition, JSON.stringify(parameters), changeSummary || null, createdBy || null]
    );
    return this.mapTemplateVersion(result.rows[0]);
  }

  /**
   * List template versions
   */
  async listTemplateVersions(
    templateId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ data: TemplateVersion[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const countResult = await this.pool.query(
      'SELECT COUNT(*) FROM pipeline_template_versions WHERE template_id = $1',
      [templateId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM pipeline_template_versions
       WHERE template_id = $1
       ORDER BY version DESC
       LIMIT $2 OFFSET $3`,
      [templateId, limit, offset]
    );

    return {
      data: dataResult.rows.map((r: any) => this.mapTemplateVersion(r)),
      total,
    };
  }

  // ==================== Template Instantiation ====================

  /**
   * Instantiate a template into a new pipeline
   * Returns the pipeline definition that should be created
   */
  async instantiateTemplate(
    tenantId: string,
    templateId: string,
    input: InstantiateTemplateInput
  ): Promise<{
    name: string;
    tenantId: string;
    projectId?: string;
    yamlDefinition: string;
    version: number;
    createdBy?: string;
  } | null> {
    const template = await this.getTemplateById(tenantId, templateId);
    if (!template) return null;

    // Apply parameter substitution to YAML definition
    let yamlDefinition = template.yamlDefinition;
    const params = input.params || {};

    // Merge with default parameter values
    const mergedParams: Record<string, any> = {};
    for (const param of template.parameters) {
      mergedParams[param.name] = params[param.name] !== undefined
        ? params[param.name]
        : param.defaultValue;
    }
    // Add any extra params not in the template definition
    for (const [key, value] of Object.entries(params)) {
      mergedParams[key] = value;
    }

    // Replace ${params.name} placeholders
    for (const [key, value] of Object.entries(mergedParams)) {
      const placeholder = `\${params.${key}}`;
      yamlDefinition = yamlDefinition.replaceAll(placeholder, String(value));
    }

    // Increment usage count
    await this.pool.query(
      'UPDATE pipeline_templates SET usage_count = usage_count + 1 WHERE id = $1',
      [templateId]
    );

    return {
      name: input.name,
      tenantId: input.tenantId,
      projectId: input.projectId,
      yamlDefinition,
      version: 1,
      createdBy: input.createdBy,
    };
  }

  // ==================== Internal helpers ====================

  private mapTemplate(row: any): Template {
    let parameters: TemplateParameter[] = [];
    try {
      parameters = typeof row.parameters === 'string'
        ? JSON.parse(row.parameters)
        : (row.parameters || []);
    } catch {
      parameters = [];
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || '',
      category: row.category || 'custom',
      tags: row.tags || [],
      yamlDefinition: row.yaml_definition,
      parameters,
      version: row.version,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      usageCount: row.usage_count || 0,
      rating: row.rating ? parseFloat(row.rating) : undefined,
    };
  }

  private mapTemplateVersion(row: any): TemplateVersion {
    let parameters: TemplateParameter[] = [];
    try {
      parameters = typeof row.parameters === 'string'
        ? JSON.parse(row.parameters)
        : (row.parameters || []);
    } catch {
      parameters = [];
    }

    return {
      id: row.id,
      templateId: row.template_id,
      version: row.version,
      yamlDefinition: row.yaml_definition,
      parameters,
      changeSummary: row.change_summary,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}
