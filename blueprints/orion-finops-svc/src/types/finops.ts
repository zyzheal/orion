/**
 * FinOps 成本数据模型 - 类型定义
 *
 * 用于云资源成本采集、K8s 成本分摊、SaaS 工具成本跟踪等 FinOps 领域
 */

// ==================== 云资源成本 ====================

/**
 * 云资源类型
 */
export type CloudResourceType = 'compute' | 'storage' | 'network' | 'database' | 'container' | 'serverless' | 'other';

/**
 * 云服务提供商
 */
export type CloudProvider = 'aws' | 'alicloud' | 'tencent' | 'azure' | 'gcp';

/**
 * 云资源成本记录
 */
export interface CloudResource {
  /** 资源唯一 ID */
  id: string;
  /** 云服务提供商 */
  provider: CloudProvider;
  /** 资源类型 */
  resourceType: CloudResourceType;
  /** 云厂商资源 ID */
  resourceId: string;
  /** 资源名称 */
  resourceName?: string;
  /** 区域 */
  region: string;
  /** 成本金额 */
  cost: number;
  /** 货币单位 */
  currency: string;
  /** 资源标签 */
  tags: Record<string, string>;
  /** 时间戳 */
  timestamp: Date;
  /** 所属租户 ID */
  tenantId?: string;
  /** 所属环境 */
  environment?: string;
  /** 计费周期 */
  billingPeriod?: string;
}

// ==================== K8s 成本 ====================

/**
 * K8s 资源成本分配记录
 */
export interface K8sCost {
  /** 记录 ID */
  id: string;
  /** 命名空间 */
  namespace: string;
  /** 部署名称 */
  deployment: string;
  /** Pod 名称 */
  podName?: string;
  /** CPU 成本 */
  cpuCost: number;
  /** 内存成本 */
  memoryCost: number;
  /** 存储成本 */
  storageCost: number;
  /** 网络成本 */
  networkCost: number;
  /** 总成本 */
  totalCost: number;
  /** 所属租户 */
  tenantId?: string;
  /** 时间戳 */
  timestamp: Date;
  /** 集群名称 */
  clusterName?: string;
  /** 节点名称 */
  nodeName?: string;
}

// ==================== SaaS 成本 ====================

/**
 * SaaS 计费周期
 */
export type BillingCycle = 'monthly' | 'quarterly' | 'annually';

/**
 * SaaS 订阅记录
 */
export interface SaaSCost {
  /** 记录 ID */
  id: string;
  /** 工具名称 (GitLab, Jira, Slack 等) */
  tool: string;
  /** 订阅计划名称 */
  subscription: string;
  /** 席位数 */
  seats: number;
  /** 单席成本 */
  unitCost: number;
  /** 总成本 */
  totalCost: number;
  /** 计费周期 */
  billingCycle: BillingCycle;
  /** 开始日期 */
  startDate: Date;
  /** 结束日期 */
  endDate: Date;
  /** 所属租户 */
  tenantId?: string;
  /** 使用状态 */
  status: 'active' | 'cancelled' | 'expired';
  /** 额外说明 */
  notes?: string;
}

// ==================== 成本事件 ====================

/**
 * 成本事件类型
 */
export type CostEventType = 'cost.collected' | 'cost.anomaly_detected';

/**
 * 成本事件
 */
export interface CostEvent {
  /** 事件类型 */
  type: CostEventType;
  /** 事件来源 */
  source: string;
  /** 事件数据 */
  data: Record<string, any>;
  /** 时间戳 */
  timestamp: Date;
}

// ==================== 成本汇总 ====================

/**
 * 成本汇总
 */
export interface CostSummary {
  /** 总成本 */
  totalCost: number;
  /** 计算资源成本 */
  computeCost: number;
  /** 存储成本 */
  storageCost: number;
  /** 网络成本 */
  networkCost: number;
  /** SaaS 成本 */
  saasCost: number;
  /** 统计周期 */
  period: CostPeriod;
  /** 货币单位 */
  currency: string;
  /** 所属租户 */
  tenantId?: string;
}

/**
 * 成本统计周期
 */
export type CostPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// ==================== 成本分解 ====================

/**
 * 成本分解维度
 */
