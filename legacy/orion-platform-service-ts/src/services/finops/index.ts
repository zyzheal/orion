// @ts-nocheck
/**
 * FinOps 模块导出
 */

// Database-backed services (NEW - PostgreSQL Repository pattern)
export { FinOpsRepository, FinOpsReport, ResourceCost, CloudCostRecord, K8sCostRecord, SaaSCostRecord, LegacyBudgetAlertRecord } from './FinOpsRepository';
export { FinOpsService, FinOpsServiceError } from './FinOpsService';

// Specialized FinOps services (extracted from FinOpsService for single responsibility)
export { FinOpsCostCalculator } from './FinOpsCostCalculator';
export { FinOpsReportGenerator } from './FinOpsReportGenerator';
export { FinOpsOptimizer } from './FinOpsOptimizer';
export { FinOpsAlertService } from './FinOpsAlertService';

// FinOpsService input/output types
export type {
  CostRecordInput,
  BudgetInput,
  BudgetUpdateInput,
  ROIInput,
  PeriodComparisonInput,
  EntityCostSummary,
  ChargebackReport,
  CostTrend,
  CostTrendPoint,
  BudgetStatus,
  BudgetForecast,
  CloudCostInput,
  K8sCostInput,
  SaaSCostInput,
  SaaSCostUpdate,
  LegacyBudgetAlertInput,
} from './FinOpsService';

// FinOpsOptimizer types
export type { OptimizationQuery } from './FinOpsOptimizer';

// Legacy in-memory services (kept for backward compatibility, will be deprecated)
export { CloudCostCollector } from './CloudCostCollector';
export { K8sCostAllocator } from './K8sCostAllocator';
export { SaaSCostTracker } from './SaaSCostTracker';
export { CostEventPublisher } from './CostEventPublisher';
export { CostService } from './CostService';

export { CostTrackingService } from './CostTrackingService';
export { ROIAnalyzer } from './ROIAnalyzer';
export { BudgetService } from './BudgetService';
export { CostOptimizer } from './CostOptimizer';

// Shared types
export * from './types';
