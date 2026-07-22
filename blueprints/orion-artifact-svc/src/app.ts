import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getPool, closePool, checkHealth } from './utils/database';
import artifactRoutes from './routes/artifact-routes';
import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);
  const database = getPool();
  await fastify.register(artifactRoutes, { prefix: '/api/v1', database });
  fastify.get('/health', async () => { const db = await checkHealth(); return { status: db.status === 'up' ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks: { database: db } }; });
  fastify.addHook('onClose', async () => { await closePool(); });
  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3014', 10);
  try { await fastify.listen({ port, host: '0.0.0.0' }); fastify.log.info(`Artifact Service listening on http://0.0.0.0:${port}`); } catch (err) { fastify.log.error(err, 'Failed to start server'); process.exit(1); }
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
