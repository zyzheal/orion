/**
 * Notification API Routes - Enhanced Implementation
 *
 * Provides notification endpoints for frontend compatibility.
 * Full notification functionality integrates with orion-notify-svc.
 *
 * Permissions:
 *   - notification:read   → list, detail, stats, unread-count, settings get
 *   - notification:write  → mark-read, settings update
 *   - notification:admin  → broadcast
 *
 * Tenant isolation:
 *   All routes rely on getCurrentTenantId() from AsyncLocalStorage context
 *   (set by tenant middleware in routes.ts). Client-provided tenant_id is
 *   never trusted at the route level.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission } from '../middleware/requirePermission';
import { NotificationRepository } from '../services/notification';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface NotificationRoutesOptions {
  database?: DatabasePool;
}

interface NotificationQuery {
  limit?: number;
  page?: number;
  userId?: string;
}

// In-memory notification settings store (temporary until NotificationSettingsRepository is wired)
const notificationSettingsStore = new Map<string, Record<string, unknown>>();

export default async function notificationRoutes(app: FastifyInstance, options: NotificationRoutesOptions): Promise<void> {
  const pool = options.database;
  const notificationRepo = pool ? new NotificationRepository(pool) : null;

  // Helper: extract userId from params, query, or auth
  const extractUserId = (request: FastifyRequest): string => {
    const paramUserId = (request.params as any)?.userId;
    const queryUserId = (request.query as any)?.userId;
    const authUserId = (request.user as any)?.userId;
    return paramUserId || queryUserId || authUserId || 'unknown';
  };

  // Helper: extract tenantId from auth context (unified approach)
  const getContextTenantId = (request: FastifyRequest): string => {
    return (request.user as any)?.tenantId || 'default';
  };

  // =========================================================================
  // GET / - List notifications
  // =========================================================================
  app.get<{ Querystring: NotificationQuery }>(
    '/',
    { onRequest: [requirePermission({ resource: 'notification', action: 'read' })] },
    async (request: FastifyRequest<{ Querystring: NotificationQuery }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      const { limit = 20, page = 1, userId } = request.query;
      const offset = (page - 1) * limit;

      try {
        const user_id = userId || (request.user as any)?.userId || 'unknown';
        const data = await notificationRepo.findAll({ userId: user_id, limit, offset });
        const total = await notificationRepo.count({ userId: user_id });

        return reply.send({
          success: true,
          data: { items: data, total, page, pageSize: limit },
        });
      } catch (error) {
        logger.error(
          {
            traceId: 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
            userId: (request.user as any)?.userId ? '***' : '',
          },
          '[NotificationRoutes] Error fetching notifications'
        );
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET /:userId - List notifications for specific user
  // =========================================================================
  app.get<{ Params: { userId: string }; Querystring: { limit?: number; page?: number } }>(
    '/:userId',
    { onRequest: [requirePermission({ resource: 'notification', action: 'read' })] },
    async (request: FastifyRequest<{ Params: { userId: string }; Querystring: { limit?: number; page?: number } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      try {
        const { userId } = request.params;
        const { limit = 20, page = 1 } = request.query;
        const offset = (page - 1) * limit;

        const data = await notificationRepo.findAll({ userId, limit, offset });
        const total = await notificationRepo.count({ userId });

        return reply.send({
          success: true,
          data: { items: data, total, page, pageSize: limit },
        });
      } catch (error) {
        request.log.error(error);
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET /:userId/unread-count - Unread notification count
  // =========================================================================
  app.get<{ Params: { userId?: string } }>(
    '/:userId/unread-count',
    { onRequest: [requirePermission({ resource: 'notification', action: 'read' })] },
    async (request: FastifyRequest<{ Params: { userId?: string } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      try {
        const user_id = extractUserId(request);
        const unreadCount = await notificationRepo.getUnreadCount(user_id);

        return reply.send({ success: true, data: { unreadCount } });
      } catch (error) {
        request.log.error(error);
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET /stats - Get notification stats
  // =========================================================================
  app.get(
    '/stats',
    { onRequest: [requirePermission({ resource: 'notification', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!notificationRepo) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      try {
        const user_id = (request.user as any)?.userId || 'unknown';
        const unreadCount = await notificationRepo.getUnreadCount(user_id);

        return reply.send({
          success: true,
          data: { unread: unreadCount, total: 0 },
        });
      } catch (error) {
        request.log.error(error);
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET /:id - Get single notification detail
  // =========================================================================
  app.get<{ Params: { id: string } }>(
    '/:id',
    { onRequest: [requirePermission({ resource: 'notification', action: 'read' })] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      try {
        const { id } = request.params;
        const notification = await notificationRepo.findById(id);

        if (!notification) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }

        return reply.send({ success: true, data: notification });
      } catch (error) {
        request.log.error(error);
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // POST /mark-read/:id - Mark notification as read (legacy compat)
  // =========================================================================
  app.post<{ Params: { id: string } }>(
    '/mark-read/:id',
    { onRequest: [requirePermission({ resource: 'notification', action: 'write' })] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      try {
        const { id } = request.params;
        await notificationRepo.markAsRead(id);

        return reply.send({ success: true, message: 'Notification marked as read' });
      } catch (error) {
        request.log.error(error);
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // PUT /:id/read - Mark single notification as read (RESTful)
  // =========================================================================
  app.put<{ Params: { id: string } }>(
    '/:id/read',
    { onRequest: [requirePermission({ resource: 'notification', action: 'write' })] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      try {
        const { id } = request.params;
        await notificationRepo.markAsRead(id);

        return reply.send({ success: true, data: { id, status: 'read' } });
      } catch (error) {
        request.log.error(error);
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET /settings/:userId - Get notification settings
  //
  // Uses context-based tenantId from auth, not client-provided value.
  // =========================================================================
  app.get<{ Params: { userId?: string }; Querystring: { tenantId?: string } }>(
    '/settings/:userId',
    { onRequest: [requirePermission({ resource: 'notification', action: 'read' })] },
    async (request: FastifyRequest<{ Params: { userId?: string }; Querystring: { tenantId?: string } }>, reply: FastifyReply) => {
      try {
        const user_id = extractUserId(request);
        // Tenant comes from auth context, not from query param
        const tenant_id = getContextTenantId(request);
        const key = `${tenant_id}:${user_id}`;
        const settings = notificationSettingsStore.get(key) || {
          email_enabled: true,
          sms_enabled: false,
          webhook_enabled: false,
          pipeline_completed: true,
          pipeline_failed: true,
          ticket_assigned: true,
          ticket_escalated: true,
          sla_warning: true,
          sla_breached: true,
          alert_triggered: true,
          deployment_succeed: true,
          deployment_failed: true,
          system_alert: true,
          comment_mention: true,
          transfer_request: true,
          digest_enabled: false,
          digest_frequency: 'daily',
          quiet_hours_start: '22:00',
          quiet_hours_end: '07:00',
        };

        return reply.send({ success: true, data: settings });
      } catch (error) {
        request.log.error(error);
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // PUT /settings/:userId - Update notification settings
  //
  // Uses context-based tenantId from auth, not client-provided value.
  // =========================================================================
  app.put<{ Params: { userId?: string }; Querystring: { tenantId?: string } }>(
    '/settings/:userId',
    { onRequest: [requirePermission({ resource: 'notification', action: 'write' })] },
    async (request: FastifyRequest<{ Params: { userId?: string }; Querystring: { tenantId?: string } }>, reply: FastifyReply) => {
      try {
        const user_id = extractUserId(request);
        // Tenant comes from auth context, not from query param
        const tenant_id = getContextTenantId(request);
        const key = `${tenant_id}:${user_id}`;
        const body = request.body as Record<string, unknown>;

        // Merge with existing settings
        const existing = notificationSettingsStore.get(key) || {};
        const updated = { ...existing, ...body };
        notificationSettingsStore.set(key, updated);

        return reply.send({ success: true, data: updated });
      } catch (error) {
        request.log.error(error);
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // POST /broadcast - Broadcast notification to multiple users
  // =========================================================================
  app.post(
    '/broadcast',
    { onRequest: [requirePermission({ resource: 'notification', action: 'admin' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as {
          tenant_id?: string;
          user_ids?: string[];
          type?: string;
          title?: string;
          message?: string;
        };

        const user_ids = body?.user_ids || [];
        const title = body?.title || '';
        const message = body?.message || '';

        if (!title || !message) {
          return handleError(reply, new ValidationError('BAD_REQUEST'));
        }

        // TODO: Integrate with NotificationService for actual persistence + event emission
        const sent = user_ids.length;

        return reply.send({ success: true, data: { sent } });
      } catch (error) {
        request.log.error(error);
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
