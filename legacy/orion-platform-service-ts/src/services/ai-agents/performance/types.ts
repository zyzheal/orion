/**
 * 性能优化 Agent 类型定义
 *
 * 涵盖性能指标分析、优化建议、瓶颈识别等场景
 */

/**
 * 性能指标数据
 */
export interface PerformanceMetrics {
  /** CPU 使用率 (%) */
  cpuUsage?: number;
  /** 内存使用率 (%) */
  memoryUsage?: number;
  /** 内存使用量 (bytes) */
  memoryUsed?: number;
  /** 磁盘使用率 (%) */
  diskUsage?: number;
  /** 网络接收 bytes */
  networkBytesRecv?: number;
  /** 网络发送 bytes */
  networkBytesSent?: number;
  /** 负载 (1分钟) */
  load1m?: number;
  /** 负载 (5分钟) */
  load5m?: number;
  /** 负载 (15分钟) */
  load15m?: number;
  /** 响应时间 (ms) */
  responseTime?: number;
  /** 错误率 (%) */
  errorRate?: number;
  /** 吞吐量 (req/s) */
  throughput?: number;
  /** 活跃连接数 */
  activeConnections?: number;
  /** 数据库查询时间 (ms) */
  dbQueryTime?: number;
  /** 数据库连接池使用率 (%) */
  dbPoolUsage?: number;
  /** 缓存命中率 (%) */
  cacheHitRate?: number;
  /** 自定义指标 */
  customMetrics?: Record<string, number>;
  /** 指标收集时间 */
  timestamp?: string;
  /** 主机/服务标识 */
  host?: string;
}

/**
 * 性能分析输入
 */
export interface PerformanceAnalysisInput {
  /** 输入类型 */
  type: 'metrics' | 'bottleneck' | 'capacity' | 'trend';
  /** 性能指标数据 */
  metrics: PerformanceMetrics;
  /** 历史指标（用于趋势分析） */
  historicalMetrics?: PerformanceMetrics[];
  /** 服务/应用名称 */
  serviceName?: string;
  /** 环境 */
  environment?: string;
  /** 期望的性能目标 */
  performanceTargets?: PerformanceTargets;
  /** 时间范围 */
  timeRange?: {
    start: string;
    end: string;
  };
}

/**
 * 性能目标
 */
export interface PerformanceTargets {
  /** 目标响应时间 (ms) */
  responseTimeMs?: number;
  /** 目标吞吐量 (req/s) */
  throughput?: number;
  /** 目标错误率 (%) */
  errorRatePercent?: number;
  /** 目标 CPU 使用率 (%) */
  cpuUsagePercent?: number;
  /** 目标内存使用率 (%) */
  memoryUsagePercent?: number;
  /** 目标可用性 (%) */
  availabilityPercent?: number;
}

/**
 * 性能分析结果
 */
export interface PerformanceAnalysisResult {
  /** 分析 ID */
  analysisId: string;
  /** 输入类型 */
  inputType: 'metrics' | 'bottleneck' | 'capacity' | 'trend';
  /** 分析摘要 */
  summary: string;
  /** 整体健康评分 (0-100) */
  healthScore: number;
  /** 识别的性能问题 */
  issues: PerformanceIssue[];
  /** 优化建议 */
  recommendations: OptimizationRecommendation[];
  /** 资源使用分析 */
  resourceAnalysis: ResourceAnalysis;
  /** 趋势分析（如果有历史数据） */
  trendAnalysis?: TrendAnalysis;
  /** AI 生成的详细报告 */
  detailedReport?: string;
  /** 分析完成时间 */
  analyzedAt: string;
  /** 分析耗时 (ms) */
  analysisDurationMs: number;
}

/**
 * 性能问题
 */
export interface PerformanceIssue {
  /** 问题 ID */
  id: string;
  /** 问题类型 */
  type: PerformanceIssueType;
  /** 严重程度 */
  severity: 'critical' | 'warning' | 'info';
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 受影响的指标 */
  affectedMetrics: string[];
  /** 当前值 */
  currentValue?: number;
  /** 阈值/期望值 */
  threshold?: number;
  /** 与问题的相关性分数 */
  relevanceScore?: number;
}

/**
 * 性能问题类型
 */
export type PerformanceIssueType =
  | 'high_cpu'
  | 'high_memory'
  | 'high_disk'
  | 'high_latency'
  | 'high_error_rate'
  | 'low_throughput'
  | 'connection_exhaustion'
  | 'db_slow_query'
  | 'db_connection_pool_exhaustion'
  | 'cache_miss'
  | 'network_bottleneck'
  | 'resource_contention'
  | 'capacity_limit'
  | 'degradation_trend'
  | 'unknown';

