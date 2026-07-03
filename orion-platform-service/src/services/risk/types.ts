/**
 * Risk Module Types
 *
 * Core type definitions for the risk management module:
 * - Risk entity and input/output DTOs
 * - RiskLevel enum
 * - RiskMitigation types
 * - RiskRule for rule-based engine
 * - RiskDashboard for analytics
 */

// ==================== Risk Level ====================

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: '低',
  [RiskLevel.MEDIUM]: '中',
  [RiskLevel.HIGH]: '高',
  [RiskLevel.CRITICAL]: '紧急',
};

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'green',
  [RiskLevel.MEDIUM]: 'orange',
  [RiskLevel.HIGH]: 'red',
  [RiskLevel.CRITICAL]: 'magenta',
};

export const RISK_LEVEL_SCORE_RANGES: Record<RiskLevel, [number, number]> = {
  [RiskLevel.LOW]: [0, 25],
  [RiskLevel.MEDIUM]: [26, 50],
  [RiskLevel.HIGH]: [51, 75],
  [RiskLevel.CRITICAL]: [76, 100],
};

// ==================== Risk Entity ====================

export interface RiskEntity {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  riskLevel: RiskLevel;
  score: number; // 0-100
  category: RiskCategory;
  targetType: string;
  targetId: string;
  status: RiskStatus;
  identifiedAt: Date;
  assessedAt?: Date;
  mitigatedAt?: Date;
  closedAt?: Date;
  createdBy?: string;
  assignedTo?: string;
  findings: RiskFinding[];
  mitigations: RiskMitigation[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskCreateInput {
  tenantId: string;
  name: string;
  description?: string;
  category?: RiskCategory;
  targetType: string;
  targetId: string;
  createdBy?: string;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}

export interface RiskUpdateInput {
  name?: string;
  description?: string;
  riskLevel?: RiskLevel;
  score?: number;
  status?: RiskStatus;
  assignedTo?: string;
  findings?: RiskFinding[];
  metadata?: Record<string, unknown>;
}

// ==================== Enums ====================

export enum RiskCategory {
  SECURITY = 'security',
  OPERATIONAL = 'operational',
  COMPLIANCE = 'compliance',
  FINANCIAL = 'financial',
  TECHNICAL = 'technical',
  STRATEGIC = 'strategic',
  REPUTATION = 'reputation',
  SUPPLY_CHAIN = 'supply_chain',
}

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  [RiskCategory.SECURITY]: '安全',
  [RiskCategory.OPERATIONAL]: '运营',
  [RiskCategory.COMPLIANCE]: '合规',
  [RiskCategory.FINANCIAL]: '财务',
  [RiskCategory.TECHNICAL]: '技术',
  [RiskCategory.STRATEGIC]: '战略',
  [RiskCategory.REPUTATION]: '声誉',
  [RiskCategory.SUPPLY_CHAIN]: '供应链',
};

export enum RiskStatus {
  IDENTIFIED = 'identified',
  ASSESSED = 'assessed',
  MITIGATING = 'mitigating',
  ACCEPTED = 'accepted',
  CLOSED = 'closed',
}

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  [RiskStatus.IDENTIFIED]: '已识别',
  [RiskStatus.ASSESSED]: '已评估',
  [RiskStatus.MITIGATING]: '缓解中',
  [RiskStatus.ACCEPTED]: '已接受',
  [RiskStatus.CLOSED]: '已关闭',
};

// ==================== Risk Finding ====================

export interface RiskFinding {
  id: string;
  title: string;
  description: string;
  severity: RiskLevel;
  category: RiskCategory;
  source: string; // rule id, scan tool, etc.
  recommendation: string;
  affectedComponents: string[];
  evidence?: Record<string, unknown>;
  detectedAt: Date;
}

export interface RiskFindingInput {
  title: string;
  description: string;
  severity: RiskLevel;
  category: RiskCategory;
  source: string;
  recommendation: string;
  affectedComponents?: string[];
  evidence?: Record<string, unknown>;
}

// ==================== Risk Mitigation ====================

