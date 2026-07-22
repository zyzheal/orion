/**
 * FinOps 成本聚合服务
 *
 * 汇总来自云资源、K8s、SaaS 的成本数据
 * 提供成本分解、趋势分析、预算告警等功能
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CloudResource,
  K8sCost,
  SaaSCost,
  CostSummary,
  CostPeriod,
  CostBreakdown,
  CostTrend,
  CostTrendPoint,
  BudgetAlert,
  BudgetAlertEvent,
} from './types';

/**
 * FinOps 成本聚合服务
 */
export class CostService {
  /** 云资源成本记录 */
  private cloudCosts: CloudResource[] = [];

  /** K8s 成本记录 */
  private k8sCosts: K8sCost[] = [];

  /** SaaS 成本记录 */
  private saasCosts: SaaSCost[] = [];

  /** 预算告警配置 */
  private budgetAlerts: BudgetAlert[] = [];

  /**
   * 添加云资源成本记录
   */
  addCloudCosts(costs: CloudResource[]): void {
    this.cloudCosts.push(...costs);
  }

  /**
   * 添加 K8s 成本记录
   */
  addK8sCosts(costs: K8sCost[]): void {
    this.k8sCosts.push(...costs);
  }

  /**
   * 添加 SaaS 成本记录
   */
  addSaaSCosts(costs: SaaSCost[]): void {
    this.saasCosts.push(...costs);
  }

