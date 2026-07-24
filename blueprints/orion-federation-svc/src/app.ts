import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getPool, closePool, checkHealth } from './utils/database';
import federationRoutes from './routes/federation';
import federationAdvancedRoutes from './routes/federation-advanced';
import multiCloudRoutes from './routes/multi-cloud';
import multiCloudAdvancedRoutes from './routes/multi-cloud-advanced';
import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);
  const database = getPool();
  await fastify.register(federationRoutes, { prefix: '/api/v1/federation', database });
  await fastify.register(federationAdvancedRoutes, { prefix: '/api/v1/federation-advanced' });
  await fastify.register(multiCloudRoutes, { prefix: '/api/v1/multi-cloud', database });
  await fastify.register(multiCloudAdvancedRoutes, { prefix: '/api/v1/multi-cloud-advanced' });
  fastify.get('/health', async () => { const db = await checkHealth(); return { status: db.status === 'up' ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks: { database: db } }; });
  fastify.addHook('onClose', async () => { await closePool(); });
  return { fastify };
}
async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3017', 10);
  try { await fastify.listen({ port, host: '0.0.0.0' }); fastify.log.info(`Federation Service listening on http://0.0.0.0:${port}`); } catch (err) { fastify.log.error(err, 'Failed to start'); process.exit(1); }
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
