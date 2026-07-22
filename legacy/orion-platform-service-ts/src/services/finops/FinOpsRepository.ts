/**
 * FinOpsRepository - Database layer for all FinOps operations
 *
 * Covers: cost tracking, budgets, ROI analyses, optimizations, reports
 */
import { CostEntityType, CostPeriod, CostBudget, BudgetAlertTrigger, ROIAnalysis, CostComparison, CostOptimization, OptimizationCategory, OptimizationPriority, OptimizationStatus, CloudProvider, CloudResourceType, BillingCycle } from './types';
import { DatabasePool } from '../database';

// ==================== Domain interfaces ====================

export interface FinOpsReport {
  id: string;
  tenant_id: string;
  period: string;
  total_cost: number;
  breakdown: Record<string, number>;
  created_at: Date;
}

export interface ResourceCost {
  id: string;
  tenant_id: string;
  resource_id: string;
  service: string;
  cost: number;
  date: Date;
}

export interface EntityCostRecord {
  id: string;
  entity_type: CostEntityType;
  entity_id: string;
  amount: number;
  category: string;
  timestamp: Date;
  environment?: string;
  tags?: Record<string, string>;
  currency: string;
}

export interface BudgetRecord {
  id: string;
  entity_type: CostEntityType;
  entity_id: string;
  amount: number;
  period: CostPeriod;
  currency: string;
  alerts: Record<string, any>[];
  environment?: string;
  description?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface AlertTriggerRecord {
  id: string;
  budget_id: string;
  threshold: number;
  actual: number;
  percentage: number;
  triggered_at: Date;
  entity_type: CostEntityType;
  entity_id: string;
}

export interface SpendRecord {
  id: string;
  entity_type: CostEntityType;
  entity_id: string;
  amount: number;
  recorded_at: Date;
}

export interface ROIAnalysisRecord {
  id: string;
  investment_type: string;
  name: string;
  cost: number;
  savings: number;
  period: CostPeriod;
  roi_percentage: number;
  payback_months: number;
  analyzed_at: Date;
  description?: string;
  details?: Record<string, any>;
}

export interface CostComparisonRecord {
  id: string;
  description: string;
  before_cost: number;
  after_cost: number;
  savings: number;
  savings_percent: number;
  time_savings_hours?: number;
  period: CostPeriod;
}

export interface CostOptimizationRecord {
  id: string;
  category: OptimizationCategory;
  description: string;
  estimated_savings: number;
  effort: number;
  priority: OptimizationPriority;
  status: OptimizationStatus;
  resource_ids?: string[];
  entity_id?: string;
  entity_type?: CostEntityType;
  created_at: Date;
  updated_at?: Date;
  notes?: string;
}

// Additional interfaces for cloud/K8s/SaaS/budget-alert persistence

export interface CloudCostRecord {
  id: string;
  provider: CloudProvider;
  resource_type: CloudResourceType;
  resource_id: string;
  resource_name?: string;
  region: string;
  cost: number;
  currency: string;
  tags?: Record<string, string>;
  timestamp: Date;
  tenant_id?: string;
  environment?: string;
  billing_period?: string;
}

export interface K8sCostRecord {
  id: string;
  namespace: string;
  deployment: string;
  pod_name?: string;
  cpu_cost: number;
  memory_cost: number;
  storage_cost: number;
  network_cost: number;
  total_cost: number;
  tenant_id?: string;
  timestamp: Date;
  cluster_name?: string;
  node_name?: string;
}

export interface SaaSCostRecord {
  id: string;
  tool: string;
  subscription: string;
  seats: number;
  unit_cost: number;
  total_cost: number;
  billing_cycle: BillingCycle;
  start_date: Date;
  end_date: Date;
  tenant_id?: string;
  status: 'active' | 'cancelled' | 'expired';
  notes?: string;
}

export interface LegacyBudgetAlertRecord {
  id: string;
  tenant_id?: string;
  environment?: string;
  budget_amount: number;
  threshold_percent: number;
  current_spend: number;
  currency: string;
  period: CostPeriod;
  triggered: boolean;
  created_at: Date;
}

export class FinOpsRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Reports ====================

