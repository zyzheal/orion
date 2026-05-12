import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { agentRoutes, agentStore } from './routes/agent';
import { taskRoutes, setAgentStoreRef } from './routes/task';

// Wire agent store reference into task routes for cross-route validation
setAgentStoreRef(agentStore);

async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);

  // Register error handler
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, request }, 'Request error');
    return reply.sent ? undefined : reply.send(error);
  });

  // Register route modules
  await fastify.register(agentRoutes, { prefix: '/api/v1' });
  await fastify.register(taskRoutes, { prefix: '/api/v1' });

  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3007', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Agent Service listening on http://0.0.0.0:${port}`);

  const shutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    await fastify.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export { buildApp };
