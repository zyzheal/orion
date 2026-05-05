/**
 * Artifact Operations API Routes
 *
 * Routes under /v1/artifact-ops
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ArtifactOpsController } from './controllers/ArtifactOpsController';

const controller = new ArtifactOpsController();

export default async function artifactOpsRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/artifact-ops/track - Track operation
  app.post('/track', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.trackOperation(request, reply);
  });

  // GET /v1/artifact-ops/history/:artifactId - Get operation history
  app.get('/history/:artifactId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getOperationHistory(request, reply);
  });

  // GET /v1/artifact-ops/stats/:artifactId - Get artifact stats
  app.get('/stats/:artifactId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getArtifactStats(request, reply);
  });

  // POST /v1/artifact-ops/retention - Define retention policy
  app.post('/retention', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.defineRetentionPolicy(request, reply);
  });

  // POST /v1/artifact-ops/cleanup - Cleanup artifacts
  app.post('/cleanup', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.cleanup(request, reply);
  });

  // POST /v1/artifact-ops/scan/:artifactId - Scan artifact
  app.post('/scan/:artifactId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.scanArtifact(request, reply);
  });
}
