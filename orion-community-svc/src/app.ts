import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { closePool, checkHealth } from './utils/database';
import { registerErrorHandler } from './middleware/errorHandler';
import { registerLogger } from './middleware/logger';
import communityRoutes from './routes/community';
import communityAdvancedRoutes from './routes/community-advanced';

/**
 * 构建 Fastify 应用实例
 */
async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN || '*' });
  await fastify.register(sensible);

  registerLogger(fastify);
  registerErrorHandler(fastify);

  await fastify.register(communityRoutes, { prefix: '/api/v1/community' });
  await fastify.register(communityAdvancedRoutes, { prefix: '/api/v1/community-advanced' });

  fastify.get('/health', async () => {
    const db = await checkHealth();
    return {
      status: db.status === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { database: db },
      service: '@orion/community-svc',
    };
  });

  fastify.addHook('onClose', async () => {
    await closePool();
    fastify.log.info('Database pool closed');
  });

  return { fastify };
}

export { buildApp };
