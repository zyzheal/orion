import Fastify from 'fastify';
import cors from '@fastify/cors';
import { agentRoutes } from './routes/agent';
async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });
  await fastify.register(cors, { origin: true });
  await fastify.register(agentRoutes, { prefix: '/api/v1' });
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  return { fastify };
}
async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3007', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Agent Service listening on http://0.0.0.0:${port}`);
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
