/**
 * Orion Configuration Management Service - Application Entry
 * 配置管理服务入口
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import { configMgmtRoutes } from './routes/config-mgmt';
import { getConfig } from './config';
import { getPool, closePool, checkHealth } from './utils/database';

async function buildApp() {
  const config = getConfig();
  const fastify = Fastify({ logger: { level: config.logLevel } });

  // 注册插件
  await fastify.register(cors, { origin: config.corsOrigin });
  await fastify.register(sensible);

  // 注册错误处理
  errorHandler(fastify);

  // 注册路由 - 传递数据库连接
  const database = getPool();
  await fastify.register(configMgmtRoutes, { prefix: '/api/v1', database });

  // 健康检查
  fastify.get('/health', async () => {
    const db = await checkHealth();
    return {
      status: db.status === 'up' ? 'ok' : 'degraded',
      service: 'orion-config-mgmt-svc',
      timestamp: new Date().toISOString(),
      checks: { database: db },
    };
  });

  // 优雅关闭
  fastify.addHook('onClose', async () => {
    await closePool();
  });

  return { fastify };
}

async function main() {
  const config = getConfig();
  const { fastify } = await buildApp();
  try {
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`Configuration Management Service listening on http://${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start');
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
