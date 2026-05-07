/**
 * Orion Platform Service - 入口文件
 *
 * 启动平台核心服务
 */

import { createApp } from './app';
import { config as platformConfig } from './config';
import { RedisCache } from './services/redis-cache';
import { DatabasePool } from './services/database';
import { EventBusService } from './services/event-bus-service';
import { NatsServiceRegistry } from './services/nats-registry';

async function main() {
  const cfg = platformConfig;

  console.log(`
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
      console.log('Initializing Redis...');
      redis = new RedisCache(cfg.redis);
      try {
        await redis.connect();
      } catch (error) {
        console.warn('Redis connection failed, continuing without Redis');
      }
    }

    // 2. 初始化数据库
    if (cfg.database.host) {
      console.log('Initializing Database...');
      database = new DatabasePool(cfg.database);
      try {
        await database.connect();
      } catch (error) {
        console.warn('Database connection failed, continuing without Database');
      }
    }

    // 3. 初始化事件总线
    const eventBusEnabled = process.env.EVENT_BUS_ENABLED !== 'false';
    if (eventBusEnabled) {
      console.log('Initializing Event Bus...');
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
        console.warn('Event Bus connection failed, continuing without Event Bus');
      }
    }

    // 4. 创建应用
    console.log('Creating Fastify application...');
    const { app, healthChecker } = await createApp({ redis, database, eventBus });

    // 5. 启动服务器
    await app.listen({ port: cfg.app.port, host: cfg.app.host });

    console.log(`
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
    console.log('Configuration:');
    console.log(`   Service Name: orion-platform-service`);
    console.log(`   NATS Servers: ${cfg.nats.servers.join(', ')}`);
    console.log(`   Redis: ${cfg.redis.host}:${cfg.redis.port}`);
    console.log(`   Database: ${cfg.database.host}:${cfg.database.port}/${cfg.database.database}`);

    // 优雅关闭
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n Received ${signal}, shutting down gracefully...`);

      try {
        await app.close();
        if (eventBus) await eventBus.close();
        if (database) await database.close();
        if (redis) await redis.close();

        console.log(' Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error(' Shutdown error:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error(' Failed to start Platform Service:', error);
    process.exit(1);
  }
}

// 启动应用
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
