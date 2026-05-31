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
  private repository: SaaSCostSubscriptionRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = new SaaSCostSubscriptionRepository(db);
  }

  /**
   * 添加 SaaS 订阅
   */
  async addSubscription(params: {
    tool: string;
    subscription: string;
    seats: number;
    unitCost: number;
    billingCycle: BillingCycle;
    startDate: Date;
    endDate: Date;
    tenantId?: string;
    notes?: string;
  }): Promise<SaaSCost> {
    const totalCost = this.calculateTotalCost(params.unitCost, params.seats, params.billingCycle);

    const id = uuidv4();
    await this.repository.create({
      id,
      tool: params.tool,
      subscription: params.subscription,
      seats: params.seats,
      unitCost: params.unitCost,
      totalCost,
      billingCycle: params.billingCycle,
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'active',
      notes: params.notes || null,
    });

    return {
      id,
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
  }

  /**
   * 更新 SaaS 订阅
   */
  async updateSubscription(id: string, updates: SaaSSubscriptionUpdate): Promise<SaaSCost | null> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return null;
    }

    const updateData: any = {};

    if (updates.subscription !== undefined) {
      updateData.subscription = updates.subscription;
    }
    if (updates.seats !== undefined) {
      updateData.seats = updates.seats;
    }
    if (updates.unitCost !== undefined) {
      updateData.unit_cost = updates.unitCost;
    }
    if (updates.billingCycle !== undefined) {
      updateData.billing_cycle = updates.billingCycle;
    }
    if (updates.endDate !== undefined) {
      updateData.end_date = updates.endDate;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    // 重新计算总成本
    const unitCost = updates.unitCost ?? existing.unitCost;
    const seats = updates.seats ?? existing.seats;
    const billingCycle = (updates.billingCycle ?? existing.billingCycle) as BillingCycle;
    updateData.total_cost = this.calculateTotalCost(unitCost, seats, billingCycle);

    const updated = await this.repository.update(id, updateData);

    return this.entityToSaaSCost(updated);
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(id: string): Promise<boolean> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return false;
    }

    await this.repository.update(id, {
      status: 'cancelled',
      end_date: new Date(),
    });
    return true;
  }

  /**
   * 获取所有订阅
   */
  async getSubscriptions(filter?: { tool?: string; status?: string; tenantId?: string }): Promise<SaaSCost[]> {
    let entities;

    if (filter?.tool) {
      entities = await this.repository.findByTool(filter.tool);
    } else if (filter?.status) {
      entities = await this.repository.findByStatus(filter.status);
    } else {
      const { entities: all } = await this.repository.findAll({ limit: 1000 });
      entities = all;
    }

    // Apply additional filters
    let results = entities;
    if (filter?.tool && filter?.status) {
      results = results.filter((s) => s.status === filter.status);
    }
    if (filter?.tenantId) {
      results = results.filter((s) => s.tenantId === filter.tenantId);
    }

    return results
      .map((e) => this.entityToSaaSCost(e))
      .sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * 获取单个订阅详情
   */
  async getSubscription(id: string): Promise<SaaSCost | undefined> {
    const entity = await this.repository.findById(id);
    if (!entity) return undefined;
    return this.entityToSaaSCost(entity);
  }

  /**
   * 计算月度成本
   *
   * 将不同计费周期的订阅统一转换为月度成本
   */
  async getMonthlyCost(filter?: { tool?: string; tenantId?: string }): Promise<number> {
    const subscriptions = await this.getSubscriptions(
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
  async getAnnualProjection(filter?: { tool?: string; tenantId?: string }): Promise<number> {
    const monthlyCost = await this.getMonthlyCost(filter);
    return Math.round(monthlyCost * 12 * 100) / 100;
  }

  /**
   * 按工具分组获取月度成本
   */
  async getMonthlyCostByTool(): Promise<Record<string, number>> {
    const { entities } = await this.repository.findAll({ where: { status: 'active' }, limit: 1000 });
    const tools = new Set<string>();
    for (const sub of entities) {
      tools.add(sub.tool);
    }

    const result: Record<string, number> = {};
    for (const tool of tools) {
      result[tool] = await this.getMonthlyCost({ tool });
    }

    return result;
  }

  /**
   * 许可证使用率分析
   *
   * 返回各工具的席位使用情况
   */
  async getLicenseUtilization(): Promise<Record<string, {
    tool: string;
    totalSeats: number;
    activeSeats: number;
    utilizationRate: number;
    monthlyCost: number;
    costPerActiveSeat: number;
  }>> {
    const { entities } = await this.repository.findAll({ where: { status: 'active' }, limit: 1000 });

    const toolMap = new Map<string, { totalSeats: number; activeSeats: number; monthlyCost: number }>();

    for (const sub of entities) {
      const existing = toolMap.get(sub.tool) || {
        totalSeats: 0,
        activeSeats: 0,
        monthlyCost: 0,
      };

      existing.totalSeats += sub.seats;
      // 假设 80% 的席位是活跃的（Mock 数据，实际应从使用日志获取）
      existing.activeSeats += Math.ceil(sub.seats * 0.8);
      existing.monthlyCost += this.amortizeToMonthly(sub.totalCost, sub.billingCycle as BillingCycle, sub.startDate!, sub.endDate!);

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
  async getSubscriptionCount(): Promise<number> {
    const { total } = await this.repository.findAll({ limit: 1 });
    return total;
  }

  /**
   * 将 Entity 转换为 SaaSCost
   */
  private entityToSaaSCost(entity: any): SaaSCost {
    return {
      id: entity.id,
      tool: entity.tool,
      subscription: entity.subscription || '',
      seats: entity.seats,
      unitCost: entity.unitCost,
      totalCost: entity.totalCost,
      billingCycle: entity.billingCycle as BillingCycle,
      startDate: entity.startDate,
      endDate: entity.endDate,
      tenantId: entity.tenantId || undefined,
      status: entity.status as 'active' | 'cancelled' | 'expired',
      notes: entity.notes || undefined,
    };
  }
}
