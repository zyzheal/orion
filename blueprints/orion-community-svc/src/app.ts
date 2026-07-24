import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { closePool, checkHealth, getDbAdapter } from './utils/database';
import { registerErrorHandler } from './middleware/errorHandler';
import { registerLogger } from './middleware/logger';
import communityRoutes from './routes/community-routes';
import { ContributionRepository } from './repositories/ContributionRepository';
import { PluginRepository } from './repositories/PluginRepository';
import { ReviewRepository } from './repositories/ReviewRepository';
import { FeedbackRepository } from './repositories/FeedbackRepository';

export interface CommunityRepositories {
  contributions: ContributionRepository;
  plugins: PluginRepository;
  reviews: ReviewRepository;
  feedback: FeedbackRepository;
}

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

  // Wire repositories with database adapter
  const dbAdapter = getDbAdapter();
  const repositories: CommunityRepositories = {
    contributions: new ContributionRepository(dbAdapter),
    plugins: new PluginRepository(dbAdapter),
    reviews: new ReviewRepository(dbAdapter),
    feedback: new FeedbackRepository(dbAdapter),
  };

  // Make repositories available via fastify.decorate for route injection
  fastify.decorate('repositories', repositories);

  await fastify.register(communityRoutes, { prefix: '/api/v1/community' });

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

  return { fastify, repositories };
}

export { buildApp };
