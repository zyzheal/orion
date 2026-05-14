/**
 * Ticket Analytics Service - stub for orion-efficiency-svc
 *
 * Provides analytical queries over ticket data.
 * Wraps TicketService for analytics operations.
 */

import { DatabasePool } from '../../utils/database';
import { TicketService } from './TicketService';

export class TicketAnalyticsService {
  private db: DatabasePool;
  private ticketService: TicketService;

  constructor(db: DatabasePool) {
    this.db = db;
    this.ticketService = new TicketService();
  }

  getSLACompliance(periodStart?: Date, periodEnd?: Date): {
    complianceRate: number;
    breachedTickets: number;
    totalTickets: number;
  } {
    return this.ticketService.getSLACompliance(periodStart, periodEnd);
  }

  getResolutionStats(): {
    meanResolutionTimeMs: number;
    medianResolutionTimeMs: number;
  } {
    return this.ticketService.getResolutionStats();
  }

  getBacklogAnalysis(): {
    openCount: number;
    overdueCount: number;
    averageAgeMs: number;
    oldestTicketAgeMs: number;
  } {
    return this.ticketService.getBacklogAnalysis();
  }

  getTrendReport(options?: { days?: number; granularity?: string }): {
    dataPoints: Array<{ period: string; created: number; resolved: number; open: number }>;
    totalCreated: number;
    totalResolved: number;
    trend: string;
  } {
    return this.ticketService.getTrendReport(options);
  }

  getStatistics(): {
    totalTickets: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    averageResolutionTimeMs: number;
    slaComplianceRate: number;
  } {
    return this.ticketService.getStatistics();
  }
}
