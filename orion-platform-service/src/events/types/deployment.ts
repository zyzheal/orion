/**
 * Deployment 事件类型定义
 *
 * 符合 CloudEvents 1.0 规范
 * @see https://cloudevents.io/
 */

/**
 * Deployment 事件类型
 */
export type DeploymentEventType =
  | 'deployment.started'
  | 'deployment.completed'
  | 'deployment.failed'
  | 'deployment.cancelled'
  | 'deployment.rolledback';

/**
 * 部署状态
 */
export type DeploymentStatus = 'running' | 'success' | 'failed' | 'cancelled' | 'rolledback';

/**
 * Deployment Started 事件数据
 */
export interface DeploymentStartedEventData {
  /** 部署 ID */
  deploymentId: string;
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment: string;
  /** 版本 */
  version?: string;
  /** 部署人 */
  deployedBy?: string;
  /** 部署策略 */
  strategy?: 'blue-green' | 'canary' | 'rolling' | 'recreate';
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Deployment Completed 事件数据
 */
export interface DeploymentCompletedEventData {
  /** 部署 ID */
  deploymentId: string;
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment: string;
  /** 版本 */
  version?: string;
  /** 部署状态 */
  status: DeploymentStatus;
  /** 执行耗时 (ms) */
  durationMs?: number;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Deployment Failed 事件数据
 */
export interface DeploymentFailedEventData {
  /** 部署 ID */
  deploymentId: string;
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment: string;
  /** 错误信息 */
  error: string;
  /** 错误阶段 */
  phase?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Deployment Cancelled 事件数据
 */
export interface DeploymentCancelledEventData {
  /** 部署 ID */
  deploymentId: string;
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment: string;
  /** 取消人 */
  cancelledBy?: string;
  /** 取消原因 */
  reason?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Deployment Rolledback 事件数据
 */
export interface DeploymentRolledbackEventData {
  /** 部署 ID */
  deploymentId: string;
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment: string;
  /** 回滚到的版本 */
  rollbackToVersion?: string;
  /** 回滚原因 */
  reason?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * 事件上下文扩展
 */
export interface DeploymentEventExtensions {
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