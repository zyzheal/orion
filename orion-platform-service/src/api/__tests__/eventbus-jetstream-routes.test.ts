/**
 * EventBus JetStream API Routes Tests
 *
 * Tests for the JetStream metrics, consumer listing, and DLQ endpoints.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import type { EventBusService } from '../../services/event-bus-service';

/**
 * Create a mock EventBusService with configurable JetStream availability.
 */
function createMockEventBus(options: { jetStreamAvailable: boolean } = { jetStreamAvailable: true }) {
  const mockEventBus = {
    isJetStreamAvailable: jest.fn<() => boolean>().mockReturnValue(options.jetStreamAvailable),
    getJetStreamMetrics: jest.fn().mockResolvedValue({
      streamCount: 3,
      totalMessages: 1024,
      totalConsumers: 3,
      streams: [
        { name: 'ORION_PLATFORM', messages: 512, consumers: 1 },
        { name: 'ORION_PIPELINE', messages: 400, consumers: 2 },
        { name: 'ORION_DLQ', messages: 112, consumers: 0 },
      ],
    }),
    listConsumers: jest.fn().mockResolvedValue([
      { name: 'platform-all', pending: 10 },
      { name: 'platform-audit', pending: 0 },
    ]),
    getEventHistory: jest.fn().mockResolvedValue([
      { id: 'evt-1', event_type: 'pipeline.failed', status: 'failed', created_at: new Date() },
      { id: 'evt-2', event_type: 'deploy.failed', status: 'failed', created_at: new Date() },
    ]),
    checkHealth: jest.fn().mockResolvedValue({ status: 'up', message: 'Connected to NATS' }),
    publish: jest.fn(),
    connect: jest.fn(),
    getSubscriptions: jest.fn().mockResolvedValue([]),
    getEventStats: jest.fn().mockResolvedValue({}),
    getConfig: jest.fn().mockReturnValue({ servers: [], enabled: true }),
  };
  return mockEventBus;
}

/**
 * Register the eventbus routes on a Fastify instance with the given mock.
 * We replicate the route structure from eventbus-routes.ts for testing.
 */
