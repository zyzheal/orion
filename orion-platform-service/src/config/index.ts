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
    consumers: {
      stream: string;
      name: string;
      filterSubject?: string;
      deliverPolicy?: string;
      ackPolicy?: string;
      ackWait?: string;
      maxDeliver?: number;
      maxAckPending?: number;
      replayPolicy?: string;
    }[];
    dlq: {
      maxDeliver: number;
      ackWait: string;
    };
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
        name: 'ORION_PLATFORM',
        subjects: ['orion.code.*', 'orion.deploy.*', 'orion.config.*', 'orion.incident.*', 'orion.self-healing.*'],
      },
      {
        name: 'ORION_PIPELINE',
        subjects: ['orion.pipeline.run.*', 'orion.pipeline.stage.*', 'orion.pipeline.task.*'],
      },
      {
        name: 'ORION_DLQ',
        subjects: ['*.dlq.>'],
      },
    ],
    consumers: [
      {
        stream: 'ORION_PLATFORM',
        name: 'platform-all',
        filterSubject: 'orion.*',
        deliverPolicy: 'new',
        ackPolicy: 'explicit',
        ackWait: '30s',
        maxDeliver: 5,
        maxAckPending: 100,
        replayPolicy: 'instant',
      },
      {
        stream: 'ORION_PIPELINE',
        name: 'pipeline-run',
        filterSubject: 'orion.pipeline.run.*',
        deliverPolicy: 'new',
        ackPolicy: 'explicit',
        ackWait: '60s',
        maxDeliver: 5,
        maxAckPending: 200,
        replayPolicy: 'instant',
      },
      {
        stream: 'ORION_PIPELINE',
        name: 'pipeline-stage',
        filterSubject: 'orion.pipeline.stage.*',
        deliverPolicy: 'new',
        ackPolicy: 'explicit',
        ackWait: '30s',
        maxDeliver: 3,
        maxAckPending: 500,
        replayPolicy: 'instant',
      },
    ],
    dlq: {
      maxDeliver: 5,
      ackWait: '30s',
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
          name: 'ORION_PLATFORM',
          subjects: ['orion.code.*', 'orion.deploy.*', 'orion.config.*', 'orion.incident.*', 'orion.self-healing.*'],
        },
        {
          name: 'ORION_PIPELINE',
          subjects: ['orion.pipeline.run.*', 'orion.pipeline.stage.*', 'orion.pipeline.task.*'],
        },
        {
          name: 'ORION_DLQ',
          subjects: ['*.dlq.>'],
        },
      ],
      consumers: [
        {
          stream: 'ORION_PLATFORM',
          name: 'platform-all',
          filterSubject: 'orion.*',
          deliverPolicy: 'new',
          ackPolicy: 'explicit',
          ackWait: '30s',
          maxDeliver: 5,
          maxAckPending: 100,
          replayPolicy: 'instant',
        },
        {
          stream: 'ORION_PLATFORM',
          name: 'self-healing',
          filterSubject: 'orion.self-healing.*',
          deliverPolicy: 'new',
          ackPolicy: 'explicit',
          ackWait: '60s',
          maxDeliver: 5,
          maxAckPending: 50,
          replayPolicy: 'instant',
        },
        {
          stream: 'ORION_PIPELINE',
          name: 'pipeline-run',
          filterSubject: 'orion.pipeline.run.*',
          deliverPolicy: 'new',
          ackPolicy: 'explicit',
          ackWait: '60s',
          maxDeliver: 5,
          maxAckPending: 200,
          replayPolicy: 'instant',
        },
        {
          stream: 'ORION_PIPELINE',
          name: 'pipeline-stage',
          filterSubject: 'orion.pipeline.stage.*',
          deliverPolicy: 'new',
          ackPolicy: 'explicit',
          ackWait: '30s',
          maxDeliver: 3,
          maxAckPending: 500,
          replayPolicy: 'instant',
        },
      ],
      dlq: {
        maxDeliver: 5,
        ackWait: '30s',
      },
    },
  };
  return currentConfig;
}

export function updateConfig(partial: Partial<AppConfig>): void {
  currentConfig = { ...currentConfig, ...partial };
}
