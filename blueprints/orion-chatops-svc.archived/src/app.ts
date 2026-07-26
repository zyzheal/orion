import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import chatopsRoutes from './routes/chatops';
import { pool } from './utils/database';

async function buildApp() {
  const port = parseInt(process.env.PORT || '3022', 10);
  const host = process.env.HOST || '0.0.0.0';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logPretty = nodeEnv === 'development';

  const fastify = Fastify({
    logger: {
      level: logLevel,
      transport: logPretty
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

  // Register routes
  await fastify.register(chatopsRoutes, { prefix: '/api/v1', database: pool as any });

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'chatops',
    };
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Shutting down chatops service');
    await pool.end();
  });

  return { fastify, port, host, nodeEnv };
}

async function main() {
  const { fastify, port, host, nodeEnv } = await buildApp();
  try {
    await fastify.listen({ port, host });
    fastify.log.info(`ChatOps Service listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export { buildApp };
