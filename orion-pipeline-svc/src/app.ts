import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { loadConfig } from './config';
import { getPool, closePool, checkHealth, runMigrations } from './utils/database';
import { getRedis, closeRedis, isRedisHealthy } from './utils/redis';
import { getEventBus, closeEventBus, subscribe } from './utils/eventBus';
import { pipelineRoutes } from './routes/pipeline';
import { pipelineRunRoutes } from './routes/pipeline-run';
import { pipelineAdminRoutes } from './routes/pipeline-admin';
import { scmWebhookRoutes } from './routes/scm-webhook';
import { pipelineSSERoutes } from './routes/pipeline-sse';
import { pipelineTemplateRoutes } from './routes/pipeline-template';
import { cacheStrategyRoutes } from './routes/cache-strategy';
import { errorHandler } from './middleware/errorHandler';
import { PipelineEngine } from './services/PipelineEngine';
import { PipelineRunService } from './services/PipelineRunService';
import { PipelineEventPublisher } from './events/PipelineEventPublisher';
import { EventEmitter } from 'events';

async function buildApp() {
  const config = loadConfig();

  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.logPretty
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
          }
        : undefined,
    },
  });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  // Initialize connections
  const database = getPool();
  const redis = getRedis();
  const eventBus = await getEventBus();

  // Run migrations
  if (config.nodeEnv !== 'test') {
    await runMigrations();
  }

  // ==================== Initialize Services ====================

  const eventPublisher = new PipelineEventPublisher();

  const pipelineEngine = new PipelineEngine({
    logger: fastify.log,
    maxConcurrentRuns: 10,
  });

  const pipelineRunService = new PipelineRunService(eventPublisher);

  // Local event bus for SSE
  const sseBus = new EventEmitter();

  // Register routes
  await fastify.register(pipelineRoutes, { prefix: '/api/v1', database });
  await fastify.register(pipelineRunRoutes, { prefix: '/api/v1', database, eventBus, pipelineRunService });
  await fastify.register(pipelineAdminRoutes, { prefix: '/api/v1', database });
  await fastify.register(scmWebhookRoutes, { prefix: '/api/v1', database, pipelineEngine });
  await fastify.register(pipelineSSERoutes, { prefix: '/api/v1', sseBus });
  await fastify.register(pipelineTemplateRoutes, { prefix: '/api/v1', database });
  await fastify.register(cacheStrategyRoutes, { prefix: '/api/v1', database });

  // Wire up SSE events to pipeline engine via subscribe() wrapper for type safety
  await subscribe('pipeline.log', (data: any) => sseBus.emit('pipeline.log', data));
  await subscribe('pipeline.status', (data: any) => sseBus.emit('pipeline.status', data));

  // Health check
  fastify.get('/health', async () => {
    const dbHealth = await checkHealth();
    return {
      status: dbHealth.status === 'up' && isRedisHealthy() ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        redis: isRedisHealthy() ? 'up' : 'down',
      },
    };
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await closePool();
    await closeRedis();
    await closeEventBus();
  });

  return { fastify, config };
}

async function main() {
  const { fastify, config } = await buildApp();
  try {
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`Pipeline Service listening on http://${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export { buildApp };
