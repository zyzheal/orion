import Fastify from 'fastify';
import cors from '@fastify/cors';
import { monitoringRoutes, alertRoutes } from './routes/monitoring';
async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });
  await fastify.register(cors, { origin: true });
  await fastify.register(monitoringRoutes, { prefix: '/api/v1' });
  await fastify.register(alertRoutes, { prefix: '/api/v1' });
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  return { fastify };
}
async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3005', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Monitor Service listening on http://0.0.0.0:${port}`);
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
