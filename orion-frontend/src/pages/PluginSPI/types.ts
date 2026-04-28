/**
 * PluginSPI - Shared Types & Constants
 * Type definitions, label maps, color maps, and mock data
 */

// ============================================================================
// Types
// ============================================================================

export type SPIStatus = 'active' | 'inactive' | 'deprecated' | 'experimental';

export interface SPIExtensionPoint {
  id: string;
  name: string;
  description: string;
  spiType: string;
  registeredPlugins: number;
  status: SPIStatus;
  interfaceName: string;
  version: string;
  lastUpdated: string;
}

export interface PluginRegistration {
  id: string;
  pluginName: string;
  spiPoint: string;
  provider: string;
  priority: number;
  status: 'enabled' | 'disabled' | 'error';
  version: string;
  registeredAt: string;
}

export interface SPIConfig {
  id: string;
  spiType: string;
  enabled: boolean;
  maxPlugins: number;
  timeout: number;
  fallbackStrategy: string;
}

export interface SPIStats {
  totalExtensionPoints: number;
  activePoints: number;
  totalRegistrations: number;
  enabledPlugins: number;
}

// ============================================================================
// Label & Color Maps
// ============================================================================

export const statusColorMap: Record<SPIStatus, string> = {
  active: 'success',
  inactive: 'default',
  deprecated: 'error',
  experimental: 'warning',
};

export const statusLabelMap: Record<SPIStatus, string> = {
  active: '活跃',
  inactive: '未激活',
  deprecated: '已废弃',
  experimental: '实验性',
};

export const pluginStatusColorMap: Record<string, string> = {
  enabled: 'success',
  disabled: 'default',
  error: 'error',
};

export const pluginStatusLabelMap: Record<string, string> = {
  enabled: '已启用',
  disabled: '已禁用',
  error: '异常',
};

export const spiTypeLabelMap: Record<string, string> = {
  auth: '认证扩展',
  storage: '存储扩展',
  notification: '通知扩展',
  pipeline_stage: '流水线阶段',
  code_scanner: '代码扫描',
  deploy_strategy: '部署策略',
  metric_collector: '指标采集',
  event_handler: '事件处理',
  ai_model: 'AI 模型',
};

// ============================================================================
// Fallback Strategies
// ============================================================================

export const fallbackStrategies = [
  { label: '拒绝请求 (reject)', value: 'reject' },
  { label: '使用默认实现 (default)', value: 'default' },
  { label: '加入队列 (queue)', value: 'queue' },
  { label: '重试 (retry)', value: 'retry' },
  { label: '跳过 (skip)', value: 'skip' },
  { label: '回滚 (rollback)', value: 'rollback' },
  { label: '记录日志 (log)', value: 'log' },
  { label: '降级 (fallback)', value: 'fallback' },
];

// ============================================================================
// Mock Data
// ============================================================================

export const MOCK_STATS: SPIStats = {
  totalExtensionPoints: 12,
  activePoints: 8,
  totalRegistrations: 34,
  enabledPlugins: 28,
};

export const MOCK_EXTENSION_POINTS: SPIExtensionPoint[] = [
  {
    id: 'spi-001',
    name: 'AuthenticationProvider',
    description: '认证提供者扩展点，支持 OAuth2/LDAP/SAML 等认证方式',
    spiType: 'auth',
    registeredPlugins: 4,
    status: 'active',
    interfaceName: 'com.orion.spi.auth.AuthenticationProvider',
    version: '2.1.0',
    lastUpdated: '2026-04-20T10:00:00Z',
  },
  {
    id: 'spi-002',
    name: 'StorageBackend',
    description: '存储后端扩展点，支持本地存储、S3、OSS 等',
    spiType: 'storage',
    registeredPlugins: 3,
    status: 'active',
    interfaceName: 'com.orion.spi.storage.StorageBackend',
    version: '1.5.0',
    lastUpdated: '2026-04-18T14:00:00Z',
  },
  {
    id: 'spi-003',
    name: 'NotificationChannel',
    description: '通知渠道扩展点，支持邮件、Slack、钉钉、企业微信等',
    spiType: 'notification',
    registeredPlugins: 6,
    status: 'active',
    interfaceName: 'com.orion.spi.notification.NotificationChannel',
    version: '3.0.0',
    lastUpdated: '2026-04-25T08:00:00Z',
  },
  {
    id: 'spi-004',
    name: 'PipelineStageExecutor',
    description: '流水线阶段执行器扩展点',
    spiType: 'pipeline_stage',
    registeredPlugins: 8,
    status: 'active',
    interfaceName: 'com.orion.spi.pipeline.PipelineStageExecutor',
    version: '2.0.0',
    lastUpdated: '2026-04-22T16:00:00Z',
  },
  {
    id: 'spi-005',
    name: 'CodeScanner',
    description: '代码扫描器扩展点，支持 SonarQube、Checkmarx 等',
    spiType: 'code_scanner',
    registeredPlugins: 3,
    status: 'active',
    interfaceName: 'com.orion.spi.scanner.CodeScanner',
    version: '1.2.0',
    lastUpdated: '2026-04-15T12:00:00Z',
  },
  {
    id: 'spi-006',
    name: 'DeployStrategy',
    description: '部署策略扩展点，支持蓝绿、金丝雀、滚动等策略',
    spiType: 'deploy_strategy',
    registeredPlugins: 4,
    status: 'active',
    interfaceName: 'com.orion.spi.deploy.DeployStrategy',
    version: '1.8.0',
    lastUpdated: '2026-04-19T09:00:00Z',
  },
  {
    id: 'spi-007',
    name: 'MetricCollector',
    description: '指标采集器扩展点，支持 Prometheus、OpenTelemetry 等',
    spiType: 'metric_collector',
    registeredPlugins: 2,
    status: 'active',
    interfaceName: 'com.orion.spi.metrics.MetricCollector',
    version: '1.0.0',
    lastUpdated: '2026-04-10T11:00:00Z',
  },
  {
    id: 'spi-008',
    name: 'EventHandler',
    description: '事件处理器扩展点，支持自定义事件处理逻辑',
    spiType: 'event_handler',
    registeredPlugins: 2,
    status: 'inactive',
    interfaceName: 'com.orion.spi.events.EventHandler',
    version: '0.9.0',
    lastUpdated: '2026-03-28T15:00:00Z',
  },
  {
    id: 'spi-009',
    name: 'AIModelProvider',
    description: 'AI 模型提供者扩展点，支持 OpenAI、Claude、本地模型等',
    spiType: 'ai_model',
    registeredPlugins: 2,
    status: 'experimental',
    interfaceName: 'com.orion.spi.ai.AIModelProvider',
    version: '0.5.0-beta',
    lastUpdated: '2026-04-26T10:00:00Z',
  },
];

