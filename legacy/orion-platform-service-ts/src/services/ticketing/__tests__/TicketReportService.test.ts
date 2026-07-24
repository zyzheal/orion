/**
 * TASK-801: TicketReportService Unit Tests
 */

import { TicketReportService } from '../TicketReportService';
import { Ticket, TicketSLA, TicketStatus, TicketPriority, TicketCategory } from '../types';

describe('TicketReportService', () => {
  let reporter: TicketReportService;

  beforeEach(() => {
    reporter = new TicketReportService();
  });

  // Helper to create test tickets
  function createTicket(overrides: Partial<Ticket> = {}): Ticket {
    const now = new Date();
    return {
      id: `TKT-test-${Date.now()}-${Math.random()}`,
      title: 'Test Ticket',
      description: 'Test description',
      category: 'infrastructure',
      priority: 'medium',
      status: 'open',
      reporter: 'test-user',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
      escalationLevel: 0,
      ...overrides,
    };
  }

  // Helper to create SLA records
  function createSLA(ticketId: string, overrides: Partial<TicketSLA> = {}): TicketSLA {
    return {
      id: `SLA-test-${ticketId}`,
      ticketId,
      slaTargetId: 'sla-default',
      targetResolutionTimeMs: 24 * 60 * 60 * 1000, // 24 hours
      breached: false,
      responseBreached: false,
      ...overrides,
    };
  }

  // ==================== getSLACompliance ====================

  describe('getSLACompliance', () => {
    it('should calculate 100% compliance for all compliant tickets', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'resolved', priority: 'high', createdAt: new Date(now.getTime() - 1000), updatedAt: now }),
        createTicket({ id: 't2', status: 'resolved', priority: 'medium', createdAt: new Date(now.getTime() - 2000), updatedAt: now }),
      ];

      const slaRecords = [
        createSLA('t1', { breached: false }),
        createSLA('t2', { breached: false }),
      ];

      const report = reporter.getSLACompliance(tickets, slaRecords);

      expect(report.complianceRate).toBe(100);
      expect(report.compliantTickets).toBe(2);
      expect(report.breachedTickets).toBe(0);
    });

    it('should calculate partial compliance', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'resolved', createdAt: now }),
        createTicket({ id: 't2', status: 'resolved', createdAt: now }),
        createTicket({ id: 't3', status: 'open', createdAt: now }),
        createTicket({ id: 't4', status: 'open', createdAt: now }),
      ];

      const slaRecords = [
        createSLA('t1', { breached: false }),
        createSLA('t2', { breached: false }),
        createSLA('t3', { breached: true, breachedAt: now }),
        createSLA('t4', { breached: true, breachedAt: now }),
      ];

      const report = reporter.getSLACompliance(tickets, slaRecords);

      expect(report.complianceRate).toBe(50);
      expect(report.compliantTickets).toBe(2);
      expect(report.breachedTickets).toBe(2);
    });

    it('should break down compliance by priority', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', priority: 'critical', createdAt: now }),
        createTicket({ id: 't2', priority: 'critical', createdAt: now }),
        createTicket({ id: 't3', priority: 'low', createdAt: now }),
      ];

      const slaRecords = [
        createSLA('t1', { breached: false }),
        createSLA('t2', { breached: true }),
        createSLA('t3', { breached: false }),
      ];

      const report = reporter.getSLACompliance(tickets, slaRecords);

      expect(report.byPriority.critical.total).toBe(2);
      expect(report.byPriority.critical.compliant).toBe(1);
      expect(report.byPriority.critical.rate).toBe(50);
    });

    it('should break down compliance by category', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', category: 'infrastructure', createdAt: now }),
        createTicket({ id: 't2', category: 'database', createdAt: now }),
      ];

      const slaRecords = [
        createSLA('t1', { breached: false }),
        createSLA('t2', { breached: false }),
      ];

      const report = reporter.getSLACompliance(tickets, slaRecords);

      expect(report.byCategory['infrastructure'].total).toBe(1);
      expect(report.byCategory['database'].total).toBe(1);
    });

    it('should handle empty input', () => {
      const report = reporter.getSLACompliance([], []);

      expect(report.complianceRate).toBe(100);
      expect(report.totalTickets).toBe(0);
    });

    it('should filter by date range', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      const tickets = [
        createTicket({ id: 't1', createdAt: oldDate }),
        createTicket({ id: 't2', createdAt: recentDate }),
      ];

      const slaRecords = [
        createSLA('t1', { breached: false }),
        createSLA('t2', { breached: false }),
      ];

      // Only last 10 days
      const startDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const report = reporter.getSLACompliance(tickets, slaRecords, startDate, now);

      expect(report.totalTickets).toBe(1); // Only t2
    });
  });

  // ==================== getResolutionStats ====================

  describe('getResolutionStats', () => {
    it('should calculate mean resolution time', () => {
      const now = new Date();
      const tickets = [
        createTicket({
          id: 't1',
          status: 'resolved',
          createdAt: new Date(now.getTime() - 2000),
          updatedAt: now,
        }),
        createTicket({
          id: 't2',
          status: 'closed',
          createdAt: new Date(now.getTime() - 4000),
          updatedAt: now,
        }),
      ];

      const stats = reporter.getResolutionStats(tickets);

      expect(stats.meanResolutionTimeMs).toBe(3000); // (2000 + 4000) / 2
      expect(stats.totalResolved).toBe(2);
    });

    it('should calculate median resolution time', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'resolved', createdAt: new Date(now.getTime() - 1000), updatedAt: now }),
        createTicket({ id: 't2', status: 'resolved', createdAt: new Date(now.getTime() - 2000), updatedAt: now }),
        createTicket({ id: 't3', status: 'resolved', createdAt: new Date(now.getTime() - 3000), updatedAt: now }),
      ];

      const stats = reporter.getResolutionStats(tickets);

      expect(stats.medianResolutionTimeMs).toBe(2000);
    });

    it('should calculate p95 resolution time', () => {
      const now = new Date();
      const tickets: Ticket[] = [];

      // Create 20 tickets with resolution times from 1000 to 20000
      for (let i = 0; i < 20; i++) {
        tickets.push(createTicket({
          id: `t${i}`,
          status: 'resolved',
          createdAt: new Date(now.getTime() - (i + 1) * 1000),
          updatedAt: now,
        }));
      }

      const stats = reporter.getResolutionStats(tickets);

      expect(stats.p95ResolutionTimeMs).toBeGreaterThan(0);
    });

    it('should break down by priority', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'resolved', priority: 'critical', createdAt: new Date(now.getTime() - 1000), updatedAt: now }),
        createTicket({ id: 't2', status: 'resolved', priority: 'critical', createdAt: new Date(now.getTime() - 3000), updatedAt: now }),
        createTicket({ id: 't3', status: 'resolved', priority: 'low', createdAt: new Date(now.getTime() - 2000), updatedAt: now }),
      ];

      const stats = reporter.getResolutionStats(tickets);

      expect(stats.byPriority.critical.count).toBe(2);
      expect(stats.byPriority.critical.mean).toBe(2000);
      expect(stats.byPriority.low.count).toBe(1);
    });

    it('should break down by category', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'resolved', category: 'database', createdAt: new Date(now.getTime() - 2000), updatedAt: now }),
        createTicket({ id: 't2', status: 'resolved', category: 'database', createdAt: new Date(now.getTime() - 4000), updatedAt: now }),
      ];

      const stats = reporter.getResolutionStats(tickets);

      expect(stats.byCategory['database'].count).toBe(2);
      expect(stats.byCategory['database'].mean).toBe(3000);
    });

    it('should handle no resolved tickets', () => {
      const tickets = [
        createTicket({ id: 't1', status: 'open' }),
        createTicket({ id: 't2', status: 'assigned' }),
      ];

      const stats = reporter.getResolutionStats(tickets);

      expect(stats.meanResolutionTimeMs).toBe(0);
      expect(stats.totalResolved).toBe(0);
    });
  });

  // ==================== getBacklogAnalysis ====================

  describe('getBacklogAnalysis', () => {
    it('should count open tickets by status', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'open', createdAt: new Date(now.getTime() - 1000) }),
        createTicket({ id: 't2', status: 'open', createdAt: new Date(now.getTime() - 2000) }),
        createTicket({ id: 't3', status: 'assigned', createdAt: new Date(now.getTime() - 3000) }),
        createTicket({ id: 't4', status: 'in-progress', createdAt: new Date(now.getTime() - 4000) }),
        createTicket({ id: 't5', status: 'resolved', createdAt: new Date(now.getTime() - 5000) }),
      ];

      const analysis = reporter.getBacklogAnalysis(tickets);

      expect(analysis.openCount).toBe(2);
      expect(analysis.assignedCount).toBe(1);
      expect(analysis.inProgressCount).toBe(1);
    });

    it('should count overdue tickets', () => {
      const now = new Date();
      const overdueDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

      const tickets = [
        createTicket({ id: 't1', status: 'open', createdAt: overdueDate, dueDate: new Date(now.getTime() - 1000) }),
        createTicket({ id: 't2', status: 'open', createdAt: now }),
      ];

      const analysis = reporter.getBacklogAnalysis(tickets);

      expect(analysis.overdueCount).toBe(1);
    });

    it('should calculate average age', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'open', createdAt: new Date(now.getTime() - 2000) }),
        createTicket({ id: 't2', status: 'open', createdAt: new Date(now.getTime() - 4000) }),
      ];

      const analysis = reporter.getBacklogAnalysis(tickets);

      expect(analysis.averageAgeMs).toBe(3000);
    });

    it('should find oldest ticket age', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'open', createdAt: new Date(now.getTime() - 1000) }),
        createTicket({ id: 't2', status: 'open', createdAt: new Date(now.getTime() - 5000) }),
        createTicket({ id: 't3', status: 'open', createdAt: new Date(now.getTime() - 3000) }),
      ];

      const analysis = reporter.getBacklogAnalysis(tickets);

      expect(analysis.oldestTicketAgeMs).toBe(5000);
    });

    it('should break down by priority', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'open', priority: 'critical' }),
        createTicket({ id: 't2', status: 'open', priority: 'high' }),
        createTicket({ id: 't3', status: 'open', priority: 'critical' }),
      ];

      const analysis = reporter.getBacklogAnalysis(tickets);

      expect(analysis.byPriority.critical).toBe(2);
      expect(analysis.byPriority.high).toBe(1);
      expect(analysis.byPriority.medium).toBe(0);
    });

    it('should break down by category', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'open', category: 'infrastructure' }),
        createTicket({ id: 't2', status: 'open', category: 'database' }),
        createTicket({ id: 't3', status: 'open', category: 'infrastructure' }),
      ];

      const analysis = reporter.getBacklogAnalysis(tickets);

      expect(analysis.byCategory['infrastructure']).toBe(2);
      expect(analysis.byCategory['database']).toBe(1);
    });

    it('should handle empty backlog', () => {
      const analysis = reporter.getBacklogAnalysis([]);

      expect(analysis.openCount).toBe(0);
      expect(analysis.averageAgeMs).toBe(0);
    });
  });

  // ==================== getTrendReport ====================

  describe('getTrendReport', () => {
    it('should generate trend data points', () => {
      const now = new Date();
      const tickets: Ticket[] = [];

      // Create tickets spread across the last 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        tickets.push(createTicket({
          id: `created-${i}`,
          status: 'open',
          createdAt: date,
          updatedAt: date,
        }));

        // Some resolved
        if (i < 5) {
          tickets.push(createTicket({
            id: `resolved-${i}`,
            status: 'resolved',
            createdAt: new Date(date.getTime() - 2 * 24 * 60 * 60 * 1000),
            updatedAt: date,
          }));
        }
      }

      const report = reporter.getTrendReport(tickets, { days: 7, granularity: 'day' });

      expect(report.dataPoints.length).toBeGreaterThan(0);
      expect(report.totalCreated).toBeGreaterThan(0);
      expect(report.totalResolved).toBe(5);
    });

    it('should determine trend direction', () => {
      const now = new Date();
      const tickets: Ticket[] = [];

      // Create increasing number of tickets (more in recent days)
      // Last 2 days: 10 tickets each
      for (let i = 0; i < 20; i++) {
        tickets.push(createTicket({
          id: `recent-${i}`,
          status: 'open',
          createdAt: new Date(now.getTime() - Math.random() * 2 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        }));
      }

      // First 8 days: 1 ticket each
      for (let i = 0; i < 8; i++) {
        tickets.push(createTicket({
          id: `old-${i}`,
          status: 'open',
          createdAt: new Date(now.getTime() - (10 + i) * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        }));
      }

      const report = reporter.getTrendReport(tickets, { days: 10, granularity: 'day' });

      expect(report.trend).toBe('increasing');
    });

    it('should calculate net change', () => {
      const now = new Date();
      const tickets = [
        createTicket({ id: 't1', status: 'open', createdAt: new Date(now.getTime() - 1000) }),
        createTicket({ id: 't2', status: 'open', createdAt: new Date(now.getTime() - 2000) }),
        createTicket({ id: 't3', status: 'resolved', createdAt: new Date(now.getTime() - 5000), updatedAt: new Date(now.getTime() - 1000) }),
      ];

      const report = reporter.getTrendReport(tickets, { days: 1, granularity: 'hour' });

      expect(report.netChange).toBe(2); // 3 created - 1 resolved
    });

    it('should include average resolution time per bucket', () => {
      const now = new Date();
      const tickets = [
        createTicket({
          id: 't1',
          status: 'resolved',
          createdAt: new Date(now.getTime() - 5000),
          updatedAt: new Date(now.getTime() - 2000),
        }),
      ];

      const report = reporter.getTrendReport(tickets, { days: 1, granularity: 'hour' });

      // Check if avgResolutionTimeMs is set for at least one bucket
      const withAvgTime = report.dataPoints.filter(d => d.avgResolutionTimeMs !== undefined);
      expect(withAvgTime.length).toBeGreaterThan(0);
    });
  });
});
