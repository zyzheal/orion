/**
 * Pipeline Error Detail Routes
 *
 * Provides structured error classification for failed pipeline runs.
 * Mounts under prefix: /v1/pipelines
 *
 * Routes:
 *   GET /api/v1/pipelines/:runId/error-detail — Returns classified error info
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PipelineErrorDetailController } from './controllers/PipelineErrorDetailController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface PipelineErrorRoutesOptions {
  database?: DatabasePool;
}

export default async function registerPipelineErrorDetailRoutes(
  app: FastifyInstance,
  opts: PipelineErrorRoutesOptions
): Promise<void> {
  if (!opts.database) {
    throw new Error('Pipeline error detail routes require a database connection');
  }

  const controller = new PipelineErrorDetailController(opts.database);

  // GET /api/v1/pipelines/:runId/error-detail
  app.get(
    '/:runId/error-detail',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
      return controller.getErrorDetail(request, reply);
    }
  );
}
