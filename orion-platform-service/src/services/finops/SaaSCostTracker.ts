/**
 * SaaS 工具成本跟踪服务
 *
 * 管理 SaaS 订阅（GitLab, Jira, Slack 等）的成本记录
 * 支持成本摊销、许可证使用率跟踪、费用预测
 */

import { v4 as uuidv4 } from 'uuid';
import { SaaSCost, BillingCycle } from './types';
import { SaaSCostSubscriptionRepository } from '../../repositories/SaaSCostSubscriptionRepository';

/**
 * SaaS 订阅更新请求
 */
export interface SaaSSubscriptionUpdate {
  /** 订阅计划名称 */
  subscription?: string;
  /** 席位数 */
  seats?: number;
  /** 单席成本 */
  unitCost?: number;
  /** 计费周期 */
  billingCycle?: BillingCycle;
  /** 结束日期 */
  endDate?: Date;
  /** 使用状态 */
  status?: 'active' | 'cancelled' | 'expired';
  /** 额外说明 */
  notes?: string;
}

/**
 * SaaS 成本跟踪服务
 */
export class SaaSCostTracker {
  /** 订阅记录存储 */
  private subscriptions: Map<string, SaaSCost> = new Map();
  private repository?: SaaSCostSubscriptionRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repository = new SaaSCostSubscriptionRepository(db);
    }
  }

  /**
   * 添加 SaaS 订阅
   */
  addSubscription(params: {
    tool: string;
    subscription: string;
    seats: number;
    unitCost: number;
    billingCycle: BillingCycle;
    startDate: Date;
    endDate: Date;
    tenantId?: string;
    notes?: string;
  }): SaaSCost {
    const totalCost = this.calculateTotalCost(params.unitCost, params.seats, params.billingCycle);

    const subscription: SaaSCost = {
      id: uuidv4(),
      tool: params.tool,
      subscription: params.subscription,
      seats: params.seats,
      unitCost: params.unitCost,
      totalCost,
      billingCycle: params.billingCycle,
      startDate: params.startDate,
      endDate: params.endDate,
      tenantId: params.tenantId,
      status: 'active',
      notes: params.notes,
    };

    this.subscriptions.set(subscription.id, subscription);

    // Persist to DB
    if (this.repository) {
      this.repository.create({
        id: subscription.id,
        tool: subscription.tool,
        subscription: subscription.subscription,
        seats: subscription.seats,
        unitCost: subscription.unitCost,
        totalCost: subscription.totalCost,
        billingCycle: subscription.billingCycle,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        status: subscription.status,
        notes: subscription.notes || null,
      }).catch(() => {});
    }

    return subscription;
  }

  /**
   * 更新 SaaS 订阅
   */
  updateSubscription(id: string, updates: SaaSSubscriptionUpdate): SaaSCost | null {
    const existing = this.subscriptions.get(id);
    if (!existing) {
      return null;
    }

    const updated = { ...existing };

    if (updates.subscription !== undefined) {
      updated.subscription = updates.subscription;
    }
    if (updates.seats !== undefined) {
      updated.seats = updates.seats;
    }
    if (updates.unitCost !== undefined) {
      updated.unitCost = updates.unitCost;
    }
    if (updates.billingCycle !== undefined) {
      updated.billingCycle = updates.billingCycle;
    }
    if (updates.endDate !== undefined) {
      updated.endDate = updates.endDate;
    }
    if (updates.status !== undefined) {
      updated.status = updates.status;
    }
    if (updates.notes !== undefined) {
      updated.notes = updates.notes;
    }

    // 重新计算总成本
    updated.totalCost = this.calculateTotalCost(updated.unitCost, updated.seats, updated.billingCycle);

    this.subscriptions.set(id, updated);
    return updated;
  }

  /**
   * 取消订阅
   */
  cancelSubscription(id: string): boolean {
    const existing = this.subscriptions.get(id);
    if (!existing) {
      return false;
    }

    existing.status = 'cancelled';
    existing.endDate = new Date();
    this.subscriptions.set(id, existing);
    return true;
  }

  /**
   * 获取所有订阅
   */
  getSubscriptions(filter?: { tool?: string; status?: string; tenantId?: string }): SaaSCost[] {
    let subscriptions = Array.from(this.subscriptions.values());

    if (filter?.tool) {
      subscriptions = subscriptions.filter((s) => s.tool.toLowerCase() === filter.tool!.toLowerCase());
    }
    if (filter?.status) {
      subscriptions = subscriptions.filter((s) => s.status === filter.status);
    }
    if (filter?.tenantId) {
      subscriptions = subscriptions.filter((s) => s.tenantId === filter.tenantId);
    }

    return subscriptions.sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * 获取单个订阅详情
   */
  getSubscription(id: string): SaaSCost | undefined {
    return this.subscriptions.get(id);
  }

  /**
   * 计算月度成本
   *
   * 将不同计费周期的订阅统一转换为月度成本
   */
  getMonthlyCost(filter?: { tool?: string; tenantId?: string }): number {
    const subscriptions = this.getSubscriptions(
      filter ? {
        tool: filter.tool,
        status: 'active',
        tenantId: filter.tenantId,
      } : { status: 'active' }
    );

    let monthlyTotal = 0;
    for (const sub of subscriptions) {
      monthlyTotal += this.amortizeToMonthly(sub.totalCost, sub.billingCycle, sub.startDate, sub.endDate);
    }

    return Math.round(monthlyTotal * 100) / 100;
  }

  /**
   * 计算年度预测成本
   *
   * 基于当前活跃订阅，预测全年成本
   */
  getAnnualProjection(filter?: { tool?: string; tenantId?: string }): number {
    const monthlyCost = this.getMonthlyCost(filter);
    return Math.round(monthlyCost * 12 * 100) / 100;
  }

  /**
   * 按工具分组获取月度成本
   */
  getMonthlyCostByTool(): Record<string, number> {
    const tools = new Set<string>();
    for (const sub of this.subscriptions.values()) {
      if (sub.status === 'active') {
        tools.add(sub.tool);
      }
    }

    const result: Record<string, number> = {};
    for (const tool of tools) {
      result[tool] = this.getMonthlyCost({ tool });
    }

    return result;
  }

  /**
   * 许可证使用率分析
   *
   * 返回各工具的席位使用情况
   */
  getLicenseUtilization(): Record<string, {
    tool: string;
    totalSeats: number;
    activeSeats: number;
    utilizationRate: number;
    monthlyCost: number;
    costPerActiveSeat: number;
  }> {
    const toolMap = new Map<string, { totalSeats: number; activeSeats: number; monthlyCost: number }>();

    for (const sub of this.subscriptions.values()) {
      if (sub.status !== 'active') continue;

      const existing = toolMap.get(sub.tool) || {
        totalSeats: 0,
        activeSeats: 0,
        monthlyCost: 0,
      };

      existing.totalSeats += sub.seats;
      // 假设 80% 的席位是活跃的（Mock 数据，实际应从使用日志获取）
      existing.activeSeats += Math.ceil(sub.seats * 0.8);
      existing.monthlyCost += this.amortizeToMonthly(sub.totalCost, sub.billingCycle, sub.startDate, sub.endDate);

      toolMap.set(sub.tool, existing);
    }

    const result: Record<string, {
      tool: string;
      totalSeats: number;
      activeSeats: number;
      utilizationRate: number;
      monthlyCost: number;
      costPerActiveSeat: number;
    }> = {};

    for (const [tool, data] of toolMap) {
      result[tool] = {
        tool,
        totalSeats: data.totalSeats,
        activeSeats: data.activeSeats,
        utilizationRate: Math.round((data.activeSeats / data.totalSeats) * 10000) / 100,
        monthlyCost: Math.round(data.monthlyCost * 100) / 100,
        costPerActiveSeat: data.activeSeats > 0
          ? Math.round((data.monthlyCost / data.activeSeats) * 100) / 100
          : 0,
      };
    }

    return result;
  }

  /**
   * 计算总成本（考虑计费周期）
   */
  private calculateTotalCost(unitCost: number, seats: number, billingCycle: BillingCycle): number {
    const baseCost = unitCost * seats;

    switch (billingCycle) {
      case 'monthly':
        return Math.round(baseCost * 100) / 100;
      case 'quarterly':
        return Math.round(baseCost * 3 * 100) / 100;
      case 'annually':
        return Math.round(baseCost * 12 * 100) / 100;
      default:
        return Math.round(baseCost * 100) / 100;
    }
  }

  /**
   * 将成本摊销到月度
   */
  private amortizeToMonthly(
    totalCost: number,
    billingCycle: BillingCycle,
    startDate: Date,
    endDate: Date
  ): number {
    // 计算有效月份
    const monthsDiff = (endDate.getTime() - startDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
    const effectiveMonths = Math.max(monthsDiff, 1);

    return totalCost / effectiveMonths;
  }

  /**
   * 获取订阅总数
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * 清空所有订阅
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
  }
}