export interface CostBreakdown {
  /** 维度类型 */
  dimension: 'category' | 'tenant' | 'environment' | 'provider' | 'namespace';
  /** 维度值 */
  dimensionValue: string;
  /** 成本金额 */
  cost: number;
  /** 占总成本的百分比 */
  percentage: number;
  /** 明细记录数 */
  recordCount: number;
}

// ==================== 成本趋势 ====================

/**
 * 成本趋势数据点
 */
export interface CostTrendPoint {
  /** 时间点 */
  date: Date;
  /** 成本金额 */
  cost: number;
  /** 较前一时间点的变化率（百分比） */
  changeRate: number;
}

/**
 * 成本趋势分析结果
 */
export interface CostTrend {
  /** 趋势数据点 */
  points: CostTrendPoint[];
  /** 总趋势（起始到结束的变化率） */
  overallChangeRate: number;
  /** 平均成本 */
  averageCost: number;
  /** 最高成本 */
  maxCost: number;
  /** 最低成本 */
  minCost: number;
}

// ==================== 预算告警 ====================

/**
 * 预算告警配置
 */
export interface BudgetAlert {
  /** 告警 ID */
  id: string;
  /** 租户 ID */
  tenantId?: string;
  /** 环境 */
  environment?: string;
  /** 预算金额 */
  budgetAmount: number;
  /** 告警阈值（百分比） */
  thresholdPercent: number;
  /** 当前已用金额 */
  currentSpend: number;
  /** 货币单位 */
  currency: string;
  /** 统计周期 */
  period: CostPeriod;
  /** 是否已触发 */
  triggered: boolean;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 预算告警事件
 */
export interface BudgetAlertEvent {
  /** 告警 ID */
  alertId: string;
  /** 租户 ID */
  tenantId?: string;
  /** 预算金额 */
  budgetAmount: number;
  /** 当前花费 */
  currentSpend: number;
  /** 使用率（百分比） */
  usagePercent: number;
  /** 阈值（百分比） */
  thresholdPercent: number;
  /** 触发时间 */
  triggeredAt: Date;
}

// ==================== 云厂商适配器 ====================

/**
 * 云厂商成本采集适配器接口
 */
export interface ICloudCostAdapter {
  /** 提供商名称 */
  provider: CloudProvider;

  /**
   * 采集成本数据
   * @param startDate 开始日期
   * @param endDate 结束日期
   */
  collectCosts(startDate: Date, endDate: Date): Promise<CloudResource[]>;

