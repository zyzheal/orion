/**
 * FlowTemplateMarketService — Low-code workflow template marketplace
 *
 * Responsibilities:
 *  - List available templates (optionally filtered by category/tenant)
 *  - Get template details by ID
 *  - Publish a workflow as a reusable template
 *  - Apply a template to create a new workflow instance
 *
 * Extracted from the inline templateStore logic in lowcode-routes.ts.
 * Backed by LowcodeFlowTemplatePgRepository for persistence.
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import {
  LowcodeFlowTemplatePgRepository,
  LowcodeFlowTemplateEntity,
} from '../../repositories/LowcodeFlowTemplateRepository';
import { LowcodeWorkflowDefinitionPgRepository, LowcodeWorkflowDefinitionEntity } from '../../repositories/LowcodeWorkflowDefinitionRepository';
import { LowcodeWorkflow } from './LowcodeWorkflowService';
import { OrionError, ErrorCode, ValidationError, NotFoundError } from '../../errors';
import { WorkflowValidationResult } from './LowcodeImportExportService';

const logger = createLogger('FlowTemplateMarketService');

// ==================== Types ====================

/** Workflow template as exposed by the API (matches routes WorkflowTemplate interface) */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  definition: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  tags?: string[];
  usageCount?: number;
  createdBy: string;
  createdAt: string;
}

/** Input for creating a new template */
export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  definition: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  tags?: string[];
  isPublic?: boolean;
}

/** Input for applying a template to create a new workflow */
export interface ApplyTemplateInput {
  workflowName: string;
  description?: string;
  variables?: Record<string, string>;
}

/** Options for listing templates */
export interface ListTemplatesOptions {
  category?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

// ==================== Service ====================

export class FlowTemplateMarketService {
  private templateRepo: LowcodeFlowTemplatePgRepository | null = null;
  private defRepo: LowcodeWorkflowDefinitionPgRepository | null = null;
  private dbAvailable = false;

  constructor(
    templateRepo: LowcodeFlowTemplatePgRepository | null,
    defRepo: LowcodeWorkflowDefinitionPgRepository | null,
  ) {
    this.templateRepo = templateRepo;
    this.defRepo = defRepo;
    this.dbAvailable = !!(templateRepo && defRepo);
  }

  /** Whether the PostgreSQL repositories are available */
  isDbAvailable(): boolean {
    return this.dbAvailable;
  }

  // ==================== List ====================