  async createReport(tenantId: string, period: string, totalCost: number, breakdown: Record<string, number>): Promise<FinOpsReport> {
    const result = await this.pool.query(
      'INSERT INTO finops_reports (tenant_id, period, total_cost, breakdown) VALUES ($1, $2, $3, $4) RETURNING *',
      [tenantId, period, totalCost, breakdown]
    );
    return result.rows[0];
  }

  async getReports(tenantId: string, limit: number = 12): Promise<FinOpsReport[]> {
    return (await this.pool.query(
      'SELECT * FROM finops_reports WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [tenantId, limit]
    )).rows;
  }

  async getResourceCosts(tenantId: string, startDate: Date, endDate: Date): Promise<ResourceCost[]> {
    return (await this.pool.query(
      'SELECT * FROM resource_costs WHERE tenant_id = $1 AND date >= $2 AND date <= $3',
      [tenantId, startDate, endDate]
    )).rows;
  }

  // ==================== Cost Tracking ====================

  async insertCostRecord(record: {
    entityType: CostEntityType;
    entityId: string;
    amount: number;
    category: string;
    environment?: string;
    tags?: Record<string, string>;
    currency: string;
    timestamp?: Date;
  }): Promise<EntityCostRecord> {
    const ts = record.timestamp || new Date();
    const result = await this.pool.query(
      `INSERT INTO finops_cost_records (entity_type, entity_id, amount, category, environment, tags, currency, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [record.entityType, record.entityId, record.amount, record.category, record.environment || null, record.tags || null, record.currency, ts]
    );
    return result.rows[0];
  }

  async getCostByEntity(entityType: CostEntityType, entityId: string, startDate: Date, endDate: Date): Promise<EntityCostRecord[]> {
    return (await this.pool.query(
      'SELECT * FROM finops_cost_records WHERE entity_type = $1 AND entity_id = $2 AND timestamp >= $3 AND timestamp <= $4 ORDER BY timestamp DESC',
      [entityType, entityId, startDate, endDate]
    )).rows;
  }

  async getAllCostRecords(filter?: { entityType?: CostEntityType; entityId?: string; category?: string }): Promise<EntityCostRecord[]> {
    let sql = 'SELECT * FROM finops_cost_records WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.entityType) {
      sql += ` AND entity_type = $${paramIdx++}`;
      params.push(filter.entityType);
    }
    if (filter?.entityId) {
      sql += ` AND entity_id = $${paramIdx++}`;
      params.push(filter.entityId);
    }
    if (filter?.category) {
      sql += ` AND category = $${paramIdx++}`;
      params.push(filter.category);
    }
    sql += ' ORDER BY timestamp DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  // ==================== Budgets ====================

  async createBudget(budget: {
    entityType: CostEntityType;
    entityId: string;
    amount: number;
    period: CostPeriod;
    currency: string;
    alerts: any[];
    environment?: string;
    description?: string;
  }): Promise<BudgetRecord> {
    const result = await this.pool.query(
      `INSERT INTO finops_budgets (entity_type, entity_id, amount, period, currency, alerts, environment, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [budget.entityType, budget.entityId, budget.amount, budget.period, budget.currency, JSON.stringify(budget.alerts), budget.environment || null, budget.description || null]
    );
    return result.rows[0];
  }

  async updateBudget(budgetId: string, updates: {
    amount?: number;
    period?: CostPeriod;
    alerts?: any[];
    environment?: string;
    description?: string;
  }): Promise<BudgetRecord | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (updates.amount !== undefined) { sets.push(`amount = $${paramIdx++}`); params.push(updates.amount); }
    if (updates.period !== undefined) { sets.push(`period = $${paramIdx++}`); params.push(updates.period); }
    if (updates.alerts !== undefined) { sets.push(`alerts = $${paramIdx++}`); params.push(JSON.stringify(updates.alerts)); }
    if (updates.environment !== undefined) { sets.push(`environment = $${paramIdx++}`); params.push(updates.environment); }
    if (updates.description !== undefined) { sets.push(`description = $${paramIdx++}`); params.push(updates.description); }
    sets.push(`updated_at = NOW()`);

    if (sets.length <= 1) return null; // only updated_at

    params.push(budgetId);
    const sql = `UPDATE finops_budgets SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] || null;
  }

  async deleteBudget(budgetId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM finops_budgets WHERE id = $1', [budgetId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getBudget(budgetId: string): Promise<BudgetRecord | null> {
    const result = await this.pool.query('SELECT * FROM finops_budgets WHERE id = $1', [budgetId]);
    return result.rows[0] || null;
  }

  async listBudgets(filter?: { entityType?: CostEntityType; entityId?: string }): Promise<BudgetRecord[]> {
    let sql = 'SELECT * FROM finops_budgets WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.entityType) {
      sql += ` AND entity_type = $${paramIdx++}`;
      params.push(filter.entityType);
    }
    if (filter?.entityId) {
      sql += ` AND entity_id = $${paramIdx++}`;
      params.push(filter.entityId);
    }
    sql += ' ORDER BY created_at DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  // ==================== Spend Tracking ====================

  async recordSpend(entityType: CostEntityType, entityId: string, amount: number): Promise<SpendRecord> {
    const result = await this.pool.query(
      'INSERT INTO finops_spend_tracking (entity_type, entity_id, amount) VALUES ($1, $2, $3) RETURNING *',
      [entityType, entityId, amount]
    );
    return result.rows[0];
  }

  async getCurrentSpend(entityType: CostEntityType, entityId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM finops_spend_tracking WHERE entity_type = $1 AND entity_id = $2',
      [entityType, entityId]
    );
    return parseFloat(result.rows[0]?.total || 0);
  }

  async getSpendHistory(entityType: CostEntityType, entityId: string): Promise<{ date: Date; cumulativeCost: number }[]> {
    const result = await this.pool.query(
      'SELECT recorded_at as date, amount as cumulative_cost FROM finops_spend_tracking WHERE entity_type = $1 AND entity_id = $2 ORDER BY recorded_at ASC',
      [entityType, entityId]
    );
    return result.rows.map((r: any) => ({ date: r.date, cumulativeCost: parseFloat(r.cumulative_cost) }));
  }

  // ==================== Alert Triggers ====================

  async insertAlertTrigger(trigger: {
    budgetId: string;
    threshold: number;
    actual: number;
    percentage: number;
    entityType: CostEntityType;
    entityId: string;
  }): Promise<AlertTriggerRecord> {
    const result = await this.pool.query(
      'INSERT INTO finops_alert_triggers (budget_id, threshold, actual, percentage, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [trigger.budgetId, trigger.threshold, trigger.actual, trigger.percentage, trigger.entityType, trigger.entityId]
    );
    return result.rows[0];
  }

  async getAlertTriggers(filter?: { budgetId?: string; entityType?: CostEntityType }): Promise<AlertTriggerRecord[]> {
    let sql = 'SELECT * FROM finops_alert_triggers WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.budgetId) {
      sql += ` AND budget_id = $${paramIdx++}`;
      params.push(filter.budgetId);
    }
    if (filter?.entityType) {
      sql += ` AND entity_type = $${paramIdx++}`;
      params.push(filter.entityType);
    }
    sql += ' ORDER BY triggered_at DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  // ==================== ROI Analysis ====================

  async insertROIAnalysis(analysis: {
    investmentType: string;
    name: string;
    cost: number;
    savings: number;
    period: CostPeriod;
    roiPercentage: number;
    paybackMonths: number;
    description?: string;
    details?: Record<string, any>;
  }): Promise<ROIAnalysisRecord> {
    const result = await this.pool.query(
      `INSERT INTO finops_roi_analyses (investment_type, name, cost, savings, period, roi_percentage, payback_months, description, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [analysis.investmentType, analysis.name, analysis.cost, analysis.savings, analysis.period, analysis.roiPercentage, analysis.paybackMonths, analysis.description || null, analysis.details || null]
    );
    return result.rows[0];
  }

