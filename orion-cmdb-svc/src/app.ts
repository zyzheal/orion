/**
 * Orion CMDB Service - Application Entry
 * CMDB 服务入口
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import { cmdbRoutes } from './routes/cmdb';
import { getConfig } from './config';

async function buildApp() {
  const config = getConfig();
  const fastify = Fastify({ logger: { level: config.logLevel } });

  // 注册插件
  await fastify.register(cors, { origin: config.corsOrigin });
  await fastify.register(sensible);

  // 注册错误处理
  errorHandler(fastify);

  // 注册路由
  await fastify.register(cmdbRoutes, { prefix: '/api/v1' });

  // 健康检查
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'orion-cmdb-svc',
    timestamp: new Date().toISOString(),
  }));

  return { fastify };
}

async function main() {
  const config = getConfig();
  const { fastify } = await buildApp();
  await fastify.listen({ port: config.port, host: config.host });
  fastify.log.info(`CMDB Service listening on http://${config.host}:${config.port}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