/**
 * 优化建议
 */
export interface OptimizationRecommendation {
  /** 建议 ID */
  id: string;
  /** 建议类型 */
  type: OptimizationType;
  /** 优先级 */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 预期改进 */
  expectedImprovement: string;
  /** 实施难度 */
  implementationEffort: 'low' | 'medium' | 'high';
  /** 相关命令（可选） */
  commands?: string[];
  /** 相关配置变更（可选） */
  configChanges?: ConfigChange[];
  /** 关联的问题 ID */
  relatedIssueIds?: string[];
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high';
  /** 回滚计划（可选） */
  rollbackPlan?: string;
}

/**
 * 优化类型
 */
export type OptimizationType =
  | 'scale_up'
  | 'scale_out'
  | 'cache_optimization'
  | 'query_optimization'
  | 'connection_pool_tuning'
  | 'resource_limit_adjustment'
  | 'load_balancing'
  | 'code_optimization'
  | 'infrastructure_upgrade'
  | 'configuration_tuning';

/**
 * 配置变更
 */
export interface ConfigChange {
  /** 配置文件路径 */
  configPath: string;
  /** 配置项 */
  key: string;
  /** 当前值 */
  currentValue: string | number | boolean;
  /** 建议值 */
  newValue: string | number | boolean;
  /** 原因 */
  reason: string;
}

/**
 * 资源分析
 */
export interface ResourceAnalysis {
  /** CPU 分析 */
  cpu: ResourceMetricAnalysis;
  /** 内存分析 */
  memory: ResourceMetricAnalysis;
  /** 磁盘分析 */
  disk: ResourceMetricAnalysis;
  /** 网络分析 */
  network: ResourceMetricAnalysis;
  /** 数据库分析（可选） */
  database?: ResourceMetricAnalysis;
  /** 缓存分析（可选） */
  cache?: ResourceMetricAnalysis;
}

/**
 * 单项资源指标分析
 */
export interface ResourceMetricAnalysis {
  /** 当前使用量 */
  currentValue: number;
  /** 最大容量 */
  maxValue: number;
  /** 使用率 (%) */
  usagePercent: number;
  /** 状态 */
  status: 'healthy' | 'warning' | 'critical';
  /** 分析说明 */
  analysis: string;
  /** 峰值 */
  peak?: number;
  /** 平均值 */
  average?: number;
}

/**
 * 趋势分析
 */
export interface TrendAnalysis {
  /** 趋势方向 */
  direction: 'improving' | 'stable' | 'degrading';
  /** 变化率 */
  changeRate: number;
  /** 预测 */
  predictions: TrendPrediction[];
  /** 分析说明 */
  analysis: string;
}

/**
 * 趋势预测
 */
export interface TrendPrediction {
  /** 预测时间 */
  timestamp: string;
  /** 预测指标 */
  metric: string;
  /** 预测值 */
  predictedValue: number;
  /** 置信度 */
  confidence: number;
}

/**
 * 性能优化 Agent 配置
 */
export interface PerfOptAgentConfig {
  /** 是否启用自动问题检测 */
  enableAutoDetection: boolean;
  /** 是否启用自动优化建议 */
  enableAutoRecommendations: boolean;
  /** 最大问题数 */
  maxIssues: number;
  /** 最大建议数 */
  maxRecommendations: number;
  /** 指标分析超时 (ms) */
  analysisTimeoutMs: number;
  /** 关键阈值配置 */
  thresholds?: PerformanceThresholds;
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
  /** CPU 警告阈值 (%) */
  cpuWarningPercent?: number;
  /** CPU 危险阈值 (%) */
  cpuCriticalPercent?: number;
  /** 内存警告阈值 (%) */
  memoryWarningPercent?: number;
  /** 内存危险阈值 (%) */
  memoryCriticalPercent?: number;
  /** 响应时间警告阈值 (ms) */
  responseTimeWarningMs?: number;
  /** 响应时间危险阈值 (ms) */
  responseTimeCriticalMs?: number;
  /** 错误率警告阈值 (%) */
  errorRateWarningPercent?: number;
  /** 错误率危险阈值 (%) */
  errorRateCriticalPercent?: number;
}

/**
 * 性能优化历史记录
 */
export interface PerformanceAnalysisRecord {
  /** 分析 ID */
  analysisId: string;
  /** 输入摘要 */
  inputSummary: string;
  /** 健康评分 */
  healthScore: number;
  /** 问题数量 */
  issueCount: number;
  /** 建议数量 */
  recommendationCount: number;
  /** 分析时间 */
  analyzedAt: Date;
  /** 执行上下文 */
  context: {
    userId: string;
    tenantId: string;
    traceId: string;
  };
}