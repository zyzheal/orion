/**
 * TimeTrendAnalyzer - Compute time-series trends for BI metrics
 *
 * Extracted from TicketBIService.getTimeTrend(). Supports metrics:
 * - volume: ticket creation and resolution counts
 * - resolution: average resolution hours
 * - sla: SLA compliance rate
 * - load: active ticket count
 *
 * Stateless computation: takes data context + options, returns result.
 */

import type { TimeGranularity } from '../../types';
import type { BIDataContext } from './BIDataContext';
import { createBuckets, getDefaultStart } from './TimeSeriesUtils';
import { computeSLARate, buildSLAMap } from './SLAUtils';

export interface TimeTrendOptions {
  metric?: 'volume' | 'resolution' | 'sla' | 'load';
  start?: Date;
  end?: Date;
  granularity?: TimeGranularity;
}

export interface TimeTrendPoint {
  period: string;
  value: number;
  details?: Record<string, number>;
}

/** Compute time-series trend data */
export function computeTimeTrend(context: BIDataContext, options: TimeTrendOptions = {}): TimeTrendPoint[] {
  const start = options.start ?? getDefaultStart();
  const end = options.end ?? new Date();
  const granularity = options.granularity ?? 'day';
  const metric = options.metric ?? 'volume';

  const buckets = createBuckets(start, end, granularity);
  const slaMap = buildSLAMap(context.slaRecords);

  return buckets.map((bucket) => {
    switch (metric) {
      case 'volume': {
        const created = context.tickets.filter(
          (t) => t.createdAt >= bucket.start && t.createdAt <= bucket.end
        ).length;
        const resolved = context.tickets.filter(
          (t) =>
            (t.status === 'resolved' || t.status === 'closed') &&
            t.updatedAt >= bucket.start &&
            t.updatedAt <= bucket.end
        ).length;
        return {
          period: bucket.label,
          value: created,
          details: { created, resolved },
        };
      }
      case 'resolution': {
        const bucketResolved = context.tickets.filter(
          (t) =>
            (t.status === 'resolved' || t.status === 'closed') &&
            t.updatedAt >= bucket.start &&
            t.updatedAt <= bucket.end
        );
        const hours = bucketResolved.map(
          (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
        );
        const avg = hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
        return {
          period: bucket.label,
          value: Math.round(avg * 100) / 100,
          details: { count: bucketResolved.length },
        };
      }
      case 'sla': {
        const bucketTickets = context.tickets.filter(
          (t) => t.createdAt >= bucket.start && t.createdAt <= bucket.end
        );
        const bucketSLAMap = buildSLAMap(
          context.slaRecords.filter((s) => bucketTickets.some((t) => t.id === s.ticketId))
        );
        return {
          period: bucket.label,
          value: computeSLARate(bucketTickets, bucketSLAMap),
        };
      }
      case 'load': {
        const active = context.tickets.filter(
          (t) =>
            ['open', 'assigned', 'in-progress'].includes(t.status) &&
            t.createdAt <= bucket.end
        ).length;
        return { period: bucket.label, value: active };
      }
      default:
        return { period: bucket.label, value: 0 };
    }
  });
}
