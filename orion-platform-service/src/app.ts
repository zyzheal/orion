/**
 * Orion Platform Service - Fastify 应用配置
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { v4 as uuidv4 } from 'uuid';

import { config } from './config';
import { HealthChecker, HealthStatus } from './services/health';
import { RedisCache } from './services/redis-cache';
import { DatabasePool } from './services/database';
import { EventBusService } from './services/event-bus-service';
import { NatsServiceRegistry } from './services/nats-registry';
import { initApiKeyAuth } from './middleware/apiKeyAuth';
import apiRoutes from './api/routes';
import authRoutes from './api/routes-auth';
import { registerSsoRoutes } from './api/sso-routes';
import { registerMaintenanceWindowRoutes } from './api/maintenance-window-routes';
import teamRoutes from './api/team-routes';

// AuthZ engine imports
import { RoleService, ROLE_INHERITANCE, SYSTEM_ROLE_PERMISSIONS, BUSINESS_ROLE_PERMISSIONS, PROJECT_ROLE_PERMISSIONS } from './services/role/RoleService';
import { RoleRepository } from './services/role/RoleRepository';
import { PermissionRepository } from './repositories/PermissionRepository';
import { PermissionService } from './services/permission/PermissionService';
import { AuthorizationEngine } from './services/authz/AuthorizationEngine';
import { PipelineRBACService } from './services/pipeline/PipelineRBACService';
import { RBACRuleRepository } from './repositories/RBACRuleRepository';
import { AbacPolicyEngine } from './services/authz/AbacPolicyEngine';
import { RelationshipService } from './services/authz/RelationshipService';
import { PermissionAuditRepository } from './repositories/PermissionAuditRepository';
import { setAuthzEngine } from './middleware/requirePermission';
import { setCapabilityService } from './middleware/requireCapability';
import { CacheService } from './services/cache/CacheService';
import { CacheStrategyService } from './services/cache/CacheStrategyService';
import { TeamRepository, TeamService } from './services/team';
import { CapabilityRepository, CapabilityService } from './services/capability';
import capabilityRoutes from './api/capability-routes';
import { getCircuitBreakerService } from './services/circuit-breaker';
import circuitBreakerRoutes from './api/circuit-breaker-routes';
import { MessageQueueService } from './services/message-queue/message-queue-service';
import messageQueueRoutes from './api/message-queue-routes';
import cacheRoutes from './api/cache-routes';
import pino from 'pino';

const logger = pino({ name: 'app' });

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
  const cfg = config;

  // 创建 Fastify 实例
  const app = Fastify({
    logger: {
      level: cfg.app.logLevel || 'info',
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
    // A3 Fix: Global body size limit to prevent oversized payloads
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // ==================== 注册插件 ====================

  // 1. CORS 配置 — 修复：不再使用 origin:true（等同允许所有来源），改为从环境变量读取允许的来源列表
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000']; // 开发环境默认

  await app.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID', 'X-Tenant-ID', 'X-User-ID'],
  });

  // 2. Helmet 安全头部
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // 3. A5 Fix: Rate limiting to prevent DoS abuse
  // Default: 1000 requests per 60s per IP, with stricter limits for write operations
  await app.register(fastifyRateLimit, {
    max: 1000,
    timeWindow: '1 minute',
    ban: 300, // Ban for 5 minutes after exceeding rate limit 300 times
    keyGenerator: (request: FastifyRequest) => {
      // Use IP address only — custom headers can be spoofed by clients
      return request.ip;
    },
    errorResponseBuilder: (_request: FastifyRequest, context: { after: string; max: number; ttl: number }) => {
      return {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        code: '42900',
        message: `Too many requests. Try again ${context.after}`,
        retryAfter: context.ttl,
      };
    },
  });

  // ==================== OpenAPI / Swagger 文档 ====================

  // 4. Swagger — OpenAPI 3.0 规范自动生成
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Orion Platform API',
        description: 'AI-driven DevOps platform API — R&D efficiency, pipeline management, observability',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3001', description: 'Development' },
      ],
      tags: [
        { name: 'auth', description: 'Authentication' },
        { name: 'pipeline', description: 'Pipeline management' },
        { name: 'alert', description: 'Alert management' },
        { name: 'incident', description: 'Incident management' },
        { name: 'ticket', description: 'Ticket management' },
        { name: 'finops', description: 'FinOps' },
        { name: 'self-healing', description: 'Self-healing' },
        { name: 'maintenance', description: 'Maintenance windows' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http' as const,
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: ({ schema, ...rest }) => {
      // 自动将 JSON Schema 转换为 OpenAPI Schema（处理 ajv 格式差异）
      return {
        schema: {
          ...schema,
        },
        ...rest,
      };
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });

  // ==================== 健康检查 ====================

  const healthChecker = new HealthChecker('orion-platform-service');

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

  // 注册数据库健康检查（数据库是关键依赖，标记为 readiness 检查）
  if (options.database) {
    healthChecker.registerCheck('database', async () => {
      return await options.database!.checkHealth();
    });
    healthChecker.markAsReadyCheck('database');
  }

  // Initialize API key auth middleware
  if (options.database) {
    initApiKeyAuth(options.database);
  }

  // ==================== AuthZ Engine Initialization ====================
  // Initialize RBAC + ABAC unified authorization engine
  if (options.database) {
    const permRepo = new PermissionRepository(options.database);
    const roleRepo = new RoleRepository(options.database);
    const roleService = new RoleService(roleRepo);
    const abacEngine = new AbacPolicyEngine();
    const relationshipService = new RelationshipService(options.database);
    const auditRepo = new PermissionAuditRepository(options.database);

    const rbacRuleRepo = new RBACRuleRepository(options.database);
    const pipelineRbacService = new PipelineRBACService(rbacRuleRepo);

    // 初始化权限缓存（使用 Redis）
    const cacheService = options.redis ? new CacheService(options.redis, 300) : null;
    const cacheTtl = parseInt(process.env.AUTHZ_CACHE_TTL || '300', 10);

    // Initialize Team service
    const teamRepo = new TeamRepository(options.database);
    const teamService = new TeamService(teamRepo, roleRepo);

    // Initialize Capability service (hoisted for cron job access)
    const capRepo = new CapabilityRepository(options.database);
    const capabilityService = new CapabilityService(capRepo, roleRepo);

    const authzEngine = new AuthorizationEngine(
      roleService,
      abacEngine,
      relationshipService,
      auditRepo,
      pipelineRbacService,
      teamService,
      capabilityService,
      cacheService,
      cacheTtl,
    );

    // Register global AuthZ engine instance for middleware use
    setAuthzEngine(authzEngine);

    // Register global CapabilityService instance for middleware use
    setCapabilityService(capabilityService);

    // Seed permissions and roles asynchronously (non-blocking)
    const permService = new PermissionService(permRepo);
    permService.seedCommonPermissions().then((result) => {
      logger.info(`[AuthZ] Seeded ${result.created} permissions (${result.skipped} existing)`);
    }).catch((err) => {
      logger.error('[AuthZ] Failed to seed common permissions:', err);
    });

    // Seed system-level default roles and bind permissions
    // Use system tenant for initial seeding; per-tenant seeding happens on tenant creation
    const SYSTEM_TENANT = '00000000-0000-0000-0000-000000000001';
    roleService.seedDefaultRoles(SYSTEM_TENANT).then((result) => {
      logger.info(`[AuthZ] Seeded ${result.created} roles (${result.skipped} existing)`);
      // After roles are created, bind permissions to them
      return roleService.seedRolePermissions();
    }).then(() => {
      logger.info('[AuthZ] Role permissions seeded successfully');
    }).catch((err) => {
      logger.error('[AuthZ] Failed to seed roles/permissions:', err);
    });

    logger.info('[AuthZ] Authorization engine initialized (RBAC + ABAC + Relationship + Audit)');
  }

  // 注册 EventBus 健康检查
  if (options.eventBus) {
    healthChecker.registerCheck('eventbus', async () => {
      const health = await options.eventBus!.checkHealth();
      // Add JetStream status
      if (options.eventBus!.isJetStreamAvailable()) {
        return { ...health, jetstream: 'up' };
      }
      return health;
    });
  }

  // 存活检查端点 — 仅检查进程是否存活（最快，用于 K8s liveness probe）
  app.get('/livez', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: 'orion-platform-service',
      pid: process.pid,
      uptime: process.uptime(),
    });
  });

  // 就绪检查端点 — 检查关键依赖是否就绪（用于 K8s readiness probe）
  app.get('/readyz', async (_request: FastifyRequest, reply: FastifyReply) => {
    const readyResult = await healthChecker.checkReady();

    return reply.status(readyResult.ready ? 200 : 503).send({
      status: readyResult.ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      service: 'orion-platform-service',
      checks: readyResult.checks,
    });
  });

  // 综合健康检查端点 — 检查所有依赖（用于人工查看或监控系统）
  app.get('/healthz', async (request: FastifyRequest, reply: FastifyReply) => {
    const health = await healthChecker.check();
    const statusCode = health.status === 'healthy' ? 200 :
                       health.status === 'degraded' ? 200 : 503;
    return reply.status(statusCode).send(health);
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

  // Register auth API routes with database access
  await app.register(authRoutes, { prefix: '/api/v1/auth', database: options.database });

  // Register SSO/OIDC routes with database access + Redis for state storage
  await app.register(registerSsoRoutes, { prefix: '/api/v1/auth', database: options.database, redis: options.redis });

  // Register main API routes with database access
  await app.register(apiRoutes, { prefix: '/api/v1', eventBus: options.eventBus, database: options.database, redis: options.redis });

  // Register Maintenance Window routes with database access
  await app.register(registerMaintenanceWindowRoutes, { database: options.database });

  // Register Team routes with database access
  if (options.database) {
    await app.register(teamRoutes, { prefix: '/api/v1/teams', database: options.database });

    // Register Capability routes
    await app.register(capabilityRoutes, { database: options.database });

    // F003: Register Circuit Breaker routes
    const cbService = getCircuitBreakerService();
    if (cbService) {
      await app.register(circuitBreakerRoutes, { circuitBreakerService: cbService });
    }

    // F008: Register Message Queue routes
    const mqService = new MessageQueueService();
    await app.register(messageQueueRoutes, { messageQueueService: mqService });

    // F014: Register Cache Management routes
    // CacheStrategyService is initialized above for AuthZ cache, reuse it for cache management
    if (options.redis) {
      const cacheStrategyService = new CacheStrategyService(options.redis);
      await app.register(cacheRoutes, { cacheService: cacheStrategyService });
    }

    // Register permission cleanup cron job (creates its own lightweight service instance)
    setupPermissionCleanupJob(options.database);
  }

  // 基础 API 路由
  app.get('/api/v1/info', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      service: 'orion-platform-service',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  // ==================== 错误处理 ====================

  // A4 Fix: Unified global error handler with consistent response format
  // All uncaught errors return the same envelope: { success, error, code, message, timestamp, path }
  app.setErrorHandler((error: Error, request, reply) => {
    const statusCode = (reply.statusCode >= 400 && reply.statusCode < 600) ? reply.statusCode : 500;

    // Structured error logging with request context
    app.log.error({
      error: error.name,
      message: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      requestId: request.id,
      statusCode,
    }, 'Unhandled error');

    // Map common error types to consistent responses
    const isDev = process.env.NODE_ENV === 'development';

    // Fastify validation errors
    if ((error as any).validation) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        code: '40001',
        message: 'Request validation failed',
        details: (error as any).validation,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.id,
      });
    }

    // Fastify parsing errors
    if (statusCode === 413 || error.message.includes('body size')) {
      return reply.status(413).send({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        code: '41300',
        message: 'Request body exceeds maximum allowed size (10MB)',
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.id,
      });
    }

    // Default error response
    return reply.status(statusCode).send({
      success: false,
      error: statusCode === 500 ? 'INTERNAL_ERROR' : error.name || 'REQUEST_ERROR',
      code: statusCode === 500 ? '50000' : `${statusCode}00`,
      message: isDev ? error.message : 'An unexpected error occurred',
      details: isDev ? { stack: error.stack } : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.id,
    });
  });

  // 404 处理 — 格式与全局错误处理器保持一致
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      success: false,
      error: 'NOT_FOUND',
      code: '40400',
      message: `Cannot ${request.method} ${request.url}`,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.id,
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

/**
 * 设置权限过期清理定时任务
 * 每 10 分钟执行一次，清理 chatops_temporary_permissions 和 capability_user_mappings 中的过期记录
 */
function setupPermissionCleanupJob(database: DatabasePool): void {
  const capRepo = new CapabilityRepository(database);
  const capabilityService = new CapabilityService(capRepo);

  const cleanup = async () => {
    try {
      const result = await capabilityService.cleanupExpiredTemporaryPermissions();
      logger.info(`[PermissionCleanup] Cleaned ${result.cleaned} expired permissions, wrote ${result.auditLogs} audit logs`);
    } catch (error) {
      logger.error('[PermissionCleanup] Failed:', error);
    }
  };

  // 每 10 分钟执行一次
  setInterval(cleanup, 10 * 60 * 1000);

  // 立即执行一次
  cleanup();

  logger.info('[PermissionCleanup] Cron job registered (every 10 minutes)');
}