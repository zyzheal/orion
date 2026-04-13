/**
 * Mock Data for Plugin Management Pages
 * - Plugins with various statuses, categories, and health
 * - Plugin configurations and permissions
 */

// ============================================================================
// Plugin Mock Data
// ============================================================================

export interface MockPlugin {
  id: string;
  name: string;
  version: string;
  latestVersion?: string;
  description: string;
  category: 'core' | 'extension' | 'security' | 'monitoring';
  status: 'enabled' | 'disabled';
  author: string;
  installedAt: string;
  permissions: string[];
  config: Record<string, string>;
  healthStatus: 'healthy' | 'warning' | 'error';
}

export const mockPlugins: MockPlugin[] = [
  {
    id: 'plugin-001',
    name: '数据库迁移助手',
    version: '2.1.0',
    description: '自动化数据库迁移工具，支持多环境部署和回滚',
    category: 'core',
    status: 'enabled',
    author: '张伟',
    installedAt: '2026-01-15T10:00:00Z',
    permissions: ['db:read', 'db:write', 'db:migrate'],
    config: { maxConnections: '10', timeout: '30000', autoRetry: 'true' },
    healthStatus: 'healthy',
  },
  {
    id: 'plugin-002',
    name: '日志分析插件',
    version: '1.5.3',
    latestVersion: '1.6.0',
    description: '实时日志分析与异常检测，支持多种日志格式',
    category: 'monitoring',
    status: 'enabled',
    author: '李娜',
    installedAt: '2026-02-20T14:30:00Z',
    permissions: ['log:read', 'log:analyze', 'alert:create'],
    config: { batchSize: '500', analysisInterval: '60' },
    healthStatus: 'healthy',
  },
  {
    id: 'plugin-003',
    name: '安全审计',
    version: '3.0.0',
    description: '全面的安全审计与合规检查工具',
    category: 'security',
    status: 'enabled',
    author: '王强',
    installedAt: '2025-12-01T08:00:00Z',
    permissions: ['audit:read', 'audit:write', 'security:scan', 'report:generate'],
    config: { scanInterval: '3600', severity: 'high', reportFormat: 'pdf' },
    healthStatus: 'healthy',
  },
  {
    id: 'plugin-004',
    name: '性能监控',
    version: '2.3.1',
    latestVersion: '2.4.0',
    description: '全链路性能监控与瓶颈分析',
    category: 'monitoring',
    status: 'enabled',
    author: '赵敏',
    installedAt: '2026-03-10T16:00:00Z',
    permissions: ['metric:read', 'trace:read', 'alert:create'],
    config: { sampleRate: '0.1', retentionDays: '30', alertThreshold: '95' },
    healthStatus: 'warning',
  },
  {
    id: 'plugin-005',
    name: '代码质量检查',
    version: '1.2.0',
    description: '代码静态分析与质量门禁，集成 SonarQube',
    category: 'extension',
    status: 'disabled',
    author: '陈浩',
    installedAt: '2026-01-05T09:00:00Z',
    permissions: ['code:read', 'report:generate'],
    config: { qualityGate: 'A', excludePattern: '**/test/**' },
    healthStatus: 'healthy',
  },
  {
    id: 'plugin-006',
    name: '自动化部署',
    version: '1.8.0',
    description: '蓝绿部署与金丝雀发布自动化工具',
    category: 'extension',
    status: 'enabled',
    author: '刘洋',
    installedAt: '2025-11-15T11:00:00Z',
    permissions: ['deploy:create', 'deploy:rollback', 'infra:read'],
    config: { strategy: 'canary', canaryPercent: '10', rollbackTimeout: '300' },
    healthStatus: 'healthy',
  },
  {
    id: 'plugin-007',
    name: '告警路由增强',
    version: '1.1.0',
    latestVersion: '1.2.0',
    description: '智能告警路由与去重降噪',
    category: 'core',
    status: 'disabled',
    author: '孙丽',
    installedAt: '2026-02-28T13:00:00Z',
    permissions: ['alert:read', 'alert:route', 'alert:silence'],
    config: { dedupWindow: '300', escalationTimeout: '900' },
    healthStatus: 'error',
  },
  {
    id: 'plugin-008',
    name: '数据备份恢复',
    version: '2.0.5',
    latestVersion: '2.1.0',
    description: '自动化数据备份与一键恢复，支持增量备份',
    category: 'core',
    status: 'enabled',
    author: '周磊',
    installedAt: '2025-10-20T07:00:00Z',
    permissions: ['backup:create', 'backup:restore', 'storage:write'],
    config: { schedule: '0 2 * * *', retentionDays: '90', compression: 'gzip' },
    healthStatus: 'healthy',
  },
];

// ============================================================================
// Category labels
// ============================================================================

export const categoryLabels: Record<string, string> = {
  core: '核心',
  extension: '扩展',
  security: '安全',
  monitoring: '监控',
};

// ============================================================================
// Health status labels
// ============================================================================

export const healthStatusLabels: Record<string, string> = {
  healthy: '正常',
  warning: '警告',
  error: '异常',
};
