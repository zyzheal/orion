/**
 * Workbench API Routes — Personal unified dashboard backend
 *
 * GET /api/v1/workbench — Aggregate pipeline/alerts/tickets/deployments
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkbenchService } from '../services/workbench/WorkbenchService';
import { DatabasePool } from '../services/database';

interface WorkbenchRoutesOptions {
  database?: DatabasePool;
}

export default async function workbenchRoutes(app: FastifyInstance, options: WorkbenchRoutesOptions): Promise<void> {
  const pool = options.database;
  const workbenchService = pool ? new WorkbenchService(pool) : undefined;

  // GET /api/v1/workbench — Personal aggregated workbench
  app.get<{
    Querystring: { tenantId?: string; userId?: string };
  }>('/', async (request, reply) => {
    if (!workbenchService) {
      return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Database not connected' });
    }

    const tenantId = request.query.tenantId || 'default';
    const userId = request.query.userId || (request.user as any)?.id || 'anonymous';

    const data = await workbenchService.getWorkbench(userId, tenantId);
    return reply.send({ success: true, data });
  });
}
