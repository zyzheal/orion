import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { notificationRoutes } from './routes/notification';
import { webhookRoutes } from './routes/webhook';
import { notificationChannelRoutes } from './routes/notification-channel';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined,
    },
  });

  await fastify.register(cors, { origin: config.corsOrigin });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, { max: 100, timeWindow: '1m' });

  fastify.addHook('onRequest', requestLogger);

  await fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await fastify.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await fastify.register(notificationChannelRoutes, { prefix: '/api/v1/notify/channels' });

  fastify.get('/healthz', async () => ({
    status: 'ok',
    service: 'orion-notify-svc',
    timestamp: new Date().toISOString(),
  }));

  fastify.setErrorHandler(errorHandler);

  return fastify;
}
