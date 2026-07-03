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
import { createSubAppAuthHook } from './middleware/subAppAuthAdapter';
import { LoggingMiddleware } from './middleware/logging';
import { TenantMiddleware } from './middleware/tenant';
import { PermissionMiddleware } from './middleware/permission';
import { createCSPMiddleware } from './middleware/csp';
import { errorMiddleware } from './middleware/error';
import { registerRoutes, gatewayDynamicRoutes } from './routes';
import { metricsRoutes, httpRequestDuration, httpRequestTotal, activeConnections } from './routes/metrics';
import { serviceRegistry } from './services/service-registry';
import { TokenService } from './services/token.service';
import { redisClient } from './utils/redis';
import { AuthRoutes } from './routes/auth.routes';
import { TenantRoutes } from './routes/tenant.routes';
import { PipelineVersionsRoutes } from './routes/pipeline-versions.routes';
import { PipelineBudgetRoutes } from './routes/pipeline-budget.routes';
import { PipelineTemplatesRoutes } from './routes/pipeline-templates.routes';
import { AIModelsRoutes } from './routes/ai-models.routes';
import { AIDecisionsRoutes } from './routes/ai-decisions.routes';
import { AIDegradationRoutes } from './routes/ai-degradation.routes';
import { ChaosRoutes } from './routes/chaos.routes';
import { ResilienceScoreRoutes } from './routes/resilience-score.routes';
import { DigitalTwinRoutes } from './routes/digital-twin.routes';
import { GovernanceRoutes } from './routes/governance.routes';
import type { WebSocketServerManager } from './websocket/ws-server';

export interface AppOptions {
  logger?: boolean;
}

