/**
 * Unified Configuration Center
 * 
 * 统一配置中心 - 集中管理所有系统配置
 * 支持: 环境变量 / 数据库配置 / 热更新
 */

import { DatabasePool } from '../database';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== 配置类型定义 ====================

export interface SystemConfig {
  // 应用配置
  app: {
    port: number;
    host: string;
    env: 'development' | 'production' | 'test';
    logLevel: string;
  };
  
  // 数据库配置
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    poolSize: number;
  };
  
  // Redis 配置
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  
  // NATS 配置
  nats: {
    servers: string[];
    user?: string;
    pass?: string;
  };
  
  // 升级配置
  escalation: {
    enabled: boolean;
    checkIntervalSeconds: number;
    defaults: {
      alertTimeoutMinutes: number;
      ticketSlaTimeoutMinutes: number;
      incidentTimeoutMinutes: number;
    };
  };
  
  // 告警配置
  alert: {
    deduplicationWindowMs: number;
    correlationWindowMs: number;
    autoAckTimeoutMs: number;
    maxEnrichAttempts: number;
  };
  
  // 自愈配置
  selfHealing: {
    enabled: boolean;
    maxConcurrentHealings: number;
    healthCheckIntervalMs: number;
    failureThreshold: number;
    recoveryThreshold: number;
  };
  
  // 工单配置
  ticketing: {
    autoAssignEnabled: boolean;
    defaultPriority: string;
    sla: {
      critical: { responseMinutes: number; resolutionMinutes: number };
      high: { responseMinutes: number; resolutionMinutes: number };
      medium: { responseMinutes: number; resolutionMinutes: number };
      low: { responseMinutes: number; resolutionMinutes: number };
    };
  };
  
  // 监控配置
  monitoring: {
    metricsEnabled: boolean;
    tracesEnabled: boolean;
    sampleRate: number;
    exportIntervalMs: number;
  };
  
  // 安全配置
  security: {
    jwtSecret: string;
    jwtExpiryHours: number;
    refreshTokenExpiryDays: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
  };
  
  // 通知配置
  notification: {
    channels: {
      dingtalk: { enabled: boolean; webhookUrl?: string };
      wechat: { enabled: boolean; corpId?: string; agentId?: string };
      email: { enabled: boolean; smtpHost?: string; smtpPort?: number };
      sms: { enabled: boolean; provider?: string };
      slack: { enabled: boolean; webhookUrl?: string };
    };
    defaultChannel: string;
  };
  
  // 审计配置
  audit: {
    enabled: boolean;
    retentionDays: number;
    hashAlgorithm: string;
    enableSignature: boolean;
  };
  
  // 灾备配置
  disasterRecovery: {
    enabled: boolean;
    rtoTargetSeconds: number;
    rpoTargetSeconds: number;
    autoFailoverEnabled: boolean;
    drillScheduleCron: string;
  };
  
  // Pipeline 配置
  pipeline: {
    maxConcurrentRuns: number;
    defaultTimeoutMinutes: number;
    retryAttempts: number;
    artifactRetentionDays: number;
  };
  
  // 部署配置
  deploy: {
    defaultStrategy: 'blue-green' | 'canary' | 'rolling';
    healthCheckTimeoutSeconds: number;
    preDeployApprovalRequired: boolean;
    autoRollbackEnabled: boolean;
  };
  
  // 租户配置
  tenant: {
    maxTenants: number;
    defaultQuota: {
      pipelines: number;
      storageMb: number;
      apiCallsPerDay: number;
    };
    rlsEnabled: boolean;
  };
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: SystemConfig = {
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    env: (process.env.NODE_ENV as any) || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'orion',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  
  nats: {
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
  },
  
  escalation: {
    enabled: true,
    checkIntervalSeconds: 60,
    defaults: {
      alertTimeoutMinutes: 15,
      ticketSlaTimeoutMinutes: 120,
      incidentTimeoutMinutes: 30,
    },
  },
  
  alert: {
    deduplicationWindowMs: 300000,      // 5 分钟
    correlationWindowMs: 600000,        // 10 分钟
    autoAckTimeoutMs: 900000,           // 15 分钟
    maxEnrichAttempts: 3,
  },
  
  selfHealing: {
    enabled: true,
    maxConcurrentHealings: 10,
    healthCheckIntervalMs: 30000,       // 30 秒
    failureThreshold: 3,
    recoveryThreshold: 2,
  },
  
  ticketing: {
    autoAssignEnabled: true,
    defaultPriority: 'medium',
    sla: {
      critical: { responseMinutes: 15, resolutionMinutes: 240 },
      high: { responseMinutes: 30, resolutionMinutes: 480 },
      medium: { responseMinutes: 60, resolutionMinutes: 1440 },
      low: { responseMinutes: 240, resolutionMinutes: 2880 },
    },
  },
  
  monitoring: {
    metricsEnabled: true,
    tracesEnabled: true,
    sampleRate: 0.1,
    exportIntervalMs: 60000,
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    jwtExpiryHours: 24,
    refreshTokenExpiryDays: 30,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
  },
  
  notification: {
    channels: {
      dingtalk: { enabled: false },
      wechat: { enabled: false },
      email: { enabled: false },
      sms: { enabled: false },
      slack: { enabled: false },
    },
    defaultChannel: 'dingtalk',
  },
  
  audit: {
    enabled: true,
    retentionDays: 365,
    hashAlgorithm: 'sha256',
    enableSignature: true,
  },
  
  disasterRecovery: {
    enabled: false,
    rtoTargetSeconds: 600,      // 10 分钟
    rpoTargetSeconds: 300,      // 5 分钟
    autoFailoverEnabled: false,
    drillScheduleCron: '0 2 * * 0',  // 每周日凌晨 2 点
  },
  
  pipeline: {
    maxConcurrentRuns: 50,
    defaultTimeoutMinutes: 120,
    retryAttempts: 3,
    artifactRetentionDays: 30,
  },
  
  deploy: {
    defaultStrategy: 'rolling',
    healthCheckTimeoutSeconds: 300,
    preDeployApprovalRequired: true,
    autoRollbackEnabled: true,
  },
  
  tenant: {
    maxTenants: 100,
    defaultQuota: {
      pipelines: 100,
      storageMb: 10240,
      apiCallsPerDay: 100000,
    },
    rlsEnabled: true,
  },
};

