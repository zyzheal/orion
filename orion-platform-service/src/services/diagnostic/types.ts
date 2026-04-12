/**
 * 诊断 Agent 服务类型定义
 *
 * 涵盖自动化故障诊断、根因分析、诊断报告生成、诊断知识库积累等场景
 */

// ==================== 诊断会话核心类型 ====================

/**
 * 诊断触发类型
 */
export type DiagnosticTriggerType =
  | 'incident'
  | 'deployment_failure'
  | 'pipeline_failure'
  | 'health_check_failure'
  | 'manual'
  | 'scheduled';

/**
 * 诊断会话状态
 */
export type DiagnosticSessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 症状严重程度
 */
export type SymptomSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * 诊断类别
 */
export type DiagnosticCategory =
  | 'infrastructure'
  | 'application'
  | 'network'
  | 'database'
  | 'deployment'
  | 'pipeline'
  | 'security'
  | 'performance'
  | 'configuration';

/**
 * 根因类别
 */
export type RootCauseCategory = DiagnosticCategory | 'unknown';

/**
 * 修复复杂度
 */
export type FixComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';

// ==================== 症状类型 ====================

/**
 * 症状 - 观察到的异常现象
 */
export interface Symptom {
  /** 症状类型 */
  type: string;
  /** 来源（服务名/组件名） */
  source: string;
  /** 描述 */
  description: string;
  /** 严重程度 */
  severity: SymptomSeverity;
  /** 时间戳 */
  timestamp: Date;
  /** 元数据 */
  metadata?: Record<string, any>;
}

// ==================== 发现类型 ====================

/**
 * 发现 - 诊断过程中的中间结论
 */
export interface Finding {
  /** 描述 */
  description: string;
  /** 类别 */
  category: DiagnosticCategory;
  /** 证据 */
  evidence: string[];
  /** 严重程度 */
  severity: SymptomSeverity;
  /** 关联的症状 */
  relatedSymptoms: string[];
}

// ==================== 根因类型 ====================

/**
 * 推荐动作
 */
export interface RecommendedAction {
  /** 动作描述 */
  description: string;
  /** 动作类型 */
  actionType: 'investigate' | 'fix' | 'rollback' | 'restart' | 'scale' | 'notify';
  /** 优先级 */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** 预计耗时 (ms) */
  estimatedTimeMs?: number;
  /** 自动化程度 */
  automationLevel: 'manual' | 'semi_auto' | 'fully_auto';
  /** 相关命令或脚本 */
  commands?: string[];
}

/**
 * 根因分析结果
 */
export interface RootCause {
  /** 描述 */
  description: string;
  /** 类别 */
  category: RootCauseCategory;
  /** 置信度 (0-100) */
  confidence: number;
  /** 证据列表 */
  evidence: string[];
  /** 推荐动作 */
  recommendedActions: RecommendedAction[];
}

// ==================== 诊断会话类型 ====================

/**
 * 诊断会话
 */
