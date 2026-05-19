/**
 * Unified Configuration Center
 * 
 * 统一配置中心 - 集中管理所有系统配置
 * 支持: 环境变量 / 数据库配置 / 热更新
 */

import { DatabasePool } from '../services/database';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Parse DATABASE_URL into individual config fields (fallback when DB_* env vars are not set)
 * Format: postgresql://user:password@host:port/database
 */
function parseDatabaseUrl(): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  const url = process.env.DATABASE_URL;
  if (!url) return { host: '', port: '', user: '', password: '', database: '' };
  try {
    // Remove protocol
    const afterProtocol = url.replace(/^postgresql?:\/\//, '');
    const [auth, rest] = afterProtocol.split('@');
    const [user, password] = auth.split(':');
    const [hostPort, database] = rest.split('/');
    const [host, port] = hostPort.split(':');
    return { host, port: port || '5432', user, password, database };
  } catch {
    return { host: '', port: '', user: '', password: '', database: '' };
  }
}

const dbUrl = parseDatabaseUrl();

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

  // 构建配置
  build: {
    maxParallelJobs: number;
    defaultTimeoutMinutes: number;
    retryAttempts: number;
    nodePoolSize: number;
  };

  // 制品配置
  artifact: {
    retentionDays: number;
    maxSizeMb: number;
    cleanupPolicy: 'lru' | 'fifo' | 'manual';
    storagePath: string;
  };

  // 金丝雀配置
  canary: {
    initialTrafficPercent: number;
    incrementPercent: number;
    analysisIntervalSeconds: number;
    autoPromoteThreshold: number;
  };

  // 混沌工程配置
  chaos: {
    maxConcurrentExperiments: number;
    maxBlastRadiusPercent: number;
    allowedAttackTypes: string[];
    requireApproval: boolean;
  };

  // 备份配置
  backup: {
    scheduleCron: string;
    retentionDays: number;
    storageLocation: string;
    compressionEnabled: boolean;
  };

  // 事件管理配置
  incident: {
    severityLevels: string[];
    autoEscalationMinutes: number;
    slaCriticalMinutes: number;
    slaHighMinutes: number;
  };

  // 任务调度配置
  scheduler: {
    maxConcurrentJobs: number;
    retryPolicy: { maxAttempts: number; backoffMs: number };
    staleJobTimeoutMinutes: number;
  };

  // 可观测性配置
  observability: {
    metricsRetentionDays: number;
    logSamplingRate: number;
    tracingEnabled: boolean;
    traceSamplingRate: number;
  };

  // FinOps 配置
  finops: {
    budgetThresholdPercent: number;
    alertRules: { critical: number; warning: number };
    costCenterTagging: boolean;
    reportScheduleCron: string;
  };

  // 安全扫描配置
  securityScanning: {
    sbomScanningEnabled: boolean;
    dependencyCheckEnabled: boolean;
    vulnerabilityThreshold: 'critical' | 'high' | 'medium' | 'low' | 'none';
    scanOnPush: boolean;
  };

  // 合规配置
  compliance: {
    auditLogRetentionDays: number;
    dataResidencyRegions: string[];
    encryptionRequired: boolean;
    policyEnforcementMode: 'strict' | 'warn' | 'off';
  };

  // 特性开关配置
  featureFlag: {
    defaultState: boolean;
    rolloutStrategy: 'percentage' | 'user-list' | 'environment';
    evaluationTimeoutMs: number;
  };

  // AI 决策配置
  aiDecision: {
    defaultModel: string;
    confidenceThreshold: number;
    fallbackEnabled: boolean;
    maxDecisionTimeSeconds: number;
  };

  // Pipeline 模板配置
  pipelineTemplate: {
    defaultTemplates: string[];
    validationEnabled: boolean;
    customTemplateAllowed: boolean;
    maxTemplateSizeKb: number;
  };

  // 审批流程配置
  approval: {
    maxLevels: number;
    timeoutMinutes: number;
    autoApproveRules: { enabled: boolean; maxRiskLevel: string };
  };

  // 弹性配置
  resilience: {
    scoringWeights: { availability: number; performance: number; faultTolerance: number };
    passingThreshold: number;
    baselineRefreshDays: number;
  };

  // 数字孪生配置
  digitalTwin: {
    syncIntervalSeconds: number;
    simulationAccuracyTarget: number;
    stateHistoryRetentionDays: number;
  };

  // 环境配置
  environment: {
    maxQuotaPerEnv: { cpu: number; memoryMb: number; storageGb: number };
    isolationLevel: 'namespace' | 'cluster' | 'node';
    maxEnvironmentsPerTenant: number;
  };

  // 插件配置
  plugin: {
    marketplaceUrl: string;
    validationEnabled: boolean;
    sandboxMode: boolean;
    maxPluginsPerTenant: number;
  };

  // 缓存配置
  cache: {
    defaultTtlSeconds: number;
    evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
    maxMemoryMb: number;
    keyPrefix: string;
  };

  // 队列配置
  queue: {
    maxDepth: number;
    priorityWeights: { high: number; normal: number; low: number };
    deadLetterPolicy: { enabled: boolean; retentionDays: number };
  };

  // 事件总线配置
  eventBus: {
    connectionPoolSize: number;
    streamConfig: { maxMsgSizeBytes: number; maxAgeHours: number };
    consumerGroupPrefix: string;
  };

  // RBAC 配置
  rbac: {
    defaultRoles: string[];
    permissionInheritanceEnabled: boolean;
    maxRolesPerTenant: number;
    auditPermissionChanges: boolean;
  };

  // API 网关配置
  apiGateway: {
    rateLimitPerMinute: number;
    timeoutSeconds: number;
    corsOrigins: string[];
    healthCheckPath: string;
  };

  // 模块配置
  moduleConfig: {
    core: Record<string, { enabled: boolean }>;
    domains: Record<string, { enabled: boolean; autoStart?: boolean; services?: Record<string, { enabled: boolean; autoStart?: boolean; dependencies?: string[] }> }>;
    services: Record<string, { enabled: boolean; autoStart?: boolean; dependencies?: string[]; priority?: number }>;
    features: Record<string, { enabled: boolean }>;
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
    host: process.env.DB_HOST || dbUrl.host || 'localhost',
    port: parseInt(process.env.DB_PORT || dbUrl.port || '5432', 10),
    user: process.env.DB_USER || dbUrl.user || 'postgres',
    password: process.env.DB_PASSWORD || dbUrl.password || '',
    database: process.env.DB_NAME || dbUrl.database || 'orion',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '50', 10),
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

  build: {
    maxParallelJobs: 20,
    defaultTimeoutMinutes: 60,
    retryAttempts: 2,
    nodePoolSize: 10,
  },

  artifact: {
    retentionDays: 90,
    maxSizeMb: 2048,
    cleanupPolicy: 'lru',
    storagePath: '/data/artifacts',
  },

  canary: {
    initialTrafficPercent: 5,
    incrementPercent: 10,
    analysisIntervalSeconds: 300,
    autoPromoteThreshold: 0.99,
  },

  chaos: {
    maxConcurrentExperiments: 3,
    maxBlastRadiusPercent: 10,
    allowedAttackTypes: ['network-latency', 'pod-failure', 'cpu-stress'],
    requireApproval: true,
  },

  backup: {
    scheduleCron: '0 2 * * *',
    retentionDays: 30,
    storageLocation: '/data/backups',
    compressionEnabled: true,
  },

  incident: {
    severityLevels: ['critical', 'high', 'medium', 'low'],
    autoEscalationMinutes: 30,
    slaCriticalMinutes: 60,
    slaHighMinutes: 240,
  },

  scheduler: {
    maxConcurrentJobs: 50,
    retryPolicy: { maxAttempts: 3, backoffMs: 5000 },
    staleJobTimeoutMinutes: 120,
  },

  observability: {
    metricsRetentionDays: 30,
    logSamplingRate: 0.5,
    tracingEnabled: true,
    traceSamplingRate: 0.1,
  },

  finops: {
    budgetThresholdPercent: 80,
    alertRules: { critical: 100, warning: 80 },
    costCenterTagging: true,
    reportScheduleCron: '0 8 1 * *',
  },

  securityScanning: {
    sbomScanningEnabled: true,
    dependencyCheckEnabled: true,
    vulnerabilityThreshold: 'high',
    scanOnPush: true,
  },

  compliance: {
    auditLogRetentionDays: 730,
    dataResidencyRegions: ['cn-north-1'],
    encryptionRequired: true,
    policyEnforcementMode: 'strict',
  },

  featureFlag: {
    defaultState: false,
    rolloutStrategy: 'percentage',
    evaluationTimeoutMs: 100,
  },

  aiDecision: {
    defaultModel: 'qwen-plus',
    confidenceThreshold: 0.8,
    fallbackEnabled: true,
    maxDecisionTimeSeconds: 30,
  },

  pipelineTemplate: {
    defaultTemplates: ['nodejs-build', 'java-build', 'docker-build'],
    validationEnabled: true,
    customTemplateAllowed: true,
    maxTemplateSizeKb: 64,
  },

  approval: {
    maxLevels: 3,
    timeoutMinutes: 1440,
    autoApproveRules: { enabled: false, maxRiskLevel: 'low' },
  },

  resilience: {
    scoringWeights: { availability: 0.4, performance: 0.35, faultTolerance: 0.25 },
    passingThreshold: 70,
    baselineRefreshDays: 7,
  },

  digitalTwin: {
    syncIntervalSeconds: 60,
    simulationAccuracyTarget: 0.95,
    stateHistoryRetentionDays: 14,
  },

  environment: {
    maxQuotaPerEnv: { cpu: 4, memoryMb: 8192, storageGb: 50 },
    isolationLevel: 'namespace',
    maxEnvironmentsPerTenant: 20,
  },

  plugin: {
    marketplaceUrl: 'https://plugins.orion.internal',
    validationEnabled: true,
    sandboxMode: true,
    maxPluginsPerTenant: 50,
  },

  cache: {
    defaultTtlSeconds: 3600,
    evictionPolicy: 'lru',
    maxMemoryMb: 512,
    keyPrefix: 'orion:',
  },

  queue: {
    maxDepth: 10000,
    priorityWeights: { high: 3, normal: 2, low: 1 },
    deadLetterPolicy: { enabled: true, retentionDays: 7 },
  },

  eventBus: {
    connectionPoolSize: 5,
    streamConfig: { maxMsgSizeBytes: 1048576, maxAgeHours: 168 },
    consumerGroupPrefix: 'orion-cg-',
  },

  rbac: {
    defaultRoles: ['viewer', 'developer', 'admin'],
    permissionInheritanceEnabled: true,
    maxRolesPerTenant: 50,
    auditPermissionChanges: true,
  },

  apiGateway: {
    rateLimitPerMinute: 1000,
    timeoutSeconds: 30,
    corsOrigins: ['http://localhost:5173'],
    healthCheckPath: '/healthz',
  },

  moduleConfig: {
    core: {
      auth: { enabled: true },
      tenant: { enabled: true },
      database: { enabled: true },
      eventBus: { enabled: true },
      audit: { enabled: true },
      config: { enabled: true },
      degradation: { enabled: true },
      privacy: { enabled: true },
    },
    domains: {
      pipeline: { enabled: true, autoStart: true },
      build: { enabled: true, autoStart: true },
      deploy: { enabled: true, autoStart: true },
      monitoring: { enabled: true, autoStart: true },
      alert: { enabled: true, autoStart: true },
      security: { enabled: true, autoStart: true },
      ai: { enabled: true, autoStart: true },
      finops: { enabled: true, autoStart: true },
      chaos: { enabled: true, autoStart: true },
      backup: { enabled: true, autoStart: true },
      disasterRecovery: { enabled: true, autoStart: true },
      selfHealing: { enabled: true, autoStart: true },
      ticketing: { enabled: true, autoStart: true },
      knowledge: { enabled: true, autoStart: true },
      plugin: { enabled: true, autoStart: true },
      chatops: { enabled: true, autoStart: true },
      digitalTwin: { enabled: true, autoStart: true },
      federation: { enabled: true, autoStart: true },
      multiCloud: { enabled: true, autoStart: true },
      dataPipeline: { enabled: true, autoStart: true },
      community: { enabled: true, autoStart: true },
      efficiency: { enabled: true, autoStart: true },
      cmdb: { enabled: true, autoStart: true },
      iac: { enabled: true, autoStart: true },
    },
    services: {
      adaptivePipeline: { enabled: true },
      consistency: { enabled: false },
      deploymentWindow: { enabled: true },
      outputValidation: { enabled: false },
      costTracking: { enabled: true },
      riskEngine: { enabled: true },
      modelVersion: { enabled: false },
      agentRun: { enabled: false },
      agentProfile: { enabled: false },
      cmdbIntegration: { enabled: false },
    },
    features: {},
  },
};

