/**
 * Orion Digital Twin Service
 *
 * 数字孪生服务：系统状态镜像、沙箱隔离、流量录制与回放
 * 从 orion-platform-service/src/services/digital-twin/ 拆分
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import { digitalTwinRoutes } from './routes/digital-twin';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  await fastify.register(digitalTwinRoutes, { prefix: '/api/v1/digital-twins' });

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'orion-digital-twin-svc',
    timestamp: new Date().toISOString(),
  }));

  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3008', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Digital Twin Service listening on http://0.0.0.0:${port}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