// ==================== 配置服务 ====================

export class UnifiedConfigService {
  private db?: DatabasePool;
  private config: SystemConfig;
  private cache: Map<string, any> = new Map();
  private subscribers: Map<string, Function[]> = new Map();
  
  constructor(database?: DatabasePool) {
    this.db = database;
    this.config = { ...DEFAULT_CONFIG };
  }
  
  /**
   * 初始化配置中心
   */
  async iy: string, newValue: any, oldValue: any): void {
    const subs = this.subscribers.get(key) || [];
    for (const callback of subs) {
      try {
        callback(newValue, oldValue);
      } catch (error) {
        logger.error(`[UnifiedConfig] Subscriber error for ${key}:`, error);
      }
    }
    
    // 通知通配符订阅者
    const wildcardSubs = this.subscribers.get('*') || [];
    for (const callback of wildcardSubs) {
      try {
        callback(key, newValue, oldValue);
      } catch (error) {
        logger.error('[UnifiedConfig] Wildcard subscriber error:', error);
      }
    }
  }
  
  /**
   * 重置为默认配置
   */
  async reset(key?: keyof SystemConfig): Promise<void> {
    if (key) {
      this.config[key] = DEFAULT_CONFIG[key];
      await this.set(key, DEFAULT_CONFIG[key]);
    } else {
      this.config = { ...DEFAULT_CONFIG };
    }
  }
  
  /**
   * 导出配置 (脱敏)
   */
  exportConfig(): Partial<SystemConfig> {
    const exported = { ...this.config };
    
    // 脱敏敏感配置
    if (exported.security) {
      exported.security = {
        ...exported.security,
        jwtSecret: '***REDACTED***',
      };
    }
    
    if (exported.database) {
      exported.database = {
        ...exported.database,
        password: '***REDACTED***',
      };
    }
    
    if (exported.redis?.password) {
      exported.redis.password = '***REDACTED***';
    }
    
    return exported;
  }
}

// 导出单例
export const unifiedConfig = new UnifiedConfigService();

// 便捷访问
export const config = {
  get app() { return unifiedConfig.get('app'); },
  get database() { return unifiedConfig.get('database'); },
  get redis() { return unifiedConfig.get('redis'); },
  get nats() { return unifiedConfig.get('nats'); },
  get escalation() { return unifiedConfig.get('escalation'); },
  get alert() { return unifiedConfig.get('alert'); },
  get selfHealing() { return unifiedConfig.get('selfHealing'); },
  get ticketing() { return unifiedConfig.get('ticketing'); },
  get monitoring() { return unifiedConfig.get('monitoring'); },
  get security() { return unifiedConfig.get('security'); },
  get notification() { return unifiedConfig.get('notification'); },
  get audit() { return unifiedConfig.get('audit'); },
  get disasterRecovery() { return unifiedConfig.get('disasterRecovery'); },
  get pipeline() { return unifiedConfig.get('pipeline'); },
  get deploy() { return unifiedConfig.get('deploy'); },
  get tenant() { return unifiedConfig.get('tenant'); },
};