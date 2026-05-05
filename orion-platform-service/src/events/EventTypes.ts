/**
 * EventTypes - 统一事件类型定义
 *
 * 集中定义所有事件域的事件类型常量:
 * - Pipeline (pipeline.*)
 * - Code (code.*)
 * - Config (config.*)
 * - Deployment (deploy.*)
 * - Incident (incident.*)
 * - Self-Healing (self-healing.*)
 *
 * 用于:
 * 1. JetStream subject 路由
 * 2. 事件过滤和匹配
 * 3. 类型安全的订阅
 */

// ============================================================
// Pipeline 事件 (orion.pipeline.*)
// ============================================================

export const PipelineEvents = {
  /** Pipeline 执行已创建 */
  RUN_CREATED: 'pipeline.run.created',
  /** Pipeline 执行已开始 */
  RUN_STARTED: 'pipeline.run.started',
  /** Pipeline 执行已完成 */
  RUN_COMPLETED: 'pipeline.run.completed',
  /** Pipeline 执行失败 */
  RUN_FAILED: 'pipeline.run.failed',
  /** Pipeline 执行已取消 */
  RUN_CANCELLED: 'pipeline.run.cancelled',
  /** Stage 已开始 */
  STAGE_STARTED: 'pipeline.stage.started',
  /** Stage 已完成 */
  STAGE_COMPLETED: 'pipeline.stage.completed',
  /** Stage 失败 */
  STAGE_FAILED: 'pipeline.stage.failed',
  /** Stage 已跳过 */
  STAGE_SKIPPED: 'pipeline.stage.skipped',
  /** Task 已开始 */
  TASK_STARTED: 'pipeline.task.started',
  /** Task 已完成 */
  TASK_COMPLETED: 'pipeline.task.completed',
  /** Task 失败 */
  TASK_FAILED: 'pipeline.task.failed',
} as const;

export type PipelineEventType = (typeof PipelineEvents)[keyof typeof PipelineEvents];

// Pipeline 事件的 NATS subject
export const PipelineSubjects = {
  RUN: 'orion.pipeline.run.*',
  STAGE: 'orion.pipeline.stage.*',
  TASK: 'orion.pipeline.task.*',
} as const;

// ============================================================
// Code 事件 (orion.code.*)
// ============================================================

export const CodeEvents = {
  /** PR 已打开 */
  PR_OPENED: 'code.pr.opened',
  /** PR 已合并 */
  PR_MERGED: 'code.pr.merged',
  /** PR 已关闭 */
  PR_CLOSED: 'code.pr.closed',
  /** PR 已更新 */
  PR_UPDATED: 'code.pr.updated',
} as const;

export type CodeEventType = (typeof CodeEvents)[keyof typeof CodeEvents];

export const CodeSubjects = {
  ALL: 'orion.code.*',
} as const;

// ============================================================
// Deployment 事件 (orion.deploy.*)
// ============================================================

export const DeploymentEvents = {
  /** 部署已开始 */
  DEPLOYMENT_STARTED: 'deployment.started',
  /** 部署已完成 */
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  /** 部署失败 */
  DEPLOYMENT_FAILED: 'deployment.failed',
  /** 部署已取消 */
  DEPLOYMENT_CANCELLED: 'deployment.cancelled',
  /** 部署已回滚 */
  DEPLOYMENT_ROLLEDBACK: 'deployment.rolledback',
} as const;

export type DeploymentEventType = (typeof DeploymentEvents)[keyof typeof DeploymentEvents];

export const DeploymentSubjects = {
  ALL: 'orion.deploy.*',
} as const;

// ============================================================
// Config 事件 (orion.config.*)
// ============================================================

export const ConfigEvents = {
  /** 检测到配置漂移 */
  DRIFT_DETECTED: 'config.drift.detected',
  /** 配置漂移已解决 */
  DRIFT_RESOLVED: 'config.drift.resolved',
  /** 配置变更已应用 */
  CHANGE_APPLIED: 'config.change.applied',
  /** 配置变更被拒绝 */
  CHANGE_REJECTED: 'config.change.rejected',
} as const;

