/**
 * Self-Healing 事件类型定义
 *
 * 符合 CloudEvents 1.0 规范
 * @see https://cloudevents.io/
 */

/**
 * Self-Healing 事件类型
 */
export type SelfHealingEventType =
  | 'self-healing.incident_detected'
  | 'self-healing.healing_started'
  | 'self-healing.action_executed'
  | 'self-healing.healing_completed'
  | 'self-healing.healing_failed'
  | 'self-healing.approval_requested'
  | 'self-healing.approval_responded'
  | 'self-healing.incident_escalated';

/**
 * 自愈事件严重程度
 */
export type SelfHealingSeverity = 'critical' | 'warning' | 'info';

/**
 * 自愈事件状态
 */
export type SelfHealingStatus =
  | 'new'
  | 'evaluating'
  | 'healing'
  | 'healed'
  | 'failed'
  | 'escalated'
  | 'pending_approval'
  | 'cancelled';

/**
 * 自愈动作类型
 */
export type SelfHealingActionType = 'restart' | 'scale' | 'failover' | 'rollback';

/**
 * 自愈事故类型
 */
export type SelfHealingIncidentType =
  | 'high_cpu'
  | 'high_memory'
  | 'high_error_rate'
  | 'high_latency'
  | 'pod_crash'
  | 'node_failure'
  | 'service_down'
  | 'deployment_failure'
  | 'disk_full'
  | 'network_timeout'
  | 'custom';

/**
 * Incident Detected 事件数据
 */
export interface SelfHealingIncidentDetectedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 告警 ID */
  alertId?: string;
  /** 应用名称 */
  appName: string;
  /** 环境 */
  environment: string;
  /** 事故类型 */
  type: SelfHealingIncidentType;
  /** 严重程度 */
  severity: SelfHealingSeverity;
  /** 标签 */
  tags?: Record<string, string>;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Healing Started 事件数据
 */
export interface SelfHealingStartedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 应用名称 */
  appName: string;
  /** 环境 */
  environment: string;
  /** 策略 ID */
  strategyId: string;
  /** 策略名称 */
  strategyName: string;
  /** 动作列表 */
  actions: Array<{ type: SelfHealingActionType; description?: string }>;
  /** 是否需要审批 */
  requiresApproval: boolean;
  /** 置信度 */
  confidence: number;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Action Executed 事件数据
 */
export interface SelfHealingActionExecutedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 动作类型 */
  actionType: SelfHealingActionType;
  /** 是否成功 */
  success: boolean;
  /** 执行时长 (ms) */
  durationMs: number;
  /** 结果消息 */
  message?: string;
  /** 错误信息 */
  error?: string;
  /** 是否需要回滚 */
  rollbackNeeded?: boolean;
  /** 回滚是否成功 */
  rollbackSuccess?: boolean;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Healing Completed 事件数据
 */
export interface SelfHealingCompletedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 应用名称 */
  appName: string;
  /** 环境 */
  environment: string;
  /** 是否成功 */
  success: boolean;
  /** 总时长 (ms) */
  durationMs: number;
  /** 执行的动作数量 */
  actionsExecuted: number;
  /** 效果评分 (0-100) */
  effectiveness?: number;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Healing Failed 事件数据
 */
export interface SelfHealingFailedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 应用名称 */
  appName: string;
  /** 环境 */
  environment: string;
  /** 错误信息 */
  error: string;
  /** 尝试次数 */
  attempts: number;
  /** 最后执行的动作 */
  lastAction?: SelfHealingActionType;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Approval Requested 事件数据
 */
export interface SelfHealingApprovalRequestedEventData {
  /** 审批请求 ID */
  approvalRequestId: string;
  /** 事故 ID */
  incidentId: string;
  /** 应用名称 */
  appName: string;
  /** 环境 */
  environment: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description?: string;
  /** 风险级别 */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** 推荐动作 */
  recommendedActions: Array<{ type: SelfHealingActionType; description?: string }>;
  /** 过期时间 */
  expiresAt?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Approval Responded 事件数据
 */
export interface SelfHealingApprovalRespondedEventData {
  /** 审批请求 ID */
  approvalRequestId: string;
  /** 事故 ID */
  incidentId: string;
  /** 是否批准 */
  approved: boolean;
  /** 响应人 */
  respondedBy: string;
  /** 响应原因 */
  reason?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Incident Escalated 事件数据
 */
export interface SelfHealingIncidentEscalatedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 应用名称 */
  appName: string;
  /** 环境 */
  environment: string;
  /** 升级原因 */
  reason: string;
  /** 原始事故类型 */
  type: SelfHealingIncidentType;
  /** 升级后的状态 */
  status: SelfHealingStatus;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * 事件上下文扩展
 */
export interface SelfHealingEventExtensions {
  /** 租户 ID */
  tenantId?: string;
  /** 用户 ID */
  userId?: string;
  /** 追踪 ID */
  traceId?: string;
  /** 事件版本 */
  version?: string;
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high' | 'critical';
}