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
  status:
    | 'PENDING'
    | 'RUNNING'
    | 'SUCCESS'
    | 'FAILED'
    | 'TIMEOUT'
    | 'CANCELLED'
    | 'QUOTA_EXCEEDED'
    | 'VALIDATION_FAILED';
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
export async function getAvailablePlugins(params?: { type?: PluginType; tags?: string }) {
  const res = await api.get('/v1/plugins/available', { params });
  const body = res.data as { success: boolean; data: Plugin[] };
  return { data: { data: body.data || [] } };
}

/**
 * 列出已安装插件
 */
export async function getInstalledPlugins(params?: { type?: PluginType; state?: PluginState }) {
  const res = await api.get('/v1/plugins/installed', { params });
  const body = res.data as { success: boolean; data: Plugin[] };
  return { data: { data: body.data || [] } };
}

/**
 * 获取插件详情
 */
export async function getPlugin(pluginId: string) {
  const res = await api.get(`/v1/plugins/${pluginId}`);
  const body = res.data as { success: boolean; data: Plugin };
  return { data: { data: body.data } };
}

/**
 * 安装插件
 */
export async function installPlugin(pluginId: string, data: InstallPluginInput) {
  const res = await api.post(`/v1/plugins/${pluginId}/install`, data);
  const body = res.data as { success: boolean; data: Plugin };
  return { data: { data: body.data } };
}

/**
 * 卸载插件
 */
export async function uninstallPlugin(pluginId: string) {
  const res = await api.post(`/v1/plugins/${pluginId}/uninstall`);
  return { data: { data: res.data } };
}

/**
 * 激活插件 (启用)
 */
export async function activatePlugin(pluginId: string) {
  const res = await api.post(`/v1/plugins/${pluginId}/activate`);
  const body = res.data as { success: boolean; data: Plugin };
  return { data: { data: body.data } };
}

/**
 * 停用插件 (禁用)
 */
export async function deactivatePlugin(pluginId: string) {
  const res = await api.post(`/v1/plugins/${pluginId}/deactivate`);
  const body = res.data as { success: boolean; data: Plugin };
  return { data: { data: body.data } };
}

/**
 * 配置插件
 */
export async function configurePlugin(pluginId: string, data: ConfigurePluginInput) {
  const res = await api.post(`/v1/plugins/${pluginId}/configure`, data);
  const body = res.data as { success: boolean; data: Plugin };
  return { data: { data: body.data } };
}

/**
 * 执行插件任务
 */
export async function executePlugin(pluginId: string, data: ExecutePluginInput) {
  const res = await api.post(`/v1/plugins/${pluginId}/execute`, data);
  const body = res.data as { success: boolean; data: PluginExecutionResult };
  return { data: { data: body.data } };
}
