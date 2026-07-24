import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getPool, closePool, checkHealth, initializeDatabase } from './utils/database';
import { config } from './config';
import knowledgeRoutes from './routes/knowledge';
import vectorRoutes from './routes/vector';
import vectorStoreRoutes from './routes/vector-store';
import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.nodeEnv === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  // Register plugins
  await fastify.register(cors, { origin: config.corsOrigin });
  await fastify.register(sensible);
  errorHandler(fastify);

  // Initialize database schema and get pool
  await initializeDatabase();
  const database = getPool();

  // Register routes with database pool
  await fastify.register(knowledgeRoutes, { prefix: '/knowledge/v1', database });
  await fastify.register(vectorRoutes, { prefix: '/vector', database });
  await fastify.register(vectorStoreRoutes, { prefix: '/vector-store', database });

  // Health check endpoint
  fastify.get('/healthz', async () => {
    const dbHealth = await checkHealth();
    return {
      status: dbHealth.status === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'orion-knowledge-svc',
      version: '1.0.0',
      checks: {
        database: dbHealth,
      },
    };
  });

  // Graceful shutdown hook
  fastify.addHook('onClose', async () => {
    await closePool();
    fastify.log.info('Database pool closed');
  });

  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Orion Knowledge Service listening on http://0.0.0.0:${config.port}`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export { buildApp };
