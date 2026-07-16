/**
 * Config 事件类型定义
 *
 * 符合 CloudEvents 1.0 规范
 * @see https://cloudevents.io/
 */

/**
 * Config 事件类型
 */
export type ConfigEventType =
  | 'config.drift.detected'
  | 'config.drift.resolved'
  | 'config.change.applied'
  | 'config.change.rejected';

/**
 * 漂移类型
 */
export type DriftType = 'added' | 'removed' | 'modified' | 'unknown';

/**
 * 漂移严重程度
 */
export type DriftSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Config Drift Detected 事件数据
 */
export interface ConfigDriftDetectedEventData {
  /** 配置 ID */
  configId: string;
  /** 配置名称 */
  configName?: string;
  /** 资源类型 */
  resourceType: string;
  /** 资源 ID */
  resourceId?: string;
  /** 期望值 */
  expected: Record<string, unknown>;
  /** 实际值 */
  actual: Record<string, unknown>;
  /** 漂移类型 */
  driftType: DriftType;
  /** 严重程度 */
  severity?: DriftSeverity;
  /** 差异详情 */
  diff?: Record<string, { expected: unknown; actual: unknown }>;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Config Drift Resolved 事件数据
 */
export interface ConfigDriftResolvedEventData {
  /** 配置 ID */
  configId: string;
  /** 配置名称 */
  configName?: string;
  /** 资源类型 */
  resourceType: string;
  /** 解决方式 */
  resolution: 'reconciled' | 'ignored' | 'manual';
  /** 解决人 */
  resolvedBy?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Config Change Applied 事件数据
 */
export interface ConfigChangeAppliedEventData {
  /** 配置 ID */
  configId: string;
  /** 配置名称 */
  configName?: string;
  /** 变更类型 */
  changeType: 'create' | 'update' | 'delete';
  /** 变更人 */
  changedBy?: string;
  /** 变更详情 */
  changes?: Record<string, unknown>;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Config Change Rejected 事件数据
 */
export interface ConfigChangeRejectedEventData {
  /** 配置 ID */
  configId: string;
  /** 配置名称 */
  configName?: string;
  /** 拒绝原因 */
  reason: string;
  /** 校验错误 */
  validationErrors?: string[];
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * 事件上下文扩展
 */
export interface ConfigEventExtensions {
  /** 租户 ID */
  tenantId: string;
  /** 用户 ID */
  userId: string;
  /** 追踪 ID */
  traceId: string;
  /** 事件版本 */
  version?: string;
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high' | 'critical';
}