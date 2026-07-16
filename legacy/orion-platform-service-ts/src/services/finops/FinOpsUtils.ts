/**
 * FinOpsUtils - Shared utility functions for FinOps services
 *
 * Extracted from duplicated implementations in:
 * - FinOpsService.ts
 * - FinOpsCostCalculator.ts
 * - FinOpsAlertService.ts
 */

import type { CostPeriod } from './types';

/**
 * Get start and end dates for a cost period
 */
export function getPeriodDates(period: CostPeriod): { startDate: Date; endDate: Date } {
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
 * Get number of days in a cost period
 */
export function getPeriodDays(period: CostPeriod): number {
  switch (period) {
    case 'daily': return 1;
    case 'weekly': return 7;
    case 'monthly': return 30;
    case 'quarterly': return 90;
    case 'yearly': return 365;
    default: return 30;
  }
}

import type { CostTrend, CostTrendPoint } from './types';

/**
 * Compute cost trend from data points
 */
export function computeCostTrend(dataPoints: { date: Date; cost: number }[]): CostTrend {
  if (dataPoints.length === 0) {
    return { points: [], overallChangeRate: 0, averageCost: 0, maxCost: 0, minCost: 0 };
  }

  const sorted = [...dataPoints].sort((a, b) => a.date.getTime() - b.date.getTime());
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

  const costs = sorted.map(p => p.cost);
  const totalCost = costs.reduce((sum, c) => sum + c, 0);
  const firstCost = sorted[0].cost;
  const lastCost = sorted[sorted.length - 1].cost;
  const overallChangeRate = firstCost > 0 ? ((lastCost - firstCost) / firstCost) * 100 : 0;

  return {
    points,
    overallChangeRate: Math.round(overallChangeRate * 100) / 100,
    averageCost: Math.round((totalCost / costs.length) * 100) / 100,
    maxCost: Math.max(...costs),
    minCost: Math.min(...costs),
  };
}
