/**
 * Extended Configuration Types & Defaults
 *
 * 扩展配置类型定义 - 补充 UnifiedConfigService 中未覆盖的配置域
 * 为统一配置中心提供额外的配置类型支撑
 */

import { SystemConfig as BaseConfig } from './UnifiedConfigService';

// ==================== 扩展配置接口 ====================

export interface ExtendedSystemConfig extends BaseConfig {
  // 配置管理配置
  configMgmt: {
    maxConfigSizeKb: number;
    yamlMaxDepth: number;
    gitOpsEnabled: boolean;
    configEncryptionEnabled: boolean;
    configApprovalRequired: boolean;
  };

  // 代码仓库配置
  codeRepo: {
    gitlabApiTimeoutSeconds: number;
    gerritApiTimeoutSeconds: number;
    maxPageSize: number;
    maxRepoSizeMb: number;
    defaultBranch: string;
    cloneTimeoutSeconds: number;
  };

  // 项目配置
  project: {
    maxProjectsPerTenant: number;
    maxMembersPerProject: number;
    projectAutoApproval: boolean;
    defaultProjectVisibility: string;
  };

  // ChatOps 配置
  chatops: {
    paginationDefaultSize: number;
    paginationMaxSize: number;
    auditLogRetentionDays: number;
    idempotencyTtlSeconds: number;
    commandTimeoutMs: number;
    maxRetries: number;
    dangerousCharsPattern: string;
    pathTraversalPattern: string;
    sensitiveKeys: string[];
    sessionTtlMinutes: number;
    maxSessionsPerUser: number;
    allowedPlatforms: string[];
  };

  // 诊断配置
  diagnostic: {
    diagnosisTimeoutMinutes: number;
    maxDiagnosisDepth: number;
    aiAssistedDiagnosis: boolean;
  };

  // 智能部署配置
  smartDeploy: {
    enabled: boolean;
    strategySelectionAI: boolean;
    riskThreshold: number;
  };

  // 发布窗口配置
  deploymentWindow: {
    enabled: boolean;
    allowedDays: string[];
    allowedHours: number[];
    blockedDates: string[];
    maintenanceMode: boolean;
  };

  // 发布审批配置
  releaseApproval: {
    productionRequiresApproval: boolean;
    approvalRoles: string[];
    autoRejectAfterHours: number;
    autoEscalateAfterHours: number;
    notifyOnApprove: string[];
    notifyOnReject: string[];
  };

  // 环境晋升规则
  environmentPromotion: {
    requireTests: boolean;
    requireSignoff: string[];
    promotionBlockers: string[];
    autoPromotionEnabled: boolean;
    promotionTimeoutHours: number;
  };

  // 质量门配置
  qualityGate: {
    enabled: boolean;
    defaultThresholds: {
      coveragePercent: number;
      criticalIssues: number;
      securityScore: number;
    };
  };

  // 效能配置
  efficiency: {
    doraTargets: {
      deployFrequencyPerDay: number;
      leadTimeForChangesHours: number;
      changeFailureRatePercent: number;
      mttrHours: number;
    };
    trendThreshold: number;
    reportScheduleCron: string;
  };

  // 成本配置
  cost: {
    currency: string;
    budgetAlertThreshold: number;
    costAnomalyThreshold: number;
    dailyCostLimit: number;
    costReportScheduleCron: string;
  };

  // 角色配置
  role: {
    maxRolesPerTenant: number;
    maxPermissionsPerRole: number;
    roleHierarchyEnabled: boolean;
  };

  // API Key 配置
  apiKey: {
    expiryDays: number;
    maxKeysPerUser: number;
    keyPrefix: string;
    requireDescription: boolean;
  };

  // 隐私配置
  privacy: {
    dataMaskingEnabled: boolean;
    piiDetectionEnabled: boolean;
    gdprCompliance: boolean;
    retentionEnforcement: boolean;
  };

  // 策略配置
  policy: {
    policyEngineEnabled: boolean;
    maxPoliciesPerTenant: number;
    policyEvaluationTimeoutMs: number;
    cachingEnabled: boolean;
  };

  // API 治理配置
  apiGovernance: {
    rateLimitEnabled: boolean;
    rateLimitPerMinute: number;
    versioningEnabled: boolean;
    deprecationGracePeriodDays: number;
  };

