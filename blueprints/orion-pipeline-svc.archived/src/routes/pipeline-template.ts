import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { PipelineTemplateService } from '../services/PipelineTemplateService';

export async function pipelineTemplateRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  const service = new PipelineTemplateService(opts.database);

  // ==================== Basic Template CRUD ====================

  // List templates
  fastify.get('/pipeline-templates', async (request) => {
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    return service.listTemplates({
      tenantId,
      category: query.category,
      tag: query.tag,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });
  });

  // Get template by ID
  fastify.get('/pipeline-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request.query as any)?.tenantId || 'default';
    const template = await service.getTemplateById(tenantId, id);
    if (!template) return reply.code(404).send({ error: 'Template not found' });
    return template;
  });

  // Create template
  fastify.post('/pipeline-templates', async (request, reply) => {
    const body = request.body as any;
    const template = await service.createTemplate({
      tenantId: body.tenantId || 'default',
      name: body.name,
      description: body.description,
      category: body.category || 'custom',
      tags: body.tags || [],
      yamlDefinition: body.yaml_definition || body.yamlDefinition,
      parameters: body.parameters || [],
      createdBy: body.createdBy || null,
    });
    return reply.code(201).send(template);
  });

  // Update template
  fastify.put('/pipeline-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request.query as any)?.tenantId || 'default';
    const body = request.body as any;
    const template = await service.updateTemplate(tenantId, id, {
      name: body.name,
      description: body.description,
      tags: body.tags,
      yamlDefinition: body.yaml_definition || body.yamlDefinition,
      parameters: body.parameters,
    });
    if (!template) return reply.code(404).send({ error: 'Template not found' });
    return template;
  });

  // Delete template
  fastify.delete('/pipeline-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request.query as any)?.tenantId || 'default';
    const deleted = await service.deleteTemplate(tenantId, id);
    if (!deleted) return reply.code(404).send({ error: 'Template not found' });
    return { success: true };
  });

  // List template versions
  fastify.get('/pipeline-templates/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    return service.listTemplateVersions(id, {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });
  });

  // Instantiate template into a pipeline
  fastify.post('/pipeline-templates/:id/instantiate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const tenantId = body.tenant_id || body.tenantId || 'default';
    const result = await service.instantiateTemplate(tenantId, id, {
      name: body.name,
      tenantId,
      projectId: body.project_id || body.projectId,
      params: body.params || {},
      createdBy: body.createdBy || null,
    });
    if (!result) return reply.code(404).send({ error: 'Template not found' });
    return reply.code(201).send(result);
  });

  // ==================== Template Marketplace ====================

  // Search templates with full-text search
  fastify.get('/pipeline-templates/search', async (request) => {
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    return service.searchTemplates({
      tenantId,
      query: query.q || query.query,
      category: query.category,
      tags: query.tags ? query.tags.split(',') : undefined,
      isPublic: query.isPublic !== undefined ? query.isPublic === 'true' : undefined,
      minRating: query.minRating ? parseFloat(query.minRating) : undefined,
      sortBy: query.sortBy || 'popular',
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });
  });

  // Rate a template
  fastify.post('/pipeline-templates/:id/rate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const tenantId = body.tenantId || 'default';

    try {
      const result = await service.rateTemplate({
        templateId: id,
        tenantId,
        rating: body.rating,
        comment: body.comment,
        ratedBy: body.ratedBy || 'anonymous',
      });
      return result;
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // Fork a template
  fastify.post('/pipeline-templates/:id/fork', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const tenantId = body.tenantId || 'default';

    const forked = await service.forkTemplate({
      sourceTemplateId: id,
      tenantId,
      name: body.name,
      description: body.description,
      createdBy: body.createdBy,
    });
    if (!forked) return reply.code(404).send({ error: 'Source template not found' });
    return reply.code(201).send(forked);
  });

  // Publish/unpublish template
  fastify.post('/pipeline-templates/:id/publish', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const tenantId = body.tenantId || 'default';

    const template = await service.publishTemplate({
      templateId: id,
      tenantId,
      isPublic: body.isPublic,
      author: body.author,
      thumbnail: body.thumbnail,
      readme: body.readme,
    });
    if (!template) return reply.code(404).send({ error: 'Template not found' });
    return template;
  });

  // Get template ratings
  fastify.get('/pipeline-templates/:id/ratings', async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    return service.getTemplateRatings(id, {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });
  });

  // Get template statistics
  fastify.get('/pipeline-templates-stats', async (request) => {
    const query = request.query as any;
    return service.getTemplateStats(query.tenantId);
  });
}
