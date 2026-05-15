import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import { visorRoutes } from './routes/visor-routes';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  await fastify.register(visorRoutes, { prefix: '/api/v1/visor' });

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'orion-visor-svc',
    visorBackend: process.env.VISOR_URL || 'http://localhost:8080',
    timestamp: new Date().toISOString(),
  }));

  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3032', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Visor Service listening on http://0.0.0.0:${port}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
