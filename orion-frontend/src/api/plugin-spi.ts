/**
 * Plugin SPI API Client
 *
 * Backend: orion-platform-service/src/services/plugin-spi/
 * 路由前缀: /api/plugins-spi
 *
 * 注意: 后端没有"扩展点"概念，只有插件管理
 * 前端页面需要适配为: 插件列表、能力分类、插件配置
 */

import { api } from './client';

// ==================== Types ====================

export interface SPIStats {
  totalPlugins: number;
  enabledPlugins: number;
  disabledPlugins: number;
  errorPlugins: number;
  activeExecutions: number;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  entryPoint: string;
  capabilities: string[];
  dependencies: { name: string; version: string }[];
  minPlatformVersion?: string;
  maxPlatformVersion?: string;
  securityLevel?: string;
  tags?: string[];
  icon?: string;
}

export interface PluginInfo {
  name: string;
  version: string;
  status: 'installed' | 'enabled' | 'disabled' | 'error' | 'uninstalling';
  manifest: PluginManifest;
  config?: Record<string, unknown>;
  enabledAt?: string;
  errorMessage?: string;
}

// 映射到前端展示类型
export interface SPIExtensionPoint {
  id: string;
  name: string;
  description: string;
  interface: string;
  enabled: boolean;
  registrationCount: number;
  createdAt: string;
}

export interface PluginRegistration {
  id: string;
  pluginName: string;
  extensionPointId: string;
  extensionPointName: string;
  version: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  createdAt: string;
  capabilities?: string[];
  status: string;
}

