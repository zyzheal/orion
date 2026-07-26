import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import { deployRoutes } from './routes/deploy-routes';
import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  errorHandler(fastify);

  // Initialize database pool
  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  await fastify.register(deployRoutes, { prefix: '/api/v1', dbPool });
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  return { fastify, dbPool };
}
async function main() {
  const { fastify, dbPool } = await buildApp();
  const port = parseInt(process.env.PORT || '3003', 10);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    fastify.log.info('SIGINT received, shutting down...');
    await dbPool.end();
    await fastify.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    fastify.log.info('SIGTERM received, shutting down...');
    await dbPool.end();
    await fastify.close();
    process.exit(0);
  });

  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Deploy Service listening on http://0.0.0.0:${port}`);
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
