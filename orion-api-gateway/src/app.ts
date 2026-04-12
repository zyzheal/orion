/**
 * Orion API Gateway - 应用配置
 *
 * 配置 Fastify 应用，注册插件和中间件
 */

import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';

import { getConfig } from './config';
import { AuthMiddleware } from './middleware/auth';
import { LoggingMiddleware } from './middleware/logging';
import { TenantMiddleware } from './middleware/tenant';
import { errorMiddleware } from './middleware/error';
import { registerRoutes } from './routes';
import { serviceRegistry } from './services/service-registry';
import { TokenService } from './services/token.service';
import { redisClient } from './utils/redis';
import { AuthRoutes } from './routes/auth.routes';
import { TenantRoutes } from './routes/tenant.routes';
import type { WebSocketServerManager } from './websocket/ws-server';

export interface AppOptions {
  logger?: boolean;
}

export async function createApp(options: AppOptions = {}): Promise<{
  app: FastifyInstance;
  authMiddleware: AuthMiddleware;
  loggingMiddleware: LoggingMiddleware;
  tenantMiddleware: TenantMiddleware;
  tokenService: TokenService;
  authRoutes: AuthRoutes;
  tenantRoutes: TenantRoutes;
  wsServer: WebSocketServerManager;
}> {
  const config = getConfig();

  // 创建 Fastify 实例
  const app = Fastify({
    logger: options.logger !== false ? { level: config.logLevel } : false,
  });

  // ==================== 注册插件 ====================

  // 1. CORS 配置
  await app.register(fastifyCors, {
    origin: config.corsOrigins.join(',') === '*' ? true : config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400,
  });

  // 2. Helmet 安全头部
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // 根据需求配置
    crossOriginEmbedderPolicy: false,
  });

  // 3. JWT 认证
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: {
      expiresIn: config.jwtExpiresIn,
    },
  });

  // 4. 限流配置
  await app.register(fastifyRateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    allowList: ['127.0.0.1', '::1'], // 本地地址不限流
  });

  // ==================== 初始化 Redis 和 Token 服务 ====================

  // 初始化 Redis 客户端
  const { RedisClient } = await import('./utils/redis');
  const redis = new RedisClient();
  try {
    await redis.connect();
    app.log.info('Redis connected');
  } catch (error) {
    app.log.warn({ err: error instanceof Error ? error.message : String(error) }, 'Redis connection failed, some features may be limited');
  }

  // 初始化 Token 服务
  const tokenService = new TokenService(app);
  const redisClientInstance = redis.getClient();
  if (redisClientInstance) {
    tokenService.setRedisClient(redisClientInstance);
  }

  // ==================== 初始化 WebSocket 服务器 ====================

  // 初始化 WebSocket 服务器
  const { WebSocketServerManager } = await import('./websocket/ws-server');
  const wsServer = new WebSocketServerManager(app, {
    path: '/ws',
    heartbeatInterval: 30000,
    heartbeatTimeout: 15000,
  });
  await wsServer.initialize();

  // ==================== 注册中间件 ====================

  // 日志中间件
  const loggingMiddleware = new LoggingMiddleware(app);
  app.addHook('onRequest', loggingMiddleware.handler.bind(loggingMiddleware));

  // 认证中间件
  const authMiddleware = new AuthMiddleware(app);
  app.addHook('onRequest', authMiddleware.handler.bind(authMiddleware));

  // 租户解析中间件（在认证之后）
  const tenantMiddleware = new TenantMiddleware(app);
  app.addHook('onRequest', tenantMiddleware.handler.bind(tenantMiddleware));

  // ==================== 注册认证路由 ====================

  // 注册认证路由（在 registerRoutes 之前，因为需要公开 /api/v1/auth/*路径）
  const authRoutes = new AuthRoutes(app, tokenService);

  // ==================== 注册租户管理路由 ====================

  const tenantRoutes = new TenantRoutes(app);
  tenantRoutes.register();

  // ==================== 错误处理 ====================

  app.setErrorHandler(errorMiddleware.handler.bind(errorMiddleware));

  // ==================== 注册路由 ====================

  registerRoutes(app);

  // ==================== 注册服务到注册表 ====================

  // 注册自身服务
  serviceRegistry.register({
    name: 'api-gateway',
    url: `http://${config.host}:${config.port}`,
    healthUrl: `http://${config.host}:${config.port}/healthz`,
    metadata: {
      version: '1.0.0',
    },
  });

  // ==================== 优雅关闭 ====================

  const gracefulShutdown = async () => {
    app.log.info('Received shutdown signal, shutting down gracefully...');

    // 关闭 WebSocket 服务器
    await wsServer.shutdown();

    // 注销服务
    serviceRegistry.unregister('api-gateway');

    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error(error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return { app, authMiddleware, loggingMiddleware, tenantMiddleware, tokenService, authRoutes, tenantRoutes, wsServer };
}
