/**
 * FinOpsService - Business logic facade for all FinOps operations
 *
 * Delegates to specialized services:
 * - FinOpsCostCalculator: cost tracking, aggregation, cloud/k8s/saaS costs
 * - FinOpsReportGenerator: report generation and cost analysis
 * - FinOpsBudgetService: budget CRUD, ROI analysis, cost comparison
 * - FinOpsOptimizer: optimization suggestions and analysis
 * - FinOpsAlertService: budget alerts and forecasts
 *
 * Maintains backward compatibility with existing imports.
 */

import { FinOpsRepository } from './FinOpsRepository';
import { FinOpsCostCalculator } from './FinOpsCostCalculator';
import { FinOpsReportGenerator } from './FinOpsReportGenerator';
import { FinOpsBudgetService } from './FinOpsBudgetService';
import { FinOpsOptimizer } from './FinOpsOptimizer';
import { FinOpsAlertService } from './FinOpsAlertService';
import {
  CostEntityType,
  CostPeriod,
  OptimizationCategory,
  OptimizationPriority,
  OptimizationStatus,
  ResourceUtilization,
  RightSizingRecommendation,
  CloudProvider,
  CloudResourceType,
  BillingCycle,
  CostSummary,
  CostBreakdown,
  BudgetStatus,
  BudgetForecast,
} from './types';
import { createLogger } from '../../utils/logger';

export class FinOpsServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'FinOpsServiceError'; }
}

// Re-export I/O types for backward compatibility
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
  CloudCostInput,
  K8sCostInput,
  SaaSCostInput,
  SaaSCostUpdate,
  LegacyBudgetAlertInput,
} from './types';

export class FinOpsService {
  private costCalculator: FinOpsCostCalculator;
  private reportGenerator: FinOpsReportGenerator;
  private budgetService: FinOpsBudgetService;
  private optimizer: FinOpsOptimizer;
  private alertService: FinOpsAlertService;
  private repository: FinOpsRepository;
  private readonly logger = createLogger('finops-service');

  constructor(repository: FinOpsRepository) {
    this.repository = repository;
    this.costCalculator = new FinOpsCostCalculator(repository);
    this.reportGenerator = new FinOpsReportGenerator(repository);
    this.budgetService = new FinOpsBudgetService(repository);
    this.optimizer = new FinOpsOptimizer(repository);
    this.alertService = new FinOpsAlertService(repository);
  }

  // ==================== Reports ====================

  async generateReport(tenantId: string, period: string): Promise<any> {
    return this.reportGenerator.generateReport(tenantId, period);
  }

  async getReportHistory(tenantId: string, limit?: number): Promise<any[]> {
    return this.reportGenerator.getReportHistory(tenantId, limit);
  }

  async analyzeCosts(tenantId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return this.reportGenerator.analyzeCosts(tenantId, startDate, endDate);
  }

  // ==================== Cost Tracking ====================

  async trackCost(input: import('./types').CostRecordInput): Promise<any> {
    return this.costCalculator.trackCost(input);
  }

  async getCostByEntity(entityType: CostEntityType, entityId: string, period: CostPeriod = 'monthly'): Promise<EntityCostSummary> {
    return this.costCalculator.getCostByEntity(entityType, entityId, period);
  }

  async getCostTrend(entityType: CostEntityType, entityId: string, period: CostPeriod, category?: string): Promise<CostTrend> {
    return this.costCalculator.getCostTrend(entityType, entityId, period, category);
  }

  async getServiceCostTrend(serviceId: string, period: CostPeriod, category?: string): Promise<CostTrend> {
    this.logger.debug({ serviceId, period, category }, '[FinOpsService] Getting service cost trend');
    return this.costCalculator.getServiceCostTrend(serviceId, period, category);
  }

  async getChargebackReport(period: CostPeriod = 'monthly'): Promise<ChargebackReport> {
    return this.costCalculator.getChargebackReport(period);
  }

  async getAllCostRecords(filter?: { entityType?: CostEntityType; entityId?: string; category?: string }): Promise<any[]> {
    return this.costCalculator.getAllCostRecords(filter);
  }

