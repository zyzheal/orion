import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../utils/database';
import { NotificationService } from '../services/NotificationService';
import { NotificationRepository } from '../services/NotificationRepository';
import { NotificationSettingsService } from '../services/NotificationSettingsService';
import { NotificationSettingsRepository } from '../services/NotificationSettingsRepository';

export async function notificationRoutes(app: FastifyInstance) {
  const pool = getPool();
  const notifRepo = new NotificationRepository(pool);
  const notifService = new NotificationService(notifRepo);
  const settingsRepo = new NotificationSettingsRepository(pool);
  const settingsService = new NotificationSettingsService(settingsRepo);

  app.post('/send', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const notification = await notifService.send(body);
      return reply.status(201).send(notification);
    } catch (err: any) {
      return reply.status(err.code === 'NOT_FOUND' ? 404 : 400).send({ error: err.message });
    }
  });

  app.get('/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { userId: string };
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const notifications = await notifService.getNotifications(params.userId, limit);
    return reply.send(notifications);
  });

  app.put('/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const notification = await notifService.markAsRead(params.id);
    return reply.send(notification);
  });

  app.get('/:userId/unread-count', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { userId: string };
    const count = await notifService.getUnreadCount(params.userId);
    return reply.send({ userId: params.userId, unreadCount: count });
  });

  app.post('/broadcast', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const count = await notifService.broadcast(body.tenant_id, body.user_ids, body.type, body.title, body.message);
    return reply.send({ sent: count });
  });

  app.get('/settings/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { userId: string };
    const query = request.query as { tenantId?: string };
    const settings = await settingsService.getSettings(params.userId, query.tenantId || 'default');
    return reply.send(settings);
  });

  app.put('/settings/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { userId: string };
    const query = request.query as { tenantId?: string };
    const body = request.body as any;
    const settings = await settingsService.updateSettings(params.userId, query.tenantId || 'default', body);
    return reply.send(settings);
  });
}
