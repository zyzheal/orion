/**
 * Orion Platform Service - Fastify 应用配置
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

import { getConfig } from './config';
import { HealthChecker, HealthStatus } from './services/health';
import { RedisCache } from './services/redis-cache';
import { DatabasePool } from './services/database';
import { EventBusService } from './services/event-bus-service';
import { NatsServiceRegistry } from './services/nats-registry';
import apiRoutes from './api/routes';
import authRoutes from './api/routes-auth';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export interface PlatformAppOptions {
  redis?: RedisCache;
  database?: DatabasePool;
  eventBus?: EventBusService;
}

export async function createApp(options: PlatformAppOptions = {}): Promise<{
  app: FastifyInstance;
  healthChecker: HealthChecker;
  redis?: RedisCache;
  database?: DatabasePool;
  eventBus?: EventBusService;
}> {
  const config = getConfig();

  // 创建 Fastify 实例
  const app = Fastify({
    logger: {
      level: config.logLevel || 'info',
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: req.headers,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => uuidv4(),
  });

  // ==================== 注册插件 ====================

  // 1. CORS 配置
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID', 'X-Tenant-ID', 'X-User-ID'],
  });

  // 2. Helmet 安全头部
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // ==================== 健康检查 ====================

  const healthChecker = new HealthChecker(config.serviceName);

  // 注册 Redis 健康检查
  if (options.redis) {
    healthChecker.registerCheck('redis', async () => {
      const isHealthy = options.redis!.isHealthy();
      return {
        status: isHealthy ? 'up' : 'down',
        message: isHealthy ? undefined : 'Redis not connected',
      };
    });
  }

  // 注册数据库健康检查
  if (options.database) {
    healthChecker.registerCheck('database', async () => {
      return await options.database!.checkHealth();
    });
  }

  // 注册 EventBus 健康检查
  if (options.eventBus) {
    healthChecker.registerCheck('eventbus', async () => {
      return await options.eventBus!.checkHealth();
    });
  }

  // 健康检查端点
  app.get('/healthz', async (request: FastifyRequest, reply: FastifyReply) => {
    const health = await healthChecker.check();
    const statusCode = health.status === 'healthy' ? 200 :
                       health.status === 'degraded' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });

  // 就绪检查端点
  app.get('/readyz', async (request: FastifyRequest, reply: FastifyReply) => {
    const health = await healthChecker.check();
    const isReady = health.status !== 'unhealthy';

    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      service: config.serviceName,
    });
  });

  // 版本信息端点
  app.get('/version', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      name: '@orion/platform-service',
      version: process.env.VERSION || '1.0.0',
      buildTime: process.env.BUILD_TIME,
      gitCommit: process.env.GIT_COMMIT,
    });
  });

  // ==================== API 路由 ====================

  // 注册认证 API 路由
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  // 注册 Pipeline API
  await app.register(apiRoutes, { prefix: '/api/v1', eventBus: options.eventBus });

  // 基础 API 路由
  app.get('/api/v1/info', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      service: config.serviceName,
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  // ==================== 错误处理 ====================

  app.setErrorHandler((error: Error, request, reply) => {
    app.log.error({
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    }, 'Unhandled error');

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      code: '50000',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  });

  // 404 处理
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: 'NOT_FOUND',
      code: '10102',
      message: `Cannot ${request.method} ${request.url}`,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    app,
    healthChecker,
    redis: options.redis,
    database: options.database,
    eventBus: options.eventBus,
  };
}