export interface DiagnosticSession {
  /** 会话 ID */
  id: string;
  /** 触发类型 */
  triggerType: DiagnosticTriggerType;
  /** 触发源 ID */
  triggerId: string;
  /** 症状列表 */
  symptoms: Symptom[];
  /** 发现列表 */
  findings: Finding[];
  /** 根因分析结果 */
  rootCause: RootCause | null;
  /** 置信度 (0-100) */
  confidence: number;
  /** 状态 */
  status: DiagnosticSessionStatus;
  /** 创建时间 */
  createdAt: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 租户 ID */
  tenantId?: string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

// ==================== 诊断报告类型 ====================

/**
 * 诊断报告
 */
export interface DiagnosticReport {
  /** 报告 ID */
  id: string;
  /** 关联的会话 ID */
  sessionId: string;
  /** 摘要 */
  summary: string;
  /** 发现列表 */
  findings: Finding[];
  /** 根因分析 */
  rootCause: RootCause | null;
  /** 推荐动作 */
  recommendations: RecommendedAction[];
  /** 时间线 */
  timeline: TimelineEntry[];
  /** 预估修复时间 (ms) */
  estimatedFixTimeMs?: number;
  /** 生成时间 */
  generatedAt: Date;
  /** 租户 ID */
  tenantId?: string;
}

/**
 * 时间线条目
 */
export interface TimelineEntry {
  /** 时间戳 */
  timestamp: Date;
  /** 事件描述 */
  description: string;
  /** 事件类型 */
  eventType: 'symptom_detected' | 'finding_made' | 'root_cause_identified' | 'action_recommended';
}

// ==================== 诊断模式（知识库）类型 ====================

/**
 * 诊断模式 - 从历史事件中学到的诊断知识
 */
export interface DiagnosticPattern {
  /** 模式 ID */
  id: string;
  /** 模式名称 */
  name: string;
  /** 匹配的症状模板 */
  symptoms: SymptomPattern[];
  /** 根因描述 */
  rootCause: string;
  /** 解决方案 */
  solution: string;
  /** 匹配频率 */
  frequency: number;
  /** 最后匹配时间 */
  lastMatched?: Date;
  /** 类别 */
  category: DiagnosticCategory;
  /** 平均置信度 */
  averageConfidence: number;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 症状模式模板
 */
export interface SymptomPattern {
  /** 症状类型 */
  type: string;
  /** 来源模式（支持通配符） */
  sourcePattern?: string;
  /** 描述关键词 */
  keywords?: string[];
  /** 最低严重程度 */
  minSeverity?: SymptomSeverity;
}

/**
 * 诊断结果记录
 */
export interface DiagnosticOutcome {
  /** 关联的会话 ID */
  sessionId: string;
  /** 模式 ID */
  patternId: string;
  /** 是否确认 */
  confirmed: boolean;
  /** 实际根因 */
  actualRootCause?: string;
  /** 修复时间 (ms) */
  fixTimeMs?: number;
  /** 记录时间 */
  recordedAt: Date;
}

// ==================== API 请求/响应类型 ====================

/**
 * 触发诊断请求
 */
export interface TriggerDiagnosticRequest {
  /** 触发类型 */
  triggerType: DiagnosticTriggerType;
  /** 触发源 ID */
  triggerId: string;
  /** 症状列表 */
  symptoms: Array<{
    type: string;
    source: string;
    description: string;
    severity: SymptomSeverity;
    metadata?: Record<string, any>;
  }>;
  /** 租户 ID */
  tenantId?: string;
}

/**
 * 添加症状请求
 */
export interface AddSymptomRequest {
  /** 症状类型 */
  type: string;
  /** 来源 */
  source: string;
  /** 描述 */
  description: string;
  /** 严重程度 */
  severity: SymptomSeverity;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 添加诊断模式请求
 */
export interface AddPatternRequest {
  /** 模式名称 */
  name: string;
  /** 症状模式列表 */
  symptoms: SymptomPattern[];
  /** 根因描述 */
  rootCause: string;
  /** 解决方案 */
  solution: string;
  /** 类别 */
  category: DiagnosticCategory;
}

/**
 * 诊断历史查询参数
 */
export interface DiagnosticHistoryQuery {
  /** 触发类型过滤 */
  triggerType?: DiagnosticTriggerType;
  /** 触发源 ID 过滤 */
  triggerId?: string;
  /** 租户 ID 过滤 */
  tenantId?: string;
  /** 状态过滤 */
  status?: DiagnosticSessionStatus;
  /** 起始时间 */
  since?: string;
  /** 限制条数 */
  limit?: string;
}

/**
 * 知识库查询参数
 */
export interface KnowledgeBaseQuery {
  /** 类别过滤 */
  category?: DiagnosticCategory;
  /** 关键词搜索 */
  keyword?: string;
  /** 最低匹配频率 */
  minFrequency?: number;
  /** 限制条数 */
  limit?: string;
}
