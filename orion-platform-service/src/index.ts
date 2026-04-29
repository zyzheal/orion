/**
 * Orion Platform Service - 入口文件
 *
 * 启动平台核心服务
 */

import { createApp } from './app';
import { getConfig } from './config';
import { RedisCache } from './services/redis-cache';
import { DatabasePool } from './services/database';
import { EventBusService } from './services/event-bus-service';
import { NatsServiceRegistry } from './services/nats-registry';

async function main() {
  const config = getConfig();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Orion Platform Service                               ║
║                                                           ║
║   Version: 1.0.0                                          ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  // 初始化服务
  let redis: RedisCache | undefined;
  let database: DatabasePool | undefined;
  let eventBus: EventBusService | undefined;
  let natsRegistry: NatsServiceRegistry | undefined;

  try {
    // 1. 初始化 Redis
    if (config.redis.host) {
      console.log('📦 Initializing Redis...');
      redis = new RedisCache(config.redis);
      try {
        await redis.connect();
      } catch (error) {
        console.warn('⚠️  Redis connection failed, continuing without Redis');
      }
    }

    // 2. 初始化数据库
    if (config.database.host) {
      console.log('📦 Initializing Database...');
      database = new DatabasePool(config.database);
      try {
        await database.connect();
      } catch (error) {
        console.warn('⚠️  Database connection failed, continuing without Database');
      }
    }

    // 3. 初始化事件总线
    if (config.eventBus.enabled) {
      console.log('📦 Initializing Event Bus...');
      eventBus = new EventBusService({
        servers: config.nats.servers,
        user: config.nats.user,
        pass: config.nats.pass,
        retry: config.eventBus.enabled ? {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          multiplier: 2,
        } : undefined,
        enabled: true,
        autoConnect: true,
      });
      try {
        await eventBus.connect();

        // Initialize JetStream streams
        if (eventBus.isJetStreamAvailable()) {
          console.log('Initializing JetStream streams...');
          for (const stream of config.eventBus.streams) {
            try {
              await eventBus.ensureStream(stream);
              console.log(`  OK JetStream stream: ${stream.name}`);
            } catch (error) {
              console.warn(`  WARN Failed to ensure JetStream stream ${stream.name}:`, error);
            }
          }

          // Initialize JetStream consumers
          for (const consumer of config.eventBus.consumers) {
            try {
              await eventBus.ensureConsumer(consumer.stream, consumer as any);
              console.log(`  OK JetStream consumer: ${consumer.name}`);
            } catch (error) {
              console.warn(`  WARN Failed to ensure JetStream consumer ${consumer.name}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️  Event Bus connection failed, continuing without Event Bus');
      }
    }

    // 4. 创建应用
    console.log('📦 Creating Fastify application...');
    const { app, healthChecker } = await createApp({ redis, database, eventBus });

    // 5. 启动服务器
    await app.listen({ port: config.port, host: config.host });

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Server is running                                    ║
║                                                           ║
║   📍 Address: http://${config.host}:${config.port}                         ║
║   🏥 Health:  http://${config.host}:${config.port}/healthz                  ║
║   📖 Version: http://${config.host}:${config.port}/version                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

    // 打印配置信息
    console.log('📋 Configuration:');
    console.log(`   Service Name: ${config.serviceName}`);
    console.log(`   NATS Servers: ${config.nats.servers.join(', ')}`);
    console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
    console.log(`   Database: ${config.database.host}:${config.database.port}/${config.database.database}`);

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
