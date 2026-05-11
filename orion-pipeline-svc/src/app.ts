import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { loadConfig } from './config';
import { getPool, closePool, checkHealth, runMigrations } from './utils/database';
import { getRedis, closeRedis, isRedisHealthy } from './utils/redis';
import { getEventBus, closeEventBus } from './utils/eventBus';
import { pipelineRoutes } from './routes/pipeline';
import { pipelineRunRoutes } from './routes/pipeline-run';
import { pipelineAdminRoutes } from './routes/pipeline-admin';
import { scmWebhookRoutes } from './routes/scm-webhook';
import { pipelineSSERoutes } from './routes/pipeline-sse';

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

  await fastify.register(cors, { origin: true });
  await fastify.register(sensible);

  // Initialize connections
  const database = getPool();
  const redis = getRedis();
  const eventBus = await getEventBus();

  // Run migrations
  if (config.nodeEnv !== 'test') {
    await runMigrations();
  }

  // Register routes
  await fastify.register(pipelineRoutes, { prefix: '/api/v1', database });
  await fastify.register(pipelineRunRoutes, { prefix: '/api/v1', database, eventBus });
  await fastify.register(pipelineAdminRoutes, { prefix: '/api/v1', database });
  await fastify.register(scmWebhookRoutes, { prefix: '/api/v1', database });
  await fastify.register(pipelineSSERoutes, { prefix: '/api/v1' });

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
