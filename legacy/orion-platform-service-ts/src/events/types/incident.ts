/**
 * Incident 事件类型定义
 *
 * 符合 CloudEvents 1.0 规范
 * @see https://cloudevents.io/
 */

/**
 * Incident 事件类型
 */
export type IncidentEventType =
  | 'incident.detected'
  | 'incident.acknowledged'
  | 'incident.resolved'
  | 'incident.escalated';

/**
 * 事故严重程度
 */
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 事故状态
 */
export type IncidentStatus = 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';

/**
 * 事故类型
 */
export type IncidentType = 'service_down' | 'performance_degradation' | 'error_rate_spike' | 'resource_exhaustion' | 'security_breach' | 'data_loss' | 'other';

/**
 * Incident Detected 事件数据
 */
export interface IncidentDetectedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 服务名称 */
  service: string;
  /** 严重程度 */
  severity: IncidentSeverity;
  /** 事故类型 */
  type: IncidentType;
  /** 事故标题 */
  title?: string;
  /** 事故描述 */
  description?: string;
  /** 影响范围 */
  impact?: string;
  /** 关联告警 ID */
  alertIds?: string[];
  /** 根因分析 */
  rootCause?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Incident Acknowledged 事件数据
 */
export interface IncidentAcknowledgedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 服务名称 */
  service: string;
  /** 确认人 */
  acknowledgedBy: string;
  /** 确认时间 */
  acknowledgedAt?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Incident Resolved 事件数据
 */
export interface IncidentResolvedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 服务名称 */
  service: string;
  /** 解决人 */
  resolvedBy: string;
  /** 解决方案 */
  resolution?: string;
  /** 持续时间 (ms) */
  durationMs?: number;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Incident Escalated 事件数据
 */
export interface IncidentEscalatedEventData {
  /** 事故 ID */
  incidentId: string;
  /** 服务名称 */
  service: string;
  /** 升级级别 */
  escalationLevel: number;
  /** 升级原因 */
  reason?: string;
  /** 升级到的团队或用户 */
  escalatedTo?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * 事件上下文扩展
 */
export interface IncidentEventExtensions {
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