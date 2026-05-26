/**
 * Notification API Routes - Minimal Implementation
 *
 * Provides basic notification endpoints for frontend compatibility
 * Note: Full notification functionality requires orion-notify-svc
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

export default async function notificationRoutes(app: FastifyInstance, options: NotificationRoutesOptions): Promise<void> {
  const pool = options.database;
  const notificationRepo = pool ? new NotificationRepository(pool) : null;

  // GET /api/v1/notifications - List notifications
  app.get<{ Querystring: NotificationQuery }>(
    '/',
    {
      onRequest: [authenticateUser],
    },
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
          data: {
            items: data,
            total,
            page,
            pageSize: limit,
          },
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

  // GET /api/v1/notifications/stats - Get notification stats
  app.get(
    '/stats',
    {
      onRequest: [authenticateUser],
    },
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
          data: {
            unread: unreadCount,
            total: 0,
          },
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

  // POST /api/v1/notifications/mark-read - Mark notification as read
  app.post<{ Params: { id: string } }>(
    '/mark-read/:id',
    {
      onRequest: [authenticateUser],
    },
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

        return reply.send({
          success: true,
          message: 'Notification marked as read',
        });
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
}