export interface RiskMitigation {
  id: string;
  riskId: string;
  plan: string;
  actions: MitigationAction[];
  status: MitigationStatus;
  priority: RiskLevel;
  owner?: string;
  dueDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  effectiveness?: number; // 0-100, post-implementation
  result?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MitigationAction {
  id: string;
  description: string;
  type: MitigationActionType;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignee?: string;
  dueDate?: Date;
  completedAt?: Date;
  result?: string;
}

export enum MitigationActionType {
  AVOID = 'avoid',
  TRANSFER = 'transfer',
  MITIGATE = 'mitigate',
  ACCEPT = 'accept',
}

export const MITIGATION_ACTION_LABELS: Record<MitigationActionType, string> = {
  [MitigationActionType.AVOID]: '规避',
  [MitigationActionType.TRANSFER]: '转移',
  [MitigationActionType.MITIGATE]: '减轻',
  [MitigationActionType.ACCEPT]: '接受',
};

export enum MitigationStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export const MITIGATION_STATUS_LABELS: Record<MitigationStatus, string> = {
  [MitigationStatus.PLANNED]: '计划中',
  [MitigationStatus.IN_PROGRESS]: '执行中',
  [MitigationStatus.COMPLETED]: '已完成',
  [MitigationStatus.FAILED]: '失败',
  [MitigationStatus.CANCELLED]: '已取消',
};

// ==================== Risk Rule (Rule Engine) ====================

export interface RiskRule {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: RiskCategory;
  condition: RiskRuleCondition;
  weight: number; // 0-1, influence on final score
  enabled: boolean;
  priority: number; // higher = runs first
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskRuleCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
  conditions?: RiskRuleCondition[]; // nested conditions for complex rules
}

export enum RuleOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN = 'in',
  BETWEEN = 'between',
  REGEX_MATCH = 'regex_match',
}

// ==================== Risk Dashboard ====================

export interface RiskDashboard {
  tenantId: string;
  generatedAt: Date;
  summary: {
    totalRisks: number;
    openRisks: number;
    closedRisks: number;
    averageScore: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  byCategory: Record<RiskCategory, number>;
  byLevel: Record<RiskLevel, number>;
  byStatus: Record<RiskStatus, number>;
  topRisks: RiskEntity[];
  recentTrends: RiskTrendPoint[];
  mitigationProgress: {
    planned: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
}

export interface RiskTrendPoint {
  date: string;
  identified: number;
  closed: number;
  averageScore: number;
}

// ==================== Rule Engine Context ====================

export interface RiskEngineContext {
  tenantId: string;
  targetType: string;
  targetId: string;
  data: Record<string, unknown>;
  existingFindings?: RiskFinding[];
}

export interface RiskIdentificationResult {
  risks: RiskFinding[];
  triggeredRules: string[];
  overallScore: number;
  overallLevel: RiskLevel;
}

// ==================== Assessment Input/Output ====================

export interface RiskAssessInput {
  riskId: string;
  customScore?: number;
  notes?: string;
  assessedBy: string;
}

export interface RiskAssessOutput {
  riskId: string;
  previousScore: number;
  previousLevel: RiskLevel;
  newScore: number;
  newLevel: RiskLevel;
  scoreDelta: number;
  findingsCount: number;
  assessedAt: Date;
}

export interface CreateMitigationInput {
  riskId: string;
  plan: string;
  actions: Omit<MitigationAction, 'id' | 'status'>[];
  priority?: RiskLevel;
  owner?: string;
  dueDate?: Date;
}

// ==================== Risk DB Row (for BaseRepository mapping) ====================

export interface RiskRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  risk_level: string;
  score: number;
  category: string;
  target_type: string;
  target_id: string;
  status: string;
  identified_at: Date;
  assessed_at: Date | null;
  mitigated_at: Date | null;
  closed_at: Date | null;
  created_by: string | null;
  assigned_to: string | null;
  findings: Record<string, unknown>; // JSONB
  mitigations: Record<string, unknown>[]; // JSONB
  metadata: Record<string, unknown>; // JSONB
  created_at: Date;
  updated_at: Date;
}