export const MOCK_PLUGIN_REGISTRATIONS: PluginRegistration[] = [
  {
    id: 'reg-001',
    pluginName: 'OAuth2AuthProvider',
    spiPoint: 'AuthenticationProvider',
    provider: 'org.orion.plugins',
    priority: 1,
    status: 'enabled',
    version: '1.2.0',
    registeredAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'reg-002',
    pluginName: 'LDAPAuthProvider',
    spiPoint: 'AuthenticationProvider',
    provider: 'org.orion.plugins',
    priority: 2,
    status: 'enabled',
    version: '1.1.0',
    registeredAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'reg-003',
    pluginName: 'S3StorageBackend',
    spiPoint: 'StorageBackend',
    provider: 'com.amazonaws.plugins',
    priority: 1,
    status: 'enabled',
    version: '2.0.0',
    registeredAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'reg-004',
    pluginName: 'AliyunOSSStorage',
    spiPoint: 'StorageBackend',
    provider: 'com.aliyun.plugins',
    priority: 2,
    status: 'enabled',
    version: '1.5.0',
    registeredAt: '2026-02-10T09:00:00Z',
  },
  {
    id: 'reg-005',
    pluginName: 'SlackNotifier',
    spiPoint: 'NotificationChannel',
    provider: 'com.slack.plugins',
    priority: 1,
    status: 'enabled',
    version: '3.1.0',
    registeredAt: '2026-02-15T14:00:00Z',
  },
  {
    id: 'reg-006',
    pluginName: 'DingTalkNotifier',
    spiPoint: 'NotificationChannel',
    provider: 'com.dingtalk.plugins',
    priority: 2,
    status: 'enabled',
    version: '2.0.0',
    registeredAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'reg-007',
    pluginName: 'WeComNotifier',
    spiPoint: 'NotificationChannel',
    provider: 'com.wecom.plugins',
    priority: 3,
    status: 'disabled',
    version: '1.0.0',
    registeredAt: '2026-03-15T16:00:00Z',
  },
  {
    id: 'reg-008',
    pluginName: 'SonarQubeScanner',
    spiPoint: 'CodeScanner',
    provider: 'org.sonar.plugins',
    priority: 1,
    status: 'enabled',
    version: '4.0.0',
    registeredAt: '2026-03-20T08:00:00Z',
  },
  {
    id: 'reg-009',
    pluginName: 'BlueGreenDeployer',
    spiPoint: 'DeployStrategy',
    provider: 'org.orion.plugins',
    priority: 1,
    status: 'enabled',
    version: '1.3.0',
    registeredAt: '2026-04-01T10:00:00Z',
  },
  {
    id: 'reg-010',
    pluginName: 'CanaryDeployer',
    spiPoint: 'DeployStrategy',
    provider: 'org.orion.plugins',
    priority: 2,
    status: 'error',
    version: '1.2.0',
    registeredAt: '2026-04-05T12:00:00Z',
  },
];

export const MOCK_SPI_CONFIGS: SPIConfig[] = [
  {
    id: 'cfg-001',
    spiType: 'auth',
    enabled: true,
    maxPlugins: 10,
    timeout: 5000,
    fallbackStrategy: 'reject',
  },
  {
    id: 'cfg-002',
    spiType: 'storage',
    enabled: true,
    maxPlugins: 5,
    timeout: 10000,
    fallbackStrategy: 'default',
  },
  {
    id: 'cfg-003',
    spiType: 'notification',
    enabled: true,
    maxPlugins: 20,
    timeout: 3000,
    fallbackStrategy: 'queue',
  },
  {
    id: 'cfg-004',
    spiType: 'pipeline_stage',
    enabled: true,
    maxPlugins: 50,
    timeout: 30000,
    fallbackStrategy: 'retry',
  },
  {
    id: 'cfg-005',
    spiType: 'code_scanner',
    enabled: true,
    maxPlugins: 5,
    timeout: 60000,
    fallbackStrategy: 'skip',
  },
  {
    id: 'cfg-006',
    spiType: 'deploy_strategy',
    enabled: true,
    maxPlugins: 10,
    timeout: 15000,
    fallbackStrategy: 'rollback',
  },
  {
    id: 'cfg-007',
    spiType: 'metric_collector',
    enabled: false,
    maxPlugins: 3,
    timeout: 5000,
    fallbackStrategy: 'default',
  },
  {
    id: 'cfg-008',
    spiType: 'event_handler',
    enabled: false,
    maxPlugins: 15,
    timeout: 5000,
    fallbackStrategy: 'log',
  },
  {
    id: 'cfg-009',
    spiType: 'ai_model',
    enabled: true,
    maxPlugins: 5,
    timeout: 30000,
    fallbackStrategy: 'fallback',
  },
];
