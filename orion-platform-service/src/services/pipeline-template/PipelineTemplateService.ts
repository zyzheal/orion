import { DatabasePool } from '../database';
/**
 * PipelineTemplateService - Business logic for Pipeline Template Library
 *
 * Implements template management capabilities including:
 * - Pre-built templates for common CI/CD patterns
 * - User custom template creation
 * - Template instantiation into pipelines
 * - Template versioning and categorization
 *
 * Phase 1 P0 Service
 */

// ==================== Types ====================

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  defaultValue?: string | number | boolean | string[];
  required: boolean;
}

export interface PipelineTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  yaml_definition: string;
  parameters: TemplateParameter[];
  version: number;
  is_public: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTemplateInput {
  tenant_id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  yaml_definition: string;
  parameters?: TemplateParameter[];
  is_public?: boolean;
  created_by?: string;
}

export interface InstantiateTemplateInput {
  template_id: string;
  name: string;
  tenant_id: string;
  project_id?: string;
  params?: Record<string, string | number | boolean | string[]>;
  created_by?: string;
}

export interface ListTemplatesOptions {
  tenant_id?: string;
  category?: string;
  tag?: string;
  is_public?: boolean;
  page?: number;
  limit?: number;
}

export class PipelineTemplateServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PipelineTemplateServiceError';
  }
}

// ==================== Pre-built Templates ====================

const BUILTIN_TEMPLATES: CreateTemplateInput[] = [
  {
    tenant_id: 'system',
    name: 'Node.js Build & Test',
    description: 'Standard Node.js CI pipeline with install, test, and build stages',
    category: 'language',
    tags: ['nodejs', 'build', 'test', 'javascript'],
    yaml_definition: `
apiVersion: orion/v1
kind: Pipeline
metadata:
  name: nodejs-build-test
spec:
  stages:
    - name: install
      type: shell
      config:
        script: npm install
      timeout: 300000
    - name: test
      type: shell
      config:
        script: npm test
      depends_on: [install]
    - name: build
      type: shell
      config:
        script: npm run build
      depends_on: [test]
`,
    parameters: [
      { name: 'nodeVersion', type: 'string', description: 'Node.js version', defaultValue: '18', required: false },
      { name: 'testCommand', type: 'string', description: 'Test command', defaultValue: 'npm test', required: false },
    ],
    is_public: true,
    created_by: 'system',
  },
  {
    tenant_id: 'system',
    name: 'Go Build & Test',
    description: 'Go CI pipeline with build, test, and vet stages',
    category: 'language',
    tags: ['go', 'golang', 'build', 'test'],
    yaml_definition: `
apiVersion: orion/v1
kind: Pipeline
metadata:
  name: go-build-test
spec:
  stages:
    - name: build
      type: shell
      config:
        script: go build -v ./...
    - name: test
      type: shell
      config:
        script: go test -v ./...
      depends_on: [build]
    - name: vet
      type: shell
      config:
        script: go vet ./...
      depends_on: [test]
`,
    parameters: [
      { name: 'goVersion', type: 'string', description: 'Go version', defaultValue: '1.21', required: false },
    ],
    is_public: true,
    created_by: 'system',
  },
  {
    tenant_id: 'system',
    name: 'Java Maven Build',
    description: 'Java Maven build pipeline with compile, test, and package',
    category: 'language',
    tags: ['java', 'maven', 'build', 'test'],
    yaml_definition: `
apiVersion: orion/v1
kind: Pipeline
metadata:
  name: java-maven-build
spec:
  stages:
    - name: compile
      type: shell
      config:
        script: mvn compile
    - name: test
      type: shell
      config:
        script: mvn test
      depends_on: [compile]
    - name: package
      type: shell
      config:
        script: mvn package -DskipTests
      depends_on: [test]
`,
    parameters: [
      { name: 'javaVersion', type: 'string', description: 'Java version', defaultValue: '17', required: false },
      { name: 'mavenArgs', type: 'string', description: 'Additional Maven arguments', defaultValue: '', required: false },
    ],
    is_public: true,
    created_by: 'system',
  },
  {
    tenant_id: 'system',
    name: 'Docker Build & Push',
    description: 'Build Docker image and push to registry',
    category: 'platform',
    tags: ['docker', 'container', 'build', 'push'],
    yaml_definition: `
apiVersion: orion/v1
kind: Pipeline
metadata:
  name: docker-build-push
spec:
  stages:
    - name: build
      type: docker
      config:
        dockerfile: Dockerfile
        context: .
        tags:
          - "$IMAGE_NAME:$VERSION"
    - name: push
      type: docker
      config:
        registry: "$REGISTRY"
        tags:
          - "$IMAGE_NAME:$VERSION"
      depends_on: [build]
`,
    parameters: [
      { name: 'imageName', type: 'string', description: 'Image name', required: true },
      { name: 'version', type: 'string', description: 'Image version/tag', defaultValue: 'latest', required: false },
      { name: 'registry', type: 'string', description: 'Docker registry URL', required: true },
    ],
    is_public: true,
    created_by: 'system',
  },
  {
    tenant_id: 'system',
    name: 'Frontend Deploy',
    description: 'Build and deploy frontend application to static hosting',
    category: 'purpose',
    tags: ['frontend', 'deploy', 'static', 'web'],
    yaml_definition: `
apiVersion: orion/v1
kind: Pipeline
metadata:
  name: frontend-deploy
spec:
  stages:
    - name: build
      type: shell
      config:
        script: npm run build
    - name: deploy
      type: deploy
      config:
        provider: "$PROVIDER"
        target: "$TARGET"
      depends_on: [build]
`,
    parameters: [
      { name: 'buildCommand', type: 'string', description: 'Build command', defaultValue: 'npm run build', required: false },
      { name: 'provider', type: 'string', description: 'Deployment provider (s3, gcs, azure)', required: true },
      { name: 'target', type: 'string', description: 'Deployment target/bucket', required: true },
    ],
    is_public: true,
    created_by: 'system',
  },
];