export async function createApp(options: AppOptions = {}): Promise<{
  app: FastifyInstance;
  authMiddleware: AuthMiddleware;
  loggingMiddleware: LoggingMiddleware;
  tenantMiddleware: TenantMiddleware;
  permissionMiddleware: PermissionMiddleware;
  tokenService: TokenService;
  authRoutes: AuthRoutes;
  tenantRoutes: TenantRoutes;
  pipelineVersionsRoutes: PipelineVersionsRoutes;
  pipelineBudgetRoutes: PipelineBudgetRoutes;
  pipelineTemplatesRoutes: PipelineTemplatesRoutes;
  aiModelsRoutes: AIModelsRoutes;
  aiDecisionsRoutes: AIDecisionsRoutes;
  aiDegradationRoutes: AIDegradationRoutes;
  chaosRoutes: ChaosRoutes;
  resilienceScoreRoutes: ResilienceScoreRoutes;
  digitalTwinRoutes: DigitalTwinRoutes;
  governanceRoutes: GovernanceRoutes;
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
    contentSecurityPolicy: false, // 使用自定义 CSP 中间件
    crossOriginEmbedderPolicy: false,
  });

  // 2.1 自定义 CSP 中间件（用于微前端子应用加载）
  const cspMiddleware = createCSPMiddleware({
    enabled: true,
    reportOnly: process.env.NODE_ENV === 'development',
    reportUri: '/api/v1/csp-report',
    allowEval: true, // 微前端场景需要
  });
  app.addHook('onRequest', cspMiddleware);

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
  // Phase 4.2: Wire Redis client to token blacklist checker
  if (redisClientInstance) {
    authMiddleware.setRedisClient(redisClientInstance);
  }
  app.addHook('onRequest', authMiddleware.handler.bind(authMiddleware));

  // 子应用认证适配：JWT 验证通过后注入用户信息到 header
  // 子应用后端无需再解析 JWT，直接读取 X-User-* header 即可
  const subAppAuthHook = createSubAppAuthHook(app);
  app.addHook('onRequest', subAppAuthHook);

  // 租户解析中间件（在认证之后）
  const tenantMiddleware = new TenantMiddleware(app);
  app.addHook('onRequest', tenantMiddleware.handler.bind(tenantMiddleware));

  // 权限检查中间件（在租户解析之后，基于 RBAC+ABAC 进行 API 路由级权限控制）
  const permissionMiddleware = new PermissionMiddleware(app);
  app.addHook('onRequest', permissionMiddleware.handler.bind(permissionMiddleware));

  // ==================== 指标采集钩子 ====================

  // onResponse 钩子：请求完成后记录 Prometheus 指标
  app.addHook('onResponse', (request, reply, done) => {
    const route = request.routeOptions?.url ?? request.url;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };
    httpRequestTotal.inc(labels);
    httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
    done();
  });

  // ==================== 注册 Metrics 路由 ====================

  await app.register(metricsRoutes);

  // ==================== 注册认证路由 ====================

  // 注册认证路由（在 registerRoutes 之前，因为需要公开 /api/v1/auth/*路径）
  const authRoutes = new AuthRoutes(app);

  // ==================== 注册租户管理路由 ====================

  const tenantRoutes = new TenantRoutes(app);
  tenantRoutes.register();

  // ==================== 注册 Pipeline 相关路由 ====================

  const pipelineVersionsRoutes = new PipelineVersionsRoutes(app);
  pipelineVersionsRoutes.register();

  const pipelineBudgetRoutes = new PipelineBudgetRoutes(app);
  pipelineBudgetRoutes.register();

  const pipelineTemplatesRoutes = new PipelineTemplatesRoutes(app);
  pipelineTemplatesRoutes.register();

  // ==================== 注册 AI 相关路由 ====================

  const aiModelsRoutes = new AIModelsRoutes(app);
  aiModelsRoutes.register();

  const aiDecisionsRoutes = new AIDecisionsRoutes(app);
  aiDecisionsRoutes.register();

  const aiDegradationRoutes = new AIDegradationRoutes(app);
  aiDegradationRoutes.register();

  // ==================== 注册韧性工程相关路由 ====================

  const chaosRoutes = new ChaosRoutes(app);
  chaosRoutes.register();

  const resilienceScoreRoutes = new ResilienceScoreRoutes(app);
  resilienceScoreRoutes.register();


  // ==================== 注册高级功能路由 ====================

  const digitalTwinRoutes = new DigitalTwinRoutes(app);
  digitalTwinRoutes.register();

  const governanceRoutes = new GovernanceRoutes(app);
  governanceRoutes.register();

  // ==================== 错误处理 ====================

  app.setErrorHandler(errorMiddleware.handler.bind(errorMiddleware));

  // ==================== 注册路由 ====================

  // 注册动态发现的路由（包括服务注册表路由 + 静态 fallback + 子应用路由）
  await registerRoutes(app);

  // ==================== 注册服务到注册表 ====================

  // 注册自身服务
  serviceRegistry.register({
    name: 'api-gateway',
    url: `http://${config.host}:${config.port}`,
    healthUrl: `http://${config.host}:${config.port}/healthz`,
    metadata: {
      version: '1.0.0',
      api_paths: ['/healthz', '/readyz', '/version', '/metrics'],
    },
  });

  // ==================== 优雅关闭 ====================

  const gracefulShutdown = async () => {
    app.log.info('Received shutdown signal, shutting down gracefully...');

    // 关闭 WebSocket 服务器
    await wsServer.shutdown();

    // 清理动态路由
    gatewayDynamicRoutes.shutdown();

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

  return { app, authMiddleware, loggingMiddleware, tenantMiddleware, permissionMiddleware, tokenService, authRoutes, tenantRoutes, pipelineVersionsRoutes, pipelineBudgetRoutes, pipelineTemplatesRoutes, aiModelsRoutes, aiDecisionsRoutes, aiDegradationRoutes, chaosRoutes, resilienceScoreRoutes, sbomRoutes, digitalTwinRoutes, governanceRoutes, wsServer };
}
