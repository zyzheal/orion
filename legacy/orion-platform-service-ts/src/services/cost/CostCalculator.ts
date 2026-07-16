/**
 * Cost Calculator - 成本计算、聚合、ROI 分析
 *
 * 基于模型定价表计算每次请求的成本，并提供聚合分析和投资回报率计算。
 */

import { BudgetService } from './BudgetService';
import { ModelPricing, CostRecord } from '../../models/CostRecord';
import { OrionError } from '../../errors';
import { CostEstimateRepository } from '../../repositories/CostEstimateRepository';
import { createLogger } from '../../utils/logger';

const logger = createLogger('cost-calculator');

export interface CostEstimate {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

export interface RoiAnalysis {
  totalInvestment: number;
  estimatedSavings: number;
  roi: number; // 百分比
  paybackPeriod: number; // 月数
  monthlyNetBenefit: number;
}

export interface TrendDataPoint {
  period: string;
  cost: number;
  requests: number;
  avgCostPerRequest: number;
}

export class CostCalculator {
  private budgetService: BudgetService;
  private estimateRepo: CostEstimateRepository | null;

  constructor(budgetService: BudgetService, db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.budgetService = budgetService;
    this.estimateRepo = db ? new CostEstimateRepository(db) : null;
  }

  /**
   * 根据模型定价计算单次请求的成本
   */
  async calculateCost(params: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<CostEstimate> {
    const pricing = await this.budgetService.getPricingForModel(
      params.provider,
      params.model
    );

    if (!pricing) {
      throw new OrionError(`No pricing found for ${params.provider}/${params.model}`, 'OPERATION_FAILED');
    }

    const estimate = this._estimateFromPricing(pricing, params.inputTokens, params.outputTokens);

    // Persist estimate to PostgreSQL (fire-and-forget)
    this.estimateRepo?.create({
      id: `ce-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      model: estimate.model,
      provider: estimate.provider,
      input_tokens: estimate.inputTokens,
      output_tokens: estimate.outputTokens,
      input_cost: estimate.inputCost,
      output_cost: estimate.outputCost,
      total_cost: estimate.totalCost,
      currency: estimate.currency,
      tenant_id: 'default',
    }).catch((err) => logger.warn({ err: err as Error, stack: (err as Error).stack, model: estimate.model, provider: estimate.provider }, '[CostCalculator] Failed to persist cost estimate'));

    return estimate;
  }

  /**
   * 批量估算多个请求的成本
   */
  async estimateBatchCost(
    requests: Array<{
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
    }>
  ): Promise<{ totalCost: number; estimates: CostEstimate[] }> {
    const estimates: CostEstimate[] = [];
    let totalCost = 0;

    for (const req of requests) {
      try {
        const est = await this.calculateCost(req);
        estimates.push(est);
        totalCost += est.totalCost;
      } catch {
        // 忽略没有定价的请求
      }
    }

    return { totalCost: Math.round(totalCost * 10000) / 10000, estimates };
  }

  /**
   * 计算指定模型的 ROI（投资回报率）
   *
   * @param totalInvestment 总投资额（元）
   * @param manualCostPerTask 人工单次任务成本（元）
   * @param aiTasksCompleted AI 已完成任务数
   * @param monthlyAiCost 每月 AI 成本
   * @param analysisPeriodMonths 分析周期（月）
   */
  calculateRoi(params: {
    totalInvestment: number;
    manualCostPerTask: number;
    aiTasksCompleted: number;
    monthlyAiCost: number;
    analysisPeriodMonths: number;
  }): RoiAnalysis {
    const manualTotalCost = params.manualCostPerTask * params.aiTasksCompleted;
    const estimatedSavings = manualTotalCost - params.totalInvestment;
    const roi =
      params.totalInvestment > 0
        ? ((estimatedSavings / params.totalInvestment) * 100)
        : 0;

    const monthlyNetBenefit =
      params.analysisPeriodMonths > 0
        ? estimatedSavings / params.analysisPeriodMonths
        : 0;

    const paybackPeriod =
      monthlyNetBenefit > 0
        ? params.totalInvestment / monthlyNetBenefit
        : Infinity;

    return {
      totalInvestment: params.totalInvestment,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      paybackPeriod: Math.round(paybackPeriod * 10) / 10,
      monthlyNetBenefit: Math.round(monthlyNetBenefit * 100) / 100,
    };
  }

  /**
   * Calculate ROI report from cost data
   * P1-2 Fix: Added for frontend /v1/ai-cost/roi endpoint
   */
  async calculateROI(params: { period?: string }): Promise<{
    totalInvestment: number;
    totalCostSaved: number;
    roi: number;
    period: string;
    costBreakdown: Record<string, number>;
    trend: TrendDataPoint[];
  }> {
    const period = params.period || 'monthly';
    const now = new Date();
    let dateFrom: string;

    switch (period) {
      case 'weekly':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'monthly':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'quarterly':
        dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { records } = await this.budgetService.queryCosts({
      dateFrom,
      dateTo: now.toISOString(),
    });

    const totalInvestment = records.reduce((sum, r) => sum + r.totalCost, 0);

    // Estimate savings based on typical automation ROI (placeholder calculation)
    // In production, this should compare AI-assisted vs manual effort
    const estimatedSavings = totalInvestment * 2.5; // Assume 250% ROI as baseline

    const roi = totalInvestment > 0 ? ((estimatedSavings - totalInvestment) / totalInvestment) * 100 : 0;

    // Cost breakdown by model
    const costBreakdown: Record<string, number> = {};
    for (const record of records) {
      const key = `${record.provider}/${record.model}`;
      costBreakdown[key] = (costBreakdown[key] || 0) + record.totalCost;
    }

    // Compute trend
    const trend = await this.computeTrend({
      granularity: period === 'weekly' ? 'daily' : 'monthly',
      dateFrom,
      dateTo: now.toISOString(),
    });

    return {
      totalInvestment: Math.round(totalInvestment * 100) / 100,
      totalCostSaved: Math.round(estimatedSavings * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      period,
      costBreakdown,
      trend,
    };
  }

  /**
   * 根据成本记录计算趋势
   */
  async computeTrend(params: {
    tenantId?: string;
    projectId?: string;
    userId?: string;
    granularity: 'daily' | 'weekly' | 'monthly';
    dateFrom: string;
    dateTo: string;
  }): Promise<TrendDataPoint[]> {
    const { records } = await this.budgetService.queryCosts({
      tenantId: params.tenantId,
      projectId: params.projectId,
      userId: params.userId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });

    // 按时间周期分组
    const grouped: Map<string, { cost: number; requests: number }> = new Map();

    for (const record of records) {
      const period = this._formatPeriod(record.timestamp, params.granularity);
      const existing = grouped.get(period) ?? { cost: 0, requests: 0 };
      existing.cost += record.totalCost;
      existing.requests += 1;
      grouped.set(period, existing);
    }

    // 排序并转换为数据点
    const points: TrendDataPoint[] = [];
    const sortedKeys = Array.from(grouped.keys()).sort();

    for (const period of sortedKeys) {
      const data = grouped.get(period)!;
      points.push({
        period,
        cost: Math.round(data.cost * 100) / 100,
        requests: data.requests,
        avgCostPerRequest:
          data.requests > 0
            ? Math.round((data.cost / data.requests) * 10000) / 10000
            : 0,
      });
    }

    return points;
  }

  /**
   * 计算成本预测（基于历史数据的线性外推）
   */
  async forecastCost(params: {
    tenantId?: string;
    projectId?: string;
    userId?: string;
    daysAhead: number;
  }): Promise<{ forecastedCost: number; dailyAverage: number; confidence: string }> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { records } = await this.budgetService.queryCosts({
      tenantId: params.tenantId,
      projectId: params.projectId,
      userId: params.userId,
      dateFrom: thirtyDaysAgo.toISOString(),
      dateTo: now.toISOString(),
    });

    if (records.length === 0) {
      return { forecastedCost: 0, dailyAverage: 0, confidence: 'low' };
    }

    const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0);
    const dailyAverage = totalCost / 30;
    const forecastedCost = dailyAverage * params.daysAhead;

    // 根据数据量决定置信度
    let confidence = 'low';
    if (records.length >= 100) confidence = 'high';
    else if (records.length >= 30) confidence = 'medium';

    return {
      forecastedCost: Math.round(forecastedCost * 100) / 100,
      dailyAverage: Math.round(dailyAverage * 10000) / 10000,
      confidence,
    };
  }

  // ==================== Internal Helpers ====================

  private _estimateFromPricing(
    pricing: ModelPricing,
    inputTokens: number,
    outputTokens: number
  ): CostEstimate {
    const inputCost = (inputTokens / 1000) * pricing.inputPricePer1k;
    const outputCost = (outputTokens / 1000) * pricing.outputPricePer1k;
    const totalCost = inputCost + outputCost;

    return {
      model: pricing.model,
      provider: pricing.provider,
      inputTokens,
      outputTokens,
      inputCost: Math.round(inputCost * 10000) / 10000,
      outputCost: Math.round(outputCost * 10000) / 10000,
      totalCost: Math.round(totalCost * 10000) / 10000,
      currency: pricing.currency,
    };
  }

  private _formatPeriod(date: Date, granularity: 'daily' | 'weekly' | 'monthly'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (granularity) {
      case 'daily':
        return `${year}-${month}-${day}`;
      case 'weekly': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-W${String(
          Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
        ).padStart(2, '0')}`;
      }
      case 'monthly':
        return `${year}-${month}`;
    }
  }
}
