/**
 * Workbench API Routes — Personal unified dashboard backend
 *
 * GET /api/v1/workbench — Aggregate pipeline/alerts/tickets/deployments
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { WorkbenchService } from '../services/workbench/WorkbenchService';
import { DatabasePool } from '../services/database';
import { ServiceUnavailableError, handleError } from '../errors';

interface WorkbenchRoutesOptions {
  database?: DatabasePool;
}

export default async function workbenchRoutes(app: FastifyInstance, options: WorkbenchRoutesOptions): Promise<void> {
  const pool = options.database;
  const workbenchService = pool ? new WorkbenchService(pool) : undefined;

  // GET /api/v1/workbench — Personal aggregated workbench
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'workbench', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!workbenchService) {
      return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    }

    const query = request.query as { tenantId?: string; userId?: string };
    const tenantId = query.tenantId || 'default';
    const userId = query.userId || (request as any).user?.id || 'anonymous';

    const data = await workbenchService.getWorkbench(userId, tenantId);
    return reply.send({ success: true, data });
  });
}