  /**
   * 获取提供商状态
   */
  getStatus(): Promise<{ connected: boolean; lastSync?: Date }>;
}

// ==================== 成本采集调度 ====================

/**
 * 成本采集任务配置
 */
export interface CostCollectionSchedule {
  /** 提供商 */
  provider: CloudProvider;
  /** Cron 表达式 */
  cronExpression: string;
  /** 是否启用 */
  enabled: boolean;
  /** 上次采集时间 */
  lastCollectedAt?: Date;
  /** 上次采集状态 */
  lastStatus?: 'success' | 'failed';
}

// ==================== TASK-502: 成本追踪与 ROI ====================

/**
 * 实体类型（用于成本追踪）
 */
export type CostEntityType = 'project' | 'tenant' | 'team';

/**
 * 成本预算
 *
 * 按项目/租户/团队配置预算，用于成本追踪和告警
 */
export interface CostBudget {
  /** 预算 ID */
  id: string;
  /** 实体类型 */
  entityType: CostEntityType;
  /** 实体 ID（项目 ID、租户 ID、团队 ID） */
  entityId: string;
  /** 预算金额 */
  amount: number;
  /** 预算周期 */
  period: CostPeriod;
  /** 货币单位 */
  currency: string;
  /** 告警阈值配置（百分比） */
  alerts: BudgetThreshold[];
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt?: Date;
  /** 所属环境 */
  environment?: string;
  /** 描述 */
  description?: string;
}

/**
 * 预算阈值配置
 */
export interface BudgetThreshold {
  /** 阈值 ID */
  id: string;
  /** 阈值百分比（如 80 表示 80%） */
  percentage: number;
  /** 是否已触发 */
  triggered: boolean;
  /** 触发时间 */
  triggeredAt?: Date;
}

/**
 * 预算告警触发记录
 */
export interface BudgetAlertTrigger {
  /** 告警 ID */
  id: string;
  /** 关联预算 ID */
  budgetId: string;
  /** 阈值百分比 */
  threshold: number;
  /** 实际花费 */
  actual: number;
  /** 使用率百分比 */
  percentage: number;
  /** 触发时间 */
  triggeredAt: Date;
  /** 实体类型 */
  entityType: CostEntityType;
  /** 实体 ID */
  entityId: string;
}

/**
 * ROI 分析结果
 *
 * 用于评估基础设施投资、自动化节省等
 */
export interface ROIAnalysis {
  /** 分析 ID */
  id: string;
  /** 投资类型 */
  investmentType: ROIInvestmentType;
  /** 投资名称 */
  name: string;
  /** 投资成本 */
  cost: number;
  /** 节省金额 */
  savings: number;
  /** 分析周期 */
  period: CostPeriod;
  /** ROI 百分比 */
  roiPercentage: number;
  /** 回本周期（月） */
  paybackMonths: number;
  /** 分析时间 */
  analyzedAt: Date;
  /** 描述 */
  description?: string;
  /** 详细数据 */
  details?: Record<string, any>;
}

/**
 * 投资类型
 */
export type ROIInvestmentType = 'infrastructure' | 'automation' | 'tooling' | 'training' | 'migration';

/**
 * 前后成本对比
 */
export interface CostComparison {
  /** 对比 ID */
  id: string;
  /** 描述 */
  description: string;
  /** 自动化/变更前成本 */
  beforeCost: number;
  /** 自动化/变更后成本 */
  afterCost: number;
  /** 节省金额 */
  savings: number;
  /** 节省百分比 */
  savingsPercent: number;
  /** 时间节省（小时/月） */
  timeSavingsHours?: number;
  /** 分析周期 */
  period: CostPeriod;
}

/**
 * 成本优化建议
 */
export interface CostOptimization {
  /** 建议 ID */
  id: string;
  /** 优化类别 */
  category: OptimizationCategory;
  /** 描述 */
  description: string;
  /** 预估节省金额（月） */
  estimatedSavings: number;
  /** 实施工作量（人天） */
  effort: number;
  /** 优先级 */
  priority: OptimizationPriority;
  /** 状态 */
  status: OptimizationStatus;
  /** 关联资源 ID */
  resourceIds?: string[];
  /** 关联租户/项目 */
  entityId?: string;
  /** 实体类型 */
  entityType?: CostEntityType;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt?: Date;
  /** 额外说明 */
  notes?: string;
}

/**
 * 优化类别
 */
export type OptimizationCategory = 'right-sizing' | 'unused-resources' | 'reserved-instances' | 'storage-optimization' | 'network-optimization' | 'scheduling' | 'architecture';

/**
 * 优化优先级
 */
export type OptimizationPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * 优化状态
 */
export type OptimizationStatus = 'identified' | 'reviewing' | 'approved' | 'in-progress' | 'completed' | 'rejected';

/**
 * 资源利用率
 */
export interface ResourceUtilization {
  /** 资源 ID */
  resourceId: string;
  /** 资源类型 */
  resourceType: string;
  /** 资源名称 */
  resourceName: string;
  /** CPU 使用率（百分比） */
  cpuUtilization: number;
  /** 内存使用率（百分比） */
  memoryUtilization: number;
  /** 存储使用率（百分比） */
  storageUtilization: number;
  /** 当前月成本 */
  monthlyCost: number;
  /** 所属租户 */
  tenantId?: string;
  /** 所属环境 */
  environment?: string;
}

/**
 * 资源调整大小建议
 */
export interface RightSizingRecommendation {
  /** 建议 ID */
  id: string;
  /** 资源 ID */
  resourceId: string;
  /** 资源类型 */
  resourceType: string;
  /** 当前配置 */
  currentSpec: Record<string, any>;
  /** 推荐配置 */
  recommendedSpec: Record<string, any>;
  /** 当前月成本 */
  currentCost: number;
  /** 预估月成本 */
  estimatedCost: number;
  /** 预估月节省 */
  estimatedSavings: number;
  /** 理由 */
  reason: string;
  /** 所属租户 */
  tenantId?: string;
}
