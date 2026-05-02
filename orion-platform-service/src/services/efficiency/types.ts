/**
 * 效能数据模型 - DORA 指标相关类型定义
 *
 * 用于效能洞察域的指标计算与聚合
 */

// ==================== 时间窗口类型 ====================

/**
 * 聚合时间窗口
 */
export type TimeWindow = 'day' | 'week' | 'month' | 'quarter';

/**
 * 时间窗口配置
 */
export interface TimeWindowConfig {
  /** 窗口类型 */
  window: TimeWindow;
  /** 窗口大小（如 1 天、2 周） */
  size: number;
  /** 窗口起始时间 */
  start: Date;
  /** 窗口结束时间 */
  end: Date;
}

// ==================== DORA 指标定义 ====================

/**
 * 部署频率 (Deployment Frequency)
 * 单位时间内成功部署到生产环境的次数
 */
export interface DeploymentFrequency {
  /** 时间窗口 */
  window: TimeWindowConfig;
  /** 部署总次数 */
  totalDeployments: number;
  /** 成功部署次数 */
  successfulDeployments: number;
  /** 失败部署次数 */
  failedDeployments: number;
  /** 日均部署次数 */
  deploymentsPerDay: number;
  /** 部署频率等级 */
  frequencyLevel: 'on-demand' | 'daily' | 'weekly' | 'monthly' | 'yearly';
}

/**
 * 变更前置时间 (Lead Time for Changes)
 * 从代码提交到成功部署到生产环境的平均时间
 */
export interface LeadTimeForChanges {
  /** 时间窗口 */
  window: TimeWindowConfig;
  /** 变更总数 */
  totalChanges: number;
  /** 平均前置时间（毫秒） */
  averageLeadTimeMs: number;
  /** 中位数前置时间（毫秒） */
  medianLeadTimeMs: number;
  /** P90 前置时间（毫秒） */
  p90LeadTimeMs: number;
  /** P99 前置时间（毫秒） */
  p99LeadTimeMs: number;
  /** 前置时间等级 */
  leadTimeLevel: 'elite' | 'high' | 'medium' | 'low';
  /** 计算方法：commit_to_deploy（真实）或 pipeline_duration（近似） */
  calculationMethod?: 'commit_to_deploy' | 'pipeline_duration';
}

/**
 * 变更失败率 (Change Failure Rate)
 * 部署到生产环境后导致服务降级或需要热修复的百分比
 */
export interface ChangeFailureRate {
  /** 时间窗口 */
  window: TimeWindowConfig;
  /** 部署总次数 */
  totalDeployments: number;
  /** 失败部署次数 */
  failedDeployments: number;
  /** 变更失败率（0-100） */
  failureRate: number;
  /** 失败率等级 */
  failureRateLevel: 'elite' | 'high' | 'medium' | 'low';
  /** 失败详情 */
  failureDetails: DeploymentFailureRecord[];
}

/**
 * 部署失败记录
 */
export interface DeploymentFailureRecord {
  /** 部署 ID */
  deploymentId: string;
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment: string;
  /** 失败时间 */
  failedAt: Date;
  /** 失败原因 */
  reason?: string;
  /** 恢复时间（毫秒，如果已恢复） */
  recoveryTimeMs?: number;
}

/**
 * 平均恢复时间 (Mean Time to Recovery)
 * 服务发生故障后恢复到正常状态的平均时间
 */
export interface MeanTimeToRecovery {
  /** 时间窗口 */
  window: TimeWindowConfig;
  /** 故障总数 */
  totalIncidents: number;
  /** 已恢复的故障数 */
  recoveredIncidents: number;
  /** 平均恢复时间（毫秒） */
  averageRecoveryTimeMs: number;
  /** 中位数恢复时间（毫秒） */
  medianRecoveryTimeMs: number;
  /** P90 恢复时间（毫秒） */
  p90RecoveryTimeMs: number;
  /** 恢复时间等级 */
  recoveryTimeLevel: 'elite' | 'high' | 'medium' | 'low';
}

// ==================== 综合效能报告 ====================

