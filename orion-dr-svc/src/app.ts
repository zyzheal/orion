import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getPool, closePool, checkHealth } from './utils/database';
import backupRoutes from './routes/backup';
import disasterRecoveryRoutes from './routes/disaster-recovery';
import disasterRecoveryAdvancedRoutes from './routes/disaster-recovery-advanced';
import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);
  const database = getPool();
  await fastify.register(backupRoutes, { prefix: '/api/v1/backup', database });
  await fastify.register(disasterRecoveryRoutes, { prefix: '/api/v1/disaster-recovery', database });
  await fastify.register(disasterRecoveryAdvancedRoutes, { prefix: '/api/v1/disaster-recovery/advanced', database });
  fastify.get('/health', async () => { const db = await checkHealth(); return { status: db.status === 'up' ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks: { database: db } }; });
  fastify.addHook('onClose', async () => { await closePool(); });
  return { fastify };
}
async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3016', 10);
  try { await fastify.listen({ port, host: '0.0.0.0' }); fastify.log.info(`DR Service listening on http://0.0.0.0:${port}`); } catch (err) { fastify.log.error(err, 'Failed to start'); process.exit(1); }
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
