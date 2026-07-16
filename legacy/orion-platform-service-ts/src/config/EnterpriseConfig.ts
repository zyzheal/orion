/**
 * Enterprise Platform Extended Configurations
 * 
 * 企业级中台扩展配置 - 30+ 新增配置域
 * 补充消息中间件、数据存储、服务治理、可观测性等能力
 */

// ==================== 新增配置接口 ====================

export interface EnterpriseSystemConfig {
  // 消息中间件 - Kafka
  kafka: {
    brokers: string[];
    partitions: number;
    replicas: number;
    retentionHours: number;
    compressionType: 'none' | 'gzip' | 'snappy' | 'lz4';
    acks: '0' | '1' | 'all';
    maxBatchSizeBytes: number;
    lingerMs: number;
  };
  
  // 消息中间件 - RabbitMQ
  rabbitMQ: {
    url: string;
    vhost: string;
    connectionTimeout: number;
    channelMax: number;
    frameMax: number;
    heartbeat: number;
    deliveryLimit: number;
  };
  
  // 消息中间件 - RocketMQ
  rocketMQ: {
    namesrvAddr: string;
    producerGroup: string;
    consumerGroup: string;
    sendTimeout: number;
    compressMsgBodyOverHowmuch: number;
    maxMessageSize: number;
  };
  
  // 文档数据库 - MongoDB
  mongodb: {
    uri: string;
    database: string;
    poolSize: number;
    socketTimeout: number;
    serverSelectionTimeout: number;
    maxIdleTimeMS: number;
    retryWrites: boolean;
    retryReads: boolean;
  };
  
  // 搜索引擎 - Elasticsearch
  elasticsearch: {
    nodes: string[];
    indexShards: number;
    indexReplicas: number;
    refreshInterval: string;
    maxResultWindow: number;
    requestTimeout: number;
    compressionEnabled: boolean;
  };
  
  // 对象存储 - MinIO
  minio: {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucketName: string;
    region: string;
    useSSL: boolean;
    partSize: number;
    maxPoolSize: number;
  };
  
  // API 网关
  gateway: {
    port: number;
    timeout: number;
    maxConnections: number;
    cors: {
      enabled: boolean;
      origins: string[];
      methods: string[];
      headers: string[];
    };
    rateLimit: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
    };
    compression: {
      enabled: boolean;
      level: number;
      threshold: number;
    };
  };
  
  // 熔断器
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    halfOpenRequests: number;
    slidingWindowSize: number;
    permittedNumberOfCallsInHalfOpenState: number;
  };
  
  // 限流配置
  rateLimit: {
    enabled: boolean;
    defaultLimit: number;
    defaultWindow: string;
    strategy: 'token-bucket' | 'leaky-bucket' | 'fixed-window';
    redisPrefix: string;
    ipWhitelist: string[];
  };
  
  // 服务发现
  serviceDiscovery: {
    provider: 'consul' | 'eureka' | 'nacos' | 'kubernetes';
    endpoint: string;
    namespace: string;
    healthCheckInterval: number;
    deregisterAfter: number;
    preferAgent: boolean;
  };
  
  // Kubernetes 配置
  kubernetes: {
    apiServer: string;
    caCert: string;
    token: string;
    namespace: string;
    defaultImagePullSecret: string;
    resourceQuotaEnabled: boolean;
    networkPolicyEnabled: boolean;
    podSecurityPolicyEnabled: boolean;
  };
  
  // Helm 配置
  helm: {
    repoUrl: string;
    username?: string;
    password?: string;
    timeout: number;
    maxHistory: number;
    atomic: boolean;
    wait: boolean;
  };
  
  // 容器镜像仓库
  containerRegistry: {
    url: string;
    authType: 'none' | 'basic' | 'token' | 'ecr';
    username?: string;
    password?: string;
    region?: string;
    insecure: boolean;
    pullPolicy: 'Always' | 'IfNotPresent' | 'Never';
  };
  
  // 日志配置
  logging: {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    output: string[];
    file: {
      enabled: boolean;
      path: string;
      maxSize: string;
      maxFiles: number;
    };
    stdout: {
      enabled: boolean;
      colorize: boolean;
    };
  };
  
  // 分布式追踪
  trace: {
    enabled: boolean;
    sampler: 'const' | 'probabilistic' | 'ratelimiting' | 'remote';
    samplerParam: number;
    endpoint: string;
    serviceName: string;
    maxTagValueLength: number;
    sampleElasticPercentage: number;
  };
  
  // 日志保留策略
  logRetention: {
    days: number;
    compressionEnabled: boolean;
    archiveEnabled: boolean;
    archivePath: string;
    deletionEnabled: boolean;
  };
  
  // AI 运维配置
  aiops: {
    enabled: boolean;
    models: string[];
    threshold: number;
    autoActionEnabled: boolean;
    trainingIntervalHours: number;
    predictionWindowHours: number;
    anomalyScoreThreshold: number;
  };
  
  // 异常检测
  anomalyDetection: {
    enabled: boolean;
    sensitivity: number;
    windowMinutes: number;
    baselineWindowDays: number;
    deviationThreshold: number;
    alertOnDetection: boolean;
    autoAckEnabled: boolean;
  };
  
  // SOC2 合规
  soc2: {
    enabled: boolean;
    controlsEnabled: string[];
    auditIntervalDays: number;
    evidenceRetentionDays: number;
    automatedTesting: boolean;
  };
  
  // ISO27001 合规
  iso27001: {
    enabled: boolean;
    controlsEnabled: string[];
    riskAssessmentInterval: number;
    statementOfApplicability: string[];
  };
  
  // 数据治理
  dataGovernance: {
    classificationEnabled: boolean;
    retentionPolicy: {
      defaultDays: number;
      encryptionRequired: boolean;
    };
    dataLineageEnabled: boolean;
    piiDetectionEnabled: boolean;
    maskOnExport: boolean;
  };
  
  // 计费配置
  billing: {
    enabled: boolean;
    currency: string;
    pricingModel: 'subscription' | 'usage' | 'hybrid';
    billingCycle: 'daily' | 'weekly' | 'monthly';
    invoiceDelivery: string[];
    taxRate: number;
    creditLimit: number;
  };
  
  // 使用量追踪
  usageTracking: {
    enabled: boolean;
    interval: number;
    aggregation: string;
    metrics: string[];
    retentionDays: number;
    exportEnabled: boolean;
  };
  
  // 配额管理
  quotaManagement: {
    enabled: boolean;
    enforcementMode: 'strict' | 'soft' | 'advisory';
    notifications: {
      enabled: boolean;
      thresholds: number[];
      channels: string[];
    };
    gracePeriodHours: number;
  };
  
  // 服务网格
  serviceMesh: {
    enabled: boolean;
    provider: 'istio' | 'linkerd' | 'envoy';
    controlPlane: string;
    mtlsEnabled: boolean;
    tracingEnabled: boolean;
    egressEnabled: boolean;
  };
  
  // 工作流引擎
  workflow: {
    engine: string;
    timeout: number;
    maxConcurrent: number;
    retryPolicy: {
      maxAttempts: number;
      backoff: string;
    };
    historyRetention: number;
  };
  
  // 知识库
  knowledge: {
    enabled: boolean;
    provider: string;
    indexType: string;
    embeddingModel: string;
    similarityThreshold: number;
    maxResults: number;
  };
  
  // 报表配置
  reporting: {
    enabled: boolean;
    formats: string[];
    schedule: string;
    retentionDays: number;
    recipients: string[];
  };
  
  // 通知编排
  notificationOrchestration: {
    enabled: boolean;
    channels: string[];
    aggregationWindow: number;
    deduplicationEnabled: boolean;
    priorityRouting: boolean;
  };
  
  // 集成配置
  integration: {
    webhookTimeout: number;
    retryAttempts: number;
    oauthEnabled: boolean;
    ipWhitelist: string[];
  };
}

