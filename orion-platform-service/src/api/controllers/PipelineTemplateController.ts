/**
 * PipelineTemplateController - Pipeline template management API
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PipelineTemplateService } from '../../services/pipeline/PipelineTemplateService';
import { PipelineService } from '../../services/pipeline/PipelineService';

export class PipelineTemplateController {
  private templateService: PipelineTemplateService;
  private pipelineService: PipelineService;

  constructor(templateService: PipelineTemplateService, pipelineService: PipelineService) {
    this.templateService = templateService;
    this.pipelineService = pipelineService;
  }

  /**
   * List templates
   * GET /api/v1/pipeline-templates
   */
  async listTemplates(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const { category, tag, page, limit } = query;

      const result = await this.templateService.listTemplates({
        tenantId,
        category,
        tag,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });

      await reply.send({
        data: result.data.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          tags: t.tags,
          version: t.version,
          createdBy: t.createdBy,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          usageCount: t.usageCount,
          rating: t.rating,
        })),
        total: result.total,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to list templates',
      });
    }
  }

  /**
   * Get template detail
   * GET /api/v1/pipeline-templates/:templateId
   */
  async getTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { templateId } = params;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      const template = await this.templateService.getTemplateById(tenantId, templateId);
      if (!template) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Template '${templateId}' not found`,
        });
        return;
      }

      await reply.send({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        yamlDefinition: template.yamlDefinition,
        parameters: template.parameters,
        version: template.version,
        createdBy: template.createdBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        usageCount: template.usageCount,
        rating: template.rating,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get template',
      });
    }
  }

  /**
   * Create template
   * POST /api/v1/pipeline-templates
   */
  async createTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const createdBy = (request.headers['x-user-id'] as string) || undefined;
      const { name, description, category, tags, yamlDefinition, parameters, pipelineId } = body;

      if (!name || !yamlDefinition) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Missing required fields: name, yamlDefinition',
        });
        return;
      }

      // If creating from an existing pipeline, get its YAML
      let finalYamlDefinition = yamlDefinition;
      if (pipelineId && !yamlDefinition) {
        const pipeline = await this.pipelineService.getById(pipelineId);
        if (!pipeline) {
          await reply.status(404).send({
            error: 'NOT_FOUND',
            code: '30201',
            message: `Pipeline '${pipelineId}' not found`,
          });
          return;
        }
        finalYamlDefinition = pipeline.yamlDefinition || pipeline.config?.yamlDefinition || '';
      }

      const template = await this.templateService.createTemplate({
        tenantId,
        name,
        description,
        category: category || 'custom',
        tags: tags || [],
        yamlDefinition: finalYamlDefinition,
        parameters: parameters || [],
        createdBy,
      });

      await reply.status(201).send({
        id: template.id,
        name: template.name,
        version: template.version,
        category: template.category,
        createdAt: template.createdAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to create template',
      });
    }
  }

  /**
   * Update template
   * PUT /api/v1/pipeline-templates/:templateId
   */
  async updateTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { templateId } = params;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const { name, description, tags, yamlDefinition, parameters } = body;

      const updated = await this.templateService.updateTemplate(tenantId, templateId, {
        name,
        description,
        tags,
        yamlDefinition,
        parameters,
      });

      if (!updated) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Template '${templateId}' not found`,
        });
        return;
      }

      await reply.send({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        category: updated.category,
        tags: updated.tags,
        version: updated.version,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to update template',
      });
    }
  }

  /**
   * Delete template
   * DELETE /api/v1/pipeline-templates/:templateId
   */
  async deleteTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { templateId } = params;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      const success = await this.templateService.deleteTemplate(tenantId, templateId);
      if (!success) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Template '${templateId}' not found`,
        });
        return;
      }

      await reply.status(204).send();
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to delete template',
      });
    }
  }

  /**
   * Instantiate template into a new pipeline
   * POST /api/v1/pipeline-templates/:templateId/instantiate
   */
  async instantiateTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { templateId } = params;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const createdBy = (request.headers['x-user-id'] as string) || undefined;
      const { name, projectId, params: templateParams } = body;

      if (!name) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Missing required field: name',
        });
        return;
      }

      const result = await this.templateService.instantiateTemplate(tenantId, templateId, {
        name,
        tenantId,
        projectId,
        params: templateParams,
        createdBy,
      });

      if (!result) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Template '${templateId}' not found`,
        });
        return;
      }

      // Create the pipeline from the instantiated template
      const pipeline = await this.pipelineService.create({
        tenant_id: result.tenantId,
        project_id: result.projectId,
        name: result.name,
        version: result.version.toString(),
        yamlDefinition: result.yamlDefinition,
        created_by: result.createdBy,
      });

      await reply.status(201).send({
        pipelineId: pipeline.id,
        name: pipeline.name,
        version: pipeline.version,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        await reply.status(409).send({
          error: 'CONFLICT',
          code: '30202',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to instantiate template',
      });
    }
  }
}
