import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './utils/error-handler';
import ticketingRoutes from './routes/ticket-full';

async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);
  await fastify.register(ticketingRoutes, { prefix: '/api/v1' });
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3004', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Ticket Service listening on http://0.0.0.0:${port}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
