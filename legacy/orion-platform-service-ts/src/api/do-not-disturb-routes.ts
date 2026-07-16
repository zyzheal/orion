/**
 * Do Not Disturb (DND) API Routes
 *
 * Manage do-not-disturb settings per user with multi-tenant isolation.
 * Mounted under /api/v1/notifications/dnd
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DoNotDisturbService } from '../services/notification/DoNotDisturbService';
import { DoNotDisturbRepository } from '../repositories/DoNotDisturbRepository';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

const logger = createLogger('do-not-disturb-routes');

interface DoNotDisturbRoutesOptions {
  database?: DatabasePool;
}

export default async function doNotDisturbRoutes(
  app: FastifyInstance,
  options: DoNotDisturbRoutesOptions
): Promise<void> {
  const pool = options.database;
  if (!pool) {
    logger.warn('[DoNotDisturbRoutes] No database pool provided');
    return;
  }

  const repository = new DoNotDisturbRepository(pool);
  const service = new DoNotDisturbService(repository);

  const getContextTenantId = (request: FastifyRequest): string => {
    const tid = (request as any).user?.tenantId;
    if (!tid) {
      throw new OrionError('租户ID缺失：用户认证信息中必须包含 tenantId', 'VALIDATION_ERROR');
    }
    return tid;
  };

  // =========================================================================
  // PUT /:userId - Set DND for user
  // =========================================================================
  app.put<{ Params: { userId: string } }>(
    '/:userId',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'write' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        const { userId } = request.params;
        const body = request.body as {
          start_time: string | Date;
          end_time: string | Date;
          reason?: string;
        };

        if (!body.start_time || !body.end_time) {
          return handleError(reply, new ValidationError('start_time and end_time are required'));
        }

        const startTime = typeof body.start_time === 'string'
          ? new Date(body.start_time)
          : body.start_time;
        const endTime = typeof body.end_time === 'string'
          ? new Date(body.end_time)
          : body.end_time;

        const dnd = await (service as any).setDnd(userId, startTime, endTime, body.reason);
        return reply.send({ success: true, data: dnd });
      } catch (error) {
        if (error instanceof Error && (error.message.includes('end_time') || error.message.includes('required'))) {
          return handleError(reply, new ValidationError(error.message));
        }
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
            userId: (request.params as any)?.userId || 'unknown',
          },
          '[DoNotDisturbRoutes] Error setting DND'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // DELETE /:userId - Clear DND for user
  // =========================================================================
  app.delete<{ Params: { userId: string } }>(
    '/:userId',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'write' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        const { userId } = request.params;
        await (service as any).clearDnd(userId);
        return reply.send({ success: true, message: 'DND cleared' });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
            userId: (request.params as any)?.userId || 'unknown',
          },
          '[DoNotDisturbRoutes] Error clearing DND'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET /:userId - Get DND settings for user
  // =========================================================================
  app.get<{ Params: { userId: string } }>(
    '/:userId',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'read' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        const { userId } = request.params;
        const dnd = await (service as any).getDndSettings(userId);
        return reply.send({ success: true, data: dnd });
      } catch (error) {
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
            userId: (request.params as any)?.userId || 'unknown',
          },
          '[DoNotDisturbRoutes] Error fetching DND settings'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET /:userId/active - Check if DND is currently active for user
  // =========================================================================
  app.get<{ Params: { userId: string } }>(
    '/:userId/active',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'read' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        const { userId } = request.params;
        const isActive = await (service as any).isDndActive(userId);
        return reply.send({ success: true, data: { isActive, userId } });
      } catch (error) {
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
            userId: (request.params as any)?.userId || 'unknown',
          },
          '[DoNotDisturbRoutes] Error checking DND status'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET /active/users - Get all users with active DND (admin)
  // =========================================================================
  app.get(
    '/active/users',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'admin' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const activeUsers = await (service as any).getActiveUsers();
        return reply.send({ success: true, data: activeUsers });
      } catch (error) {
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[DoNotDisturbRoutes] Error fetching active DND users'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
