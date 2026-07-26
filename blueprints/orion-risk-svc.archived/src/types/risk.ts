/**
 * Orion Risk Assessment Service - Type Definitions
 * 风险评估服务完整类型定义
 */

// ============================================================
// 基础枚举
// ============================================================

/** 风险类别 */
export enum RiskCategory {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  AVAILABILITY = 'availability',
  COMPLIANCE = 'compliance',
  OPERATIONAL = 'operational',
  FINANCIAL = 'financial',
}

/** 风险等级 */
export enum RiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

/** 风险状态 */
export enum RiskStatus {
  IDENTIFIED = 'identified',
  ASSESSING = 'assessing',
  MITIGATING = 'mitigating',
  ACCEPTED = 'accepted',
  CLOSED = 'closed',
  ESCALATED = 'escalated',
}

/** 风险评估状态 */
export enum AssessmentStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

// ============================================================
// 核心类型
// ============================================================

/** 风险评分 */
export interface RiskScore {
  /** 评分 ID */
  id: string;
  /** 实体类型 (application, service, infrastructure) */
  entityType: string;
  /** 实体 ID */
  entityId: string;
  /** 总分 (0-100) */
  totalScore: number;
  /** 各维度分数 */
  dimensionScores: Record<string, number>;
  /** 风险等级 */
  riskLevel: RiskLevel;
  /** 评估时间 */
  assessedAt: Date;
  /** 过期时间 */
  expiresAt: Date;
  /** 评估说明 */
  comment?: string;
}

/** 风险事件 */
export interface RiskEvent {
  /** 事件 ID */
  id: string;
  /** 关联的评估 ID */
  assessmentId: string;
  /** 风险类别 */
  category: RiskCategory;
  /** 风险等级 */
  level: RiskLevel;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 影响范围 */
  impact: string;
  /** 影响分数 (1-5) */
  impactScore: number;
  /** 发生概率 (1-5) */
  probabilityScore: number;
  /** 风险值 (impact * probability) */
  riskValue: number;
  /** 建议措施 */
  recommendation?: string;
  /** 责任人 */
  assigneeId?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 状态 */
  status: RiskStatus;
}

/** 风险查询参数 */
export interface RiskQuery {
  /** 实体类型过滤 */
  entityType?: string;
  /** 实体 ID 过滤 */
  entityId?: string;
  /** 风险类别过滤 */
  category?: RiskCategory;
  /** 风险等级过滤 */
  level?: RiskLevel;
  /** 状态过滤 */
  status?: RiskStatus;
  /** 分页 - 页码 */
  page?: number;
  /** 分页 - 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/** 风险评估 */
export interface RiskAssessment {
  /** 评估 ID */
  id: string;
  /** 评估名称 */
  name: string;
  /** 评估描述 */
  description?: string;
  /** 实体类型 */
  entityType: string;
  /** 实体 ID */
  entityId: string;
  /** 评估状态 */
  status: AssessmentStatus;
  /** 风险事件列表 */
  events: RiskEvent[];
  /** 总体风险评分 */
  overallScore?: RiskScore;
  /** 评估人 */
  assessorId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 租户 ID */
  tenantId: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}