export type ConfigEventType = (typeof ConfigEvents)[keyof typeof ConfigEvents];

export const ConfigSubjects = {
  ALL: 'orion.config.*',
} as const;

// ============================================================
// Incident 事件 (orion.incident.*)
// ============================================================

export const IncidentEvents = {
  /** 事件已检测 */
  INCIDENT_DETECTED: 'incident.detected',
  /** 事件已确认 */
  INCIDENT_ACKNOWLEDGED: 'incident.acknowledged',
  /** 事件已解决 */
  INCIDENT_RESOLVED: 'incident.resolved',
  /** 事件已升级 */
  INCIDENT_ESCALATED: 'incident.escalated',
} as const;

export type IncidentEventType = (typeof IncidentEvents)[keyof typeof IncidentEvents];

export const IncidentSubjects = {
  ALL: 'orion.incident.*',
} as const;

// ============================================================
// Self-Healing 事件 (orion.self-healing.*)
// ============================================================

export const SelfHealingEvents = {
  /** 自愈事件已检测 */
  INCIDENT_DETECTED: 'self-healing.incident.detected',
  /** 自愈已开始 */
  HEALING_STARTED: 'self-healing.started',
  /** 自愈动作已执行 */
  ACTION_EXECUTED: 'self-healing.action.executed',
  /** 自愈已完成 */
  HEALING_COMPLETED: 'self-healing.completed',
  /** 自愈失败 */
  HEALING_FAILED: 'self-healing.failed',
  /** 自愈审批已请求 */
  APPROVAL_REQUESTED: 'self-healing.approval.requested',
  /** 自愈审批已响应 */
  APPROVAL_RESPONDED: 'self-healing.approval.responded',
  /** 自愈事件已升级 */
  INCIDENT_ESCALATED: 'self-healing.incident.escalated',
} as const;

export type SelfHealingEventType = (typeof SelfHealingEvents)[keyof typeof SelfHealingEvents];

export const SelfHealingSubjects = {
  ALL: 'orion.self-healing.*',
} as const;

// ============================================================
// 事件域分类
// ============================================================

export type EventDomain = 'pipeline' | 'code' | 'deployment' | 'config' | 'incident' | 'self-healing';

/**
 * 从事件类型推断所属域
 */
export function getEventDomain(eventType: string): EventDomain | 'unknown' {
  if (eventType.startsWith('pipeline.')) return 'pipeline';
  if (eventType.startsWith('code.')) return 'code';
  if (eventType.startsWith('deployment.')) return 'deployment';
  if (eventType.startsWith('config.')) return 'config';
  if (eventType.startsWith('incident.')) return 'incident';
  if (eventType.startsWith('self-healing.')) return 'self-healing';
  return 'unknown';
}

/**
 * 获取某事件域的所有事件类型
 */
export function getEventsForDomain(domain: EventDomain): ReadonlyArray<string> {
  switch (domain) {
    case 'pipeline': return Object.values(PipelineEvents);
    case 'code': return Object.values(CodeEvents);
    case 'deployment': return Object.values(DeploymentEvents);
    case 'config': return Object.values(ConfigEvents);
    case 'incident': return Object.values(IncidentEvents);
    case 'self-healing': return Object.values(SelfHealingEvents);
    default: return [];
  }
}

/**
 * 获取所有事件类型（flat list）
 */
export function getAllEventTypes(): ReadonlyArray<string> {
  return [
    ...Object.values(PipelineEvents),
    ...Object.values(CodeEvents),
    ...Object.values(DeploymentEvents),
    ...Object.values(ConfigEvents),
    ...Object.values(IncidentEvents),
    ...Object.values(SelfHealingEvents),
  ];
}

/**
 * 将所有事件类型映射到 NATS subject 格式 (前缀 orion.)
 */
export function toSubject(eventType: string): string {
  return `orion.${eventType}`;
}
