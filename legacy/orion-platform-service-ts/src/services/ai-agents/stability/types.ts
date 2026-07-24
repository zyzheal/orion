/**
 * 根因分析 Agent 类型定义
 *
 * 涵盖错误分析、告警分析、根因定位、修复建议等场景
 */

import { Symptom, SymptomSeverity, DiagnosticCategory } from '../../diagnostic/types';

/**
 * 根因分析输入类型
 */
export type RootCauseInput =
  | ErrorAnalysisInput
  | AlertAnalysisInput;

/**
 * 错误分析输入
 */
export interface ErrorAnalysisInput {
  /** 输入类型 */
  type: 'error';
  /** 错误信息 */
  error: {
    /** 错误码 */
    code?: string;
    /** 错误消息 */
    message: string;
    /** 堆栈跟踪 */
    stack?: string;
  };
  /** 上下文信息 */
  context?: {
    /** 服务名称 */
    service?: string;
    /** 环境 */
    environment?: string;
    /** 相关请求 ID */
    requestId?: string;
    /** 用户 ID */
    userId?: string;
  };
  /** 关联指标 */
  metrics?: {
    /** CPU 使用率 */
    cpuUsage?: number;
    /** 内存使用率 */
    memoryUsage?: number;
    /** 响应时间 */
    responseTime?: number;
    /** 错误率 */
    errorRate?: number;
  };
}

/**
 * 告警分析输入
 */
export interface AlertAnalysisInput {
  /** 输入类型 */
  type: 'alert';
  /** 告警信息 */
  alert: {
    /** 告警 ID */
    id: string;
    /** 告警名称 */
    name: string;
    /** 告警描述 */
    description: string;
    /** 严重程度 */
    severity: 'critical' | 'warning' | 'info';
    /** 告警来源 */
    source: string;
    /** 触发时间 */
    triggeredAt: string;
  };
  /** 关联指标 */
  metrics?: {
    /** 指标名称 */
    metricName: string;
    /** 当前值 */
    currentValue: number;
    /** 阈值 */
    threshold: number;
    /** 单位 */
    unit?: string;
  }[];
  /** 历史告警 */
  relatedAlerts?: {
    id: string;
    name: string;
    triggeredAt: string;
  }[];
}

/**
 * 根因分析结果
 */
export interface RootCauseAnalysisResult {
  /** 分析 ID */
  analysisId: string;
  /** 诊断会话 ID (关联 DiagnosticEngine) */
  diagnosticSessionId?: string;
  /** 输入类型 */
  inputType: 'error' | 'alert';
  /** 识别的症状 */
  symptoms: AnalyzedSymptom[];
  /** 根因描述 */
  rootCause: {
    /** 根因类型 */
    category: RootCauseCategory;
    /** 根因描述 */
    description: string;
    /** 置信度 (0-100) */
    confidence: number;
    /** 证据列表 */
    evidence: string[];
  };
  /** 影响范围 */
  impactScope?: {
    /** 受影响的服务 */
    affectedServices: string[];
    /** 受影响的环境 */
    affectedEnvironments: string[];
    /** 预估影响用户数 */
    estimatedUsersAffected?: number;
  };
  /** 推荐动作 */
  recommendedActions: RecommendedAction[];
  /** 关联指标快照 */
  metricsSnapshot?: Record<string, number>;
  /** AI 生成的报告 */
  aiReport?: string;
  /** 分析完成时间 */
  analyzedAt: string;
  /** 分析耗时 (ms) */
  analysisDurationMs: number;
}

/**
 * 分析后的症状
 */
export interface AnalyzedSymptom {
  /** 症状类型 */
  type: string;
  /** 来源 */
  source: string;
  /** 描述 */
  description: string;
  /** 严重程度 */
  severity: SymptomSeverity;
  /** 是否关键症状 */
  isKey: boolean;
  /** 与根因的相关性分数 */
  relevanceScore?: number;
}

/**
 * 根因类别
 */
export type RootCauseCategory =
  | 'infrastructure'
  | 'application'
  | 'network'
  | 'database'
  | 'deployment'
  | 'pipeline'
  | 'security'
  | 'performance'
  | 'configuration'
  | 'unknown';

/**
 * 推荐的修复动作
 */
export interface RecommendedAction {
  /** 动作 ID */
  id: string;
  /** 动作描述 */
  description: string;
  /** 动作类型 */
  actionType: 'investigate' | 'fix' | 'rollback' | 'restart' | 'scale' | 'notify' | 'dismiss';
  /** 优先级 */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** 自动化程度 */
  automationLevel: 'manual' | 'semi_auto' | 'fully_auto';
  /** 预计耗时 (ms) */
  estimatedTimeMs?: number;
  /** 执行命令 */
  command?: string;
  /** 依赖的其他动作 */
  dependsOn?: string[];
}

/**
 * 根因分析配置
 */
export interface RootCauseAgentConfig {
  /** 是否启用智能指标查询 */
  enableMetricsQuery: boolean;
  /** 是否启用自动根因建议 */
  enableAutoFix: boolean;
  /** 最大症状数 */
  maxSymptoms: number;
  /** 指标查询超时 (ms) */
  metricsTimeoutMs: number;
}

/**
 * 根因分析历史记录
 */
export interface RootCauseAnalysisRecord {
  /** 分析 ID */
  analysisId: string;
  /** 输入摘要 */
  inputSummary: string;
  /** 根因类别 */
  rootCauseCategory: RootCauseCategory;
  /** 置信度 */
  confidence: number;
  /** 分析时间 */
  analyzedAt: Date;
  /** 执行上下文 */
  context: {
    userId: string;
    tenantId: string;
    traceId: string;
  };
}