  // CMDB 配置
  cmdb: {
    syncIntervalMinutes: number;
    reconciliationEnabled: boolean;
    reconciliationIntervalMinutes: number;
    resourceKinds: string[];
    namespacePoolSize: number;
  };

  // Webhook 配置
  webhook: {
    timeoutSeconds: number;
    maxRetries: number;
    retryDelaySeconds: number;
    secretValidationEnabled: boolean;
  };

  // 会话配置
  session: {
    ttlMinutes: number;
    refreshEnabled: boolean;
    maxSessionsPerUser: number;
    concurrentSessionLimit: number;
  };

  // 用户配置
  user: {
    maxUsersPerTenant: number;
    defaultUserRole: string;
    passwordMinLength: number;
    passwordRequireSpecialChar: boolean;
    mfaEnabled: boolean;
  };

  // 一致性配置
  consistency: {
    checkIntervalMinutes: number;
    consistencyLevel: 'eventual' | 'strong';
    repairEnabled: boolean;
  };

  // 输出验证配置
  outputValidation: {
    maxFileSize: number;
    maxChangesPerPatch: number;
    disallowedPatterns: string[];
    dlpEnabled: boolean;
  };

  // 降级配置
  degradation: {
    enabled: boolean;
    autoRecoveryEnabled: boolean;
    recoveryCheckIntervalMs: number;
    minRecoveryTimeMs: number;
    maxRecoveryAttempts: number;
    successThreshold: number;
  };

  // 安全扩展配置 (补充 base security)
  securityExtended: {
    jwtSecretRotationDays: number;
    secretManagement: {
      provider: string;
      vaultUrl?: string;
      awsRegion?: string;
      keyVaultName?: string;
    };
    logMasking: {
      enabled: boolean;
      patterns: string[];
    };
    accessControl: {
      tenantIsolation: boolean;
      configReadRoles: string[];
      configWriteRoles: string[];
      sensitiveConfigRoles: string[];
    };
  };

  // 配置分级
  configSensitivity: {
    public: string[];
    internal: string[];
    confidential: string[];
    secret: string[];
  };
}

// ==================== 扩展默认值 ====================

