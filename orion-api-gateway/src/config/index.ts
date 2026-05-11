/**
 * Orion API Gateway - 应用配置
 *
 * 配置管理支持：
 * - 环境变量
 * - 配置文件
 * - 热加载
 */

export interface AppConfig {
  port: number;
  host: string;
  logLevel: string;
  corsOrigins: string[];
  jwtSecret: string;
  jwtExpiresIn: string;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  rateLimit: {
    max: number;
    timeWindow: number;
  };
  nats: {
    servers: string[];
    user?: string;
    pass?: string;
  };
  services: {
    [key: string]: {
      url: string;
      timeout?: number;
    };
  };
}

const defaultConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
  jwtSecret: process.env.JWT_SECRET || 'orion-default-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
  },
  nats: {
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
  },
  services: {
    platform: {
      url: process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001',
      timeout: parseInt(process.env.PLATFORM_TIMEOUT || '30000', 10),
    },
    pipeline: {
      url: process.env.PIPELINE_SERVICE_URL || 'http://localhost:3002',
      timeout: parseInt(process.env.PIPELINE_TIMEOUT || '60000', 10),
    },
    deploy: {
      url: process.env.DEPLOY_SERVICE_URL || 'http://localhost:3003',
      timeout: parseInt(process.env.DEPLOY_TIMEOUT || '60000', 10),
    },
    ticket: {
      url: process.env.TICKET_SERVICE_URL || 'http://localhost:3004',
      timeout: parseInt(process.env.TICKET_TIMEOUT || '30000', 10),
    },
    monitor: {
      url: process.env.MONITOR_SERVICE_URL || 'http://localhost:3005',
      timeout: parseInt(process.env.MONITOR_TIMEOUT || '30000', 10),
    },
    intelligence: {
      url: process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:3006',
      timeout: parseInt(process.env.INTELLIGENCE_TIMEOUT || '60000', 10),
    },
    agent: {
      url: process.env.AGENT_SERVICE_URL || 'http://localhost:3007',
      timeout: parseInt(process.env.AGENT_TIMEOUT || '60000', 10),
    },
    finops: {
      url: process.env.FINOPS_SERVICE_URL || 'http://localhost:3009',
      timeout: parseInt(process.env.FINOPS_TIMEOUT || '30000', 10),
    },
  },
};

let currentConfig: AppConfig = { ...defaultConfig };

export function getConfig(): AppConfig {
  return currentConfig;
}

export function reloadConfig(): AppConfig {
  currentConfig = {
    ...defaultConfig,
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
    jwtSecret: process.env.JWT_SECRET || 'orion-default-jwt-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    },
    nats: {
      servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
      user: process.env.NATS_USER,
      pass: process.env.NATS_PASS,
    },
    services: {
      platform: {
        url: process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001',
        timeout: parseInt(process.env.PLATFORM_TIMEOUT || '30000', 10),
      },
      pipeline: {
        url: process.env.PIPELINE_SERVICE_URL || 'http://localhost:3002',
        timeout: parseInt(process.env.PIPELINE_TIMEOUT || '60000', 10),
      },
      deploy: {
        url: process.env.DEPLOY_SERVICE_URL || 'http://localhost:3003',
        timeout: parseInt(process.env.DEPLOY_TIMEOUT || '60000', 10),
      },
      ticket: {
        url: process.env.TICKET_SERVICE_URL || 'http://localhost:3004',
        timeout: parseInt(process.env.TICKET_TIMEOUT || '30000', 10),
      },
      monitor: {
        url: process.env.MONITOR_SERVICE_URL || 'http://localhost:3005',
        timeout: parseInt(process.env.MONITOR_TIMEOUT || '30000', 10),
      },
      intelligence: {
        url: process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:3006',
        timeout: parseInt(process.env.INTELLIGENCE_TIMEOUT || '60000', 10),
      },
      agent: {
        url: process.env.AGENT_SERVICE_URL || 'http://localhost:3007',
        timeout: parseInt(process.env.AGENT_TIMEOUT || '60000', 10),
      },
      finops: {
        url: process.env.FINOPS_SERVICE_URL || 'http://localhost:3009',
        timeout: parseInt(process.env.FINOPS_TIMEOUT || '30000', 10),
      },
    },
  };
  return currentConfig;
}

export function updateConfig(partial: Partial<AppConfig>): void {
  currentConfig = { ...currentConfig, ...partial };
}
