/**
 * SLAUtils - Shared SLA computation utilities for Ticket BI
 *
 * Extracted from TicketBIService. Provides SLA compliance calculation
 * used by all dashboard builders and analytics modules.
 */

import type { Ticket, TicketSLA } from '../../types';

// ==================== SLA Compliance ====================

/**
 * Compute SLA compliance rate for a set of tickets.
 *
 * For each ticket:
 * - If SLA record exists: check breached flag
 * - If no SLA record but ticket is resolved/closed: count as compliant
 * - Otherwise: not counted
 */
export function computeSLARate(tickets: Ticket[], slaMap: Map<string, TicketSLA>): number {
  let compliant = 0;
  let total = 0;

  for (const t of tickets) {
    const sla = slaMap.get(t.id);
    if (sla) {
      total++;
      if (!sla.breached) compliant++;
    } else if (t.status === 'resolved' || t.status === 'closed') {
      total++;
      compliant++;
    }
  }

  return total > 0 ? (compliant / total) * 100 : 100;
}

/**
 * Compute SLA compliance for resolved tickets only.
 * Returns { compliant, total } for more detailed reporting.
 */
export function computeSLADetails(
  tickets: Ticket[],
  slaMap: Map<string, TicketSLA>
): { compliant: number; total: number; rate: number } {
  let compliant = 0;
  let total = 0;

  for (const t of tickets) {
    const sla = slaMap.get(t.id);
    if (sla) {
      total++;
      if (!sla.breached) compliant++;
    } else if (t.status === 'resolved' || t.status === 'closed') {
      total++;
      compliant++;
    }
  }

  return {
    compliant,
    total,
    rate: total > 0 ? (compliant / total) * 100 : 100,
  };
}

// ==================== Resolution Time ====================

/** Compute average resolution hours for resolved tickets */
export function computeAvgResolutionHours(tickets: Ticket[]): number {
  const resolved = tickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );

  if (resolved.length === 0) return 0;

  const hours = resolved.map(
    (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );

  return Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 100) / 100;
}

/** Compute resolution time statistics */
export function computeResolutionTimeStats(tickets: Ticket[]): {
  avgHours: number;
  medianHours: number;
  p95Hours: number;
} {
  const resolved = tickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );

  if (resolved.length === 0) {
    return { avgHours: 0, medianHours: 0, p95Hours: 0 };
  }

  const hours = resolved.map(
    (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );

  const sorted = [...hours].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;

  return {
    avgHours: Math.round(avg * 100) / 100,
    medianHours: sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0,
    p95Hours: sorted.length > 0
      ? sorted[Math.min(Math.ceil(0.95 * sorted.length) - 1, sorted.length - 1)]
      : 0,
  };
}

// ==================== SLA Map Builder ====================

/** Build a Map<ticketId, TicketSLA> from SLA records array */
export function buildSLAMap(slaRecords: TicketSLA[]): Map<string, TicketSLA> {
  return new Map(slaRecords.map((s) => [s.ticketId, s]));
}
