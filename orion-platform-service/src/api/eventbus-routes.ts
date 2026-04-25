/**
 * EventBus API Routes
 * NATS message bus status, control, and event history
 * Prefix: /api/v1/eventbus
 *
 * Migrated to PostgreSQL Repository pattern (M24)
 * - Event history persisted to event_bus_events table
 * - Subscriptions persisted to event_subscriptions table
 * - Config persisted to event_bus_config table
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { EventBusService } from '../services/event-bus-service';
import {
  EventBusConfigRepository,
  EventSubscriptionRepository,
  EventBusEventRepository,
} from '../repositories/EventBusRepository';

interface EventBusRoutesOptions {
  database?: DatabasePool;
  eventBus?: EventBusService;
}

export default async function eventbusRoutes(
  app: FastifyInstance,
  options: EventBusRoutesOptions
): Promise<void> {
  // Initialize repositories if database is available
  let service: EventBusService;

  if (options.database) {
    const configRepo = new EventBusConfigRepository(options.database);
    const subscriptionRepo = new EventSubscriptionRepository(options.database);
    const eventRepo = new EventBusEventRepository(options.database);

    service = new EventBusService(
      { enabled: true },
      { configRepo, subscriptionRepo, eventRepo },
    );
  } else {
    // Fallback: no persistence
    console.warn('[EventBusRoutes] No database pool provided, event bus will run without persistence');
    service = options.eventBus || new EventBusService({ enabled: false });
  }

  // POST /eventbus/publish - Publish event
  app.post('/publish', async (request: FastifyRequest, reply: FastifyReply) => {
    const { subject, data, tenantId, publishedBy } = request.body as {
      subject: string;
      data: any;
      tenantId?: string;
      publishedBy?: string;
    };
    if (!subject) return reply.status(400).send({ error: 'SUBJECT_REQUIRED' });
    try {
      await service.publish(subject, data, { tenantId, publishedBy });
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

  // GET /eventbus/events - Get event history
  app.get('/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const { eventType, status, limit } = request.query as {
      eventType?: string;
      status?: string;
      limit?: string;
    };
    try {
      const events = await service.getEventHistory({
        eventType,
        status,
        limit: limit ? parseInt(limit, 10) : 50,
      });
      return reply.send({ events });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /eventbus/subscriptions - Get active subscriptions
  app.get('/subscriptions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.query as { tenantId?: string };
    try {
      const subscriptions = await service.getSubscriptions(tenantId);
      return reply.send({ subscriptions });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /eventbus/stats - Get event statistics
  app.get('/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await service.getEventStats();
      return reply.send({ stats });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
