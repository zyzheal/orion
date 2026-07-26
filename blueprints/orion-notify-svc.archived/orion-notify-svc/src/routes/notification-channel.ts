import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../utils/database';
import { NotificationChannelRepository } from '../services/NotificationChannelRepository';
import { NotificationChannelService } from '../services/NotificationChannelService';

export async function notificationChannelRoutes(app: FastifyInstance) {
  const pool = getPool();
  const channelRepo = new NotificationChannelRepository(pool);
  const channelService = new NotificationChannelService(channelRepo);

  // POST / - Create a notification channel
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const channel = await channelService.createChannel({
        tenantId: body.tenantId,
        name: body.name,
        type: body.type,
        enabled: body.enabled ?? true,
        config: body.config ?? {},
      });
      return reply.status(201).send(channel);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET / - List notification channels
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { tenantId?: string; enabledOnly?: string };
    const tenantId = query.tenantId || 'default';
    const enabledOnly = query.enabledOnly === 'true';

    const channels = await channelService.listChannels(tenantId, enabledOnly);
    return reply.send(channels);
  });

  // GET /:id - Get a notification channel
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const channel = await channelService.getChannel(params.id);
    if (!channel) {
      return reply.status(404).send({ error: `Channel not found: ${params.id}` });
    }
    return reply.send(channel);
  });

  // PATCH /:id - Update a notification channel
  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as any;
    const channel = await channelService.updateChannel(params.id, body);
    if (!channel) {
      return reply.status(404).send({ error: `Channel not found: ${params.id}` });
    }
    return reply.send(channel);
  });

  // DELETE /:id - Delete a notification channel
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await channelService.deleteChannel(params.id);
    if (!deleted) {
      return reply.status(404).send({ error: `Channel not found: ${params.id}` });
    }
    return reply.status(204).send();
  });

  // POST /:id/test - Test a notification channel
  app.post('/:id/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const result = await channelService.testChannel(params.id);
    return reply.send(result);
  });

  // POST /send - Send a notification
  app.post('/send', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const result = await channelService.sendNotification({
      tenantId: body.tenantId ?? '',
      channelType: body.channelType,
      config: body.config ?? {},
      subject: body.subject,
      message: body.message,
      recipients: body.recipients ?? [],
    });
    return reply.send(result);
  });
}