  /**
   * List available templates.
   *
   * Visibility rules:
   *  - Public templates (is_public = true) are always visible
   *  - When tenantId is provided, tenant's private templates are also included
   *  - Without tenantId, only public templates are returned
   *
   * @param options - category filter, tenantId for private templates, pagination
   * @returns paginated list of WorkflowTemplate
   */
  async listTemplates(options: ListTemplatesOptions = {}): Promise<{
    data: WorkflowTemplate[];
    total: number;
  }> {
    if (!this.templateRepo) {
      throw new OrionError('Template repository not available', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const { category, tenantId, limit = 50, offset = 0, search } = options;

    let templates: WorkflowTemplate[];

    if (tenantId) {
      // With tenant context: public templates + tenant's own templates
      const publicTemplates = await this.templateRepo.findPublic({
        category,
        limit: 1000, // fetch all, filter in memory for search
        offset: 0,
      });

      // Also fetch tenant's private templates
      let tenantTemplates: LowcodeFlowTemplateEntity[] = [];
      try {
        tenantTemplates = await this.templateRepo.findByTenantId(tenantId, {
          limit: 1000,
          offset: 0,
        });
        // Filter out any public ones already counted (avoid duplicates)
        const publicIds = new Set(publicTemplates.map(t => t.id));
        tenantTemplates = tenantTemplates.filter(t => !publicIds.has(t.id));
      } catch {
        // If findByTenantId fails (e.g., table doesn't support it), just use public
      }

      const allEntities = [...publicTemplates, ...tenantTemplates];
      templates = allEntities.map(e => this.mapEntityToTemplate(e));
    } else {
      // No tenant context: public templates only
      const publicEntities = await this.templateRepo.findPublic({
        category,
        limit: 1000,
        offset: 0,
      });
      templates = publicEntities.map(e => this.mapEntityToTemplate(e));
    }

    // Apply search filter (in-memory since DB LIKE search is complex for JSON fields)
    let filtered = templates;
    if (search && typeof search === 'string') {
      const lowerSearch = search.toLowerCase();
      filtered = templates.filter(
        t =>
          t.name.toLowerCase().includes(lowerSearch) ||
          t.description?.toLowerCase().includes(lowerSearch) ||
          t.category?.toLowerCase().includes(lowerSearch) ||
          t.tags?.some((tag: string) => tag.toLowerCase().includes(lowerSearch)),
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(Number(offset) || 0, (Number(offset) || 0) + Math.min(limit, 100));

    return { data: paginated, total };
  }

  /**
   * Get a single template by ID.
   *
   * @param templateId
   * @returns WorkflowTemplate or null
   */
  async getTemplate(templateId: string): Promise<WorkflowTemplate | null> {
    if (!this.templateRepo) {
      throw new OrionError('Template repository not available', ErrorCode.SERVICE_UNAVAILABLE);
    }

    try {
      const entity = await this.templateRepo.findById(templateId);
      if (!entity) return null;
      return this.mapEntityToTemplate(entity);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn({ templateId, error: msg }, 'Failed to fetch template');
      throw new OrionError(`Failed to get template: ${msg}`, ErrorCode.OPERATION_FAILED);
    }
  }

  // ==================== Create ====================

  /**
   * Publish a workflow as a reusable template.
   *
   * @param input - template metadata + definition
   * @param userId - who is publishing
   * @returns the created WorkflowTemplate
   */
  async createTemplate(input: CreateTemplateInput, userId: string): Promise<WorkflowTemplate> {
    if (!this.templateRepo) {
      throw new OrionError('Template repository not available', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const validation = this.validateTemplateInput(input);
    if (!validation.valid) {
      throw new ValidationError(
        `Template validation failed: ${validation.errors.join('; ')}`,
        { errors: validation.errors, warnings: validation.warnings },
      );
    }

    const id = uuidv4();
    const tenantId = this.getTenantId();

    try {
      const entity = await this.templateRepo.create({
        id,
        tenant_id: tenantId,
        name: input.name.trim(),
        description: input.description?.trim() || '',
        category: input.category || 'custom',
        tags: input.tags || [],
        nodes: JSON.stringify(input.definition.nodes),
        edges: JSON.stringify(input.definition.edges),
        icon: input.thumbnail || '',
        usage_count: 0,
        is_public: input.isPublic ?? false,
        created_by: userId,
      });

      logger.info({ templateId: id, name: input.name }, 'Template created in DB');

      return this.mapEntityToTemplate(entity);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg, name: input.name }, 'Failed to create template');
      throw new OrionError(`Failed to create template: ${msg}`, ErrorCode.DATABASE_ERROR);
    }
  }

  // ==================== Apply ====================

  /**
   * Apply a template to create a new workflow.
   *
   * Process:
   *  1. Look up the template by ID (throws NotFoundError if missing)
   *  2. Create a new workflow definition from the template's definition
   *  3. Increment the template's usage_count
   *
   * @param templateId
   * @param input - new workflow name, optional description + variables
   * @param userId - who is applying
   * @returns the newly created LowcodeWorkflow
   */
  async applyTemplate(templateId: string, input: ApplyTemplateInput, userId: string): Promise<LowcodeWorkflow> {
    if (!this.templateRepo || !this.defRepo) {
      throw new OrionError('Template or workflow repository not available', ErrorCode.SERVICE_UNAVAILABLE);
    }

    // Look up the template
    const templateEntity = await this.templateRepo.findById(templateId);
    if (!templateEntity) {
      throw new NotFoundError('FlowTemplate', templateId);
    }

    const nodes = this.parseNodes(templateEntity.nodes);
    const edges = this.parseEdges(templateEntity.edges);
    const now = new Date();
    const workflowId = uuidv4();
    const tenantId = this.getTenantId();

    // Create the new workflow from the template definition
    try {
      const entity = await this.defRepo.create({
        id: workflowId,
        tenant_id: tenantId,
        name: input.workflowName.trim(),
        description: input.description?.trim() || templateEntity.description,
        version: '1.0.0',
        enabled: true,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        created_by: userId,
      });

      logger.info(
        { templateId, workflowId, name: input.workflowName },
        'Workflow created from template',
      );

      // Increment usage count (best-effort)
      try {
        await this.templateRepo.incrementUsage(templateId);
      } catch (incrementError) {
        const msg = incrementError instanceof Error ? incrementError.message : String(incrementError);
        logger.warn({ templateId, error: msg }, 'Failed to increment template usage count');
      }

      return this.mapDefEntityToWorkflow(entity);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg, templateId, workflowName: input.workflowName }, 'Failed to apply template');
      throw new OrionError(`Failed to apply template: ${msg}`, ErrorCode.DATABASE_ERROR);
    }
  }

  // ==================== Validation ====================

  private validateTemplateInput(input: CreateTemplateInput): WorkflowValidationResult {
    const result: WorkflowValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      result.valid = false;
      result.errors.push('Field "name" must be a non-empty string');
    }

    if (!input.definition || typeof input.definition !== 'object') {
      result.valid = false;
      result.errors.push('Field "definition" must be an object');
    } else {
      if (!Array.isArray(input.definition.nodes)) {
        result.valid = false;
        result.errors.push('Field "definition.nodes" must be an array');
      }
      if (!Array.isArray(input.definition.edges)) {
        result.valid = false;
        result.errors.push('Field "definition.edges" must be an array');
      }
    }

    if (input.tags !== undefined && !Array.isArray(input.tags)) {
      result.warnings.push('Field "tags" should be an array of strings');
    }

    return result;
  }

  // ==================== Mapping helpers ====================

  private parseNodes(nodes: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(nodes)) return nodes as Array<Record<string, unknown>>;
    if (typeof nodes === 'string') {
      try { return JSON.parse(nodes); } catch { return []; }
    }
    return [];
  }

