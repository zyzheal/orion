/**
 * EventBus API Routes
 * NATS message bus status and control
 * Prefix: /api/v1/eventbus
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventBusService } from '../../services/event-bus-service';

export default async function eventbusRoutes(app: FastifyInstance, eventBus?: EventBusService): Promise<void> {
  const service = eventBus || new EventBusService({ enabled: false });

  // POST /eventbus/publish - Publish event
  app.post('/publish', async (request: FastifyRequest, reply: FastifyReply) => {
    const { subject, data } = request.body as { subject: string; data: any };
    if (!subject) return reply.status(400).send({ error: 'SUBJECT_REQUIRED' });
    try {
      await service.publish(subject, data);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /eventbus/status - Get connection status
  app.get('/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    const health = await service.checkHealth();
    const config = service.getConfig();
    return reply.send({ ...health, servers: config.servers, enabled: config.enabled });
  });

  // POST /eventbus/connect - Connect to NATS
  app.post('/connect', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      await service.connect();
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