// ==================== 配置服务 ====================

export class UnifiedConfigService {
  private db?: DatabasePool;
  private config: SystemConfig;
  private cache: Map<string, any> = new Map();
  private subscribers: Map<string, Function[]> = new Map();
  private history: Array<{ key: string; oldValue: any; newValue: any; timestamp: Date; changedBy?: string }> = [];

  constructor(database?: DatabasePool) {
    this.db = database;
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  
  /**
   * 初始化配置中心，从数据库加载持久化配置
   */
  async initialize(): Promise<void> {
    if (!this.db) {
      logger.info('[UnifiedConfig] No DB, using default configuration');
      return;
    }

    try {
      // Ensure table exists
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS system_config (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      const result = await this.db.query('SELECT key, value FROM system_config');
      let loaded = 0;
      for (const row of result.rows) {
        if (row.key in this.config) {
          (this.config as any)[row.key] = row.value;
          loaded++;
        }
      }
      logger.info(`[UnifiedConfig] Loaded ${loaded} config(s) from database`);
    } catch (error) {
      logger.error('[UnifiedConfig] Failed to load config from DB, using defaults:', error);
    }
  }

  /**
   * 获取配置值
   */
  get<K extends keyof SystemConfig>(key: K): SystemConfig[K] {
    return this.config[key];
  }

  /**
   * 设置配置值
   * @param changedBy 可选，记录操作人（审计用途）
   */
  async set<K extends keyof SystemConfig>(key: K, value: SystemConfig[K], changedBy?: string): Promise<void> {
    const oldValue = this.config[key];
    this.config[key] = value;

    // C3: 记录变更历史
    this.history.push({
      key: key as string,
      oldValue,
      newValue: value,
      timestamp: new Date(),
      changedBy,
    });

    // C5: 持久化到数据库
    if (this.db) {
      try {
        await this.db.query(
          'INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
          [key as string, JSON.stringify(value)]
        );
      } catch (error) {
        logger.warn('[UnifiedConfig] DB persistence failed, falling back to memory-only:', error);
      }
    }

    await this.notifySubscribers(key as string, value, oldValue);
  }

  /**
   * 通知订阅者
   */
  private async notifySubscribers(key: string, newValue: any, oldValue: any): Promise<void> {
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
   * 获取变更历史（最近优先）
   */
  getHistory(): Array<{ key: string; oldValue: any; newValue: any; timestamp: Date; changedBy?: string }> {
    return [...this.history].reverse();
  }
  
  /**
   * 重置为默认配置
   */
  async reset<K extends keyof SystemConfig>(key?: K): Promise<void> {
    if (key) {
      const oldValue = this.config[key];
      // C4: 深拷贝，避免引用污染 DEFAULT_CONFIG
      this.config[key] = JSON.parse(JSON.stringify(DEFAULT_CONFIG[key]));
      await this.notifySubscribers(key as string, this.config[key], oldValue);
    } else {
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
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
  get build() { return unifiedConfig.get('build'); },
  get artifact() { return unifiedConfig.get('artifact'); },
  get canary() { return unifiedConfig.get('canary'); },
  get chaos() { return unifiedConfig.get('chaos'); },
  get backup() { return unifiedConfig.get('backup'); },
  get incident() { return unifiedConfig.get('incident'); },
  get scheduler() { return unifiedConfig.get('scheduler'); },
  get observability() { return unifiedConfig.get('observability'); },
  get finops() { return unifiedConfig.get('finops'); },
  get securityScanning() { return unifiedConfig.get('securityScanning'); },
  get compliance() { return unifiedConfig.get('compliance'); },
  get featureFlag() { return unifiedConfig.get('featureFlag'); },
  get aiDecision() { return unifiedConfig.get('aiDecision'); },
  get pipelineTemplate() { return unifiedConfig.get('pipelineTemplate'); },
  get approval() { return unifiedConfig.get('approval'); },
  get resilience() { return unifiedConfig.get('resilience'); },
  get digitalTwin() { return unifiedConfig.get('digitalTwin'); },
  get environment() { return unifiedConfig.get('environment'); },
  get plugin() { return unifiedConfig.get('plugin'); },
  get cache() { return unifiedConfig.get('cache'); },
  get queue() { return unifiedConfig.get('queue'); },
  get eventBus() { return unifiedConfig.get('eventBus'); },
  get rbac() { return unifiedConfig.get('rbac'); },
  get apiGateway() { return unifiedConfig.get('apiGateway'); },
  get moduleConfig() { return unifiedConfig.get('moduleConfig'); },
};