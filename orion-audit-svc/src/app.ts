import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { auditRoutes } from './routes/audit';
import { complianceRoutes } from './routes/compliance';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
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

  await fastify.register(cors, { origin: config.security.corsOrigin });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, { max: config.security.rateLimitMax, timeWindow: config.security.rateLimitWindow });

  requestLogger(fastify);

  await fastify.register(auditRoutes, { prefix: '/api/v1/audit' });
  await fastify.register(complianceRoutes, { prefix: '/api/v1' });

  fastify.get('/healthz', async () => ({
    status: 'ok',
    service: 'orion-audit-svc',
    timestamp: new Date().toISOString(),
  }));

  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);

  return fastify;
}