  // ==================== Budget Management ====================

  async createBudget(input: BudgetInput): Promise<any> {
    return this.budgetService.createBudget(input);
  }

  async updateBudget(budgetId: string, input: BudgetUpdateInput): Promise<any> {
    return this.budgetService.updateBudget(budgetId, input);
  }

  async deleteBudget(budgetId: string): Promise<boolean> {
    return this.budgetService.deleteBudget(budgetId);
  }

  async getBudget(budgetId: string): Promise<any> {
    return this.budgetService.getBudget(budgetId);
  }

  async listBudgets(filter?: { entityType?: CostEntityType; entityId?: string }): Promise<any[]> {
    return this.budgetService.listBudgets(filter);
  }

  async updateEntitySpend(entityType: CostEntityType, entityId: string, amount: number): Promise<any> {
    return this.budgetService.updateEntitySpend(entityType, entityId, amount);
  }

  // ==================== ROI Analysis ====================

  async calculateROI(input: ROIInput): Promise<any> {
    return this.budgetService.calculateROI(input);
  }

  async analyzeAutomationSavings(params: {
    name: string;
    manualHoursPerMonth: number;
    hourlyRate: number;
    automationCost: number;
    automationMaintenancePerMonth?: number;
    timeSavingsPercent: number;
    description?: string;
  }): Promise<any> {
    return this.budgetService.analyzeAutomationSavings(params);
  }

  async comparePeriods(input: PeriodComparisonInput): Promise<any> {
    return this.budgetService.comparePeriods(input);
  }

  async compareCosts(tenantId: string, serviceA: string, serviceB: string, period: CostPeriod): Promise<any> {
    return this.budgetService.compareCosts(tenantId, serviceA, serviceB, period);
  }

  async getROIHistory(filter?: { investmentType?: string; minROI?: number }): Promise<any[]> {
    return this.budgetService.getROIHistory(filter);
  }

  async getCostComparisons(filter?: { period?: CostPeriod }): Promise<any[]> {
    return this.budgetService.getCostComparisons(filter);
  }

  async getROISummary(): Promise<{
    totalAnalyses: number;
    averageROI: number;
    averagePaybackMonths: number;
    totalComparisons: number;
    totalSavings: number;
  }> {
    return this.budgetService.getROISummary();
  }

  // ==================== Cost Optimization ====================

  async analyzeOptimization(utilizations: ResourceUtilization[]): Promise<any[]> {
    return this.optimizer.analyzeOptimization(utilizations);
  }

  async getRightSizingRecommendations(filter?: { tenantId?: string; environment?: string }): Promise<RightSizingRecommendation[]> {
    return this.optimizer.getRightSizingRecommendations(filter);
  }

  async detectUnusedResources(filter?: { tenantId?: string; environment?: string }): Promise<any[]> {
    return this.optimizer.detectUnusedResources(filter);
  }

  async estimateSavings(filter?: { category?: OptimizationCategory; status?: OptimizationStatus }): Promise<{
    totalMonthlySavings: number;
    totalAnnualSavings: number;
    byCategory: Record<string, number>;
    suggestionCount: number;
  }> {
    return this.optimizer.estimateSavings(filter);
  }

  async getOptimizations(query?: {
    category?: OptimizationCategory;
    priority?: OptimizationPriority;
    status?: OptimizationStatus;
    entityType?: CostEntityType;
    entityId?: string;
  }): Promise<any[]> {
    return this.optimizer.getOptimizations(query);
  }

  async getServiceOptimizationSuggestions(serviceId: string, entityType: CostEntityType = 'project'): Promise<any[]> {
    this.logger.debug({ serviceId, entityType }, '[FinOpsService] Getting service optimization suggestions');
    return this.optimizer.getServiceOptimizationSuggestions(serviceId, entityType);
  }

  async updateOptimizationStatus(optimizationId: string, status: OptimizationStatus): Promise<any> {
    return this.optimizer.updateOptimizationStatus(optimizationId, status);
  }

  async deleteOptimization(optimizationId: string): Promise<boolean> {
    return this.optimizer.deleteOptimization(optimizationId);
  }

  // ==================== Cloud Cost Collection ====================