// ==================== Repository ====================

export class PipelineTemplateRepository {

  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<PipelineTemplate | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_templates WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(options: ListTemplatesOptions): Promise<{ data: PipelineTemplate[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Public templates are visible to all tenants
    if (options.tenant_id) {
      conditions.push(`(tenant_id = $${paramIndex} OR is_public = true)`);
      params.push(options.tenant_id);
      paramIndex++;
    }

    if (options.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(options.category);
      paramIndex++;
    }

    if (options.tag) {
      conditions.push(`$${paramIndex} = ANY(tags)`);
      params.push(options.tag);
      paramIndex++;
    }

    if (options.is_public !== undefined) {
      conditions.push(`is_public = $${paramIndex}`);
      params.push(options.is_public);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM pipeline_templates ${whereClause}`,
      params
    );

    const dataResult = await this.pool.query(
      `SELECT * FROM pipeline_templates ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      data: dataResult.rows.map(row => this.mapRow(row)),
      total: parseInt(countResult.rows[0].total),
    };
  }

  async create(input: CreateTemplateInput): Promise<PipelineTemplate> {
    const result = await this.pool.query(
      `INSERT INTO pipeline_templates 
        (tenant_id, name, description, category, tags, yaml_definition, version, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)
       RETURNING *`,
      [
        input.tenant_id,
        input.name,
        input.description || null,
        input.category || 'custom',
        input.tags || [],
        input.yaml_definition,
        input.is_public || false,
        input.created_by || null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, updates: Partial<CreateTemplateInput>): Promise<PipelineTemplate | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      fields.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }
    if (updates.description) {
      fields.push(`description = $${paramIndex}`);
      values.push(updates.description);
      paramIndex++;
    }
    if (updates.category) {
      fields.push(`category = $${paramIndex}`);
      values.push(updates.category);
      paramIndex++;
    }
    if (updates.tags) {
      fields.push(`tags = $${paramIndex}`);
      values.push(updates.tags);
      paramIndex++;
    }
    if (updates.yaml_definition) {
      fields.push(`yaml_definition = $${paramIndex}`);
      fields.push(`version = version + 1`);
      values.push(updates.yaml_definition);
      paramIndex++;
    }
    if (updates.is_public !== undefined) {
      fields.push(`is_public = $${paramIndex}`);
      values.push(updates.is_public);
      paramIndex++;
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = now()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE pipeline_templates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM pipeline_templates WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  async incrementUsage(id: string): Promise<void> {
    // Track usage count for analytics (would need usage_count column)
    // For now, just a placeholder
  }

  private mapRow(row: any): PipelineTemplate {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      category: row.category,
      tags: row.tags || [],
      yaml_definition: row.yaml_definition,
      parameters: [], // Would parse from yaml or separate column
      version: row.version || 1,
      is_public: row.is_public || false,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Service ====================

export class PipelineTemplateService {
  private repository: PipelineTemplateRepository;
  
  private initialized: boolean = false;

  constructor(private pool: DatabasePool) {
    this.repository = new PipelineTemplateRepository(this.pool);
  }

  /**
   * Initialize built-in templates (call on startup)
   */
  async initializeBuiltinTemplates(): Promise<void> {
    if (this.initialized) return;

    for (const template of BUILTIN_TEMPLATES) {
      try {
        const existing = await this.pool.query(
          'SELECT id FROM pipeline_templates WHERE tenant_id = $1 AND name = $2',
          [template.tenant_id, template.name]
        );
        if (existing.rows.length === 0) {
          await this.repository.create(template);
        }
      } catch (err) {
        console.error(`Failed to create template ${template.name}:`, err);
      }
    }
    this.initialized = true;
  }

  /**
   * List templates
   */
  async listTemplates(options: ListTemplatesOptions): Promise<{
    data: PipelineTemplate[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const result = await this.repository.list(options);
    return { ...result, page, limit };
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<PipelineTemplate> {
    const template = await this.repository.findById(templateId);
    if (!template) {
      throw new PipelineTemplateServiceError(
        `Template not found: ${templateId}`,
        'TEMPLATE_NOT_FOUND'
      );
    }
    return template;
  }

  /**
   * Create template (from existing pipeline or scratch)
   */
  async createTemplate(input: CreateTemplateInput): Promise<PipelineTemplate> {
    // Validate YAML definition
    if (!input.yaml_definition || input.yaml_definition.trim().length === 0) {
      throw new PipelineTemplateServiceError(
        'YAML definition is required',
        'INVALID_YAML'
      );
    }

    return this.repository.create(input);
  }

  /**
   * Update template
   */
  async updateTemplate(templateId: string, updates: Partial<CreateTemplateInput>): Promise<PipelineTemplate> {
    const template = await this.getTemplate(templateId);
    const result = await this.repository.update(templateId, updates);
    return result as PipelineTemplate;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<{ success: boolean }> {
    const template = await this.getTemplate(templateId);
    const deleted = await this.repository.delete(templateId);
    return { success: deleted };
  }

  /**
   * Instantiate template into a new pipeline
   */
  async instantiateTemplate(input: InstantiateTemplateInput): Promise<{
    pipeline_id: string;
    name: string;
    version: number;
  }> {
    const template = await this.getTemplate(input.template_id);

    // Replace parameters in YAML
    let yaml = template.yaml_definition;
    const params = input.params || {};

    // Replace ${PARAM_NAME} placeholders with actual values
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `\${${key.toUpperCase()}}`;
      yaml = yaml.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Also replace ${PARAM_NAME} style
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `\${${key}}`;
      yaml = yaml.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Validate required parameters
    for (const param of template.parameters) {
      if (param.required && !(params[param.name] || param.defaultValue)) {
        throw new PipelineTemplateServiceError(
          `Required parameter missing: ${param.name}`,
          'MISSING_PARAMETER'
        );
      }
    }

    // Create pipeline from template
    const result = await this.pool.query(
      `INSERT INTO pipelines 
        (tenant_id, project_id, name, trigger_type, config, created_by)
       VALUES ($1, $2, $3, 'manual', $4, $5)
       RETURNING id`,
      [
        input.tenant_id,
        input.project_id || null,
        input.name,
        { yamlDefinition: yaml, version: 1 },
        input.created_by || null,
      ]
    );

    const pipelineId = result.rows[0].id;

    // Increment template usage
    await this.repository.incrementUsage(input.template_id);

    return {
      pipeline_id: pipelineId,
      name: input.name,
      version: 1,
    };
  }

  /**
   * Save existing pipeline as template
   */
  async savePipelineAsTemplate(
    pipelineId: string,
    input: Omit<CreateTemplateInput, 'yaml_definition'>,
    userId?: string
  ): Promise<PipelineTemplate> {
    // Get pipeline
    const pipelineResult = await this.pool.query(
      'SELECT * FROM pipelines WHERE id = $1',
      [pipelineId]
    );

    if (!pipelineResult.rows[0]) {
      throw new PipelineTemplateServiceError(
        `Pipeline not found: ${pipelineId}`,
        'PIPELINE_NOT_FOUND'
      );
    }

    const pipeline = pipelineResult.rows[0];
    const yamlDefinition = pipeline.config?.yamlDefinition || '';

    return this.createTemplate({
      ...input,
      yaml_definition: yamlDefinition,
      created_by: userId,
    });
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: string, tenantId?: string): Promise<PipelineTemplate[]> {
    const result = await this.repository.list({ category, tenant_id: tenantId });
    return result.data;
  }

  /**
   * Search templates by tag
   */
  async searchTemplatesByTag(tag: string, tenantId?: string): Promise<PipelineTemplate[]> {
    const result = await this.repository.list({ tag, tenant_id: tenantId });
    return result.data;
  }
}