/**
 * Notification API Routes (M8/M33)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService, NotificationServiceError } from '../services/notification';
import { NotificationRepository, NotificationSettingsRepository, NotificationSettingsService } from '../services/notification';

import { DatabasePool } from '../services/database';

interface NotificationRoutesOptions {
  notificationService?: NotificationService;
  database?: DatabasePool;
}

export default async function notificationRoutes(app: FastifyInstance, options: NotificationRoutesOptions): Promise<void> {
  const pool = options.database;
  const notificationRepo = pool ? new NotificationRepository(pool) : undefined;
  const service = options.notificationService || (notificationRepo ? new NotificationService(notificationRepo) : undefined as any);
  const settingsRepo = pool ? new NotificationSettingsRepository(pool) : undefined as any;
  const settingsService = settingsRepo ? new NotificationSettingsService(settingsRepo) : undefined as any;

  // Error handler
  function handleNotificationError(error: NotificationServiceError, reply: FastifyReply) {
    return reply.status(error.code === 'NOT_FOUND' ? 404 : 400).send({
      error: error.name,
      message: error.message,
      code: error.code,
    });
  }

  // POST /api/v1/notifications/send - Send notification
  app.post<{
    Body: {
      tenant_id: string;
      user_id: string;
      type: string;
      title: string;
      message: string;
      channel?: string;
      metadata?: Record<string, any>;
    };
  }>('/send', async (request, reply) => {
    try {
      const notification = await service.send(request.body);
      return reply.status(201).send(notification);
    } catch (err) {
      if (err instanceof NotificationServiceError) return handleNotificationError(err, reply);
      throw err;
    }
  });

  // GET /api/v1/notifications/:userId - Get user notifications
  app.get<{
    Params: { userId: string };
    Querystring: { limit?: number };
  }>('/:userId', async (request, reply) => {
    try {
      const { userId } = request.params;
      const { limit } = request.query;
      const notifications = await service.getNotifications(userId, limit);
      return reply.send(notifications);
    } catch (err) {
      if (err instanceof NotificationServiceError) return handleNotificationError(err, reply);
      throw err;
    }
  });

  // PUT /api/v1/notifications/:id/read - Mark as read
  app.put<{
    Params: { id: string };
  }>('/:id/read', async (request, reply) => {
    try {
      const notification = await service.markAsRead(request.params.id);
      return reply.send(notification);
    } catch (err) {
      if (err instanceof NotificationServiceError) return handleNotificationError(err, reply);
      throw err;
    }
  });

  // GET /api/v1/notifications/:userId/unread-count - Get unread count
  app.get<{
    Params: { userId: string };
  }>('/:userId/unread-count', async (request, reply) => {
    try {
      const count = await service.getUnreadCount(request.params.userId);
      return reply.send({ userId: request.params.userId, unreadCount: count });
    } catch (err) {
      if (err instanceof NotificationServiceError) return handleNotificationError(err, reply);
      throw err;
    }
  });

  // POST /api/v1/notifications/broadcast - Broadcast to multiple users
  app.post<{
    Body: {
      tenant_id: string;
      user_ids: string[];
      type: string;
      title: string;
      message: string;
    };
  }>('/broadcast', async (request, reply) => {
    try {
      const { tenant_id, user_ids, type, title, message } = request.body;
      const count = await service.broadcast(tenant_id, user_ids, type, title, message);
      return reply.send({ sent: count });
    } catch (err) {
      if (err instanceof NotificationServiceError) return handleNotificationError(err, reply);
      throw err;
    }
  });

  // GET /api/v1/notifications/settings/:userId - Get notification settings
  app.get<{
    Params: { userId: string };
    Querystring: { tenantId?: string };
  }>('/settings/:userId', async (request, reply) => {
    try {
      const { userId } = request.params;
      const tenantId = request.query.tenantId || 'default';
      const settings = await settingsService.getSettings(userId, tenantId);
      return reply.send(settings);
    } catch (err) {
      if (err instanceof NotificationServiceError) return handleNotificationError(err, reply);
      throw err;
    }
  });

  // PUT /api/v1/notifications/settings/:userId - Update notification settings
  app.put<{
    Params: { userId: string };
    Body: Record<string, any>;
    Querystring: { tenantId?: string };
  }>('/settings/:userId', async (request, reply) => {
    try {
      const { userId } = request.params;
      const tenantId = request.query.tenantId || 'default';
      const settings = await settingsService.updateSettings(userId, tenantId, request.body);
      return reply.send(settings);
    } catch (err) {
      if (err instanceof NotificationServiceError) return handleNotificationError(err, reply);
      throw err;
    }
  });
}
