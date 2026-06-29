/**
 * Notification API Routes - Enhanced Implementation
 *
 * Provides notification endpoints for frontend compatibility.
 * Full notification functionality integrates with orion-notify-svc.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { NotificationRepository } from '../services/notification';
import { DatabasePool } from '../services/database';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface NotificationRoutesOptions {
  database?: DatabasePool;
}

interface NotificationQuery {
  limit?: number;
  page?: number;
  userId?: string;
}

// In-memory notification settings store (temporary until NotificationSettingsRepository)
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

  // Helper: extract tenantId
  const extractTenantId = (request: FastifyRequest): string => {
    const bodyTenantId = (request.body as any)?.tenant_id;
    const queryTenantId = (request.query as any)?.tenantId;
    return bodyTenantId || queryTenantId || 'default';
  };

  // =========================================================================
  // GET / - List notifications
  // =========================================================================
  app.get<{ Querystring: NotificationQuery }>(
    '/',
    { onRequest: [authenticateUser] },
    async (request: FastifyRequest<{ Querystring: NotificationQuery }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return reply.status(503).send({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Notification service not configured',
        });
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
            tenantId: 'unknown-tenant',
            error: error instanceof Error ? error.message : error,
            userId: (request.user as any)?.userId ? '***' : '',
          },
          '[NotificationRoutes] Error fetching notifications'
        );
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch notifications',
        });
      }
    }
  );

  // =========================================================================
  // GET /:userId - List notifications for specific user
  // =========================================================================
  app.get<{ Params: { userId: string }; Querystring: { limit?: number; page?: number } }>(
    '/:userId',
    { onRequest: [authenticateUser] },
    async (request: FastifyRequest<{ Params: { userId: string }; Querystring: { limit?: number; page?: number } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return reply.status(503).send({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Notification service not configured',
        });
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
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch notifications',
        });
      }
    }
  );

  // =========================================================================
  // GET /:userId/unread-count - Unread notification count (NEW)
  // =========================================================================
  app.get<{ Params: { userId?: string } }>(
    '/:userId/unread-count',
    { onRequest: [authenticateUser] },
    async (request: FastifyRequest<{ Params: { userId?: string } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return reply.status(503).send({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Notification service not configured',
        });
      }

      try {
        const user_id = extractUserId(request);
        const unreadCount = await notificationRepo.getUnreadCount(user_id);

        return reply.send({ success: true, data: { unreadCount } });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get unread count',
        });
      }
    }
  );

  // =========================================================================
  // GET /stats - Get notification stats
  // =========================================================================
  app.get(
    '/stats',
    { onRequest: [authenticateUser] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!notificationRepo) {
        return reply.status(503).send({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Notification service not configured',
        });
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
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch stats',
        });
      }
    }
  );

  // =========================================================================
  // GET /:id - Get single notification detail (NEW)
  // =========================================================================
  app.get<{ Params: { id: string } }>(
    '/:id',
    { onRequest: [authenticateUser] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return reply.status(503).send({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Notification service not configured',
        });
      }

      try {
        const { id } = request.params;
        const notification = await notificationRepo.findById(id);

        if (!notification) {
          return reply.status(404).send({
            success: false,
            error: 'NOT_FOUND',
            message: `Notification ${id} not found`,
          });
        }

        return reply.send({ success: true, data: notification });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch notification',
        });
      }
    }
  );

  // =========================================================================
  // POST /mark-read/:id - Mark notification as read (existing, kept for compat)
  // =========================================================================
  app.post<{ Params: { id: string } }>(
    '/mark-read/:id',
    { onRequest: [authenticateUser] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return reply.status(503).send({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Notification service not configured',
        });
      }

      try {
        const { id } = request.params;
        await notificationRepo.markAsRead(id);

        return reply.send({ success: true, message: 'Notification marked as read' });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to mark as read',
        });
      }
    }
  );

  // =========================================================================
  // PUT /:id/read - Mark single notification as read (NEW, RESTful)
  // =========================================================================
  app.put<{ Params: { id: string } }>(
    '/:id/read',
    { onRequest: [authenticateUser] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!notificationRepo) {
        return reply.status(503).send({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Notification service not configured',
        });
      }

      try {
        const { id } = request.params;
        await notificationRepo.markAsRead(id);

        return reply.send({ success: true, data: { id, status: 'read' } });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to mark as read',
        });
      }
    }
  );

  // =========================================================================
  // GET /settings/:userId - Get notification settings (NEW)
  // =========================================================================
  app.get<{ Params: { userId?: string }; Querystring: { tenantId?: string } }>(
    '/settings/:userId',
    { onRequest: [authenticateUser] },
    async (request: FastifyRequest<{ Params: { userId?: string }; Querystring: { tenantId?: string } }>, reply: FastifyReply) => {
      try {
        const user_id = extractUserId(request);
        const tenant_id = extractTenantId(request);
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
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get notification settings',
        });
      }
    }
  );

  // =========================================================================
  // PUT /settings/:userId - Update notification settings (NEW)
  // =========================================================================
  app.put<{ Params: { userId?: string }; Querystring: { tenantId?: string } }>(
    '/settings/:userId',
    { onRequest: [authenticateUser] },
    async (request: FastifyRequest<{ Params: { userId?: string }; Querystring: { tenantId?: string } }>, reply: FastifyReply) => {
      try {
        const user_id = extractUserId(request);
        const tenant_id = extractTenantId(request);
        const key = `${tenant_id}:${user_id}`;
        const body = request.body as Record<string, unknown>;

        // Merge with existing settings
        const existing = notificationSettingsStore.get(key) || {};
        const updated = { ...existing, ...body };
        notificationSettingsStore.set(key, updated);

        return reply.send({ success: true, data: updated });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update notification settings',
        });
      }
    }
  );

  // =========================================================================
  // POST /broadcast - Broadcast notification to multiple users (NEW)
  // =========================================================================
  app.post(
    '/broadcast',
    { onRequest: [authenticateUser] },
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
          return reply.status(400).send({
            success: false,
            error: 'BAD_REQUEST',
            message: 'Title and message are required for broadcast',
          });
        }

        // TODO: Integrate with NotificationEventPublisher for multi-channel delivery
        const sent = user_ids.length;

        return reply.send({ success: true, data: { sent } });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to broadcast notification',
        });
      }
    }
  );
}
