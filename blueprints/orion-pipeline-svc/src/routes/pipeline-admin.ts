import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { PipelineValidator, ValidationResult } from '../services/PipelineValidator';
import { PipelineVersionService, CreateVersionInput } from '../services/PipelineVersionService';

export async function pipelineAdminRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  const validator = new PipelineValidator();
  const versionService = opts.database ? new PipelineVersionService(opts.database) : null;

  // List pipeline versions
  fastify.get('/pipelines/:id/versions', async (request, reply) => {
    if (!versionService) {
      return reply.code(503).send({ error: 'Version service not available' });
    }

    const pipelineId = (request.params as any).id;
    const query = request.query as any;

    const result = await versionService.listVersions(pipelineId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      tag: query.tag,
    });

    return reply.send(result);
  });

  // Validate pipeline YAML
  fastify.post('/pipelines/validate', async (request, reply) => {
    const body = request.body as any;
    const yamlString = body.yaml || body.spec || '';

    if (!yamlString) {
      return reply.code(400).send({ error: 'YAML definition is required' });
    }

    const result: ValidationResult = validator.validate(yamlString);

    return reply.send({
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
    });
  });

  // Create a new version from YAML
  fastify.post('/pipelines/:id/versions', async (request, reply) => {
    if (!versionService) {
      return reply.code(503).send({ error: 'Version service not available' });
    }

    const pipelineId = (request.params as any).id;
    const body = request.body as any;

    if (!body.yamlDefinition) {
      return reply.code(400).send({ error: 'yamlDefinition is required' });
    }

    // Validate before creating
    const validation = validator.validate(body.yamlDefinition);
    if (!validation.valid) {
      return reply.code(400).send({ error: 'Invalid pipeline definition', validation });
    }

    const nextVersion = await versionService.getLatestVersionNumber(pipelineId) + 1;

    const input: CreateVersionInput = {
      pipelineId,
      version: nextVersion,
      yamlDefinition: body.yamlDefinition,
      spec: body.spec || {},
      changeSummary: body.changeSummary,
      createdBy: body.createdBy,
      parentVersionId: body.parentVersionId,
    };

    const version = await versionService.createVersion(input);
    return reply.code(201).send(version);
  });

  // Diff two versions
  fastify.get('/pipelines/:id/versions/:v1/diff/:v2', async (request, reply) => {
    if (!versionService) {
      return reply.code(503).send({ error: 'Version service not available' });
    }

    const pipelineId = (request.params as any).id;
    const v1 = (request.params as any).v1;
    const v2 = (request.params as any).v2;

    const diff = await versionService.diffVersions(pipelineId, v1, v2);
    if (!diff) {
      return reply.code(404).send({ error: 'One or both versions not found' });
    }

    return reply.send(diff);
  });

  // Rollback to a version
  fastify.post('/pipelines/:id/versions/:versionId/rollback', async (request, reply) => {
    if (!versionService) {
      return reply.code(503).send({ error: 'Version service not available' });
    }

    const pipelineId = (request.params as any).id;
    const versionId = (request.params as any).versionId;
    const body = request.body as any;

    const version = await versionService.rollbackToVersion(pipelineId, versionId, {
      reason: body.reason,
      createdBy: body.createdBy,
    });

    if (!version) {
      return reply.code(404).send({ error: 'Version not found' });
    }

    return reply.send(version);
  });

  // Set/unset baseline
  fastify.put('/pipelines/:id/versions/:versionId/baseline', async (request, reply) => {
    if (!versionService) {
      return reply.code(503).send({ error: 'Version service not available' });
    }

    const pipelineId = (request.params as any).id;
    const versionId = (request.params as any).versionId;
    const body = request.body as any;

    const success = await versionService.setBaseline(pipelineId, versionId, body.isBaseline ?? true);
    if (!success) {
      return reply.code(404).send({ error: 'Version not found' });
    }

    return reply.send({ success: true });
  });
}
