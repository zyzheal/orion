/**
 * TimeSeriesUtils - Shared time-series utilities for Ticket BI computation
 *
 * Extracted from TicketBIService private helpers. Used by:
 * - ExecutiveDashboardBuilder (trends)
 * - ManagerDashboardBuilder (week-over-week)
 * - EngineerDashboardBuilder (personal trends)
 * - BIExporter (time aggregation)
 * - TimeTrendAnalyzer (time buckets)
 */

import type { Ticket } from '../../types';
import type { TimeGranularity } from '../../types';

// ==================== Time Formatting ====================

/** Format a date as a period label for the given granularity */
export function formatPeriod(date: Date, granularity: TimeGranularity): string {
  switch (granularity) {
    case 'hour':
      return date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    case 'day':
      return date.toISOString().slice(0, 10); // YYYY-MM-DD
    case 'week': {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().slice(0, 10);
    }
    case 'month':
      return date.toISOString().slice(0, 7); // YYYY-MM
    case 'quarter': {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    }
    case 'year':
      return date.getFullYear().toString();
    default:
      return date.toISOString().slice(0, 10);
  }
}

// ==================== Time Buckets ====================

/** Bucket boundary definition */
export interface TimeBucket {
  start: Date;
  end: Date;
  label: string;
}

/** Create time buckets between start and end */
export function createBuckets(
  start: Date,
  end: Date,
  granularity: TimeGranularity
): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  const current = new Date(start);

  while (current <= end) {
    const bucketEnd = getNextBucketEnd(current, granularity);
    const label = formatPeriod(current, granularity);

    buckets.push({
      start: new Date(current),
      end: bucketEnd > end.getTime() ? new Date(end) : new Date(bucketEnd),
      label,
    });

    advanceDate(current, granularity);
  }

  return buckets;
}

/** Get the end timestamp of the next bucket */
function getNextBucketEnd(current: Date, granularity: TimeGranularity): number {
  const next = new Date(current);
  advanceDate(next, granularity);
  return next.getTime();
}

/** Advance a date by one granularity unit */
function advanceDate(date: Date, granularity: TimeGranularity): void {
  switch (granularity) {
    case 'hour':
      date.setHours(date.getHours() + 1);
      break;
    case 'day':
      date.setDate(date.getDate() + 1);
      break;
    case 'week':
      date.setDate(date.getDate() + 7);
      break;
    case 'month':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarter':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
}

// ==================== Ticket Filtering ====================

/** Filter tickets created within a time range */
export function filterByPeriod(tickets: Ticket[], start: Date, end: Date): Ticket[] {
  return tickets.filter((t) => t.createdAt >= start && t.createdAt <= end);
}

/** Get tickets created within a time range (alias for filterByPeriod) */
export function getTicketsInBucket(start: Date, end: Date, tickets: Ticket[]): Ticket[] {
  return filterByPeriod(tickets, start, end);
}

/** Check if a ticket falls within a period */
export function isTicketInPeriod(ticketId: string, start: Date, end: Date, tickets: Ticket[]): boolean {
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) return false;
  return ticket.createdAt >= start && ticket.createdAt <= end;
}

/** Get default start date (30 days ago) */
export function getDefaultStart(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}