  async getROIHistory(filter?: { investmentType?: string; minROI?: number }): Promise<ROIAnalysisRecord[]> {
    let sql = 'SELECT * FROM finops_roi_analyses WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.investmentType) {
      sql += ` AND investment_type = $${paramIdx++}`;
      params.push(filter.investmentType);
    }
    if (filter?.minROI !== undefined) {
      sql += ` AND roi_percentage >= $${paramIdx++}`;
      params.push(filter.minROI);
    }
    sql += ' ORDER BY analyzed_at DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  async insertCostComparison(comparison: {
    description: string;
    beforeCost: number;
    afterCost: number;
    savings: number;
    savingsPercent: number;
    timeSavingsHours?: number;
    period: CostPeriod;
  }): Promise<CostComparisonRecord> {
    const result = await this.pool.query(
      `INSERT INTO finops_cost_comparisons (description, before_cost, after_cost, savings, savings_percent, time_savings_hours, period)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [comparison.description, comparison.beforeCost, comparison.afterCost, comparison.savings, comparison.savingsPercent, comparison.timeSavingsHours || null, comparison.period]
    );
    return result.rows[0];
  }

  async getCostComparisons(filter?: { period?: CostPeriod }): Promise<CostComparisonRecord[]> {
    let sql = 'SELECT * FROM finops_cost_comparisons WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.period) {
      sql += ` AND period = $${paramIdx++}`;
      params.push(filter.period);
    }
    return (await this.pool.query(sql, params)).rows;
  }

  async getROISummary(): Promise<{ totalAnalyses: number; averageROI: number; averagePaybackMonths: number; totalComparisons: number; totalSavings: number }> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_analyses,
        COALESCE(AVG(roi_percentage), 0) as average_roi,
        COALESCE(AVG(CASE WHEN payback_months > 0 THEN payback_months END), 0) as average_payback,
        (SELECT COUNT(*) FROM finops_cost_comparisons) as total_comparisons,
        COALESCE((SELECT SUM(savings) FROM finops_cost_comparisons), 0) as total_savings
       FROM finops_roi_analyses`
    );
    const row = result.rows[0];
    return {
      totalAnalyses: parseInt(row.total_analyses, 10),
      averageROI: Math.round(parseFloat(row.average_roi) * 100) / 100,
      averagePaybackMonths: Math.round(parseFloat(row.average_payback) * 100) / 100,
      totalComparisons: parseInt(row.total_comparisons, 10),
      totalSavings: Math.round(parseFloat(row.total_savings) * 100) / 100,
    };
  }

  // ==================== Cost Optimizations ====================

  async insertOptimization(opt: {
    category: OptimizationCategory;
    description: string;
    estimatedSavings: number;
    effort: number;
    priority: OptimizationPriority;
    status: OptimizationStatus;
    resourceIds?: string[];
    entityId?: string;
    entityType?: CostEntityType;
    notes?: string;
  }): Promise<CostOptimizationRecord> {
    const result = await this.pool.query(
      `INSERT INTO finops_optimizations (category, description, estimated_savings, effort, priority, status, resource_ids, entity_id, entity_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [opt.category, opt.description, opt.estimatedSavings, opt.effort, opt.priority, opt.status, opt.resourceIds || null, opt.entityId || null, opt.entityType || null, opt.notes || null]
    );
    return result.rows[0];
  }

  async batchInsertOptimizations(opts: Array<{
    category: OptimizationCategory;
    description: string;
    estimatedSavings: number;
    effort: number;
    priority: OptimizationPriority;
    status: OptimizationStatus;
    resourceIds?: string[];
    entityId?: string;
    entityType?: CostEntityType;
    notes?: string;
  }>): Promise<CostOptimizationRecord[]> {
    const results: CostOptimizationRecord[] = [];
    for (const opt of opts) {
      results.push(await this.insertOptimization(opt));
    }
    return results;
  }

  async getOptimizations(query?: {
    category?: OptimizationCategory;
    priority?: OptimizationPriority;
    status?: OptimizationStatus;
    entityType?: CostEntityType;
    entityId?: string;
  }): Promise<CostOptimizationRecord[]> {
    let sql = 'SELECT * FROM finops_optimizations WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (query?.category) {
      sql += ` AND category = $${paramIdx++}`;
      params.push(query.category);
    }
    if (query?.priority) {
      sql += ` AND priority = $${paramIdx++}`;
      params.push(query.priority);
    }
    if (query?.status) {
      sql += ` AND status = $${paramIdx++}`;
      params.push(query.status);
    }
    if (query?.entityType) {
      sql += ` AND entity_type = $${paramIdx++}`;
      params.push(query.entityType);
    }
    if (query?.entityId) {
      sql += ` AND entity_id = $${paramIdx++}`;
      params.push(query.entityId);
    }
    sql += ' ORDER BY CASE priority WHEN \'critical\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END';
    return (await this.pool.query(sql, params)).rows;
  }

  async updateOptimizationStatus(optimizationId: string, status: OptimizationStatus): Promise<CostOptimizationRecord | null> {
    const result = await this.pool.query(
      'UPDATE finops_optimizations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, optimizationId]
    );
    return result.rows[0] || null;
  }

  async deleteOptimization(optimizationId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM finops_optimizations WHERE id = $1', [optimizationId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getOptimizationById(optimizationId: string): Promise<CostOptimizationRecord | null> {
    const result = await this.pool.query('SELECT * FROM finops_optimizations WHERE id = $1', [optimizationId]);
    return result.rows[0] || null;
  }

  // For resource utilization data used by the optimizer
  async getResourceUtilizations(filter?: { tenantId?: string; environment?: string }): Promise<any[]> {
    // Since resource utilization is typically sourced from Prometheus/metrics,
    // we store optimization analysis results, not raw utilization data.
    // This method returns optimization records filtered by tenant/environment.
    let sql = 'SELECT * FROM finops_optimizations WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.tenantId) {
      sql += ` AND entity_id = $${paramIdx++}`;
      params.push(filter.tenantId);
    }
    if (filter?.environment) {
      // environment is stored in notes as a string field
      sql += ` AND notes LIKE $${paramIdx++}`;
      params.push(`%${filter.environment}%`);
    }
    return (await this.pool.query(sql, params)).rows;
  }

  // ==================== Cloud Cost Collection ====================

  async insertCloudCost(record: {
    provider: CloudProvider;
    resourceType: CloudResourceType;
    resourceId: string;
    resourceName?: string;
    region: string;
    cost: number;
    currency: string;
    tags?: Record<string, string>;
    timestamp?: Date;
    tenantId?: string;
    environment?: string;
    billingPeriod?: string;
  }): Promise<CloudCostRecord> {
    const ts = record.timestamp || new Date();
    const result = await this.pool.query(
      `INSERT INTO finops_cloud_costs (provider, resource_type, resource_id, resource_name, region, cost, currency, tags, timestamp, tenant_id, environment, billing_period)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [record.provider, record.resourceType, record.resourceId, record.resourceName || null, record.region, record.cost, record.currency, record.tags || null, ts, record.tenantId || null, record.environment || null, record.billingPeriod || null]
    );
    return result.rows[0];
  }

  async batchInsertCloudCosts(records: Array<{
    provider: CloudProvider;
    resourceType: CloudResourceType;
    resourceId: string;
    resourceName?: string;
    region: string;
    cost: number;
    currency: string;
    tags?: Record<string, string>;
    timestamp?: Date;
    tenantId?: string;
    environment?: string;
    billingPeriod?: string;
  }>): Promise<CloudCostRecord[]> {
    const results: CloudCostRecord[] = [];
    for (const r of records) {
      results.push(await this.insertCloudCost(r));
    }
    return results;
  }

  async getCloudCosts(filter?: {
    provider?: CloudProvider;
    resourceType?: CloudResourceType;
    tenantId?: string;
    environment?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<CloudCostRecord[]> {
    let sql = 'SELECT * FROM finops_cloud_costs WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.provider) { sql += ` AND provider = $${paramIdx++}`; params.push(filter.provider); }
    if (filter?.resourceType) { sql += ` AND resource_type = $${paramIdx++}`; params.push(filter.resourceType); }
    if (filter?.tenantId) { sql += ` AND tenant_id = $${paramIdx++}`; params.push(filter.tenantId); }
    if (filter?.environment) { sql += ` AND environment = $${paramIdx++}`; params.push(filter.environment); }
    if (filter?.startDate) { sql += ` AND timestamp >= $${paramIdx++}`; params.push(filter.startDate); }
    if (filter?.endDate) { sql += ` AND timestamp <= $${paramIdx++}`; params.push(filter.endDate); }
    sql += ' ORDER BY timestamp DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  // ==================== K8s Cost Allocation ====================

  async insertK8sCost(record: {
    namespace: string;
    deployment: string;
    podName?: string;
    cpuCost: number;
    memoryCost: number;
    storageCost: number;
    networkCost: number;
    totalCost: number;
    tenantId?: string;
    timestamp?: Date;
    clusterName?: string;
    nodeName?: string;
  }): Promise<K8sCostRecord> {
    const ts = record.timestamp || new Date();
    const result = await this.pool.query(
      `INSERT INTO finops_k8s_costs (namespace, deployment, pod_name, cpu_cost, memory_cost, storage_cost, network_cost, total_cost, tenant_id, timestamp, cluster_name, node_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [record.namespace, record.deployment, record.podName || null, record.cpuCost, record.memoryCost, record.storageCost, record.networkCost, record.totalCost, record.tenantId || null, ts, record.clusterName || null, record.nodeName || null]
    );
    return result.rows[0];
  }

  async batchInsertK8sCosts(records: Array<{
    namespace: string;
    deployment: string;
    podName?: string;
    cpuCost: number;
    memoryCost: number;
    storageCost: number;
    networkCost: number;
    totalCost: number;
    tenantId?: string;
    timestamp?: Date;
    clusterName?: string;
    nodeName?: string;
  }>): Promise<K8sCostRecord[]> {
    const results: K8sCostRecord[] = [];
    for (const r of records) {
      results.push(await this.insertK8sCost(r));
    }
    return results;
  }

  async getK8sCosts(filter?: {
    namespace?: string;
    deployment?: string;
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<K8sCostRecord[]> {
    let sql = 'SELECT * FROM finops_k8s_costs WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.namespace) { sql += ` AND namespace = $${paramIdx++}`; params.push(filter.namespace); }
    if (filter?.deployment) { sql += ` AND deployment = $${paramIdx++}`; params.push(filter.deployment); }
    if (filter?.tenantId) { sql += ` AND tenant_id = $${paramIdx++}`; params.push(filter.tenantId); }
    if (filter?.startDate) { sql += ` AND timestamp >= $${paramIdx++}`; params.push(filter.startDate); }
    if (filter?.endDate) { sql += ` AND timestamp <= $${paramIdx++}`; params.push(filter.endDate); }
    sql += ' ORDER BY timestamp DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  async getK8sNamespaceCosts(filter?: { namespace?: string }): Promise<{ namespace: string; total_cost: number }[]> {
    let sql = `SELECT namespace, SUM(total_cost) as total_cost FROM finops_k8s_costs WHERE 1=1`;
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.namespace) { sql += ` AND namespace = $${paramIdx++}`; params.push(filter.namespace); }
    sql += ' GROUP BY namespace ORDER BY total_cost DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  async getK8sPodCosts(filter?: { namespace?: string; deployment?: string }): Promise<K8sCostRecord[]> {
    let sql = 'SELECT * FROM finops_k8s_costs WHERE pod_name IS NOT NULL';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.namespace) { sql += ` AND namespace = $${paramIdx++}`; params.push(filter.namespace); }
    if (filter?.deployment) { sql += ` AND deployment = $${paramIdx++}`; params.push(filter.deployment); }
    sql += ' ORDER BY total_cost DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  async getK8sTenantCosts(filter?: { tenantId?: string }): Promise<{ tenant_id: string; total_cost: number }[]> {
    let sql = `SELECT tenant_id, SUM(total_cost) as total_cost FROM finops_k8s_costs WHERE tenant_id IS NOT NULL`;
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.tenantId) { sql += ` AND tenant_id = $${paramIdx++}`; params.push(filter.tenantId); }
    sql += ' GROUP BY tenant_id ORDER BY total_cost DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  // ==================== SaaS Cost Tracking ====================

  async insertSaaSCost(record: {
    tool: string;
    subscription: string;
    seats: number;
    unitCost: number;
    totalCost: number;
    billingCycle: BillingCycle;
    startDate: Date;
    endDate: Date;
    tenantId?: string;
    status?: 'active' | 'cancelled' | 'expired';
    notes?: string;
  }): Promise<SaaSCostRecord> {
    const result = await this.pool.query(
      `INSERT INTO finops_saas_costs (tool, subscription, seats, unit_cost, total_cost, billing_cycle, start_date, end_date, tenant_id, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [record.tool, record.subscription, record.seats, record.unitCost, record.totalCost, record.billingCycle, record.startDate, record.endDate, record.tenantId || null, record.status || 'active', record.notes || null]
    );
    return result.rows[0];
  }

  async updateSaaSCost(id: string, updates: {
    seats?: number;
    unitCost?: number;
    totalCost?: number;
    billingCycle?: BillingCycle;
    startDate?: Date;
    endDate?: Date;
    status?: 'active' | 'cancelled' | 'expired';
    notes?: string;
  }): Promise<SaaSCostRecord | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (updates.seats !== undefined) { sets.push(`seats = $${paramIdx++}`); params.push(updates.seats); }
    if (updates.unitCost !== undefined) { sets.push(`unit_cost = $${paramIdx++}`); params.push(updates.unitCost); }
    if (updates.totalCost !== undefined) { sets.push(`total_cost = $${paramIdx++}`); params.push(updates.totalCost); }
    if (updates.billingCycle !== undefined) { sets.push(`billing_cycle = $${paramIdx++}`); params.push(updates.billingCycle); }
    if (updates.startDate !== undefined) { sets.push(`start_date = $${paramIdx++}`); params.push(updates.startDate); }
    if (updates.endDate !== undefined) { sets.push(`end_date = $${paramIdx++}`); params.push(updates.endDate); }
    if (updates.status !== undefined) { sets.push(`status = $${paramIdx++}`); params.push(updates.status); }
    if (updates.notes !== undefined) { sets.push(`notes = $${paramIdx++}`); params.push(updates.notes); }

    if (sets.length === 0) return null;

    params.push(id);
    const sql = `UPDATE finops_saas_costs SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] || null;
  }

  async deleteSaaSCost(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM finops_saas_costs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getSaaSCosts(filter?: { tool?: string; status?: string; tenantId?: string }): Promise<SaaSCostRecord[]> {
    let sql = 'SELECT * FROM finops_saas_costs WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.tool) { sql += ` AND tool = $${paramIdx++}`; params.push(filter.tool); }
    if (filter?.status) { sql += ` AND status = $${paramIdx++}`; params.push(filter.status); }
    if (filter?.tenantId) { sql += ` AND tenant_id = $${paramIdx++}`; params.push(filter.tenantId); }
    sql += ' ORDER BY total_cost DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  // ==================== Legacy Budget Alerts ====================

  async createLegacyBudgetAlert(alert: {
    budgetAmount: number;
    thresholdPercent: number;
    tenantId?: string;
    environment?: string;
    currency?: string;
    period?: CostPeriod;
  }): Promise<LegacyBudgetAlertRecord> {
    const result = await this.pool.query(
      `INSERT INTO finops_budget_alerts (budget_amount, threshold_percent, tenant_id, environment, currency, period)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [alert.budgetAmount, alert.thresholdPercent, alert.tenantId || null, alert.environment || null, alert.currency || 'USD', alert.period || 'monthly']
    );
    return result.rows[0];
  }

  async getLegacyBudgetAlerts(filter?: { tenantId?: string; environment?: string }): Promise<LegacyBudgetAlertRecord[]> {
    let sql = 'SELECT * FROM finops_budget_alerts WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;
    if (filter?.tenantId) { sql += ` AND tenant_id = $${paramIdx++}`; params.push(filter.tenantId); }
    if (filter?.environment) { sql += ` AND environment = $${paramIdx++}`; params.push(filter.environment); }
    sql += ' ORDER BY created_at DESC';
    return (await this.pool.query(sql, params)).rows;
  }

  async deleteLegacyBudgetAlert(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM finops_budget_alerts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async updateLegacyBudgetAlertSpend(id: string, currentSpend: number): Promise<LegacyBudgetAlertRecord | null> {
    const result = await this.pool.query(
      'UPDATE finops_budget_alerts SET current_spend = $1 WHERE id = $2 RETURNING *',
      [currentSpend, id]
    );
    return result.rows[0] || null;
  }
}
