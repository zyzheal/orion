import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getPool, closePool, checkHealth } from './utils/database';
import efficiencyRoutes from './routes/efficiency';
import efficiencyEnhancedRoutes from './routes/efficiency-enhanced';
import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });
  await fastify.register(cors, { origin: true });
  await fastify.register(sensible);
  errorHandler(fastify);
  const database = getPool();
  await fastify.register(efficiencyRoutes, { prefix: '/api/v1/efficiency', database });
  await fastify.register(efficiencyEnhancedRoutes, { prefix: '/api/v1/efficiency', database });
  fastify.get('/health', async () => { const db = await checkHealth(); return { status: db.status === 'up' ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks: { database: db } }; });
  fastify.addHook('onClose', async () => { await closePool(); });
  return { fastify };
}
async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3015', 10);
  try { await fastify.listen({ port, host: '0.0.0.0' }); fastify.log.info(`Efficiency Service listening on http://0.0.0.0:${port}`); } catch (err) { fastify.log.error(err, 'Failed to start'); process.exit(1); }
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