// ==================== 新增默认值 ====================

export const ENTERPRISE_DEFAULTS: Partial<EnterpriseSystemConfig> = {
  kafka: {
    brokers: ['localhost:9092'],
    partitions: 3,
    replicas: 1,
    retentionHours: 168,
    compressionType: 'lz4',
    acks: 'all',
    maxBatchSizeBytes: 131072,
    lingerMs: 5,
  },
  
  rabbitMQ: {
    url: 'amqp://localhost:5672',
    vhost: '/',
    connectionTimeout: 10000,
    channelMax: 2048,
    frameMax: 131072,
    heartbeat: 60,
    deliveryLimit: 0,
  },
  
  rocketMQ: {
    namesrvAddr: 'localhost:9876',
    producerGroup: 'orion-producer',
    consumerGroup: 'orion-consumer',
    sendTimeout: 3000,
    compressMsgBodyOverHowmuch: 4096,
    maxMessageSize: 4194304,
  },
  
  mongodb: {
    uri: 'mongodb://localhost:27017',
    database: 'orion',
    poolSize: 10,
    socketTimeout: 30000,
    serverSelectionTimeout: 30000,
    maxIdleTimeMS: 60000,
    retryWrites: true,
    retryReads: true,
  },
  
  elasticsearch: {
    nodes: ['http://localhost:9200'],
    indexShards: 3,
    indexReplicas: 1,
    refreshInterval: '1s',
    maxResultWindow: 10000,
    requestTimeout: 30000,
    compressionEnabled: false,
  },
  
  minio: {
    endpoint: 'localhost:9000',
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    bucketName: 'orion',
    region: 'us-east-1',
    useSSL: false,
    partSize: 5242880,
    maxPoolSize: 10,
  },
  
  gateway: {
    port: 8080,
    timeout: 30000,
    maxConnections: 10000,
    cors: {
      enabled: true,
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      headers: ['Content-Type', 'Authorization'],
    },
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      maxRequests: 1000,
    },
    compression: {
      enabled: true,
      level: 6,
      threshold: 1024,
    },
  },
  
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    halfOpenRequests: 3,
    slidingWindowSize: 100,
    permittedNumberOfCallsInHalfOpenState: 3,
  },
  
  rateLimit: {
    enabled: true,
    defaultLimit: 1000,
    defaultWindow: '1m',
    strategy: 'token-bucket',
    redisPrefix: 'ratelimit:',
    ipWhitelist: [],
  },
  
  serviceDiscovery: {
    provider: 'consul',
    endpoint: 'http://localhost:8500',
    namespace: 'orion',
    healthCheckInterval: 10,
    deregisterAfter: 60,
    preferAgent: false,
  },
  
  kubernetes: {
    apiServer: 'https://kubernetes.local:6443',
    caCert: '',
    token: '',
    namespace: 'orion',
    defaultImagePullSecret: '',
    resourceQuotaEnabled: true,
    networkPolicyEnabled: true,
    podSecurityPolicyEnabled: false,
  },
  
  helm: {
    repoUrl: 'https://charts.helm.sh/stable',
    timeout: 300,
    maxHistory: 10,
    atomic: true,
    wait: true,
  },
  
  containerRegistry: {
    url: 'registry.orion.local',
    authType: 'none',
    insecure: true,
    pullPolicy: 'Always',
  },
  
  logging: {
    level: 'info',
    format: 'json',
    output: ['stdout', 'file'],
    file: {
      enabled: true,
      path: '/var/log/orion',
      maxSize: '100M',
      maxFiles: 10,
    },
    stdout: {
      enabled: true,
      colorize: false,
    },
  },
  
  trace: {
    enabled: true,
    sampler: 'probabilistic',
    samplerParam: 0.1,
    endpoint: 'http://localhost:14268/api/traces',
    serviceName: 'orion',
    maxTagValueLength: 256,
    sampleElasticPercentage: 1,
  },
  
  logRetention: {
    days: 90,
    compressionEnabled: true,
    archiveEnabled: true,
    archivePath: '/var/log/orion/archive',
    deletionEnabled: true,
  },
  
  aiops: {
    enabled: false,
    models: [],
    threshold: 0.8,
    autoActionEnabled: false,
    trainingIntervalHours: 24,
    predictionWindowHours: 24,
    anomalyScoreThreshold: 0.7,
  },
  
  anomalyDetection: {
    enabled: true,
    sensitivity: 3,
    windowMinutes: 60,
    baselineWindowDays: 7,
    deviationThreshold: 2.5,
    alertOnDetection: true,
    autoAckEnabled: false,
  },
  
  soc2: {
    enabled: false,
    controlsEnabled: [],
    auditIntervalDays: 365,
    evidenceRetentionDays: 2555,
    automatedTesting: true,
  },
  
  iso27001: {
    enabled: false,
    controlsEnabled: [],
    riskAssessmentInterval: 90,
    statementOfApplicability: [],
  },
  
  dataGovernance: {
    classificationEnabled: true,
    retentionPolicy: {
      defaultDays: 365,
      encryptionRequired: false,
    },
    dataLineageEnabled: true,
    piiDetectionEnabled: true,
    maskOnExport: true,
  },
  
  billing: {
    enabled: false,
    currency: 'CNY',
    pricingModel: 'usage',
    billingCycle: 'monthly',
    invoiceDelivery: ['email'],
    taxRate: 0.06,
    creditLimit: 100000,
  },
  
  usageTracking: {
    enabled: true,
    interval: 3600,
    aggregation: 'hourly',
    metrics: ['cpu', 'memory', 'storage', 'network', 'api_calls'],
    retentionDays: 730,
    exportEnabled: false,
  },
  
  quotaManagement: {
    enabled: true,
    enforcementMode: 'soft',
    notifications: {
      enabled: true,
      thresholds: [80, 90, 100],
      channels: ['email', 'dingtalk'],
    },
    gracePeriodHours: 24,
  },
  
  serviceMesh: {
    enabled: false,
    provider: 'istio',
    controlPlane: 'istio-system',
    mtlsEnabled: true,
    tracingEnabled: true,
    egressEnabled: true,
  },
  
  workflow: {
    engine: 'temporal',
    timeout: 3600,
    maxConcurrent: 100,
    retryPolicy: {
      maxAttempts: 3,
      backoff: 'exponential',
    },
    historyRetention: 30,
  },
  
  knowledge: {
    enabled: false,
    provider: 'elasticsearch',
    indexType: '_vector',
    embeddingModel: 'text-embedding-ada-002',
    similarityThreshold: 0.8,
    maxResults: 10,
  },
  
  reporting: {
    enabled: true,
    formats: ['pdf', 'excel'],
    schedule: '0 8 * * 1',
    retentionDays: 365,
    recipients: [],
  },
  
  notificationOrchestration: {
    enabled: true,
    channels: ['dingtalk', 'email', 'sms'],
    aggregationWindow: 300,
    deduplicationEnabled: true,
    priorityRouting: true,
  },
  
  integration: {
    webhookTimeout: 30000,
    retryAttempts: 3,
    oauthEnabled: false,
    ipWhitelist: [],
  },
};

export default ENTERPRISE_DEFAULTS;