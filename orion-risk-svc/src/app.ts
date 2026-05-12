/**
 * Orion Risk Assessment Service - Application Entry
 * 风险评估服务入口
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import { riskRoutes } from './routes/risk';
import { getConfig } from './config';
import { initializeDatabase, closePool } from './utils/database.js';

async function buildApp() {
  const config = getConfig();
  const fastify = Fastify({ logger: { level: config.logLevel } });

  // 注册插件
  await fastify.register(cors, { origin: config.corsOrigin });
  await fastify.register(sensible);

  // 注册错误处理
  errorHandler(fastify);

  // 注册路由
  await fastify.register(riskRoutes, { prefix: '/api/v1' });

  // 健康检查
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'orion-risk-svc',
    timestamp: new Date().toISOString(),
  }));

  return { fastify };
}

async function main() {
  const config = getConfig();
  const { fastify } = await buildApp();

  try {
    // 初始化数据库连接和表结构
    await initializeDatabase();
    fastify.log.info('Database initialized successfully');
  } catch (error) {
    fastify.log.error('Failed to initialize database: %s', error instanceof Error ? error.message : String(error));
    // 继续启动服务，但记录警告
    fastify.log.warn('Starting without database — some features will be unavailable');
  }

  // 优雅关闭
  const gracefulShutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    await closePool();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  await fastify.listen({ port: config.port, host: config.host });
  fastify.log.info(`Risk Assessment Service listening on http://${config.host}:${config.port}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
