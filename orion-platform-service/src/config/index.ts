/**
 * Orion Platform Service - 配置管理
 *
 * 支持：
 * - 环境变量
 * - 配置文件
 * - 热加载
 */

export interface AppConfig {
  port: number;
  host: string;
  logLevel: string;
  serviceName: string;
  nats: {
    servers: string[];
    user?: string;
    pass?: string;
    queueGroup?: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix?: string;
  };
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    poolSize: number;
  };
  eventBus: {
    enabled: boolean;
    streams: {
      name: string;
      subjects: string[];
    }[];
  };
}

const defaultConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  serviceName: process.env.SERVICE_NAME || 'orion-platform-service',
  nats: {
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
    queueGroup: process.env.NATS_QUEUE_GROUP || 'orion-platform',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'orion:',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'orion',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },
  eventBus: {
    enabled: process.env.EVENT_BUS_ENABLED !== 'false',
    streams: [
      {
        name: 'orion-platform-stream',
        subjects: ['orion.platform.*'],
      },
    ],
  },
};

let currentConfig: AppConfig = { ...defaultConfig };

export function getConfig(): AppConfig {
  return currentConfig;
}

export function reloadConfig(): AppConfig {
  currentConfig = {
    ...defaultConfig,
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    serviceName: process.env.SERVICE_NAME || 'orion-platform-service',
    nats: {
      servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
      user: process.env.NATS_USER,
      pass: process.env.NATS_PASS,
      queueGroup: process.env.NATS_QUEUE_GROUP || 'orion-platform',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'orion:',
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'orion',
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    },
    eventBus: {
      enabled: process.env.EVENT_BUS_ENABLED !== 'false',
      streams: [
        {
          name: 'orion-platform-stream',
          subjects: ['orion.platform.*'],
        },
      ],
    },
  };
  return currentConfig;
}

export function updateConfig(partial: Partial<AppConfig>): void {
  currentConfig = { ...currentConfig, ...partial };
}
