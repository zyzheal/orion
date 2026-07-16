/**
 * Scheduled Notification API Routes
 *
 * CRUD + lifecycle for scheduled notifications with multi-tenant isolation.
 * Mounted under /api/v1/notifications/scheduled
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ScheduledNotificationService } from '../services/notification/ScheduledNotificationService';
import { ScheduledNotificationRepository } from '../repositories/ScheduledNotificationRepository';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

const logger = createLogger('scheduled-notification-routes');

interface ScheduledNotificationRoutesOptions {
  database?: DatabasePool;
}

export default async function scheduledNotificationRoutes(
  app: FastifyInstance,
  options: ScheduledNotificationRoutesOptions
): Promise<void> {
  const pool = options.database;
  if (!pool) {
    logger.warn('[ScheduledNotificationRoutes] No database pool provided');
    return;
  }

  const repository = new ScheduledNotificationRepository(pool);
  const service = new ScheduledNotificationService(repository);

  const getContextTenantId = (request: FastifyRequest): string => {
    const tid = (request as any).user?.tenantId;
    if (!tid) {
      throw new OrionError('租户ID缺失：用户认证信息中必须包含 tenantId', 'VALIDATION_ERROR');
    }
    return tid;
  };

  // =========================================================================
  // POST / - Create scheduled notification
  // =========================================================================
  app.post(
    '/',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getContextTenantId(request);
        const body = request.body as {
          user_id: string;
          type: string;
          title: string;
          message: string;
          channel?: string;
          scheduled_at: string | Date;
          template_id?: string;
        };

        if (!body.user_id || !body.type || !body.title || !body.message || !body.scheduled_at) {
          return handleError(reply, new ValidationError('user_id, type, title, message, and scheduled_at are required'));
        }

        const scheduledAt = typeof body.scheduled_at === 'string'
          ? new Date(body.scheduled_at)
          : body.scheduled_at;

        const notification = await (service as any).createScheduledNotification({
          ...body,
          tenant_id: tenantId,
          scheduled_at: scheduledAt,
        });

        return reply.status(201).send({ success: true, data: notification });
      } catch (error) {
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[ScheduledNotificationRoutes] Error creating scheduled notification'
        );
        return handleError(reply as FastifyReply, error);
      }
    }
  );

  // =========================================================================
  // GET /:id - Get scheduled notification detail
  // =========================================================================
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'read' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const notification = await (service as any).getScheduledNotification(id);
        return reply.send({ success: true, data: notification });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[ScheduledNotificationRoutes] Error fetching scheduled notification'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET / - List scheduled notifications
  // =========================================================================
  app.get(
    '/',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { userId?: string; status?: string; limit?: string; offset?: string };

        const notifications = await (service as any).listScheduledNotifications({
          userId: query.userId,
          status: query.status,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
          offset: query.offset ? parseInt(query.offset, 10) : undefined,
        });

        return reply.send({ success: true, data: notifications });
      } catch (error) {
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[ScheduledNotificationRoutes] Error listing scheduled notifications'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // PUT /:id - Update scheduled notification
  // =========================================================================
  app.put<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'write' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = request.body as {
          title?: string;
          message?: string;
          scheduled_at?: string | Date;
          status?: string;
        };

        const updates: any = { ...body };
        if (body.scheduled_at) {
          updates.scheduled_at = typeof body.scheduled_at === 'string'
            ? new Date(body.scheduled_at)
            : body.scheduled_at;
        }

        const notification = await (service as any).updateScheduledNotification(id, updates);
        return reply.send({ success: true, data: notification });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[ScheduledNotificationRoutes] Error updating scheduled notification'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // POST /:id/cancel - Cancel scheduled notification
  // =========================================================================
  app.post<{ Params: { id: string } }>(
    '/:id/cancel',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'write' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        await (service as any).cancelScheduledNotification(id);
        return reply.send({ success: true, message: 'Scheduled notification cancelled' });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[ScheduledNotificationRoutes] Error cancelling scheduled notification'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // DELETE /:id - Delete scheduled notification
  // =========================================================================
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'write' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        await (service as any).deleteScheduledNotification(id);
        return reply.send({ success: true, message: 'Scheduled notification deleted' });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[ScheduledNotificationRoutes] Error deleting scheduled notification'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
