/**
 * Plugin API Service
 * Plugin management, installation, activation, and execution
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export type PluginType =
  | 'CUSTOM_TASK'
  | 'WEBHOOK_HANDLER'
  | 'AI_SKILL'
  | 'APPROVAL_PROVIDER'
  | 'NOTIFICATION_CHANNEL'
  | 'DEPLOYMENT_STRATEGY';

export type PluginState =
  | 'AVAILABLE'
  | 'DOWNLOADED'
  | 'INSTALLED'
  | 'ACTIVE'
  | 'CONFIGURED'
  | 'INACTIVE'
  | 'UNINSTALLED';

export type SecurityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type PluginCategory = 'core' | 'extension' | 'security' | 'monitoring';

export type PluginHealthStatus = 'healthy' | 'warning' | 'error';

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  latestVersion?: string;
  description: string;
  author: string;
  tags: string[];
  type: PluginType;
  category?: PluginCategory;
  securityLevel: SecurityLevel;
  state: PluginState;
  status?: 'enabled' | 'disabled';
  configSchema: Record<string, PluginConfigField>;
  config?: Record<string, any>;
  installedAt?: string;
  updatedAt?: string;
  permissions?: string[];
  healthStatus?: PluginHealthStatus;
  runtimeInfo?: PluginRuntimeInfo;
}

export interface PluginRuntimeInfo {
  processId?: string;
  containerId?: string;
  resourceUsage?: ResourceUsage;
  healthChecks?: HealthCheckStatus[];
}

export interface ResourceUsage {
  cpuPercent: number;
  memoryBytes: number;
  diskBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

export interface HealthCheckStatus {
  checkName: string;
  healthy: boolean;
  message?: string;
  lastCheckedAt: string;
}

export interface PluginListParams {
  typeFilter?: PluginType;
  stateFilter?: PluginState;
  tagsFilter?: string[];
  page?: number;
  pageSize?: number;
}

export interface InstallPluginInput {
  version?: string;
  config?: Record<string, any>;
}

export interface ConfigurePluginInput {
  config: Record<string, any>;
}

export interface ExecutePluginInput {
  taskId: string;
  pipelineRunId?: string;
  stageId?: string;
  config?: Record<string, any>;
  workspace?: {
    rootPath: string;
    files?: Record<string, string>;
  };
  env?: Record<string, string>;
  timeout?: number;
}

export interface PluginExecutionResult {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'CANCELLED' | 'QUOTA_EXCEEDED' | 'VALIDATION_FAILED';
  exitCode: number;
  stdout?: string;
  stderr?: string;
  durationMs: number;
  outputs?: Record<string, string>;
  errorMessage?: string;
  killed?: boolean;
  killReason?: string;
}

// ============================================================================
// Plugin Management APIs
// ============================================================================

/**
 * 列出可用插件
 */
export function getAvailablePlugins(params?: { type?: PluginType; tags?: string }) {
  return api.get<Plugin[]>('/v1/plugins/available', { params });
}

/**
 * 列出已安装插件
 */
export function getInstalledPlugins(params?: { type?: PluginType; state?: PluginState }) {
  return api.get<Plugin[]>('/v1/plugins/installed', { params });
}

/**
 * 获取插件详情
 */
export function getPlugin(pluginId: string) {
  return api.get<Plugin>(`/v1/plugins/${pluginId}`);
}

/**
 * 安装插件
 */
export function installPlugin(pluginId: string, data: InstallPluginInput) {
  return api.post<Plugin>(`/v1/plugins/${pluginId}/install`, data);
}

/**
 * 卸载插件
 */
export function uninstallPlugin(pluginId: string) {
  return api.post<Plugin>(`/v1/plugins/${pluginId}/uninstall`);
}

/**
 * 激活插件 (启用)
 */
export function activatePlugin(pluginId: string) {
  return api.post<Plugin>(`/v1/plugins/${pluginId}/activate`);
}

/**
 * 停用插件 (禁用)
 */
export function deactivatePlugin(pluginId: string) {
  return api.post<Plugin>(`/v1/plugins/${pluginId}/deactivate`);
}

/**
 * 配置插件
 */
export function configurePlugin(pluginId: string, data: ConfigurePluginInput) {
  return api.post<Plugin>(`/v1/plugins/${pluginId}/configure`, data);
}

/**
 * 执行插件任务
 */
export function executePlugin(pluginId: string, data: ExecutePluginInput) {
  return api.post<PluginExecutionResult>(`/v1/plugins/${pluginId}/execute`, data);
}