/**
 * DORA 四项指标的综合报告
 */
export interface DoraMetricsReport {
  /** 报告 ID */
  reportId: string;
  /** 租户 ID */
  tenantId: string;
  /** 时间窗口 */
  window: TimeWindowConfig;
  /** 部署频率 */
  deploymentFrequency: DeploymentFrequency;
  /** 变更前置时间 */
  leadTimeForChanges: LeadTimeForChanges;
  /** 变更失败率 */
  changeFailureRate: ChangeFailureRate;
  /** 平均恢复时间 */
  meanTimeToRecovery: MeanTimeToRecovery;
  /** 综合效能等级 */
  overallLevel: 'elite' | 'high' | 'medium' | 'low';
  /** 报告生成时间 */
  generatedAt: Date;
}

// ==================== 效能聚合记录 ====================

/**
 * Pipeline 完成事件记录（本地存储）
 */
export interface PipelineCompletionRecord {
  /** 记录 ID */
  id: string;
  /** Pipeline 执行 ID */
  runId: string;
  /** Pipeline ID */
  pipelineId: string;
  /** 状态 */
  status: 'success' | 'failed';
  /** 触发类型 */
  triggerType: string;
  /** Git 引用 */
  gitRef?: string;
  /** Git SHA */
  gitSha?: string;
  /** 执行耗时（毫秒） */
  durationMs: number;
  /** 完成时间 */
  completedAt: Date;
  /** 租户 ID */
  tenantId?: string;
  /** 是否已同步到 ClickHouse */
  syncedToClickHouse: boolean;
  /** 同步时间 */
  syncedAt?: Date;
}

/**
 * 部署事件记录（本地存储）
 */
export interface DeploymentRecord {
  /** 记录 ID */
  id: string;
  /** 部署 ID */
  deploymentId: string;
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment: string;
  /** 状态 */
  status: 'success' | 'failed' | 'rolled_back';
  /** 版本 */
  version?: string;
  /** 部署耗时（毫秒） */
  durationMs?: number;
  /** 部署时间 */
  deployedAt: Date;
  /** 恢复时间（如果是回滚） */
  recoveryTimeMs?: number;
  /** 租户 ID */
  tenantId?: string;
  /** Commit SHA */
  commitSha?: string;
  /** Commit 提交时间（用于精确 Lead Time 计算） */
  commitCommittedAt?: Date;
  /** 是否已同步到 ClickHouse */
  syncedToClickHouse: boolean;
  /** 同步时间 */
  syncedAt?: Date;
}

// ==================== ClickHouse 表结构 ====================

/**
 * ClickHouse 效能指标表行
 */
export interface EfficiencyMetricsRow {
  /** 记录 ID */
  id: string;
  /** 租户 ID */
  tenant_id: string;
  /** 指标类型 */
  metric_type: 'deployment_frequency' | 'lead_time' | 'failure_rate' | 'recovery_time';
  /** 时间窗口类型 */
  window_type: string;
  /** 窗口起始时间 */
  window_start: string;
  /** 窗口结束时间 */
  window_end: string;
  /** 指标值（JSON 格式） */
  metric_value: string;
  /** 创建时间 */
  created_at: string;
}

/**
 * ClickHouse 原始事件表行
 */
export interface EfficiencyEventRow {
  /** 记录 ID */
  id: string;
  /** 租户 ID */
  tenant_id: string;
  /** 事件类型 */
  event_type: string;
  /** 事件数据（JSON 格式） */
  event_data: string;
  /** 事件时间 */
  event_time: string;
  /** 创建时间 */
  created_at: string;
}

// ==================== ClickHouse 同步状态 ====================

/**
 * ClickHouse 同步状态
 */
export interface ClickHouseSyncStatus {
  /** 是否已连接 */
  connected: boolean;
  /** 表是否已创建 */
  tablesCreated: boolean;
  /** 待同步记录数 */
  pendingRecords: number;
  /** 上次同步时间 */
  lastSyncAt?: Date;
  /** 上次同步错误 */
  lastError?: string;
  /** 累计同步失败次数 */
  consecutiveFailures: number;
}