export const EXTENDED_DEFAULTS: Partial<ExtendedSystemConfig> = {
  configMgmt: {
    maxConfigSizeKb: 512,
    yamlMaxDepth: 20,
    gitOpsEnabled: false,
    configEncryptionEnabled: true,
    configApprovalRequired: false,
  },

  codeRepo: {
    gitlabApiTimeoutSeconds: 30,
    gerritApiTimeoutSeconds: 30,
    maxPageSize: 100,
    maxRepoSizeMb: 10240,
    defaultBranch: 'main',
    cloneTimeoutSeconds: 300,
  },

  project: {
    maxProjectsPerTenant: 100,
    maxMembersPerProject: 50,
    projectAutoApproval: false,
    defaultProjectVisibility: 'private',
  },

  chatops: {
    paginationDefaultSize: 20,
    paginationMaxSize: 100,
    auditLogRetentionDays: 90,
    idempotencyTtlSeconds: 3600,
    commandTimeoutMs: 30000,
    maxRetries: 3,
    dangerousCharsPattern: '[;&|`$]',
    pathTraversalPattern: '\\.\\.',
    sensitiveKeys: ['password', 'token', 'secret', 'key'],
    sessionTtlMinutes: 60,
    maxSessionsPerUser: 5,
    allowedPlatforms: ['slack', 'dingtalk', 'wechat', 'teams'],
  },

  diagnostic: {
    diagnosisTimeoutMinutes: 30,
    maxDiagnosisDepth: 5,
    aiAssistedDiagnosis: true,
  },

  smartDeploy: {
    enabled: false,
    strategySelectionAI: false,
    riskThreshold: 0.3,
  },

  deploymentWindow: {
    enabled: false,
    allowedDays: ['Sat', 'Sun'],
    allowedHours: [2, 3, 4],
    blockedDates: [],
    maintenanceMode: false,
  },

  releaseApproval: {
    productionRequiresApproval: true,
    approvalRoles: ['REL_MGR', 'QA_LEAD', 'SRE_LEAD'],
    autoRejectAfterHours: 24,
    autoEscalateAfterHours: 12,
    notifyOnApprove: ['dingtalk'],
    notifyOnReject: ['dingtalk'],
  },

  environmentPromotion: {
    requireTests: true,
    requireSignoff: ['DEV', 'QA'],
    promotionBlockers: ['critical_bugs', 'security_issues'],
    autoPromotionEnabled: false,
    promotionTimeoutHours: 48,
  },

  qualityGate: {
    enabled: true,
    defaultThresholds: {
      coveragePercent: 80,
      criticalIssues: 0,
      securityScore: 80,
    },
  },

  efficiency: {
    doraTargets: {
      deployFrequencyPerDay: 4,
      leadTimeForChangesHours: 24,
      changeFailureRatePercent: 5,
      mttrHours: 1,
    },
    trendThreshold: 10,
    reportScheduleCron: '0 8 * * 1',
  },

  cost: {
    currency: 'CNY',
    budgetAlertThreshold: 80,
    costAnomalyThreshold: 20,
    dailyCostLimit: 1000,
    costReportScheduleCron: '0 0 * * *',
  },

  role: {
    maxRolesPerTenant: 50,
    maxPermissionsPerRole: 100,
    roleHierarchyEnabled: true,
  },

  apiKey: {
    expiryDays: 90,
    maxKeysPerUser: 10,
    keyPrefix: 'orion_',
    requireDescription: true,
  },

  privacy: {
    dataMaskingEnabled: true,
    piiDetectionEnabled: true,
    gdprCompliance: false,
    retentionEnforcement: true,
  },

  policy: {
    policyEngineEnabled: true,
    maxPoliciesPerTenant: 100,
    policyEvaluationTimeoutMs: 5000,
    cachingEnabled: true,
  },

  apiGovernance: {
    rateLimitEnabled: true,
    rateLimitPerMinute: 1000,
    versioningEnabled: true,
    deprecationGracePeriodDays: 180,
  },

  cmdb: {
    syncIntervalMinutes: 60,
    reconciliationEnabled: true,
    reconciliationIntervalMinutes: 1440,
    resourceKinds: ['server', 'container', 'network', 'storage'],
    namespacePoolSize: 5,
  },

  webhook: {
    timeoutSeconds: 30,
    maxRetries: 3,
    retryDelaySeconds: 60,
    secretValidationEnabled: true,
  },

  session: {
    ttlMinutes: 60,
    refreshEnabled: true,
    maxSessionsPerUser: 5,
    concurrentSessionLimit: 3,
  },

  user: {
    maxUsersPerTenant: 1000,
    defaultUserRole: 'developer',
    passwordMinLength: 8,
    passwordRequireSpecialChar: true,
    mfaEnabled: false,
  },

  consistency: {
    checkIntervalMinutes: 15,
    consistencyLevel: 'eventual',
    repairEnabled: true,
  },

  outputValidation: {
    maxFileSize: 10485760,
    maxChangesPerPatch: 1000,
    disallowedPatterns: ['*.exe', '*.dll', '*.so'],
    dlpEnabled: true,
  },

  degradation: {
    enabled: true,
    autoRecoveryEnabled: true,
    recoveryCheckIntervalMs: 30000,
    minRecoveryTimeMs: 60000,
    maxRecoveryAttempts: 3,
    successThreshold: 0.8,
  },

  securityExtended: {
    jwtSecretRotationDays: 90,
    secretManagement: {
      provider: process.env.SECRET_PROVIDER || 'env',
      vaultUrl: process.env.VAULT_URL,
      awsRegion: process.env.AWS_REGION,
      keyVaultName: process.env.AZURE_KEY_VAULT,
    },
    logMasking: {
      enabled: true,
      patterns: ['password', 'token', 'secret', 'key', 'jwt', 'credential'],
    },
    accessControl: {
      tenantIsolation: true,
      configReadRoles: ['admin', 'operator', 'viewer'],
      configWriteRoles: ['admin', 'operator'],
      sensitiveConfigRoles: ['admin'],
    },
  },

  configSensitivity: {
    public: ['app.port', 'app.host', 'app.env', 'pipeline.maxConcurrentRuns'],
    internal: ['pipeline.defaultTimeoutMinutes', 'deploy.defaultStrategy'],
    confidential: ['database.host', 'redis.host', 'nats.servers'],
    secret: ['jwtSecret', 'database.password', 'redis.password', 'nats.pass'],
  },
};

export default EXTENDED_DEFAULTS;