  async collectCloudCosts(costs: import('./types').CloudCostInput[]): Promise<any[]> {
    return this.costCalculator.collectCloudCosts(costs);
  }

  async getCloudCosts(filter?: {
    provider?: CloudProvider;
    resourceType?: CloudResourceType;
    tenantId?: string;
    environment?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    return this.costCalculator.getCloudCosts(filter);
  }

  // ==================== K8s Cost Allocation ====================

  async allocateK8sCosts(costs: import('./types').K8sCostInput[]): Promise<any[]> {
    return this.costCalculator.allocateK8sCosts(costs);
  }

  async getK8sCosts(filter?: {
    namespace?: string;
    deployment?: string;
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    return this.costCalculator.getK8sCosts(filter);
  }

  async getK8sNamespaceCosts(filter?: { namespace?: string }): Promise<{ namespace: string; total_cost: number }[]> {
    return this.costCalculator.getK8sNamespaceCosts(filter);
  }

  async getK8sPodCosts(filter?: { namespace?: string; deployment?: string }): Promise<any[]> {
    return this.costCalculator.getK8sPodCosts(filter);
  }

  async getK8sTenantCosts(filter?: { tenantId?: string }): Promise<{ tenant_id: string; total_cost: number }[]> {
    return this.costCalculator.getK8sTenantCosts(filter);
  }

  // ==================== SaaS Cost Tracking ====================

  async addSaaSSubscription(input: import('./types').SaaSCostInput): Promise<any> {
    return this.costCalculator.addSaaSSubscription(input);
  }

  async updateSaaSSubscription(id: string, input: import('./types').SaaSCostUpdate): Promise<any> {
    return this.costCalculator.updateSaaSSubscription(id, input);
  }

  async deleteSaaSSubscription(id: string): Promise<boolean> {
    return this.costCalculator.deleteSaaSSubscription(id);
  }

  async getSaaSSubscriptions(filter?: { tool?: string; status?: string; tenantId?: string }): Promise<any[]> {
    return this.costCalculator.getSaaSSubscriptions(filter);
  }

  // ==================== Cost Aggregation ====================

  async getCostSummary(period: CostPeriod = 'monthly', filter?: { tenantId?: string }): Promise<CostSummary> {
    return this.costCalculator.getCostSummary(period, filter);
  }

  async getCostBreakdown(dimension: 'category' | 'tenant' | 'environment' | 'provider' | 'namespace', filter?: { tenantId?: string }): Promise<CostBreakdown[]> {
    return this.costCalculator.getCostBreakdown(dimension, filter);
  }

  async computeCostTrendFromData(dataPoints: { date: Date; cost: number }[]): Promise<any> {
    return this.costCalculator.computeCostTrendFromData(dataPoints);
  }

  // ==================== Legacy Budget Alerts ====================

  async createLegacyBudgetAlert(input: import('./types').LegacyBudgetAlertInput): Promise<any> {
    return this.alertService.createLegacyBudgetAlert(input);
  }

  async getLegacyBudgetAlerts(filter?: { tenantId?: string; environment?: string }): Promise<any[]> {
    return this.alertService.getLegacyBudgetAlerts(filter);
  }

  async deleteLegacyBudgetAlert(id: string): Promise<boolean> {
    return this.alertService.deleteLegacyBudgetAlert(id);
  }

  async checkLegacyBudgetAlerts(): Promise<any[]> {
    return this.alertService.checkLegacyBudgetAlerts();
  }

  // ==================== Alert Queries (delegated to alert service) ====================

  async checkBudgetAlerts(): Promise<any[]> {
    return this.alertService.checkBudgetAlerts();
  }

  async getBudgetStatus(budgetId: string): Promise<BudgetStatus | null> {
    return this.alertService.getBudgetStatus(budgetId);
  }

  async forecastBudget(budgetId: string): Promise<BudgetForecast | null> {
    return this.alertService.forecastBudget(budgetId);
  }

  async getAlertTriggers(filter?: { budgetId?: string; entityType?: CostEntityType }): Promise<any[]> {
    return this.alertService.getAlertTriggers(filter);
  }
}
