// @ts-nocheck
/**
 * FinOpsCostCalculator - 成本计算逻辑
 *
 * 职责：成本追踪、趋势分析、费用汇总分配
 */
import { FinOpsRepository } from './FinOpsRepository';
import { CostEntityType, CostPeriod, CostSummary, CostBreakdown, CloudCostInput, K8sCostInput, SaaSCostInput, SaaSCostUpdate } from './types';
import { getPeriodDates, computeCostTrend } from './FinOpsUtils';
import { createLogger } from '../../utils/logger';

export interface CostRecordInput {
  entityType: CostEntityType;
  entityId: string;
  amount: number;
  category: string;
  environment?: string;
  tags?: Record<string, string>;
  currency?: string;
  timestamp?: Date;
}

export interface EntityCostSummary {
  entityType: CostEntityType;
  entityId: string;
  totalCost: number;
  breakdown: Record<string, number>;
  period: CostPeriod;
  currency: string;
  recordCount: number;
}

export interface CostTrendPoint {
  date: Date;
  cost: number;
  changeRate: number;
}

export interface CostTrend {
  points: CostTrendPoint[];
  overallChangeRate: number;
  averageCost: number;
  maxCost: number;
  minCost: number;
}

export interface ChargebackReport {
  id: string;
  generatedAt: Date;
  period: CostPeriod;
  totalCost: number;
  entities: {
    entityType: CostEntityType;
    entityId: string;
    cost: number;
    percentage: number;
    breakdown: Record<string, number>;
  }[];
  currency: string;
}

export class FinOpsCostCalculator {
  private repository: FinOpsRepository;
  private readonly logger = createLogger('finops-cost-calculator');

  constructor(repository: FinOpsRepository) {
    this.repository = repository;
  }

  // ==================== Cost Tracking ====================

  async trackCost(input: CostRecordInput): Promise<any> {
    return this.repository.insertCostRecord({
      entityType: input.entityType,
      entityId: input.entityId,
      amount: input.amount,
      category: input.category,
      environment: input.environment,
      tags: input.tags,
      currency: input.currency || 'USD',
      timestamp: input.timestamp,
    });
  }

  async getCostByEntity(entityType: CostEntityType, entityId: string, period: CostPeriod = 'monthly'): Promise<EntityCostSummary> {
    const { startDate, endDate } = getPeriodDates(period);
    const records = await this.repository.getCostByEntity(entityType, entityId, startDate, endDate);

    const breakdown: Record<string, number> = {};
    let totalCost = 0;
    for (const r of records) {
      totalCost += r.amount;
      breakdown[r.category] = (breakdown[r.category] || 0) + r.amount;
    }

    const roundedBreakdown: Record<string, number> = {};
    for (const [k, v] of Object.entries(breakdown)) {
      roundedBreakdown[k] = Math.round(v * 100) / 100;
    }

    return {
      entityType,
      entityId,
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown: roundedBreakdown,
      period,
      currency: 'USD',
      recordCount: records.length,
    };
  }

  async getCostTrend(entityType: CostEntityType, entityId: string, period: CostPeriod, category?: string): Promise<CostTrend> {
    const { startDate, endDate } = getPeriodDates(period);
    let records = await this.repository.getCostByEntity(entityType, entityId, startDate, endDate);

    if (category) {
      records = records.filter(r => r.category === category);
    }

    if (records.length === 0) {
      return { points: [], overallChangeRate: 0, averageCost: 0, maxCost: 0, minCost: 0 };
    }

    const dateMap = new Map<string, number>();
    for (const r of records) {
      const dateKey = new Date(r.timestamp).toISOString().split('T')[0];
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + r.amount);
    }

