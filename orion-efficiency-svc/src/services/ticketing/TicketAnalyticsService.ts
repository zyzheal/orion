/**
 * Ticket Analytics Service - for orion-efficiency-svc
 *
 * Provides analytical queries over ticket data.
 * Wraps TicketService for analytics operations.
 */

import { DatabasePool } from '../../utils/database';
import { TicketRepository } from '../../repositories/TicketRepository';
import { TicketService } from './TicketService';

export class TicketAnalyticsService {
  private db: DatabasePool;
  private ticketService: TicketService;

  constructor(db: DatabasePool) {
    this.db = db;
    const repository = new TicketRepository(db);
    this.ticketService = new TicketService(repository);
  }

  async getSLACompliance(periodStart?: Date, periodEnd?: Date): Promise<{
    complianceRate: number;
    breachedTickets: number;
    totalTickets: number;
  }> {
    return this.ticketService.getSLACompliance(periodStart, periodEnd);
  }

  async getResolutionStats(): Promise<{
    meanResolutionTimeMs: number;
    medianResolutionTimeMs: number;
  }> {
    return this.ticketService.getResolutionStats();
  }

  async getBacklogAnalysis(): Promise<{
    openCount: number;
    overdueCount: number;
    averageAgeMs: number;
    oldestTicketAgeMs: number;
  }> {
    return this.ticketService.getBacklogAnalysis();
  }

  async getTrendReport(options?: { days?: number; granularity?: string }): Promise<{
    dataPoints: Array<{ period: string; created: number; resolved: number; open: number }>;
    totalCreated: number;
    totalResolved: number;
    trend: string;
  }> {
    return this.ticketService.getTrendReport(options);
  }

  async getStatistics(): Promise<{
    totalTickets: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    averageResolutionTimeMs: number;
    slaComplianceRate: number;
  }> {
    return this.ticketService.getStatistics();
  }
}
