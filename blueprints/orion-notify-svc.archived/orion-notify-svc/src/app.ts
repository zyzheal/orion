import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { getPool, closePool, checkHealth } from './utils/database';
import { NotificationRepository } from './services/NotificationRepository';
import { WebhookRepository } from './services/WebhookRepository';
import { NotificationChannelRepository } from './services/NotificationChannelRepository';
import { NotificationService } from './services/NotificationService';
import { WebhookService } from './services/WebhookService';
import { NotificationChannelService } from './services/NotificationChannelService';
import { notificationRoutes } from './routes/notification';
import { webhookRoutes } from './routes/webhook';
import { notificationChannelRoutes } from './routes/notification-channel';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

let notificationService: NotificationService | null = null;
let webhookService: WebhookService | null = null;
let notificationChannelService: NotificationChannelService | null = null;

export function getServices() {
  const pool = getPool();
  const notifRepo = new NotificationRepository(pool);
  const webhookRepo = new WebhookRepository(pool);
  const channelRepo = new NotificationChannelRepository(pool);
  if (!notificationService) notificationService = new NotificationService(notifRepo);
  if (!webhookService) webhookService = new WebhookService(webhookRepo);
  if (!notificationChannelService) notificationChannelService = new NotificationChannelService(channelRepo);
  return { notificationService, webhookService, notificationChannelService };
}

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

  // Decorate fastify with services
  const { notificationService: notifSvc, webhookService: whSvc, notificationChannelService: chSvc } = getServices();
  fastify.decorate('notificationService', notifSvc);
  fastify.decorate('webhookService', whSvc);
  fastify.decorate('notificationChannelService', chSvc);

  await fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await fastify.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await fastify.register(notificationChannelRoutes, { prefix: '/api/v1/notify/channels' });

  fastify.get('/healthz', async () => {
    const dbHealth = await checkHealth();
    return {
      status: dbHealth.status === 'up' ? 'ok' : 'degraded',
      service: 'orion-notify-svc',
      timestamp: new Date().toISOString(),
      checks: { database: dbHealth },
    };
  });

  fastify.addHook('onClose', async () => { await closePool(); });

  fastify.setErrorHandler(errorHandler);

  return fastify;
}
