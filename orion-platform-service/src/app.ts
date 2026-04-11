/**
 * Orion Platform Service - Express 应用配置
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

import { getConfig } from './config';
import { HealthChecker, HealthStatus } from './services/health';
import { RedisCache } from './services/redis-cache';
import { DatabasePool } from './services/database';
import { EventBusService } from './services/event-bus-service';
import { NatsServiceRegistry } from './services/nats-registry';

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
  app: Express;
  healthChecker: HealthChecker;
  redis?: RedisCache;
  database?: DatabasePool;
  eventBus?: EventBusService;
}> {
  const config = getConfig();
  const app = express();

  // ==================== 基础中间件 ====================

  // JSON 解析
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  }));

  // 请求 ID 中间件
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    res.setHeader('x-request-id', requestId);
    (req as any).requestId = requestId;
    next();
  });

  // 日志中间件
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = (req as any).requestId;

    logger.info({
      type: 'request',
      method: req.method,
      url: req.url,
      requestId,
    }, 'Incoming request');

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info({
        type: 'response',
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        requestId,
      }, 'Request completed');
    });

    next();
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
  app.get('/healthz', async (req: Request, res: Response) => {
    const health = await healthChecker.check();
    const statusCode = health.status === 'healthy' ? 200 :
                       health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // 就绪检查端点
  app.get('/readyz', async (req: Request, res: Response) => {
    const health = await healthChecker.check();
    const isReady = health.status !== 'unhealthy';

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      service: config.serviceName,
    });
  });

  // 版本信息端点
  app.get('/version', (req: Request, res: Response) => {
    res.json({
      name: '@orion/platform-service',
      version: process.env.VERSION || '1.0.0',
      buildTime: process.env.BUILD_TIME,
      gitCommit: process.env.GIT_COMMIT,
    });
  });

  // ==================== API 路由 ====================

  // 基础 API 路由
  app.get('/api/v1/info', (req: Request, res: Response) => {
    res.json({
      service: config.serviceName,
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  // 404 处理
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.url}`,
      timestamp: new Date().toISOString(),
    });
  });

  // 错误处理
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error({
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
    }, 'Unhandled error');

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
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
