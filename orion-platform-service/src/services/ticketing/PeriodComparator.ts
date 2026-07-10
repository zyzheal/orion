/**
 * PeriodComparator - Compare two time periods for trend analysis
 *
 * Extracted from TicketBIService.comparePeriods(). Computes:
 * - Current and previous period metrics
 * - Change percentages and direction (up/down/same)
 *
 * Stateless computation: takes data context + period bounds, returns result.
 */

import type { Ticket, TicketSLA, PeriodComparison } from '../../types';
import type { BIDataContext } from './BIDataContext';
import { filterByPeriod } from './TimeSeriesUtils';
import { computeSLARate, buildSLAMap } from './SLAUtils';

export interface PeriodComparisonInput {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  context: BIDataContext;
}

/** Compare current period vs previous period */
export function comparePeriods(input: PeriodComparisonInput): PeriodComparison {
  const { currentStart, currentEnd, previousStart, previousEnd, context } = input;

  // ---- Current period metrics ----
  const currentTickets = filterByPeriod(context.tickets, currentStart, currentEnd);
  const currentResolved = currentTickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );
  const currentSlaMap = buildSLAMap(context.slaRecords);

  const currentResTimes = currentResolved.map(
    (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );
  const currentAvgRes =
    currentResTimes.length > 0
      ? currentResTimes.reduce((a, b) => a + b, 0) / currentResTimes.length
      : 0;

  const currentSLA = computeSLARate(currentTickets, currentSlaMap);

  const currentMetrics: Record<string, number> = {
    ticketsCreated: currentTickets.length,
    ticketsResolved: currentResolved.length,
    avgResolutionHours: Math.round(currentAvgRes * 100) / 100,
    slaComplianceRate: Math.round(currentSLA * 100) / 100,
    openTickets: currentTickets.filter(
      (t) => ['open', 'assigned', 'in-progress'].includes(t.status)
    ).length,
  };

  // ---- Previous period metrics ----
  const prevTickets = filterByPeriod(context.tickets, previousStart, previousEnd);
  const prevResolved = prevTickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );

  const prevResTimes = prevResolved.map(
    (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );
  const prevAvgRes =
    prevResTimes.length > 0
      ? prevResTimes.reduce((a, b) => a + b, 0) / prevResTimes.length
      : 0;

  const prevSlaMap = buildSLAMap(context.slaRecords);
  const prevSLA = computeSLARate(prevTickets, prevSlaMap);

  const prevMetrics: Record<string, number> = {
    ticketsCreated: prevTickets.length,
    ticketsResolved: prevResolved.length,
    avgResolutionHours: Math.round(prevAvgRes * 100) / 100,
    slaComplianceRate: Math.round(prevSLA * 100) / 100,
    openTickets: prevTickets.filter(
      (t) => ['open', 'assigned', 'in-progress'].includes(t.status)
    ).length,
  };

  // ---- Compute changes ----
  const changes = Object.keys(currentMetrics).map((metric) => {
    const current = currentMetrics[metric];
    const previous = prevMetrics[metric];
    const changePercent =
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
    const direction: 'up' | 'down' | 'same' =
      changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'same';

    return { metric, changePercent: Math.round(changePercent * 100) / 100, direction };
  });

  return {
    current: {
      period: `${currentStart.toISOString()} to ${currentEnd.toISOString()}`,
      metrics: currentMetrics,
    },
    previous: {
      period: `${previousStart.toISOString()} to ${previousEnd.toISOString()}`,
      metrics: prevMetrics,
    },
    changes,
  };
}