    const dataPoints = Array.from(dateMap.entries())
      .map(([date, cost]) => ({ date: new Date(date), cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return computeCostTrend(dataPoints);
  }

  async getServiceCostTrend(serviceId: string, period: CostPeriod, category?: string): Promise<CostTrend> {
    this.logger.debug({ serviceId, period, category }, '[FinOpsCostCalculator] Getting service cost trend');
    return this.getCostTrend('project', serviceId, period, category);
  }

  async getChargebackReport(period: CostPeriod = 'monthly'): Promise<ChargebackReport> {
    const { startDate, endDate } = getPeriodDates(period);
    const allRecords = await this.repository.getAllCostRecords();
    const filtered = allRecords.filter(r => {
      const ts = new Date(r.timestamp);
      return ts >= startDate && ts <= endDate;
    });

    const entityMap = new Map<string, { entityType: CostEntityType; entityId: string; cost: number; breakdown: Record<string, number> }>();
    for (const r of filtered) {
      const key = `${r.entity_type}:${r.entity_id}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, { entityType: r.entity_type, entityId: r.entity_id, cost: 0, breakdown: {} });
      }
      const entry = entityMap.get(key)!;
      entry.cost += r.amount;
      entry.breakdown[r.category] = (entry.breakdown[r.category] || 0) + r.amount;
    }

    const totalCost = Array.from(entityMap.values()).reduce((sum, e) => sum + e.cost, 0);

    const entities = Array.from(entityMap.values())
      .map(e => ({
        entityType: e.entityType,
        entityId: e.entityId,
        cost: Math.round(e.cost * 100) / 100,
        percentage: totalCost > 0 ? Math.round((e.cost / totalCost) * 10000) / 100 : 0,
        breakdown: Object.fromEntries(Object.entries(e.breakdown).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      }))
      .sort((a, b) => b.cost - a.cost);

    return {
      id: crypto.randomUUID(),
      generatedAt: new Date(),
      period,
      totalCost: Math.round(totalCost * 100) / 100,
      entities,
      currency: 'USD',
    };
  }

  async getAllCostRecords(filter?: { entityType?: CostEntityType; entityId?: string; category?: string }): Promise<any[]> {
    return this.repository.getAllCostRecords(filter);
  }

  // ==================== Cost Aggregation ====================

  async getCostSummary(period: CostPeriod = 'monthly', filter?: { tenantId?: string }): Promise<CostSummary> {
    const { startDate, endDate } = getPeriodDates(period);

    const cloudCosts = await this.repository.getCloudCosts({
      tenantId: filter?.tenantId,
      startDate,
      endDate,
    });

    const k8sCosts = await this.repository.getK8sCosts({
      tenantId: filter?.tenantId,
      startDate,
      endDate,
    });

    const computeCost = cloudCosts
      .filter((r: any) => ['compute', 'container', 'serverless'].includes(r.resource_type))
      .reduce((sum: number, r: any) => sum + r.cost, 0);

    const storageCost = cloudCosts
      .filter((r: any) => r.resource_type === 'storage')
      .reduce((sum: number, r: any) => sum + r.cost, 0)
      + k8sCosts.reduce((sum: number, r: any) => sum + r.storage_cost, 0);

    const networkCost = cloudCosts
      .filter((r: any) => r.resource_type === 'network')
      .reduce((sum: number, r: any) => sum + r.cost, 0)
      + k8sCosts.reduce((sum: number, r: any) => sum + r.network_cost, 0);

    const activeSaaS = (await this.repository.getSaaSCosts({ status: 'active' }))
      .filter((r: any) => !filter?.tenantId || r.tenant_id === filter.tenantId);

    const saasMonthlyCost = activeSaaS.reduce((sum: number, s: any) => {
      const monthsDiff = (s.end_date.getTime() - s.start_date.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
      return sum + s.total_cost / Math.max(monthsDiff, 1);
    }, 0);

    const totalCost = computeCost + storageCost + networkCost + saasMonthlyCost;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      computeCost: Math.round(computeCost * 100) / 100,
      storageCost: Math.round(storageCost * 100) / 100,
      networkCost: Math.round(networkCost * 100) / 100,
      saasCost: Math.round(saasMonthlyCost * 100) / 100,
      period,
      currency: 'USD',
      tenantId: filter?.tenantId,
    };
  }

  async getCostBreakdown(dimension: 'category' | 'tenant' | 'environment' | 'provider' | 'namespace', filter?: { tenantId?: string }): Promise<CostBreakdown[]> {
    const { startDate, endDate } = getPeriodDates('monthly');

    const cloudCosts = await this.repository.getCloudCosts({
      tenantId: filter?.tenantId,
      startDate,
      endDate,
    });
    const k8sCosts = await this.repository.getK8sCosts({
      tenantId: filter?.tenantId,
      startDate,
      endDate,
    });
    const activeSaaS = (await this.repository.getSaaSCosts({ status: 'active' }))
      .filter((r: any) => !filter?.tenantId || r.tenant_id === filter.tenantId);

    let totalCost = 0;
    const dimensionMap = new Map<string, number>();

    for (const cost of cloudCosts) {
      totalCost += cost.cost;
      let key: string;
      switch (dimension) {
        case 'category': key = cost.resource_type; break;
        case 'tenant': key = cost.tenant_id || 'unknown'; break;
        case 'environment': key = cost.environment || 'unknown'; break;
        case 'provider': key = cost.provider; break;
        default: key = 'unknown';
      }
      dimensionMap.set(key, (dimensionMap.get(key) || 0) + cost.cost);
    }

    for (const cost of k8sCosts) {
      totalCost += cost.total_cost;
      let key: string;
      switch (dimension) {
        case 'namespace': key = cost.namespace; break;
        case 'tenant': key = cost.tenant_id || 'unknown'; break;
        default: key = 'k8s';
      }
      dimensionMap.set(key, (dimensionMap.get(key) || 0) + cost.total_cost);
    }

    const saasCost = activeSaaS.reduce((sum: number, s: any) => {
      const monthsDiff = (s.end_date.getTime() - s.start_date.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
      return sum + s.total_cost / Math.max(monthsDiff, 1);
    }, 0);
    if (dimension === 'category') {
      dimensionMap.set('saas', saasCost);
    }
    totalCost += saasCost;

    const breakdowns: CostBreakdown[] = [];
    for (const [key, cost] of dimensionMap) {
      breakdowns.push({
        dimension,
        dimensionValue: key,
        cost: Math.round(cost * 100) / 100,
        percentage: totalCost > 0 ? Math.round((cost / totalCost) * 10000) / 100 : 0,
        recordCount: 1,
      });
    }

    breakdowns.sort((a, b) => b.cost - a.cost);
    return breakdowns;
  }

  async computeCostTrendFromData(dataPoints: { date: Date; cost: number }[]): Promise<{ points: { date: Date; cost: number; changeRate: number }[]; overallChangeRate: number; averageCost: number; maxCost: number; minCost: number }> {
    const trend = computeCostTrend(dataPoints.map(d => ({ date: d.date, cost: d.cost })));
    return {
      points: trend.points,
      overallChangeRate: trend.overallChangeRate,
      averageCost: trend.averageCost,
      maxCost: trend.maxCost,
      minCost: trend.minCost,
    };
  }

  // ==================== Cloud Cost ====================

  async collectCloudCosts(costs: CloudCostInput[]): Promise<any[]> {
    const records = costs.map(c => ({
      provider: c.provider,
      resource_type: c.resourceType,
      resource_id: c.resourceId,
      resource_name: c.resourceName,
      region: c.region,
      cost: c.cost,
      currency: c.currency || 'USD',
      tags: c.tags,
      timestamp: c.timestamp,
      tenant_id: c.tenantId,
      environment: c.environment,
      billing_period: c.billingPeriod,
    }));
    return this.repository.batchInsertCloudCosts(records);
  }

  async getCloudCosts(filter?: { provider?: string; resourceType?: string; tenantId?: string; environment?: string; startDate?: Date; endDate?: Date }): Promise<any[]> {
    return this.repository.getCloudCosts(filter);
  }

  // ==================== K8s Cost ====================

  async allocateK8sCosts(costs: K8sCostInput[]): Promise<any[]> {
    const records = costs.map(c => ({
      namespace: c.namespace,
      deployment: c.deployment,
      pod_name: c.podName,
      cpu_cost: c.cpuCost,
      memory_cost: c.memoryCost,
      storage_cost: c.storageCost,
      network_cost: c.networkCost,
      total_cost: c.totalCost,
      tenant_id: c.tenantId,
      timestamp: c.timestamp,
      cluster_name: c.clusterName,
      node_name: c.nodeName,
    }));
    return this.repository.batchInsertK8sCosts(records);
  }

  async getK8sCosts(filter?: { namespace?: string; deployment?: string; tenantId?: string; startDate?: Date; endDate?: Date }): Promise<any[]> {
    return this.repository.getK8sCosts(filter);
  }

  async getK8sNamespaceCosts(filter?: { namespace?: string }): Promise<{ namespace: string; total_cost: number }[]> {
    return this.repository.getK8sNamespaceCosts(filter);
  }

  async getK8sPodCosts(filter?: { namespace?: string; deployment?: string }): Promise<any[]> {
    return this.repository.getK8sPodCosts(filter);
  }

  async getK8sTenantCosts(filter?: { tenantId?: string }): Promise<{ tenant_id: string; total_cost: number }[]> {
    return this.repository.getK8sTenantCosts(filter);
  }

  // ==================== SaaS Cost ====================

  async addSaaSSubscription(input: SaaSCostInput): Promise<any> {
    return this.repository.insertSaaSCost({
      tool: input.tool,
      subscription: input.subscription,
      seats: input.seats,
      unit_cost: input.unitCost,
      total_cost: input.unitCost * input.seats,
      billing_cycle: input.billingCycle,
      start_date: input.startDate,
      end_date: input.endDate,
      tenant_id: input.tenantId,
      status: 'active',
      notes: input.notes,
    });
  }

  async updateSaaSSubscription(id: string, input: SaaSCostUpdate): Promise<any> {
    const updates: any = { ...input };
    if (input.seats !== undefined && input.unitCost !== undefined) {
      updates.total_cost = input.seats * input.unitCost;
    }
    return this.repository.updateSaaSCost(id, updates);
  }

  async deleteSaaSSubscription(id: string): Promise<boolean> {
    return this.repository.deleteSaaSCost(id);
  }

  async getSaaSSubscriptions(filter?: { tool?: string; status?: string; tenantId?: string }): Promise<any[]> {
    return this.repository.getSaaSCosts(filter);
  }

}
