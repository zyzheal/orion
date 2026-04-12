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