  /**
   * 获取成本汇总
   *
   * 汇总所有来源的成本，按类别分类
   */
  getCostSummary(period: CostPeriod = 'monthly', filter?: { tenantId?: string }): CostSummary {
    const { startDate, endDate } = this.getPeriodDates(period);

    // 筛选时间范围内的记录
    const cloudCosts = this.filterByTimeAndTenant(
      this.cloudCosts,
      startDate,
      endDate,
      filter?.tenantId
    );
    const k8sCosts = this.filterByTimeAndTenant(
      this.k8sCosts,
      startDate,
      endDate,
      filter?.tenantId
    ) as K8sCost[];

    // 计算各类别成本
    const computeCost = cloudCosts
      .filter((r) => r.resourceType === 'compute' || r.resourceType === 'container' || r.resourceType === 'serverless')
      .reduce((sum, r) => sum + r.cost, 0);

    const storageCost = cloudCosts
      .filter((r) => r.resourceType === 'storage')
      .reduce((sum, r) => sum + r.cost, 0) +
      k8sCosts.reduce((sum, r) => sum + r.storageCost, 0);

    const networkCost = cloudCosts
      .filter((r) => r.resourceType === 'network')
      .reduce((sum, r) => sum + r.cost, 0) +
      k8sCosts.reduce((sum, r) => sum + r.networkCost, 0);

    // SaaS 成本（活跃订阅的月度摊销）
    const activeSaaS = this.saasCosts.filter((s) => s.status === 'active');
    const saasMonthlyCost = activeSaaS.reduce((sum, s) => {
      const monthsDiff = (s.endDate.getTime() - s.startDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
      return sum + s.totalCost / Math.max(monthsDiff, 1);
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

  /**
   * 获取成本分解
   *
   * 按指定维度分解成本
   */
  getCostBreakdown(dimension: 'category' | 'tenant' | 'environment' | 'provider' | 'namespace', filter?: { tenantId?: string }): CostBreakdown[] {
    const { startDate, endDate } = this.getPeriodDates('monthly');

    let totalCost = 0;
    const dimensionMap = new Map<string, number>();

    // 云资源成本
    const cloudCosts = this.filterByTimeAndTenant(this.cloudCosts, startDate, endDate, filter?.tenantId);
    for (const cost of cloudCosts) {
      totalCost += cost.cost;
      let key: string;
      switch (dimension) {
        case 'category':
          key = cost.resourceType;
          break;
        case 'tenant':
          key = cost.tenantId || 'unknown';
          break;
        case 'environment':
          key = cost.environment || 'unknown';
          break;
        case 'provider':
          key = cost.provider;
          break;
        default:
          key = 'unknown';
      }
      dimensionMap.set(key, (dimensionMap.get(key) || 0) + cost.cost);
    }

    // K8s 成本
    const k8sCosts = this.filterByTimeAndTenant(this.k8sCosts, startDate, endDate, filter?.tenantId) as K8sCost[];
    for (const cost of k8sCosts) {
      totalCost += cost.totalCost;
      let key: string;
      switch (dimension) {
        case 'namespace':
          key = cost.namespace;
          break;
        case 'tenant':
          key = cost.tenantId || 'unknown';
          break;
        default:
          key = 'k8s';
      }
      dimensionMap.set(key, (dimensionMap.get(key) || 0) + cost.totalCost);
    }

    // SaaS 成本
    const activeSaaS = this.saasCosts.filter((s) => s.status === 'active');
    const saasCost = activeSaaS.reduce((sum, s) => {
      const monthsDiff = (s.endDate.getTime() - s.startDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
      return sum + s.totalCost / Math.max(monthsDiff, 1);
    }, 0);

    if (dimension === 'category') {
      dimensionMap.set('saas', saasCost);
    }
    totalCost += saasCost;

    // 转换为分解结果
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

    // 按成本降序排序
    breakdowns.sort((a, b) => b.cost - a.cost);
    return breakdowns;
  }

  /**
   * 获取成本趋势
   *
   * 基于已有数据点计算趋势
   */
  getCostTrend(dataPoints: { date: Date; cost: number }[]): CostTrend {
    if (dataPoints.length === 0) {
      return {
        points: [],
        overallChangeRate: 0,
        averageCost: 0,
        maxCost: 0,
        minCost: 0,
      };
    }

    // 按日期排序
    const sorted = [...dataPoints].sort((a, b) => a.date.getTime() - b.date.getTime());

    // 计算变化率
    const points: CostTrendPoint[] = [];
    for (let i = 0; i < sorted.length; i++) {
      let changeRate = 0;
      if (i > 0 && sorted[i - 1].cost > 0) {
        changeRate = ((sorted[i].cost - sorted[i - 1].cost) / sorted[i - 1].cost) * 100;
      }

      points.push({
        date: sorted[i].date,
        cost: sorted[i].cost,
        changeRate: Math.round(changeRate * 100) / 100,
      });
    }

    // 计算趋势指标
    const costs = sorted.map((p) => p.cost);
    const totalCost = costs.reduce((sum, c) => sum + c, 0);
    const averageCost = totalCost / costs.length;

    const firstCost = sorted[0].cost;
    const lastCost = sorted[sorted.length - 1].cost;
    const overallChangeRate = firstCost > 0
      ? ((lastCost - firstCost) / firstCost) * 100
      : 0;

    return {
      points,
      overallChangeRate: Math.round(overallChangeRate * 100) / 100,
      averageCost: Math.round(averageCost * 100) / 100,
      maxCost: Math.max(...costs),
      minCost: Math.min(...costs),
    };
  }

  /**
   * 创建预算告警
   */
  createBudgetAlert(alert: Omit<BudgetAlert, 'id' | 'createdAt' | 'triggered' | 'currentSpend'>): BudgetAlert {
    const newAlert: BudgetAlert = {
      ...alert,
      id: uuidv4(),
      createdAt: new Date(),
      triggered: false,
      currentSpend: 0,
    };

    this.budgetAlerts.push(newAlert);
    return newAlert;
  }

  /**
   * 获取所有预算告警
   */
  getBudgetAlerts(filter?: { tenantId?: string; environment?: string }): BudgetAlert[] {
    let alerts = [...this.budgetAlerts];

    if (filter?.tenantId) {
      alerts = alerts.filter((a) => a.tenantId === filter.tenantId);
    }
    if (filter?.environment) {
      alerts = alerts.filter((a) => a.environment === filter.environment);
    }

    return alerts;
  }

  /**
   * 删除预算告警
   */
  deleteBudgetAlert(id: string): boolean {
    const index = this.budgetAlerts.findIndex((a) => a.id === id);
    if (index === -1) return false;
    this.budgetAlerts.splice(index, 1);
    return true;
  }

  /**
   * 检查预算告警
   *
   * 检查当前花费是否触发预算告警
   *
   * @returns 触发的告警事件列表
   */
  checkBudgetAlerts(): BudgetAlertEvent[] {
    const triggered: BudgetAlertEvent[] = [];
    const summary = this.getCostSummary('monthly');

    for (const alert of this.budgetAlerts) {
      // 根据租户和环境过滤
      if (alert.tenantId && summary.tenantId && alert.tenantId !== summary.tenantId) {
        continue;
      }

      // 更新当前花费
      alert.currentSpend = summary.totalCost;

      const usagePercent = (alert.currentSpend / alert.budgetAmount) * 100;

      if (usagePercent >= alert.thresholdPercent && !alert.triggered) {
        alert.triggered = true;

        const event: BudgetAlertEvent = {
          alertId: alert.id,
          tenantId: alert.tenantId,
          budgetAmount: alert.budgetAmount,
          currentSpend: alert.currentSpend,
          usagePercent: Math.round(usagePercent * 100) / 100,
          thresholdPercent: alert.thresholdPercent,
          triggeredAt: new Date(),
        };

        triggered.push(event);
      }
    }

    return triggered;
  }

  /**
   * 获取所有成本数据
   */
  getAllData(): { cloud: CloudResource[]; k8s: K8sCost[]; saas: SaaSCost[] } {
    return {
      cloud: [...this.cloudCosts],
      k8s: [...this.k8sCosts],
      saas: [...this.saasCosts],
    };
  }

  /**
   * 清空所有数据
   */
  clearAll(): void {
    this.cloudCosts = [];
    this.k8sCosts = [];
    this.saasCosts = [];
    this.budgetAlerts = [];
  }

  // ==================== 私有方法 ====================

  /**
   * 获取周期的起止日期
   */
  private getPeriodDates(period: CostPeriod): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = now;
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'yearly':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  /**
   * 按时间和租户过滤记录
   */
  private filterByTimeAndTenant<T extends { timestamp: Date; tenantId?: string }>(
    records: T[],
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): T[] {
    return records.filter((r) => {
      if (r.timestamp < startDate || r.timestamp > endDate) return false;
      if (tenantId && r.tenantId && r.tenantId !== tenantId) return false;
      return true;
    });
  }
}
