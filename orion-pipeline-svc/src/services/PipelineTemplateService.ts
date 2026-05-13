import { DatabasePool } from '../database';
/**
 * PipelineTemplateService - Pipeline template management
 *
 * Handles template CRUD, versioning, and instantiation.
 */

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
  // Template marketplace fields
  isPublic?: boolean;
  downloadCount?: number;
  ratingCount?: number;
  author?: string;
  thumbnail?: string;
  readme?: string;
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

export interface TemplateSearchOptions {
  tenantId?: string;
  query?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  minRating?: number;
  sortBy?: 'popular' | 'rating' | 'newest' | 'downloads';
  page?: number;
  limit?: number;
}

export interface TemplateRatingInput {
  templateId: string;
  tenantId: string;
  rating: number; // 1-5
  comment?: string;
  ratedBy: string;
}

export interface ForkTemplateInput {
  sourceTemplateId: string;
  tenantId: string;
  name: string;
  description?: string;
  createdBy?: string;
}

export interface PublishTemplateInput {
  templateId: string;
  tenantId: string;
  isPublic: boolean;
  author?: string;
  thumbnail?: string;
  readme?: string;
}

export interface TemplateStats {
  totalTemplates: number;
  publicTemplates: number;
  totalDownloads: number;
  averageRating: number;
  topCategories: { category: string; count: number }[];
}

export class PipelineTemplateService {

  constructor(private pool: DatabasePool) {}

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

  // ==================== Template Marketplace ====================

