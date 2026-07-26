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
import { getPool, closePool, checkHealth } from './utils/database';

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
  fastify.get('/health', async () => {
    const dbHealth = await checkHealth();
    return {
      status: dbHealth.status === 'up' ? 'ok' : 'degraded',
      service: 'orion-cmdb-svc',
      database: dbHealth,
      timestamp: new Date().toISOString(),
    };
  });

  return { fastify };
}

async function main() {
  const config = getConfig();
  const { fastify } = await buildApp();

  // 初始化数据库连接
  try {
    await getPool().query('SELECT 1');
    fastify.log.info('CMDB database connected');
  } catch (error) {
    fastify.log.warn({ error }, 'CMDB database connection failed, starting without database');
  }

  // 优雅关闭
  const signals = ['SIGTERM', 'SIGINT'] as const;
  for (const signal of signals) {
    process.on(signal, async () => {
      fastify.log.info(`${signal} received, shutting down`);
      await closePool();
      await fastify.close();
      process.exit(0);
    });
  }

  await fastify.listen({ port: config.port, host: config.host });
  fastify.log.info(`CMDB Service listening on http://${config.host}:${config.port}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
