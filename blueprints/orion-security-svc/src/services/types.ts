/**
 * 风险评估服务类型定义
 *
 * 涵盖变更风险评估、发布健康度检查、风险事件订阅等场景
 */

// ==================== 风险评估核心类型 ====================

/**
 * 风险等级
 */
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * 风险因子类别
 */
export type RiskFactorCategory = 'technical' | 'historical' | 'organizational';

/**
 * 风险评估目标类型
 */
export type RiskTargetType = 'deployment' | 'change' | 'pipeline' | 'infrastructure';

/**
 * 风险因子 - 影响风险评分的单个因素
 */
export interface RiskFactor {
  /** 因子名称 */
  name: string;
  /** 权重 (0-1) */
  weight: number;
  /** 得分 (0-100) */
  score: number;
  /** 描述 */
  description: string;
  /** 类别 */
  category: RiskFactorCategory;
}

/**
 * 变更风险评估数据
 */
export interface DeploymentRisk {
  /** 变更范围 (影响的组件/服务) */
  changeScope: string[];
  /** 变更规模 (文件数/代码行数) */
  changeSize: {
    filesChanged: number;
    linesChanged: number;
  };
  /** 时间风险 */
  timeRisk: {
    isWeekend: boolean;
    isAfterHours: boolean;
    isHoliday: boolean;
    isFriday: boolean;
  };
  /** 依赖风险 */
  dependencyRisk: {
    totalDependencies: number;
    unhealthyDependencies: number;
    criticalDependencies: string[];
  };
  /** 历史风险 */
  historicalRisk: {
    recentFailureRate: number; // 近期失败率 (0-1)
    recentIncidents: number;   // 近期事故数
    averageMTTR: number;       // 平均恢复时间 (ms)
  };
}

/**
 * 风险评估结果
 */
export interface RiskAssessment {
  /** 评估 ID */
  id: string;
  /** 目标类型 */
  targetType: RiskTargetType;
  /** 目标 ID */
  targetId: string;
  /** 风险评分 (0-100) */
  riskScore: number;
  /** 风险等级 */
  riskLevel: RiskLevel;
  /** 风险因子列表 */
  factors: RiskFactor[];
  /** 建议列表 */
  recommendations: RiskRecommendation[];
  /** 创建时间 */
  createdAt: Date;
  /** 租户 ID */
  tenantId?: string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 风险建议
 */
export interface RiskRecommendation {
  /** 建议 ID */
  id: string;
  /** 建议类型 */
  type: 'block' | 'warn' | 'info' | 'suggestion';
  /** 标题 */
  title: string;
  /** 详细描述 */
  description: string;
  /** 关联的风险因子名称 */
  relatedFactor?: string;
  /** 优先级 */
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// ==================== 健康检查类型 ====================

/**
 * 健康检查状态
 */
export type HealthCheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

/**
 * 健康检查项
 */
export interface HealthCheck {
  /** 检查 ID */
  id: string;
  /** 检查名称 */
  checkName: string;
  /** 检查状态 */
  status: HealthCheckStatus;
  /** 详细信息 */
  details: string;
  /** 检查耗时 (ms) */
  duration: number;
  /** 时间戳 */
  timestamp: Date;
  /** 关联的目标 */
  targetId?: string;
}

/**
 * 健康检查汇总结果
 */
export interface HealthCheckResult {
  /** 总检查数 */
  totalChecks: number;
  /** 通过数 */
  passed: number;
  /** 失败数 */
  failed: number;
  /** 警告数 */
  warnings: number;
  /** 跳过数 */
  skipped: number;
  /** 是否可以部署 */
  canProceed: boolean;
  /** 各检查项详情 */
  checks: HealthCheck[];
  /** 执行时间 */
  executedAt: Date;
}

// ==================== 风险报告类型 ====================

/**
 * 风险评估报告
 */
export interface RiskReport {
  /** 报告 ID */
  id: string;
  /** 关联的评估 ID */
  assessmentId: string;
  /** 摘要 */
  summary: {
    /** 风险评分 */
    riskScore: number;
    /** 风险等级 */
    riskLevel: RiskLevel;
    /** 是否可部署 */
    canDeploy: boolean;
    /** 主要风险点数量 */
    criticalRiskCount: number;
    /** 健康检查结果 */
    healthCheckResult?: HealthCheckResult;
  };
  /** 详细分析 */
  details: {
    /** 技术风险因素 */
    technicalFactors: RiskFactor[];
    /** 历史风险因素 */
    historicalFactors: RiskFactor[];
    /** 组织风险因素 */
    organizationalFactors: RiskFactor[];
  };
  /** 建议列表 */
  recommendations: RiskRecommendation[];
  /** 生成时间 */
  generatedAt: Date;
  /** 租户 ID */
  tenantId?: string;
}

// ==================== 事件类型 ====================

/**
 * 风险评估事件数据
 */
export interface RiskAssessmentEventData {
  /** 评估 ID */
  assessmentId: string;
  /** 目标类型 */
  targetType: RiskTargetType;
  /** 目标 ID */
  targetId: string;
  /** 风险评分 */
  riskScore: number;
  /** 风险等级 */
  riskLevel: RiskLevel;
  /** 健康检查是否通过 */
  healthCheckPassed: boolean;
  /** 建议是否可以继续 */
  canProceed: boolean;
  /** 关键风险因子数量 */
  criticalFactorCount: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 管道完成事件数据（用于风险评估）
 */
export interface PipelineCompletedForRiskData {
  /** Pipeline ID */
  pipelineId: string;
  /** 运行 ID */
  runId: string;
  /** 状态 */
  status: string;
  /** 触发类型 */
  triggerType: string;
  /** Git 引用 */
  gitRef?: string;
  /** Git SHA */
  gitSha?: string;
  /** 耗时 (ms) */
  durationMs?: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 代码合并事件数据（用于风险评估）
 */
export interface CodePRMergedData {
  /** PR/MR ID */
  prId: string;
  /** 仓库 ID */
  repositoryId: string;
  /** 分支 */
  targetBranch: string;
  /** 提交 SHA */
  mergeSha?: string;
  /** 合并时间 */
  timestamp: string;
}

// ==================== 服务配置类型 ====================

/**
 * 风险评估服务配置
 */
export interface RiskAssessmentServiceConfig {
  /** EventBus 实例 */
  eventBus?: any;
  /** 流名称 */
  streamName?: string;
  /** 订阅组名称 */
  consumerGroup?: string;
  /** 风险评估阈值配置 */
  thresholds?: {
    /** 低风险上限 */
    lowMax: number;
    /** 中风险上限 */
    mediumMax: number;
    /** 高风险上限 */
    highMax: number;
  };
  /** 健康检查配置 */
  healthCheckConfig?: HealthCheckConfig;
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  /** 是否检查 Pipeline 状态 */
  checkPipelineStatus: boolean;
  /** 是否检查测试结果 */
  checkTestResults: boolean;
  /** 是否检查代码审查状态 */
  checkCodeReview: boolean;
  /** 是否检查依赖服务健康 */
  checkDependencyHealth: boolean;
  /** 是否检查回滚准备 */
  checkRollbackReadiness: boolean;
  /** 超时时间 (ms) */
  timeoutMs: number;
}

/**
 * 默认健康检查配置
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  checkPipelineStatus: true,
  checkTestResults: true,
  checkCodeReview: true,
  checkDependencyHealth: true,
  checkRollbackReadiness: true,
  timeoutMs: 30000,
};
