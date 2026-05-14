import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { governanceRoutes } from './routes/governance';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: config.logging.level,
      transport: config.logging.pretty
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined,
    },
  });

  await fastify.register(cors, { origin: config.cors.origin === '*' ? true : config.cors.origin });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, { max: config.rateLimit.max, timeWindow: config.rateLimit.windowMs });

  fastify.addHook('onRequest', requestLogger);

  await fastify.register(governanceRoutes, { prefix: '/api/v1/api-governance' });

  fastify.get('/healthz', async () => ({
    status: 'ok',
    service: 'orion-governance-svc',
    timestamp: new Date().toISOString(),
  }));

  fastify.setErrorHandler(errorHandler);

  return fastify;
}