export interface SPIConfig {
  id: string;
  key: string;
  value: string;
  description: string;
  category: string;
  encrypted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PluginExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

// ==================== API Functions ====================

/**
 * 获取 SPI 统计信息
 * GET /api/plugins-spi/stats
 */
export async function getSPIStats() {
  const res = await api.get<SPIStats>('/api/plugins-spi/stats');
  return res.data;
}

/**
 * 获取插件列表（按能力分组）
 * GET /api/plugins-spi/plugins
 */
export async function getExtensionPoints() {
  const res = await api.get<PluginInfo[]>('/api/plugins-spi/plugins');

  // 适配前端: 将插件列表转为扩展点格式 (按 capability 分组)
  const capabilityMap = new Map<string, number>();

  res.data.forEach(p => {
    (p.manifest.capabilities || []).forEach(cap => {
      capabilityMap.set(cap, (capabilityMap.get(cap) || 0) + 1);
    });
  });

  const extensionPoints: SPIExtensionPoint[] = Array.from(capabilityMap.entries()).map(([cap, count]) => ({
    id: cap,
    name: cap.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
    description: `提供 ${cap} 能力的插件`,
    interface: cap,
    enabled: true,
    registrationCount: count,
    createdAt: new Date().toISOString(),
  }));

  // 如果没有插件，返回默认扩展点
  if (extensionPoints.length === 0) {
    extensionPoints.push(
      { id: 'CUSTOM_TASK', name: '自定义任务', description: '扩展 Pipeline 自定义任务类型', interface: 'CUSTOM_TASK', enabled: true, registrationCount: 0, createdAt: '' },
      { id: 'WEBHOOK_HANDLER', name: 'Webhook 处理器', description: '处理外部 Webhook 事件', interface: 'WEBHOOK_HANDLER', enabled: true, registrationCount: 0, createdAt: '' },
      { id: 'AI_SKILL', name: 'AI 技能', description: 'AI 能力扩展', interface: 'AI_SKILL', enabled: true, registrationCount: 0, createdAt: '' },
      { id: 'NOTIFICATION_CHANNEL', name: '通知渠道', description: '扩展通知发送渠道', interface: 'NOTIFICATION_CHANNEL', enabled: true, registrationCount: 0, createdAt: '' },
    );
  }

  return extensionPoints;
}

/**
 * 获取插件注册列表 (实际就是插件列表)
 * GET /api/plugins-spi/plugins
 */
export async function getPluginRegistrations() {
  const res = await api.get<PluginInfo[]>('/api/plugins-spi/plugins');

  const registrations: PluginRegistration[] = res.data.map((p) => ({
    id: p.name,
    pluginName: p.manifest.name || p.name,
    extensionPointId: (p.manifest.capabilities || [''])[0],
    extensionPointName: (p.manifest.capabilities || ['Unknown'])[0].replace(/_/g, ' '),
    version: p.manifest.version || p.version,
    enabled: p.status === 'enabled',
    config: p.config,
    createdAt: p.enabledAt || new Date().toISOString(),
    capabilities: p.manifest.capabilities || [],
    status: p.status,
  }));

  return registrations;
}

/**
 * 获取 SPI 配置 (暂无对应接口，返回空)
 */
export async function getSPIConfigs() {
  // 后端暂无此接口，返回空配置
  return [];
}

/**
 * 创建扩展点 (后端不支持，返回空实现)
 */
export async function createExtensionPoint(
  input: Omit<SPIExtensionPoint, 'id' | 'registrationCount' | 'createdAt'>
) {
  // 后端不支持，返回空
  return input;
}

/**
 * 删除扩展点 (后端不支持)
 */
export async function deleteExtensionPoint(_id: string) {
  // 后端不支持，返回成功
  return { success: true };
}

/**
 * 切换扩展点状态 (后端不支持)
 */
export async function toggleExtensionPoint(id: string, enabled: boolean) {
  // 后端不支持，返回空
  return { id, enabled };
}

/**
 * 注册插件 - 通过 manifest 注册
 */
export async function createRegistration(input: Omit<PluginRegistration, 'id' | 'createdAt'>) {
  const manifest: PluginManifest = {
    name: input.pluginName,
    version: input.version || '1.0.0',
    description: input.extensionPointName,
    author: 'user',
    entryPoint: input.pluginName,
    capabilities: [input.extensionPointName],
    dependencies: [],
  };
  const res = await api.post<PluginInfo>('/api/plugins-spi/plugins', { manifest, config: input.config });
  return res.data;
}

/**
 * 删除注册 (卸载插件)
 */
export async function deleteRegistration(id: string) {
  await api.delete(`/api/plugins-spi/plugins/${id}`);
}

/**
 * 获取插件详情
 */
export async function getPluginDetails(pluginName: string) {
  const res = await api.get<PluginInfo>(`/api/plugins-spi/plugins/${pluginName}`);
  return res.data;
}

/**
 * 更新插件配置
 */
export async function updatePluginConfig(pluginName: string, config: Record<string, unknown>) {
  const res = await api.put<PluginInfo>(`/api/plugins-spi/plugins/${pluginName}/config`, { config });
  return res.data;
}

/**
 * 启用插件
 */
export async function enablePlugin(pluginName: string) {
  const res = await api.post<PluginInfo>(`/api/plugins-spi/plugins/${pluginName}/enable`);
  return res.data;
}

/**
 * 禁用插件
 */
export async function disablePlugin(pluginName: string) {
  const res = await api.post<PluginInfo>(`/api/plugins-spi/plugins/${pluginName}/disable`);
  return res.data;
}

/**
 * 卸载插件
 */
export async function uninstallPlugin(pluginName: string) {
  const res = await api.post<PluginInfo>(`/api/plugins-spi/plugins/${pluginName}/uninstall`);
  return res.data;
}

/**
 * 获取插件健康状态
 */
export async function getPluginHealth(pluginName: string) {
  const res = await api.get<{ status: 'healthy' | 'unhealthy'; message?: string }>(`/api/plugins-spi/plugins/${pluginName}/health`);
  return res.data;
}

/**
 * 执行插件
 */
export async function executePlugin(pluginName: string, input?: Record<string, unknown>, timeout?: number) {
  const res = await api.post<PluginExecutionResult>(`/api/plugins-spi/plugins/${pluginName}/execute`, { input, timeout });
  return res.data;
}

/**
 * 发现插件 (扫描插件目录)
 */
export async function discoverPlugins() {
  const res = await api.post<{ found: number; plugins: PluginInfo[] }>('/api/plugins-spi/discover');
  return res.data;
}
