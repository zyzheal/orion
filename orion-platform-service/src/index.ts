/**
 * Orion Platform Service - 入口文件
 *
 * 启动平台核心服务
 */

// MUST be first: load .env before any other imports that depend on process.env
import './env';

import { createApp } from './app';
import { config as platformConfig } from './config';
import { RedisCache } from './services/redis-cache';
import { DatabasePool } from './services/database';
import { EventBusService } from './services/event-bus-service';
import { NatsServiceRegistry } from './services/nats-registry';
import { initializeOpenTelemetry } from './otel-setup';
import { shutdownAllExecutors } from './services/plugin-executor-service';
import { shutdownAllTimelines } from './services/observability/ExecutionTimelineService';
import { initCircuitBreakerService, getCircuitBreakerService } from './services/circuit-breaker';
import pino from 'pino';

const logger = pino({ name: 'index' });

async function main() {
  const cfg = platformConfig;

  logger.info(`
+-----------------------------------------------------------+
|                                                           |
|   Orion Platform Service                                  |
|                                                           |
|   Version: 1.0.0                                          |
|   Environment: ${process.env.NODE_ENV || 'development'}                              |
|                                                           |
+-----------------------------------------------------------+
`);

  // 初始化服务
  let redis: RedisCache | undefined;
  let database: DatabasePool | undefined;
  let eventBus: EventBusService | undefined;
  let natsRegistry: NatsServiceRegistry | undefined;

  try {
    // 1. 初始化 Redis
    if (cfg.redis.host) {
      logger.info('Initializing Redis...');
      redis = new RedisCache(cfg.redis);
      try {
        await redis.connect();
      } catch (error) {
        logger.warn('Redis connection failed, continuing without Redis');
      }
    }

    // 2. 初始化数据库
    if (cfg.database.host) {
      logger.info('Initializing Database...');
      database = new DatabasePool(cfg.database);
      try {
        await database.connect();
      } catch (error) {
        logger.warn('Database connection failed, continuing without Database');
        logger.warn('Database error details:', error);
        logger.warn('Config used:', JSON.stringify(cfg.database).replace(/password.*/gi, 'password":"***"'));
        database = undefined; // Don't pass a disconnected pool
      }
    }

    // 3. 初始化事件总线
    const eventBusEnabled = process.env.EVENT_BUS_ENABLED !== 'false';
    if (eventBusEnabled) {
      logger.info('Initializing Event Bus...');
      eventBus = new EventBusService({
        servers: cfg.nats.servers,
        user: cfg.nats.user,
        pass: cfg.nats.pass,
        retry: {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          multiplier: 2,
        },
        enabled: true,
        autoConnect: true,
      });
      try {
        await eventBus.connect();
      } catch (error) {
        logger.warn('Event Bus connection failed, continuing without Event Bus');
      }

      // Initialize NATS Service Registry after eventBus connects
      const natsConn = eventBus.getNatsConnection();
      if (natsConn && database) {
        natsRegistry = new NatsServiceRegistry(natsConn, database);
        await natsRegistry.init();
      }
    }

    // 4. Initialize OpenTelemetry
    await initializeOpenTelemetry();

    // 4.5 Initialize Circuit Breaker Service
    await initCircuitBreakerService(database);

    // 5. 创建应用
    logger.info('Creating Fastify application...');
    const { app, healthChecker } = await createApp({ redis, database, eventBus });

    // 6. 启动服务器
    await app.listen({ port: cfg.app.port, host: cfg.app.host });

    logger.info(`
+-----------------------------------------------------------+
|                                                           |
|   Server is running                                       |
|                                                           |
|   Address: http://${cfg.app.host}:${cfg.app.port}                         |
|   Health:  http://${cfg.app.host}:${cfg.app.port}/healthz                  |
|   Version: http://${cfg.app.host}:${cfg.app.port}/version                  |
|                                                           |
+-----------------------------------------------------------+
`);

    // 打印配置信息
    logger.info('Configuration:');
    logger.info(`   Service Name: orion-platform-service`);
    logger.info(`   NATS Servers: ${cfg.nats.servers.join(', ')}`);
    logger.info(`   Redis: ${cfg.redis.host}:${cfg.redis.port}`);
    logger.info(`   Database: ${cfg.database.host}:${cfg.database.port}/${cfg.database.database}`);

    // 优雅关闭
    const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);

    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n Received ${signal}, shutting down gracefully...`);

      // Enforce a hard shutdown deadline to prevent hanging forever
      const shutdownTimer = setTimeout(() => {
        logger.error(` Shutdown timeout (${SHUTDOWN_TIMEOUT_MS}ms) exceeded, forcing exit`);
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
      // Allow the timer to not block exit if shutdown completes normally
      shutdownTimer.unref();

      try {
        // Stop accepting new requests first
        await app.close();

        // Drain pending plugin executions
        await shutdownAllExecutors();

        // Clean up timeline services (timers, Maps)
        shutdownAllTimelines();

        // Close other connections
        if (eventBus) await eventBus.close();
        if (database) await database.close();
        if (redis) await redis.close();

        clearTimeout(shutdownTimer);
        logger.info(' Shutdown complete');
        process.exit(0);
      } catch (error) {
        clearTimeout(shutdownTimer);
        logger.error(' Shutdown error:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error(' Failed to start Platform Service:', error);
    process.exit(1);
  }
}

// 启动应用
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
