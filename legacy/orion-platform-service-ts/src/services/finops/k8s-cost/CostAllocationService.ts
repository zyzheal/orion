/**
 * CostAllocationService - Business logic for K8s cost allocation
 *
 * Combines K8sCostRepository and BudgetRepository to provide
 * cost summaries, trends, allocation, and budget alerting.
 */

import { getCurrentTenantId } from '../../../db/tenant-context-storage';
import { K8sCostRepository, ClusterCost, NamespaceCost } from './K8sCostRepository';
import { BudgetRepository, Budget, BudgetOverrun } from './BudgetRepository';

export interface CostSummary {
  month: string;
  total_cost: number;
  compute_cost: number;
  storage_cost: number;
  network_cost: number;
  cluster_count: number;
  namespace_count: number;
  top_clusters: { cluster_name: string; total_cost: number }[];
}

export interface CostTrend {
  month: string;
  total_cost: number;
  compute_cost: number;
  storage_cost: number;
  network_cost: number;
}

export interface CostAllocationInput {
  cluster_name: string;
  namespace: string;
  pod_name?: string;
  workload_name?: string;
  workload_type?: string;
  month: string;
  total_cost: number;
  compute_cost?: number;
  storage_cost?: number;
}

export interface BudgetAlert {
  budget_id: string;
  budget_name: string;
  scope_type: string;
  scope_value: string;
  monthly_limit: number;
  actual_cost: number;
  usage_ratio: number;
  exceeded: boolean;
  alert_level: 'normal' | 'warning' | 'critical';
}

export interface TopNamespace {
  cluster_name: string;
  namespace: string;
  total_cost: number;
  pod_count: number;
  cost_per_pod: number;
}

export class CostAllocationService {
  constructor(
    private clusterCostRepo: K8sCostRepository,
    private budgetRepo: BudgetRepository,
  ) {}

  async getCostSummary(month?: string): Promise<CostSummary> {
    const tenantId = getCurrentTenantId();
    const targetMonth = month || this.getCurrentMonth();

    const clusters = await this.clusterCostRepo.getClusterCosts(targetMonth);

    const totalCost = clusters.reduce((sum, c) => sum + Number(c.total_cost || 0), 0);
    const computeCost = clusters.reduce((sum, c) => sum + Number(c.compute_cost || 0), 0);
    const storageCost = clusters.reduce((sum, c) => sum + Number(c.storage_cost || 0), 0);
    const networkCost = clusters.reduce((sum, c) => sum + Number(c.network_cost || 0), 0);

    const topClusters = clusters.slice(0, 5).map(c => ({
      cluster_name: c.cluster_name,
      total_cost: Number(c.total_cost || 0),
    }));

    return {
      month: targetMonth,
      total_cost: totalCost,
      compute_cost: computeCost,
      storage_cost: storageCost,
      network_cost: networkCost,
      cluster_count: clusters.length,
      namespace_count: 0,
      top_clusters: topClusters,
    };
  }

  async getCostTrend(months: number): Promise<CostTrend[]> {
    const monthList = this.getRecentMonths(months);
    const trends: CostTrend[] = [];

    for (const m of monthList) {
      const clusters = await this.clusterCostRepo.getClusterCosts(m);
      const totalCost = clusters.reduce((sum, c) => sum + Number(c.total_cost || 0), 0);
      const computeCost = clusters.reduce((sum, c) => sum + Number(c.compute_cost || 0), 0);
      const storageCost = clusters.reduce((sum, c) => sum + Number(c.storage_cost || 0), 0);
      const networkCost = clusters.reduce((sum, c) => sum + Number(c.network_cost || 0), 0);

      trends.push({
        month: m,
        total_cost: totalCost,
        compute_cost: computeCost,
        storage_cost: storageCost,
        network_cost: networkCost,
      });
    }

    return trends;
  }

  async allocateCosts(data: CostAllocationInput): Promise<NamespaceCost> {
    const totalCost = data.total_cost;
    const computeCost = data.compute_cost ?? totalCost;
    const storageCost = data.storage_cost ?? 0;

    return this.clusterCostRepo.upsertNamespaceCost({
      cluster_name: data.cluster_name,
      namespace: data.namespace,
      month: data.month,
      compute_cost: computeCost,
      storage_cost: storageCost,
      total_cost: totalCost,
    });
  }

  async checkBudgetAlerts(): Promise<BudgetAlert[]> {
    const currentMonth = this.getCurrentMonth();
    const overruns = await this.budgetRepo.checkOverrun(currentMonth);

    return overruns.map(o => ({
      budget_id: o.budget_id,
      budget_name: o.budget_name,
      scope_type: o.scope_type,
      scope_value: o.scope_value,
      monthly_limit: Number(o.monthly_limit),
      actual_cost: Number(o.actual_cost),
      usage_ratio: Number(o.usage_ratio),
      exceeded: o.exceeded,
      alert_level: o.exceeded ? 'critical' : (Number(o.usage_ratio) >= 0.8 ? 'warning' : 'normal'),
    }));
  }

  async getTopExpensiveNamespaces(month?: string, limit: number = 10): Promise<TopNamespace[]> {
    const targetMonth = month || this.getCurrentMonth();
    const clusters = await this.clusterCostRepo.getClusterCosts(targetMonth);
    const allNamespaces: TopNamespace[] = [];

    for (const cluster of clusters) {
      const namespaces = await this.clusterCostRepo.getNamespaceCosts(cluster.cluster_name, targetMonth);
      for (const ns of namespaces) {
        allNamespaces.push({
          cluster_name: ns.cluster_name,
          namespace: ns.namespace,
          total_cost: Number(ns.total_cost || 0),
          pod_count: ns.pod_count || 0,
          cost_per_pod: Number(ns.cost_per_pod || 0),
        });
      }
    }

    return allNamespaces
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, limit);
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private getRecentMonths(count: number): string[] {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    }
    return months;
  }
}
