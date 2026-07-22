import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getPool, closePool, checkHealth } from './utils/database';
import { errorHandler } from './middleware/errorHandler';
import costRoutes from './routes/cost';
import finopsV2Routes from './routes/finops-v2';
import costOperationsRoutes from './routes/cost-operations';

async function buildApp() {
  const fastify = Fastify({
    logger: { level: process.env.LOG_LEVEL || 'info' },
  });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  const database = getPool();

  await fastify.register(costRoutes, { prefix: '/api/v1/cost', database });
  await fastify.register(finopsV2Routes, { prefix: '/api/v1/finops', database });
  await fastify.register(costOperationsRoutes, { prefix: '/api/v1/cost-operations', database });

  fastify.get('/health', async () => {
    const db = await checkHealth();
    return { status: db.status === 'up' ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks: { database: db } };
  });

  fastify.addHook('onClose', async () => { await closePool(); });

  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3009', 10);
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`FinOps Service listening on http://0.0.0.0:${port}`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export { buildApp };
