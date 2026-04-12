/**
 * FinOps 模块导出
 */

// 类型
export * from './types';

// 服务 - TASK-501
export { CloudCostCollector } from './CloudCostCollector';
export { K8sCostAllocator } from './K8sCostAllocator';
export { SaaSCostTracker } from './SaaSCostTracker';
export { CostEventPublisher } from './CostEventPublisher';
export { CostService } from './CostService';

// 服务 - TASK-502
export { CostTrackingService } from './CostTrackingService';
export { ROIAnalyzer } from './ROIAnalyzer';
export { BudgetService } from './BudgetService';
export { CostOptimizer } from './CostOptimizer';

// 辅助类型
export type {
  ClusterResourceUsage,
  PodResourceUsage,
  NamespaceCostSummary,
} from './K8sCostAllocator';

export type {
  SaaSSubscriptionUpdate,
} from './SaaSCostTracker';

export type {
  CostEventPublisherConfig,
  CostCollectedEventData,
  CostAnomalyEventData,
  IEventBus,
} from './CostEventPublisher';

// TASK-502 辅助类型
export type {
  EntityCostSummary,
  ChargebackReport,
  CostTrendQuery,
} from './CostTrackingService';

export type {
  ROIInput,
  PeriodComparisonInput,
} from './ROIAnalyzer';

export type {
  BudgetStatus,
  BudgetForecast,
  CreateBudgetParams,
  UpdateBudgetParams,
} from './BudgetService';

export type {
  OptimizationQuery,
} from './CostOptimizer';