  private parseEdges(edges: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(edges)) return edges as Array<Record<string, unknown>>;
    if (typeof edges === 'string') {
      try { return JSON.parse(edges); } catch { return []; }
    }
    return [];
  }

  private mapEntityToTemplate(entity: LowcodeFlowTemplateEntity): WorkflowTemplate {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description || undefined,
      category: entity.category || undefined,
      thumbnail: entity.icon || undefined,
      definition: {
        nodes: this.parseNodes(entity.nodes),
        edges: this.parseEdges(entity.edges),
      },
      tags: entity.tags,
      usageCount: entity.usage_count,
      createdBy: entity.created_by,
      createdAt: entity.created_at.toISOString(),
    };
  }

  private mapDefEntityToWorkflow(entity: LowcodeWorkflowDefinitionEntity): LowcodeWorkflow {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      name: entity.name,
      description: entity.description || undefined,
      version: entity.version,
      enabled: entity.enabled,
      nodes: this.parseNodes(entity.nodes),
      edges: this.parseEdges(entity.edges),
      createdBy: entity.created_by || undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  private getTenantId(): string {
    try {
      // Dynamic require to avoid circular deps at module load time
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getCurrentTenantId } = require('../../db/tenant-context-storage');
      return getCurrentTenantId();
    } catch {
      return '00000000-0000-0000-0000-000000000000';
    }
  }
}

// ==================== Singleton ====================

let serviceInstance: FlowTemplateMarketService | null = null;

export function getFlowTemplateMarketService(
  templateRepo: LowcodeFlowTemplatePgRepository | null,
  defRepo: LowcodeWorkflowDefinitionPgRepository | null,
): FlowTemplateMarketService {
  if (!serviceInstance) {
    serviceInstance = new FlowTemplateMarketService(templateRepo, defRepo);
  }
  return serviceInstance;
}

export function resetFlowTemplateMarketService(): void {
  serviceInstance = null;
}

export default FlowTemplateMarketService;
