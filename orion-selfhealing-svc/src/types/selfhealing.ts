/**
 * Orion Self-Healing Service - Type Definitions
 * 自愈服务完整类型定义
 */

// ============================================================
// 基础枚举
// ============================================================

/** 事件严重程度 */
export enum IncidentSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/** 事件状态 */
export enum IncidentStatus {
  NEW = 'new',
  DETECTED = 'detected',
  EVALUATING = 'evaluating',
  HEALING = 'healing',
  HEALED = 'healed',
  FAILED = 'failed',
  ESCALATED = 'escalated',
  CLOSED = 'closed',
}

/** 策略类型 */
export enum StrategyType {
  RESTART = 'restart',
  SCALE = 'scale',
  FAILOVER = 'failover',
  ROLLBACK = 'rollback',
  CUSTOM_SCRIPT = 'custom_script',
  NOTIFICATION = 'notification',
}

/** 决策动作 */
export enum DecisionAction {
  AUTO_HEAL = 'auto_heal',
  ESCALATE = 'escalate',
  IGNORE = 'ignore',
  MANUAL_REVIEW = 'manual_review',
}

/** 动作状态 */
export enum ActionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

// ============================================================
// 核心类型
// ============================================================

/** 自愈事件 */
export interface SelfHealingIncident {
  /** 事件 ID */
  id: string;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 严重程度 */
  severity: IncidentSeverity;
  /** 事件状态 */
  status: IncidentStatus;
  /** 告警 ID (关联) */
  alertId?: string;
  /** 受影响的资源 */
  affectedResources: string[];
  /** 根因分析 */
  rootCause?: string;
  /** 关联的策略 ID */
  strategyId?: string;
  /** 关联的决策 ID */
  decisionId?: string;
  /** 关联的动 ID 列表 */
  actionIds: string[];
  /** 触发源 */
  triggerSource: string;
  /** 触发事件 */
  triggeredAt: Date;
  /** 解决时间 */
  resolvedAt?: Date;
  /** 租户 ID */
  tenantId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** 自愈策略 */
export interface HealingStrategy {
  /** 策略 ID */
  id: string;
  /** 策略名称 */
  name: string;
  /** 策略描述 */
  description?: string;
  /** 策略类型 */
  type: StrategyType;
  /** 触发条件 (JSON) */
  triggerCondition: Record<string, unknown>;
  /** 策略参数 (JSON) */
  parameters: Record<string, unknown>;
  /** 优先级 */
  priority: number;
  /** 是否启用 */
  enabled: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 超时时间 (秒) */
  timeoutSeconds: number;
  /** 适用范围 */
  scope: string[];
  /** 租户 ID */
  tenantId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** 自愈动作 */
export interface HealingAction {
  /** 动作 ID */
  id: string;
  /** 动作名称 */
  name: string;
  /** 动作描述 */
  description?: string;
  /** 动作类型 */
  type: StrategyType;
  /** 动作状态 */
  status: ActionStatus;
  /** 动作参数 (JSON) */
  parameters: Record<string, unknown>;
  /** 执行结果 */
  result?: Record<string, unknown>;
  /** 错误信息 */
  errorMessage?: string;
  /** 开始时间 */
  startedAt: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 关联的事件 ID */
  incidentId: string;
  /** 关联的决策 ID */
  decisionId?: string;
  /** 执行者 */
  executor: string;
}

/** 自愈决策 */
export interface HealingDecision {
  /** 决策 ID */
  id: string;
  /** 关联的事件 ID */
  incidentId: string;
  /** 决策动作 */
  action: DecisionAction;
  /** 决策原因 */
  reasoning: string;
  /** 推荐的策略 ID */
  recommendedStrategyId?: string;
  /** 推荐的动 ID */
  recommendedActionId?: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 是否自动执行 */
  autoExecute: boolean;
  /** 决策人 (手动决策时) */
  decidedBy?: string;
  /** 创建时间 */
  createdAt: Date;
}

/** 知识库条目 */
export interface KnowledgeBase {
  /** 知识 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 问题模式 */
  problemPattern: string;
  /** 解决方案 */
  solution: string;
  /** 关联的策略类型 */
  relatedStrategyTypes: StrategyType[];
  /** 标签 */
  tags: string[];
  /** 使用次数 */
  usageCount: number;
  /** 成功率 */
  successRate: number;
  /** 最后使用时间 */
  lastUsedAt?: Date;
  /** 创建人 */
  createdBy: string;
  /** 租户 ID */
  tenantId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}
