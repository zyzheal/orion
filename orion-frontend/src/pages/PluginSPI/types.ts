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
