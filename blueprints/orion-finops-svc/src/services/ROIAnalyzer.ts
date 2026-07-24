/**
 * TASK-502: ROI 分析引擎
 *
 * 计算基础设施投资 ROI、自动化节省评估、效率指标分析
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ROIAnalysis,
  ROIInvestmentType,
  CostPeriod,
  CostComparison,
} from '../types/finops';

/**
 * ROI 分析输入参数
 */
export interface ROIInput {
  /** 投资类型 */
  investmentType: ROIInvestmentType;
  /** 投资名称 */
  name: string;
  /** 投资成本（总额） */
  cost: number;
  /** 月节省金额 */
  monthlySavings: number;
  /** 月时间节省（小时） */
  timeSavingsHours?: number;
  /** 描述 */
  description?: string;
  /** 详细数据 */
  details?: Record<string, any>;
}

/**
 * 周期对比输入
 */
export interface PeriodComparisonInput {
  /** 描述 */
  description: string;
  /** 周期前成本 */
  beforeCost: number;
  /** 周期后成本 */
  afterCost: number;
  /** 时间节省（小时/月） */
  timeSavingsHours?: number;
  /** 统计周期 */
  period: CostPeriod;
}

/**
 * ROI 分析引擎
 *
 * 评估各类投资的回报率，包括基础设施投资、自动化工具、
 * 迁移项目等的成本效益分析
 */
export class ROIAnalyzer {
  /** ROI 分析历史记录 */
  private analyses: ROIAnalysis[] = [];

  /** 前后对比记录 */
  private comparisons: CostComparison[] = [];

  /**
   * 计算 ROI
   *
   * 基于投资成本和预期节省，计算投资回报率和回本周期
   */
  calculateROI(input: ROIInput): ROIAnalysis {
    // 年度节省
    const annualSavings = input.monthlySavings * 12;
    // ROI = (年收益 - 投资成本) / 投资成本 * 100
    const roiPercentage =
      input.cost > 0
        ? ((annualSavings - input.cost) / input.cost) * 100
        : 0;
    // 回本周期 = 投资成本 / 月节省
    const paybackMonths =
      input.monthlySavings > 0
        ? input.cost / input.monthlySavings
        : Infinity;

    const analysis: ROIAnalysis = {
      id: uuidv4(),
      investmentType: input.investmentType,
      name: input.name,
      cost: input.cost,
      savings: annualSavings,
      period: 'yearly',
      roiPercentage: Math.round(roiPercentage * 100) / 100,
      paybackMonths:
        paybackMonths === Infinity ? -1 : Math.round(paybackMonths * 100) / 100,
      analyzedAt: new Date(),
      description: input.description,
      details: {
        monthlySavings: input.monthlySavings,
        annualSavings,
        timeSavingsHours: input.timeSavingsHours,
        ...input.details,
      },
    };

    this.analyses.push(analysis);
    return analysis;
  }

  /**
   * 分析自动化节省
   *
   * 评估自动化带来的成本和时间节省
   *
   * @param manualHoursPerMonth 人工操作每月耗时（小时）
   * @param hourlyRate 人工成本（元/小时）
   * @param automationCost 自动化建设成本
   * @param automationMaintenancePerMonth 自动化运维成本（月）
   * @param timeSavingsPercent 自动化节省时间百分比（0-100）
   */
  analyzeAutomationSavings(params: {
    name: string;
    manualHoursPerMonth: number;
    hourlyRate: number;
    automationCost: number;
    automationMaintenancePerMonth?: number;
    timeSavingsPercent: number;
    description?: string;
  }): ROIAnalysis {
    const maintenance = params.automationMaintenancePerMonth || 0;
    // 人工成本（月）
    const manualCostPerMonth = params.manualHoursPerMonth * params.hourlyRate;
    // 自动化后的人工成本（月）
    const remainingHours =
      params.manualHoursPerMonth * (1 - params.timeSavingsPercent / 100);
    const automatedCostPerMonth = remainingHours * params.hourlyRate;
    // 净月节省 = 原人工成本 - 自动化后成本 - 运维成本
    const netMonthlySavings =
      manualCostPerMonth - automatedCostPerMonth - maintenance;
    // 时间节省
    const timeSavingsHours =
      params.manualHoursPerMonth * (params.timeSavingsPercent / 100);

    return this.calculateROI({
      investmentType: 'automation',
      name: params.name,
      cost: params.automationCost,
      monthlySavings: netMonthlySavings,
      timeSavingsHours,
      description: params.description,
      details: {
        manualHoursPerMonth: params.manualHoursPerMonth,
        hourlyRate: params.hourlyRate,
        manualCostPerMonth,
        automatedCostPerMonth,
        maintenancePerMonth: maintenance,
        timeSavingsPercent: params.timeSavingsPercent,
      },
    });
  }

  /**
   * 对比两个周期的成本
   *
   * 比较自动化/优化前后的成本差异
   */
  comparePeriods(input: PeriodComparisonInput): CostComparison {
    const savings = input.beforeCost - input.afterCost;
    const savingsPercent =
      input.beforeCost > 0 ? (savings / input.beforeCost) * 100 : 0;

    const comparison: CostComparison = {
      id: uuidv4(),
      description: input.description,
      beforeCost: Math.round(input.beforeCost * 100) / 100,
      afterCost: Math.round(input.afterCost * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      savingsPercent: Math.round(savingsPercent * 100) / 100,
      timeSavingsHours: input.timeSavingsHours,
      period: input.period,
    };

    this.comparisons.push(comparison);
    return comparison;
  }

  /**
   * 获取 ROI 历史记录
   */
  getROIHistory(filter?: {
    investmentType?: ROIInvestmentType;
    minROI?: number;
  }): ROIAnalysis[] {
    let analyses = [...this.analyses];

    if (filter?.investmentType) {
      analyses = analyses.filter(
        (a) => a.investmentType === filter.investmentType
      );
    }
    if (filter?.minROI !== undefined) {
      analyses = analyses.filter((a) => a.roiPercentage >= filter.minROI!);
    }

    // 按分析时间倒序
    return analyses.sort(
      (a, b) => b.analyzedAt.getTime() - a.analyzedAt.getTime()
    );
  }

  /**
   * 获取前后对比历史
   */
  getComparisons(filter?: { period?: CostPeriod }): CostComparison[] {
    let comparisons = [...this.comparisons];

    if (filter?.period) {
      comparisons = comparisons.filter((c) => c.period === filter.period);
    }

    return comparisons;
  }

  /**
   * 获取汇总指标
   */
  getSummary(): {
    totalAnalyses: number;
    averageROI: number;
    averagePaybackMonths: number;
    totalComparisons: number;
    totalSavings: number;
  } {
    const validPayback = this.analyses.filter((a) => a.paybackMonths > 0);
    const totalSavings = this.comparisons.reduce(
      (sum, c) => sum + c.savings,
      0
    );

    return {
      totalAnalyses: this.analyses.length,
      averageROI:
        this.analyses.length > 0
          ? Math.round(
              (this.analyses.reduce((sum, a) => sum + a.roiPercentage, 0) /
                this.analyses.length) *
                100
            ) / 100
          : 0,
      averagePaybackMonths:
        validPayback.length > 0
          ? Math.round(
              (validPayback.reduce((sum, a) => sum + a.paybackMonths, 0) /
                validPayback.length) *
                100
            ) / 100
          : 0,
      totalComparisons: this.comparisons.length,
      totalSavings: Math.round(totalSavings * 100) / 100,
    };
  }

  /**
   * 清空所有数据
   */
  clearAll(): void {
    this.analyses = [];
    this.comparisons = [];
  }
}