  /**
   * Search templates with full-text search and filters
   */
  async searchTemplates(options: TemplateSearchOptions): Promise<{ data: Template[]; total: number }> {
    const {
      tenantId,
      query,
      category,
      tags,
      isPublic,
      minRating,
      sortBy = 'popular',
      page = 1,
      limit = 20,
    } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    // Tenant isolation - show own templates + public templates
    if (tenantId) {
      whereClause += ` AND (tenant_id = $${paramIndex} OR is_public = true)`;
      params.push(tenantId);
      paramIndex++;
    }

    if (query) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${query}%`);
      paramIndex++;
    }

    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (tags && tags.length > 0) {
      whereClause += ` AND tags && ARRAY[${tags.map((_, i) => `$${paramIndex + i}`).join(',')}]::text[]`;
      params.push(...tags);
      paramIndex += tags.length;
    }

    if (isPublic !== undefined) {
      whereClause += ` AND is_public = $${paramIndex}`;
      params.push(isPublic);
      paramIndex++;
    }

    if (minRating !== undefined) {
      whereClause += ` AND rating >= $${paramIndex}`;
      params.push(minRating);
      paramIndex++;
    }

    // Count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM pipeline_templates ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Order by
    let orderBy = 'ORDER BY usage_count DESC';
    switch (sortBy) {
      case 'rating':
        orderBy = 'ORDER BY rating DESC NULLS LAST';
        break;
      case 'newest':
        orderBy = 'ORDER BY created_at DESC';
        break;
      case 'downloads':
        orderBy = 'ORDER BY download_count DESC NULLS LAST';
        break;
      case 'popular':
      default:
        orderBy = 'ORDER BY usage_count DESC';
    }

    // Data
    params.push(limit, offset);
    const dataResult = await this.pool.query(
      `SELECT * FROM pipeline_templates ${whereClause} ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      data: dataResult.rows.map((r: any) => this.mapTemplate(r)),
      total,
    };
  }

  /**
   * Rate a template
   */
  async rateTemplate(input: TemplateRatingInput): Promise<{ success: boolean }> {
    const { templateId, tenantId, rating, comment, ratedBy } = input;

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Insert rating
    await this.pool.query(
      `INSERT INTO template_ratings (template_id, tenant_id, rating, comment, rated_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [templateId, tenantId, rating, comment || null, ratedBy]
    );

    // Update template's average rating and count
    const avgResult = await this.pool.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count
       FROM template_ratings WHERE template_id = $1`,
      [templateId]
    );

    await this.pool.query(
      `UPDATE pipeline_templates SET rating = $1, rating_count = $2 WHERE id = $3`,
      [avgResult.rows[0].avg_rating, parseInt(avgResult.rows[0].rating_count, 10), templateId]
    );

    return { success: true };
  }

  /**
   * Fork a template to another tenant
   */
  async forkTemplate(input: ForkTemplateInput): Promise<Template | null> {
    const { sourceTemplateId, tenantId, name, description, createdBy } = input;

    // Get source template
    const source = await this.getTemplateById('default', sourceTemplateId);
    if (!source) return null;

    // Create forked copy
    const forked = await this.createTemplate({
      tenantId,
      name: name || `${source.name} (Fork)`,
      description: description || source.description,
      category: source.category,
      tags: source.tags,
      yamlDefinition: source.yamlDefinition,
      parameters: source.parameters,
      createdBy,
    });

    // Increment source download count
    await this.pool.query(
      'UPDATE pipeline_templates SET download_count = COALESCE(download_count, 0) + 1 WHERE id = $1',
      [sourceTemplateId]
    );

    return forked;
  }

  /**
   * Publish/unpublish template to marketplace
   */
  async publishTemplate(input: PublishTemplateInput): Promise<Template | null> {
    const { templateId, tenantId, isPublic, author, thumbnail, readme } = input;

    const setClauses: string[] = ['is_public = $1', 'updated_at = NOW()'];
    const params: any[] = [isPublic];
    let paramIndex = 2;

    if (author !== undefined) {
      params.push(author);
      setClauses.push(`author = $${paramIndex++}`);
    }
    if (thumbnail !== undefined) {
      params.push(thumbnail);
      setClauses.push(`thumbnail = $${paramIndex++}`);
    }
    if (readme !== undefined) {
      params.push(readme);
      setClauses.push(`readme = $${paramIndex++}`);
    }

    params.push(templateId, tenantId);

    const result = await this.pool.query(
      `UPDATE pipeline_templates SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    return result.rows[0] ? this.mapTemplate(result.rows[0]) : null;
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(tenantId?: string): Promise<TemplateStats> {
    let whereClause = '';
    const params: any[] = [];

    if (tenantId) {
      whereClause = 'WHERE tenant_id = $1';
      params.push(tenantId);
    }

    const totalResult = await this.pool.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_public = true) as public_count,
              SUM(COALESCE(download_count, 0)) as total_downloads,
              AVG(rating) as avg_rating
       FROM pipeline_templates ${whereClause}`,
      params
    );

    const categoryResult = await this.pool.query(
      `SELECT category, COUNT(*) as count FROM pipeline_templates ${whereClause} GROUP BY category`,
      params
    );

    return {
      totalTemplates: parseInt(totalResult.rows[0].total, 10),
      publicTemplates: parseInt(totalResult.rows[0].public_count, 10),
      totalDownloads: parseInt(totalResult.rows[0].total_downloads, 10) || 0,
      averageRating: parseFloat(totalResult.rows[0].avg_rating) || 0,
      topCategories: categoryResult.rows.map((r: any) => ({
        category: r.category,
        count: parseInt(r.count, 10),
      })),
    };
  }

  /**
   * Get ratings for a template
   */
  async getTemplateRatings(
    templateId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ data: any[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const countResult = await this.pool.query(
      'SELECT COUNT(*) FROM template_ratings WHERE template_id = $1',
      [templateId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM template_ratings WHERE template_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [templateId, limit, offset]
    );

    return {
      data: dataResult.rows,
      total,
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
      // Template marketplace fields
      isPublic: row.is_public || false,
      downloadCount: row.download_count || 0,
      ratingCount: row.rating_count || 0,
      author: row.author || undefined,
      thumbnail: row.thumbnail || undefined,
      readme: row.readme || undefined,
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
