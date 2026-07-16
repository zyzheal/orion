// @ts-nocheck
/**
 * BIExporter - Export ticket data for external BI tools
 *
 * Extracted from TicketBIService.exportBIData(). Supports datasets:
 * - tickets: flat ticket list with resolution hours
 * - sla: SLA records with actual vs target
 * - dispatch: dispatch records
 * - efficiency: per-engineer per-period efficiency
 *
 * Stateless computation: takes data context + options, returns result.
 */

import type {
  Ticket,
  TicketSLA,
  DispatchResult,
  EngineerProfile,
  BIExportData,
  TimeGranularity,
} from '../../types';
import type { BIDataContext } from './BIDataContext';
import { createBuckets, filterByPeriod, getDefaultStart } from './TimeSeriesUtils';
import { computeSLARate, buildSLAMap } from './SLAUtils';

export interface BIExportOptions {
  dataset: 'tickets' | 'sla' | 'dispatch' | 'efficiency';
  granularity?: TimeGranularity;
  periodStart?: Date;
  periodEnd?: Date;
}

/** Export data for external BI tools */
export function exportBIData(context: BIDataContext, options: BIExportOptions): BIExportData {
  const start = options.periodStart ?? getDefaultStart();
  const end = options.periodEnd ?? new Date();
  const granularity = options.granularity ?? 'day';
  const { dataset } = options;

  let rows: Record<string, any>[] = [];
  let columns: { name: string; type: string; label: string }[] = [];

  switch (dataset) {
    case 'tickets': {
      const tickets = filterByPeriod(context.tickets, start, end);
      columns = [
        { name: 'id', type: 'string', label: 'Ticket ID' },
        { name: 'title', type: 'string', label: 'Title' },
        { name: 'category', type: 'string', label: 'Category' },
        { name: 'priority', type: 'string', label: 'Priority' },
        { name: 'status', type: 'string', label: 'Status' },
        { name: 'assignee', type: 'string', label: 'Assignee' },
        { name: 'source', type: 'string', label: 'Source' },
        { name: 'createdAt', type: 'datetime', label: 'Created At' },
        { name: 'updatedAt', type: 'datetime', label: 'Updated At' },
        { name: 'resolutionHours', type: 'number', label: 'Resolution Hours' },
      ];

      rows = tickets.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        priority: t.priority,
        status: t.status,
        assignee: t.assignee || null,
        source: t.source,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        resolutionHours:
          t.status === 'resolved' || t.status === 'closed'
            ? Math.round(((t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)) * 100) / 100
            : null,
      }));
      break;
    }

    case 'sla': {
      const slaRecords = context.slaRecords.filter((s) => {
        const ticket = context.tickets.find((t) => t.id === s.ticketId);
        return ticket && ticket.createdAt >= start && ticket.createdAt <= end;
      });

      columns = [
        { name: 'ticketId', type: 'string', label: 'Ticket ID' },
        { name: 'breached', type: 'boolean', label: 'SLA Breached' },
        { name: 'targetResolutionHours', type: 'number', label: 'Target Resolution Hours' },
        { name: 'actualResolutionHours', type: 'number', label: 'Actual Resolution Hours' },
        { name: 'firstResponseAt', type: 'datetime', label: 'First Response' },
      ];

      rows = slaRecords.map((s) => ({
        ticketId: s.ticketId,
        breached: s.breached,
        targetResolutionHours: Math.round((s.targetResolutionTimeMs / (1000 * 60 * 60)) * 100) / 100,
        actualResolutionHours: s.actualResolutionTimeMs
          ? Math.round((s.actualResolutionTimeMs / (1000 * 60 * 60)) * 100) / 100
          : null,
        firstResponseAt: s.firstResponseAt?.toISOString() || null,
      }));
      break;
    }

    case 'dispatch': {
      const dispatches = context.dispatchResults.filter(
        (d) => d.dispatchedAt >= start && d.dispatchedAt <= end
      );

      columns = [
        { name: 'ticketId', type: 'string', label: 'Ticket ID' },
        { name: 'assignee', type: 'string', label: 'Assignee' },
        { name: 'score', type: 'number', label: 'Dispatch Score' },
        { name: 'dispatchType', type: 'string', label: 'Dispatch Type' },
        { name: 'accepted', type: 'boolean', label: 'Accepted' },
        { name: 'dispatchedAt', type: 'datetime', label: 'Dispatched At' },
        { name: 'timeToAcceptanceMs', type: 'number', label: 'Time to Acceptance (ms)' },
      ];

      rows = dispatches.map((d) => ({
        ticketId: d.ticketId,
        assignee: d.assignee,
        score: d.score,
        dispatchType: d.dispatchType,
        accepted: d.accepted,
        dispatchedAt: d.dispatchedAt.toISOString(),
        timeToAcceptanceMs: d.timeToAcceptanceMs ?? null,
      }));
      break;
    }

    case 'efficiency': {
      // Per-engineer efficiency at granularity level
      const buckets = createBuckets(start, end, granularity);
      const engineerIds = new Set(
        context.tickets.map((t) => t.assignee).filter(Boolean) as string[]
      );

      columns = [
        { name: 'engineerId', type: 'string', label: 'Engineer ID' },
        { name: 'engineerName', type: 'string', label: 'Engineer Name' },
        { name: 'period', type: 'string', label: 'Period' },
        { name: 'assigned', type: 'number', label: 'Assigned' },
        { name: 'resolved', type: 'number', label: 'Resolved' },
        { name: 'avgResolutionHours', type: 'number', label: 'Avg Resolution Hours' },
        { name: 'slaComplianceRate', type: 'number', label: 'SLA Compliance Rate' },
        { name: 'compositeScore', type: 'number', label: 'Composite Score' },
      ];

      const slaMap = buildSLAMap(context.slaRecords);

      for (const eid of engineerIds) {
        for (const bucket of buckets) {
          const engTickets = context.tickets.filter(
            (t) =>
              t.assignee === eid &&
              t.createdAt >= bucket.start &&
              t.createdAt <= bucket.end
          );
          const engResolved = engTickets.filter(
            (t) => t.status === 'resolved' || t.status === 'closed'
          );

          let slaC = 0;
          let slaT = 0;
          for (const t of engResolved) {
            const sla = slaMap.get(t.id);
            if (sla) { slaT++; if (!sla.breached) slaC++; }
            else { slaT++; slaC++; }
          }

          const resTimes = engResolved.map(
            (t) => (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
          );
          const avgH = resTimes.length > 0
            ? resTimes.reduce((a, b) => a + b, 0) / resTimes.length
            : 0;

          const profile = context.engineerProfiles.get(eid);

          rows.push({
            engineerId: eid,
            engineerName: profile?.name || eid,
            period: bucket.label,
            assigned: engTickets.length,
            resolved: engResolved.length,
            avgResolutionHours: Math.round(avgH * 100) / 100,
            slaComplianceRate: slaT > 0 ? Math.round((slaC / slaT) * 10000) / 100 : 100,
            compositeScore: 0,
          });
        }
      }
      break;
    }
  }

  return {
    dataset,
    granularity,
    periodStart: start,
    periodEnd: end,
    rows,
    columns,
    generatedAt: new Date(),
  };
}
