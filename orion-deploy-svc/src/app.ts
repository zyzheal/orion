import Fastify from 'fastify';
import cors from '@fastify/cors';
import { deployRoutes } from './routes/deploy';
import { errorHandler } from './middleware/errorHandler';
async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });
  await fastify.register(cors, { origin: true });
  errorHandler(fastify);
  await fastify.register(deployRoutes, { prefix: '/api/v1' });
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  return { fastify };
}
async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3003', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Deploy Service listening on http://0.0.0.0:${port}`);
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