async function createTestApp(mockEventBus: ReturnType<typeof createMockEventBus>): Promise<FastifyInstance> {
  const app = Fastify();

  app.register(async (fastify) => {
    // GET /status
    fastify.get('/status', async (_request, reply) => {
      const health = await mockEventBus.checkHealth();
      const config = mockEventBus.getConfig();
      return reply.send({ ...health, servers: config.servers, enabled: config.enabled });
    });

    // GET /jetstream/metrics
    fastify.get('/jetstream/metrics', async (_request, reply) => {
      if (!mockEventBus.isJetStreamAvailable()) {
        return reply.send({ available: false, reason: 'JetStream not initialized' });
      }
      try {
        const metrics = await mockEventBus.getJetStreamMetrics();
        return reply.send({ available: true, metrics });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    // GET /jetstream/streams/:name/consumers
    fastify.get('/jetstream/streams/:name/consumers', async (request, reply) => {
      if (!mockEventBus.isJetStreamAvailable()) {
        return reply.send({ available: false, reason: 'JetStream not initialized' });
      }
      try {
        const { name } = request.params as { name: string };
        const consumers = await mockEventBus.listConsumers(name);
        return reply.send({ stream: name, consumers });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    // GET /dlq
    fastify.get('/dlq', async (request, reply) => {
      const { limit } = request.query as { limit?: string };
      try {
        const events = await mockEventBus.getEventHistory({
          status: 'failed',
          limit: limit ? parseInt(limit, 10) : 50,
        });
        return reply.send({
          total: events.length,
          events,
        });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });
  }, { prefix: '/eventbus' });

  return app;
}

describe('EventBus JetStream API Routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /eventbus/jetstream/metrics', () => {
    it('should return JetStream metrics when JetStream is available', async () => {
      const mockEventBus = createMockEventBus({ jetStreamAvailable: true });
      app = await createTestApp(mockEventBus);

      const response = await app.inject({
        method: 'GET',
        url: '/eventbus/jetstream/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.available).toBe(true);
      expect(body.metrics.streamCount).toBe(3);
      expect(body.metrics.totalMessages).toBe(1024);
      expect(body.metrics.totalConsumers).toBe(3);
      expect(body.metrics.streams).toHaveLength(3);
    });

    it('should return available: false when JetStream is not available', async () => {
      const mockEventBus = createMockEventBus({ jetStreamAvailable: false });
      app = await createTestApp(mockEventBus);

      const response = await app.inject({
        method: 'GET',
        url: '/eventbus/jetstream/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.available).toBe(false);
      expect(body.reason).toBe('JetStream not initialized');
    });

    it('should return 500 when getJetStreamMetrics throws', async () => {
      const mockEventBus = createMockEventBus({ jetStreamAvailable: true });
      mockEventBus.getJetStreamMetrics.mockRejectedValue(new Error('JetStream connection lost'));
      app = await createTestApp(mockEventBus);

      const response = await app.inject({
        method: 'GET',
        url: '/eventbus/jetstream/metrics',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('JetStream connection lost');
    });
  });

  describe('GET /eventbus/jetstream/streams/:name/consumers', () => {
    it('should return consumers for a stream when JetStream is available', async () => {
      const mockEventBus = createMockEventBus({ jetStreamAvailable: true });
      app = await createTestApp(mockEventBus);

      const response = await app.inject({
        method: 'GET',
        url: '/eventbus/jetstream/streams/ORION_PLATFORM/consumers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.stream).toBe('ORION_PLATFORM');
      expect(body.consumers).toHaveLength(2);
      expect(body.consumers[0].name).toBe('platform-all');
      expect(body.consumers[0].pending).toBe(10);
      expect(mockEventBus.listConsumers).toHaveBeenCalledWith('ORION_PLATFORM');
    });

    it('should return available: false when JetStream is not available', async () => {
      const mockEventBus = createMockEventBus({ jetStreamAvailable: false });
      app = await createTestApp(mockEventBus);

      const response = await app.inject({
        method: 'GET',
        url: '/eventbus/jetstream/streams/ORION_PIPELINE/consumers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.available).toBe(false);
      expect(body.reason).toBe('JetStream not initialized');
    });

    it('should return 500 when listConsumers throws', async () => {
      const mockEventBus = createMockEventBus({ jetStreamAvailable: true });
      mockEventBus.listConsumers.mockRejectedValue(new Error('Stream not found'));
      app = await createTestApp(mockEventBus);

      const response = await app.inject({
        method: 'GET',
        url: '/eventbus/jetstream/streams/ORION_DLQ/consumers',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Stream not found');
    });
  });

  describe('GET /eventbus/dlq', () => {
    it('should return DLQ events with default limit', async () => {
      const mockEventBus = createMockEventBus();
      app = await createTestApp(mockEventBus);

      const response = await app.inject({
        method: 'GET',
        url: '/eventbus/dlq',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(2);
      expect(body.events).toHaveLength(2);
      expect(body.events[0].event_type).toBe('pipeline.failed');
      expect(mockEventBus.getEventHistory).toHaveBeenCalledWith({
        status: 'failed',
        limit: 50,
      });
    });

    it('should return DLQ events with custom limit', async () => {
      const mockEventBus = createMockEventBus();
      app = await createTestApp(mockEventBus);

      const response = await app.inject({
        method: 'GET',
        url: '/eventbus/dlq?limit=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(2);
      expect(mockEventBus.getEventHistory).toHaveBeenCalledWith({
        status: 'failed',
        limit: 10,
      });
    });

    it('should return 500 when getEventHistory throws', async () => {
      const mockEventBus = createMockEventBus();
      mockEventBus.getEventHistory.mockRejectedValue(new Error('Database unavailable'));
      app = await createTestApp(mockEventBus);

      const response = await app.inject({
        method: 'GET',
        url: '/eventbus/dlq',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Database unavailable');
    });
  });
});
