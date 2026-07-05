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
    // Platform service (main backend)
    platform: {
      url: process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001',
      timeout: parseInt(process.env.PLATFORM_TIMEOUT || '30000', 10),
    },
    // Pipeline service
    pipeline: {
      url: process.env.PIPELINE_SERVICE_URL || 'http://localhost:3002',
      timeout: parseInt(process.env.PIPELINE_TIMEOUT || '60000', 10),
    },
    // Deploy service
    deploy: {
      url: process.env.DEPLOY_SERVICE_URL || 'http://localhost:3003',
      timeout: parseInt(process.env.DEPLOY_TIMEOUT || '60000', 10),
    },
    // Ticket service
    ticket: {
      url: process.env.TICKET_SERVICE_URL || 'http://localhost:3004',
      timeout: parseInt(process.env.TICKET_TIMEOUT || '30000', 10),
    },
    // Monitor service
    monitor: {
      url: process.env.MONITOR_SERVICE_URL || 'http://localhost:3005',
      timeout: parseInt(process.env.MONITOR_TIMEOUT || '30000', 10),
    },
    // Intelligence service
    intelligence: {
      url: process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:3006',
      timeout: parseInt(process.env.INTELLIGENCE_TIMEOUT || '60000', 10),
    },
    // Agent service
    agent: {
      url: process.env.AGENT_SERVICE_URL || 'http://localhost:3007',
      timeout: parseInt(process.env.AGENT_TIMEOUT || '60000', 10),
    },
    // Digital Twin service
    'digital-twin': {
      url: process.env.DIGITAL_TWIN_SERVICE_URL || 'http://localhost:3008',
      timeout: parseInt(process.env.DIGITAL_TWIN_TIMEOUT || '30000', 10),
    },
    // FinOps service
    finops: {
      url: process.env.FINOPS_SERVICE_URL || 'http://localhost:3009',
      timeout: parseInt(process.env.FINOPS_TIMEOUT || '30000', 10),
    },
    // Code service
    code: {
      url: process.env.CODE_SERVICE_URL || 'http://localhost:3010',
      timeout: parseInt(process.env.CODE_TIMEOUT || '60000', 10),
    },
    // Plugin service
    plugin: {
      url: process.env.PLUGIN_SERVICE_URL || 'http://localhost:3011',
      timeout: parseInt(process.env.PLUGIN_TIMEOUT || '30000', 10),
    },
    // AI service
    ai: {
      url: process.env.AI_SERVICE_URL || 'http://localhost:3012',
      timeout: parseInt(process.env.AI_TIMEOUT || '60000', 10),
    },
    // Security service
    security: {
      url: process.env.SECURITY_SERVICE_URL || 'http://localhost:3013',
      timeout: parseInt(process.env.SECURITY_TIMEOUT || '30000', 10),
    },
    // Artifact service
    artifact: {
      url: process.env.ARTIFACT_SERVICE_URL || 'http://localhost:3014',
      timeout: parseInt(process.env.ARTIFACT_TIMEOUT || '30000', 10),
    },
    // Efficiency service
    efficiency: {
      url: process.env.EFFICIENCY_SERVICE_URL || 'http://localhost:3015',
      timeout: parseInt(process.env.EFFICIENCY_TIMEOUT || '30000', 10),
    },
    // DR service
    dr: {
      url: process.env.DR_SERVICE_URL || 'http://localhost:3016',
      timeout: parseInt(process.env.DR_TIMEOUT || '30000', 10),
    },
    // Federation service
    federation: {
      url: process.env.FEDERATION_SERVICE_URL || 'http://localhost:3017',
      timeout: parseInt(process.env.FEDERATION_TIMEOUT || '30000', 10),
    },
    // Approval service
    approval: {
      url: process.env.APPROVAL_SERVICE_URL || 'http://localhost:3018',
      timeout: parseInt(process.env.APPROVAL_TIMEOUT || '30000', 10),
    },
    // Notify service
    notify: {
      url: process.env.NOTIFY_SERVICE_URL || 'http://localhost:3019',
      timeout: parseInt(process.env.NOTIFY_TIMEOUT || '30000', 10),
    },
    // Knowledge service — PandaWiki Go 后端
    knowledge: {
      url: process.env.KNOWLEDGE_SERVICE_URL || 'http://localhost:8090',
      timeout: parseInt(process.env.KNOWLEDGE_TIMEOUT || '30000', 10),
    },
    // Graph service
    graph: {
      url: process.env.GRAPH_SERVICE_URL || 'http://localhost:3021',
      timeout: parseInt(process.env.GRAPH_TIMEOUT || '30000', 10),
    },
    // Governance service
    governance: {
      url: process.env.GOVERNANCE_SERVICE_URL || 'http://localhost:3022',
      timeout: parseInt(process.env.GOVERNANCE_TIMEOUT || '30000', 10),
    },
    // Skill service
    skill: {
      url: process.env.SKILL_SERVICE_URL || 'http://localhost:3023',
      timeout: parseInt(process.env.SKILL_TIMEOUT || '30000', 10),
    },
    // Self-healing service
    selfhealing: {
      url: process.env.SELFHEALING_SERVICE_URL || 'http://localhost:3024',
      timeout: parseInt(process.env.SELFHEALING_TIMEOUT || '30000', 10),
    },
    // Risk service
    risk: {
      url: process.env.RISK_SERVICE_URL || 'http://localhost:3025',
      timeout: parseInt(process.env.RISK_TIMEOUT || '30000', 10),
    },
    // Audit service
    audit: {
      url: process.env.AUDIT_SERVICE_URL || 'http://localhost:3026',
      timeout: parseInt(process.env.AUDIT_TIMEOUT || '30000', 10),
    },
    // ChatOps service
    chatops: {
      url: process.env.CHATOPS_SERVICE_URL || 'http://localhost:3027',
      timeout: parseInt(process.env.CHATOPS_TIMEOUT || '30000', 10),
    },
    // Runner service
    runner: {
      url: process.env.RUNNER_SERVICE_URL || 'http://localhost:3028',
      timeout: parseInt(process.env.RUNNER_TIMEOUT || '30000', 10),
    },
    // Config Management service
    'config-mgmt': {
      url: process.env.CONFIG_MGMT_SERVICE_URL || 'http://localhost:3029',
      timeout: parseInt(process.env.CONFIG_MGMT_TIMEOUT || '30000', 10),
    },
    // CMDB service
    cmdb: {
      url: process.env.CMDB_SERVICE_URL || 'http://localhost:3030',
      timeout: parseInt(process.env.CMDB_TIMEOUT || '30000', 10),
    },
    // Inception service
    inception: {
      url: process.env.INCEPTION_SERVICE_URL || 'http://localhost:3031',
      timeout: parseInt(process.env.INCEPTION_TIMEOUT || '30000', 10),
    },
    // DBA service
    dba: {
      url: process.env.DBA_SERVICE_URL || 'http://localhost:3032',
      timeout: parseInt(process.env.DBA_TIMEOUT || '30000', 10),
    },
    // Community service
    community: {
      url: process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3033',
      timeout: parseInt(process.env.COMMUNITY_TIMEOUT || '30000', 10),
    },
    // Visor service
    visor: {
      url: process.env.VISOR_SERVICE_URL || 'http://localhost:3034',
      timeout: parseInt(process.env.VISOR_TIMEOUT || '30000', 10),
    },
    // Canary service
    canary: {
      url: process.env.CANARY_SERVICE_URL || 'http://localhost:8086',
      timeout: parseInt(process.env.CANARY_TIMEOUT || '60000', 10),
    },
    // Compliance service
    compliance: {
      url: process.env.COMPLIANCE_SERVICE_URL || 'http://localhost:8087',
      timeout: parseInt(process.env.COMPLIANCE_TIMEOUT || '30000', 10),
    },
    // Report Designer service
    'report-designer': {
      url: process.env.REPORT_DESIGNER_SERVICE_URL || 'http://localhost:8088',
      timeout: parseInt(process.env.REPORT_DESIGNER_TIMEOUT || '30000', 10),
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
      // Platform service (main backend)
      platform: {
        url: process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001',
        timeout: parseInt(process.env.PLATFORM_TIMEOUT || '30000', 10),
      },
      // Pipeline service
      pipeline: {
        url: process.env.PIPELINE_SERVICE_URL || 'http://localhost:3002',
        timeout: parseInt(process.env.PIPELINE_TIMEOUT || '60000', 10),
      },
      // Deploy service
      deploy: {
        url: process.env.DEPLOY_SERVICE_URL || 'http://localhost:3003',
        timeout: parseInt(process.env.DEPLOY_TIMEOUT || '60000', 10),
      },
      // Ticket service
      ticket: {
        url: process.env.TICKET_SERVICE_URL || 'http://localhost:3004',
        timeout: parseInt(process.env.TICKET_TIMEOUT || '30000', 10),
      },
      // Monitor service
      monitor: {
        url: process.env.MONITOR_SERVICE_URL || 'http://localhost:3005',
        timeout: parseInt(process.env.MONITOR_TIMEOUT || '30000', 10),
      },
      // Intelligence service
      intelligence: {
        url: process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:3006',
        timeout: parseInt(process.env.INTELLIGENCE_TIMEOUT || '60000', 10),
      },
      // Agent service
      agent: {
        url: process.env.AGENT_SERVICE_URL || 'http://localhost:3007',
        timeout: parseInt(process.env.AGENT_TIMEOUT || '60000', 10),
      },
      // Digital Twin service
      'digital-twin': {
        url: process.env.DIGITAL_TWIN_SERVICE_URL || 'http://localhost:3008',
        timeout: parseInt(process.env.DIGITAL_TWIN_TIMEOUT || '30000', 10),
      },
      // FinOps service
      finops: {
        url: process.env.FINOPS_SERVICE_URL || 'http://localhost:3009',
        timeout: parseInt(process.env.FINOPS_TIMEOUT || '30000', 10),
      },
      // Code service
      code: {
        url: process.env.CODE_SERVICE_URL || 'http://localhost:3010',
        timeout: parseInt(process.env.CODE_TIMEOUT || '60000', 10),
      },
      // Plugin service
      plugin: {
        url: process.env.PLUGIN_SERVICE_URL || 'http://localhost:3011',
        timeout: parseInt(process.env.PLUGIN_TIMEOUT || '30000', 10),
      },
      // AI service
      ai: {
        url: process.env.AI_SERVICE_URL || 'http://localhost:3012',
        timeout: parseInt(process.env.AI_TIMEOUT || '60000', 10),
      },
      // Security service
      security: {
        url: process.env.SECURITY_SERVICE_URL || 'http://localhost:3013',
        timeout: parseInt(process.env.SECURITY_TIMEOUT || '30000', 10),
      },
      // Artifact service
      artifact: {
        url: process.env.ARTIFACT_SERVICE_URL || 'http://localhost:3014',
        timeout: parseInt(process.env.ARTIFACT_TIMEOUT || '30000', 10),
      },
      // Efficiency service
      efficiency: {
        url: process.env.EFFICIENCY_SERVICE_URL || 'http://localhost:3015',
        timeout: parseInt(process.env.EFFICIENCY_TIMEOUT || '30000', 10),
      },
      // DR service
      dr: {
        url: process.env.DR_SERVICE_URL || 'http://localhost:3016',
        timeout: parseInt(process.env.DR_TIMEOUT || '30000', 10),
      },
      // Federation service
      federation: {
        url: process.env.FEDERATION_SERVICE_URL || 'http://localhost:3017',
        timeout: parseInt(process.env.FEDERATION_TIMEOUT || '30000', 10),
      },
      // Approval service
      approval: {
        url: process.env.APPROVAL_SERVICE_URL || 'http://localhost:3018',
        timeout: parseInt(process.env.APPROVAL_TIMEOUT || '30000', 10),
      },
      // Notify service
      notify: {
        url: process.env.NOTIFY_SERVICE_URL || 'http://localhost:3019',
        timeout: parseInt(process.env.NOTIFY_TIMEOUT || '30000', 10),
      },
      // Knowledge service — PandaWiki Go 后端
      knowledge: {
        url: process.env.KNOWLEDGE_SERVICE_URL || 'http://localhost:8090',
        timeout: parseInt(process.env.KNOWLEDGE_TIMEOUT || '30000', 10),
      },
      // Graph service
      graph: {
        url: process.env.GRAPH_SERVICE_URL || 'http://localhost:3021',
        timeout: parseInt(process.env.GRAPH_TIMEOUT || '30000', 10),
      },
      // Governance service
      governance: {
        url: process.env.GOVERNANCE_SERVICE_URL || 'http://localhost:3022',
        timeout: parseInt(process.env.GOVERNANCE_TIMEOUT || '30000', 10),
      },
      // Skill service
      skill: {
        url: process.env.SKILL_SERVICE_URL || 'http://localhost:3023',
        timeout: parseInt(process.env.SKILL_TIMEOUT || '30000', 10),
      },
      // Self-healing service
      selfhealing: {
        url: process.env.SELFHEALING_SERVICE_URL || 'http://localhost:3024',
        timeout: parseInt(process.env.SELFHEALING_TIMEOUT || '30000', 10),
      },
      // Risk service
      risk: {
        url: process.env.RISK_SERVICE_URL || 'http://localhost:3025',
        timeout: parseInt(process.env.RISK_TIMEOUT || '30000', 10),
      },
      // Audit service
      audit: {
        url: process.env.AUDIT_SERVICE_URL || 'http://localhost:3026',
        timeout: parseInt(process.env.AUDIT_TIMEOUT || '30000', 10),
      },
      // ChatOps service
      chatops: {
        url: process.env.CHATOPS_SERVICE_URL || 'http://localhost:3027',
        timeout: parseInt(process.env.CHATOPS_TIMEOUT || '30000', 10),
      },
      // Runner service
      runner: {
        url: process.env.RUNNER_SERVICE_URL || 'http://localhost:3028',
        timeout: parseInt(process.env.RUNNER_TIMEOUT || '30000', 10),
      },
      // Config Management service
      'config-mgmt': {
        url: process.env.CONFIG_MGMT_SERVICE_URL || 'http://localhost:3029',
        timeout: parseInt(process.env.CONFIG_MGMT_TIMEOUT || '30000', 10),
      },
      // CMDB service
      cmdb: {
        url: process.env.CMDB_SERVICE_URL || 'http://localhost:3030',
        timeout: parseInt(process.env.CMDB_TIMEOUT || '30000', 10),
      },
      // Inception service
      inception: {
        url: process.env.INCEPTION_SERVICE_URL || 'http://localhost:3031',
        timeout: parseInt(process.env.INCEPTION_TIMEOUT || '30000', 10),
      },
      // DBA service
      dba: {
        url: process.env.DBA_SERVICE_URL || 'http://localhost:3032',
        timeout: parseInt(process.env.DBA_TIMEOUT || '30000', 10),
      },
      // Community service
      community: {
        url: process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3033',
        timeout: parseInt(process.env.COMMUNITY_TIMEOUT || '30000', 10),
      },
      // Visor service
      visor: {
        url: process.env.VISOR_SERVICE_URL || 'http://localhost:3034',
        timeout: parseInt(process.env.VISOR_TIMEOUT || '30000', 10),
      },
      // Canary service
      canary: {
        url: process.env.CANARY_SERVICE_URL || 'http://localhost:8086',
        timeout: parseInt(process.env.CANARY_TIMEOUT || '60000', 10),
      },
      // Compliance service
      compliance: {
        url: process.env.COMPLIANCE_SERVICE_URL || 'http://localhost:8087',
        timeout: parseInt(process.env.COMPLIANCE_TIMEOUT || '30000', 10),
      },
      // Report Designer service
      'report-designer': {
        url: process.env.REPORT_DESIGNER_SERVICE_URL || 'http://localhost:8088',
        timeout: parseInt(process.env.REPORT_DESIGNER_TIMEOUT || '30000', 10),
      },
    },
  };
  return currentConfig;
}

export function updateConfig(partial: Partial<AppConfig>): void {
  currentConfig = { ...currentConfig, ...partial };
}
