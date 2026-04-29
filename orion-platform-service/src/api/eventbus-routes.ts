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
  // Priority 1: Use the main eventBus instance (already connected to NATS)
  // Priority 2: If no eventBus but database exists, create a new instance with persistence
  // Priority 3: Fallback to disabled
  let service: EventBusService;

  if (options.eventBus) {
    // Reuse the main NATS-connected eventBus instance
    service = options.eventBus;

    // Inject repositories if database is available and not already set
    if (options.database && !service.getRepositories?.().eventRepo) {
      const configRepo = new EventBusConfigRepository(options.database);
      const subscriptionRepo = new EventSubscriptionRepository(options.database);
      const eventRepo = new EventBusEventRepository(options.database);
      service.setRepositories({ configRepo, subscriptionRepo, eventRepo });
      console.log('[EventBusRoutes] Repositories injected into main EventBusService');
    }
  } else if (options.database) {
    // No main eventBus, create one with full persistence
    const configRepo = new EventBusConfigRepository(options.database);
    const subscriptionRepo = new EventSubscriptionRepository(options.database);
    const eventRepo = new EventBusEventRepository(options.database);
    service = new EventBusService(
      { enabled: true },
      { configRepo, subscriptionRepo, eventRepo },
    );
    console.log('[EventBusRoutes] Created new EventBusService with database');
  } else {
    // Fallback: no persistence, no NATS
    console.warn('[EventBusRoutes] No database pool and no eventBus, event bus will run without persistence');
    service = new EventBusService({ enabled: false });
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
    const limitNum = limit ? parseInt(limit, 10) : 50;
    if (limit && isNaN(limitNum)) {
      return reply.status(400).send({ error: 'INVALID_LIMIT', message: 'limit must be a valid number' });
    }
    try {
      const events = await service.getEventHistory({
        eventType,
        status,
        limit: limitNum,
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

  // GET /eventbus/jetstream/metrics - Get JetStream metrics overview
  app.get('/jetstream/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!service.isJetStreamAvailable()) {
      return reply.send({ available: false, reason: 'JetStream not initialized' });
    }
    try {
      const metrics = await service.getJetStreamMetrics();
      return reply.send({ available: true, metrics });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /eventbus/jetstream/streams/:name/consumers - List consumers for a stream
  app.get('/jetstream/streams/:name/consumers', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service.isJetStreamAvailable()) {
      return reply.send({ available: false, reason: 'JetStream not initialized' });
    }
    try {
      const { name } = request.params as { name: string };
      const consumers = await service.listConsumers(name);
      return reply.send({ stream: name, consumers });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /eventbus/dlq - Get DLQ message count and recent messages
  app.get('/dlq', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit } = request.query as { limit?: string };
    const limitNum = limit ? parseInt(limit, 10) : 50;
    if (limit && isNaN(limitNum)) {
      return reply.status(400).send({ error: 'INVALID_LIMIT', message: 'limit must be a valid number' });
    }
    try {
      const events = await service.getEventHistory({
        status: 'failed',
        limit: limitNum,
      }) as any[];
      return reply.send({
        total: events.length,
        events,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
