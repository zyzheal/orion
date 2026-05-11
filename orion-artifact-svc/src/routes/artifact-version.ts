/**
 * Artifact Version API Routes
 *
 * - POST   /api/v1/artifact-versions                     — Create version
 * - GET    /api/v1/artifact-versions                     — List versions
 * - GET    /api/v1/artifact-versions/:id                 — Get version details
 * - POST   /api/v1/artifact-versions/:id/promote         — Promote version to environment
 * - GET    /api/v1/artifact-versions/:id/lineage         — Get version lineage (ancestors + descendants)
 * - POST   /api/v1/artifact-versions/:id/tags/:tag       — Add tag
 * - DELETE /api/v1/artifact-versions/:id/tags/:tag       — Remove tag
 * - GET    /api/v1/artifact-versions/tag/:tag            — Find versions by tag
 * - GET    /api/v1/artifact-versions/pipeline/:pipelineId/history — Get deployment history
 * - GET    /api/v1/artifact-versions/pipeline/:pipelineId/compare — Compare versions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ArtifactVersionService } from '../services/pipeline/ArtifactVersionService';
import { ArtifactVersionRepository } from '../repositories/ArtifactVersionRepository';

export default async function artifactVersionRoutes(app: FastifyInstance, opts: { database?: any }): Promise<void> {
  if (!opts.database) {
    app.get('/health', async () => ({ status: 'unavailable', reason: 'database not configured' }));
    return;
  }

  const repository = new ArtifactVersionRepository(opts.database);
  const service = new ArtifactVersionService(repository);

  // POST /api/v1/artifact-versions — Create artifact version
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const { tenantId, pipelineId, runId, stageName, artifactName, version, commitSha, branch, storagePath, metadata } = body;

    if (!tenantId || !pipelineId || !artifactName || !version) {
      return reply.code(400).send({
        error: 'Missing required fields: tenantId, pipelineId, artifactName, version',
      });
    }

    try {
      const result = await service.createVersion({
        tenantId, pipelineId, runId, stageName, artifactName, version, commitSha, branch, storagePath, metadata,
      });
      return reply.code(201).send({ data: result });
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });

  // GET /api/v1/artifact-versions — List versions
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const options: any = {
      pipelineId: query.pipelineId,
      artifactName: query.artifactName,
      environment: query.environment,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };

    const results = await repository.findWithFilters(options);
    return reply.send({ data: results.versions, total: results.total });
  });

  // GET /api/v1/artifact-versions/:id — Get version details
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const version = await service.getVersionById(params.id);

    if (!version) {
      return reply.code(404).send({ error: 'Artifact version not found' });
    }

    return reply.send({ data: version });
  });

  // POST /api/v1/artifact-versions/:id/promote — Promote version
  app.post('/:id/promote', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;

    if (!body.targetEnvironment) {
      return reply.code(400).send({ error: 'Missing required field: targetEnvironment' });
    }

    try {
      const result = await service.promoteVersion(params.id, body.targetEnvironment);
      return reply.send({ data: result });
    } catch (error: any) {
      if (error.message.includes('already promoted') || error.message.includes('not found')) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // GET /api/v1/artifact-versions/:id/lineage — Get version lineage
  app.get('/:id/lineage', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;

    try {
      const lineage = await service.getVersionLineage(params.id);
      return reply.send({ data: lineage });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  // POST /api/v1/artifact-versions/:id/tags/:tag — Add tag
  app.post('/:id/tags/:tag', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;

    try {
      const result = await service.addTag(params.id, params.tag);
      return reply.send({ data: result });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  // DELETE /api/v1/artifact-versions/:id/tags/:tag — Remove tag
  app.delete('/:id/tags/:tag', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;

    try {
      await service.removeTag(params.id, params.tag);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // GET /api/v1/artifact-versions/tag/:tag — Find versions by tag
  app.get('/tag/:tag', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const versions = await service.findVersionsByTag(params.tag);
    return reply.send({ data: versions, total: versions.length });
  });

  // GET /api/v1/artifact-versions/pipeline/:pipelineId/history — Get deployment history
  app.get('/pipeline/:pipelineId/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const query = request.query as any;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;

    const history = await service.getDeploymentHistory(params.pipelineId, limit);
    return reply.send({ data: history });
  });

  // GET /api/v1/artifact-versions/pipeline/:pipelineId/compare — Compare versions
  app.get('/pipeline/:pipelineId/compare', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const query = request.query as any;

    if (!query.versionA || !query.versionB) {
      return reply.code(400).send({ error: 'Missing required query params: versionA, versionB' });
    }

    const diff = await service.compareVersions(params.pipelineId, query.versionA, query.versionB);
    return reply.send({ data: diff });
  });
}
