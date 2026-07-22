/**
 * TASK-802: DispatchAnalytics Tests
 */

import { DispatchAnalytics } from '../DispatchAnalytics';
import {
  Ticket,
  EngineerProfile,
  DispatchResult,
} from '../types';

const createTestTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'TKT-test-1',
  title: 'Test Ticket',
  description: 'Test description',
  category: 'infrastructure',
  priority: 'high',
  status: 'open',
  reporter: 'user-1',
  source: 'manual',
  createdAt: new Date(),
  updatedAt: new Date(),
  escalationLevel: 0,
  ...overrides,
});

const createTestEngineer = (overrides: Partial<EngineerProfile> = {}): EngineerProfile => ({
  id: 'eng-1',
  name: 'Test Engineer',
  expertise: ['infrastructure'],
  currentLoad: 2,
  maxCapacity: 10,
  availability: 'available',
  resolutionStats: {
    totalResolved: 50,
    avgResolutionTimeMs: 2 * 60 * 60 * 1000,
    slaComplianceRate: 0.9,
    resolutionByCategory: {} as any,
    resolutionByPriority: {} as any,
    escalationCount: 2,
    satisfactionScore: 85,
  },
  ...overrides,
});

const createDispatchResult = (overrides: Partial<DispatchResult> = {}): DispatchResult => ({
  id: 'DISP-test-1',
  ticketId: 'TKT-test-1',
  assignee: 'eng-1',
  reason: 'Auto-dispatched',
  score: 75,
  dispatchedAt: new Date(),
  dispatchType: 'auto',
  accepted: true,
  ...overrides,
});

describe('DispatchAnalytics', () => {
  let analytics: DispatchAnalytics;

  beforeEach(() => {
    analytics = new DispatchAnalytics();
  });

  afterEach(() => {
    analytics.clearAll();
  });

  // ==================== Data Recording ====================

  describe('data recording', () => {
    it('should record a dispatch result', () => {
      const result = createDispatchResult();
      analytics.recordDispatch(result);

      const metrics = analytics.getDispatchMetrics();
      expect(metrics.totalDispatches).toBe(1);
    });

    it('should record ticket creation', () => {
      const ticket = createTestTicket();
      analytics.recordTicketCreated(ticket);

      const stats = analytics.getTimeToAssignment();
      // Should not crash, stats exist
      expect(stats).toBeDefined();
    });

    it('should record acceptance', () => {
      const ticket = createTestTicket();
      analytics.recordTicketCreated(ticket);

      const result = createDispatchResult({ ticketId: ticket.id });
      analytics.recordDispatch(result);

      analytics.recordAcceptance(ticket.id);

      const success = analytics.getAssignmentSuccess();
      expect(success.acceptanceRate).toBe(1);
    });

    it('should record rejection', () => {
      const result = createDispatchResult();
      analytics.recordDispatch(result);
      analytics.recordRejection(result.ticketId);

      const success = analytics.getAssignmentSuccess();
      expect(success.rejectionRate).toBe(1);
    });

    it('should record resolution', () => {
      const ticket = createTestTicket();
      analytics.recordTicketCreated(ticket);
      analytics.recordResolution(ticket.id);

      const stats = analytics.getTimeToAssignment();
      expect(stats).toBeDefined();
    });

    it('should register an engineer', () => {
      const profile = createTestEngineer();
      analytics.registerEngineer(profile);

      const perf = analytics.getEngineerPerformance('eng-1');
      expect(perf).not.toBeNull();
    });
  });

  // ==================== Dispatch Metrics ====================

  describe('dispatch metrics', () => {
    it('should return zero metrics with no data', () => {
      const metrics = analytics.getDispatchMetrics();

      expect(metrics.totalDispatches).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.avgDispatchScore).toBe(0);
    });

    it('should calculate success rate', () => {
      analytics.recordDispatch(createDispatchResult({ id: 'D1', accepted: true }));
      analytics.recordDispatch(createDispatchResult({ id: 'D2', accepted: true }));
      analytics.recordDispatch(createDispatchResult({ id: 'D3', accepted: false }));

      const metrics = analytics.getDispatchMetrics();
      expect(metrics.totalDispatches).toBe(3);
      expect(metrics.successfulDispatches).toBe(2);
      expect(metrics.failedDispatches).toBe(1);
      expect(metrics.successRate).toBeCloseTo(2 / 3, 2);
    });

    it('should calculate average score', () => {
      analytics.recordDispatch(createDispatchResult({ id: 'D1', score: 80 }));
      analytics.recordDispatch(createDispatchResult({ id: 'D2', score: 90 }));

      const metrics = analytics.getDispatchMetrics();
      expect(metrics.avgDispatchScore).toBe(85);
    });

    it('should calculate median score', () => {
      analytics.recordDispatch(createDispatchResult({ id: 'D1', score: 70 }));
      analytics.recordDispatch(createDispatchResult({ id: 'D2', score: 80 }));
      analytics.recordDispatch(createDispatchResult({ id: 'D3', score: 90 }));

      const metrics = analytics.getDispatchMetrics();
      expect(metrics.medianDispatchScore).toBe(80);
    });

    it('should track by dispatch type', () => {
      analytics.recordDispatch(createDispatchResult({ id: 'D1', dispatchType: 'auto' }));
      analytics.recordDispatch(createDispatchResult({ id: 'D2', dispatchType: 'manual' }));
      analytics.recordDispatch(createDispatchResult({ id: 'D3', dispatchType: 'rule' }));

      const metrics = analytics.getDispatchMetrics();
      expect(metrics.byType['auto']).toBeDefined();
      expect(metrics.byType['manual']).toBeDefined();
      expect(metrics.byType['rule']).toBeDefined();
    });

    it('should filter by time period', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3600000);

      analytics.recordDispatch(createDispatchResult({ id: 'D1', dispatchedAt: past }));
      analytics.recordDispatch(createDispatchResult({ id: 'D2', dispatchedAt: now }));

      const metrics = analytics.getDispatchMetrics({ periodStart: now });
      expect(metrics.totalDispatches).toBe(1);
    });
  });

  // ==================== Assignment Success ====================

  describe('assignment success', () => {
    it('should calculate acceptance rate', () => {
      analytics.recordDispatch(createDispatchResult({ id: 'D1', accepted: true }));
      analytics.recordDispatch(createDispatchResult({ id: 'D2', accepted: false }));

      const success = analytics.getAssignmentSuccess();
      expect(success.acceptanceRate).toBe(0.5);
      expect(success.rejectionRate).toBe(0.5);
    });

    it('should track time to acceptance', () => {
      const dispatchedAt = new Date(Date.now() - 60000); // 1 minute ago
      const acceptedAt = new Date();

      analytics.recordDispatch(createDispatchResult({
        id: 'D1',
        dispatchedAt,
        timeToAcceptanceMs: 60000,
      }));

      const success = analytics.getAssignmentSuccess();
      expect(success.avgTimeToAcceptanceMs).toBe(60000);
    });

    it('should track reassigned count', () => {
      analytics.recordDispatch(createDispatchResult({ id: 'D1', ticketId: 'TKT-1' }));
      analytics.recordDispatch(createDispatchResult({ id: 'D2', ticketId: 'TKT-1' }));
      analytics.recordDispatch(createDispatchResult({ id: 'D3', ticketId: 'TKT-2' }));

      const success = analytics.getAssignmentSuccess();
      expect(success.reassignedCount).toBe(1); // TKT-1 was reassigned
    });

    it('should calculate median time to acceptance', () => {
      analytics.recordDispatch(createDispatchResult({ id: 'D1', timeToAcceptanceMs: 30000 }));
      analytics.recordDispatch(createDispatchResult({ id: 'D2', timeToAcceptanceMs: 60000 }));
      analytics.recordDispatch(createDispatchResult({ id: 'D3', timeToAcceptanceMs: 90000 }));

      const success = analytics.getAssignmentSuccess();
      expect(success.medianTimeToAcceptanceMs).toBe(60000);
    });
  });

  // ==================== Time to Assignment ====================

  describe('time to assignment', () => {
    it('should return zero stats with no data', () => {
      const stats = analytics.getTimeToAssignment();

      expect(stats.avgTimeToAssignmentMs).toBe(0);
      expect(stats.medianTimeToAssignmentMs).toBe(0);
    });

    it('should calculate average time to assignment', () => {
      const ticket1 = createTestTicket({ id: 'TKT-1' });
      const ticket2 = createTestTicket({ id: 'TKT-2' });

      analytics.recordTicketCreated(ticket1);
      analytics.recordTicketCreated(ticket2);

      // Record dispatches with assignedAt
      const d1 = new Date(ticket1.createdAt.getTime() + 30000);
      const d2 = new Date(ticket2.createdAt.getTime() + 60000);

      analytics.recordDispatch(createDispatchResult({
        ticketId: 'TKT-1',
        dispatchedAt: d1,
      }));
      analytics.recordDispatch(createDispatchResult({
        ticketId: 'TKT-2',
        dispatchedAt: d2,
      }));

      // Update events with assignedAt
      analytics.recordAcceptance('TKT-1', d1);
      analytics.recordAcceptance('TKT-2', d2);

      const stats = analytics.getTimeToAssignment();
      expect(stats.avgTimeToAssignmentMs).toBe(45000);
    });

    it('should break down by priority', () => {
      const critical = createTestTicket({ id: 'TKT-c', priority: 'critical' });
      const low = createTestTicket({ id: 'TKT-l', priority: 'low' });

      analytics.recordTicketCreated(critical);
      analytics.recordTicketCreated(low);

      const d1 = new Date(critical.createdAt.getTime() + 10000);
      const d2 = new Date(low.createdAt.getTime() + 100000);

      analytics.recordDispatch(createDispatchResult({ ticketId: 'TKT-c', dispatchedAt: d1 }));
      analytics.recordDispatch(createDispatchResult({ ticketId: 'TKT-l', dispatchedAt: d2 }));
      analytics.recordAcceptance('TKT-c', d1);
      analytics.recordAcceptance('TKT-l', d2);

      const stats = analytics.getTimeToAssignment();
      expect(stats.byPriority.critical.count).toBe(1);
      expect(stats.byPriority.low.count).toBe(1);
    });

    it('should break down by category', () => {
      const infra = createTestTicket({ id: 'TKT-i', category: 'infrastructure' });
      const db = createTestTicket({ id: 'TKT-d', category: 'database' });

      analytics.recordTicketCreated(infra);
      analytics.recordTicketCreated(db);

      const d1 = new Date(infra.createdAt.getTime() + 20000);
      const d2 = new Date(db.createdAt.getTime() + 40000);

      analytics.recordDispatch(createDispatchResult({ ticketId: 'TKT-i', dispatchedAt: d1 }));
      analytics.recordDispatch(createDispatchResult({ ticketId: 'TKT-d', dispatchedAt: d2 }));
      analytics.recordAcceptance('TKT-i', d1);
      analytics.recordAcceptance('TKT-d', d2);

      const stats = analytics.getTimeToAssignment();
      expect(stats.byCategory.infrastructure.count).toBe(1);
      expect(stats.byCategory.database.count).toBe(1);
    });
  });

  // ==================== Engineer Performance ====================

  describe('engineer performance', () => {
    it('should return null for unknown engineer', () => {
      const perf = analytics.getEngineerPerformance('unknown');
      expect(perf).toBeNull();
    });

    it('should calculate performance data', () => {
      const engineer = createTestEngineer();
      analytics.registerEngineer(engineer);

      analytics.recordDispatch(createDispatchResult({ assignee: 'eng-1', accepted: true, score: 85 }));
      analytics.recordDispatch(createDispatchResult({ assignee: 'eng-1', accepted: true, score: 90 }));

      const perf = analytics.getEngineerPerformance('eng-1');
      expect(perf).not.toBeNull();
      expect(perf!.engineerId).toBe('eng-1');
      expect(perf!.totalAssigned).toBe(2);
      expect(perf!.acceptanceRate).toBe(1);
    });

    it('should assign performance grade', () => {
      const engineer = createTestEngineer({
        id: 'eng-perf',
        resolutionStats: {
          totalResolved: 100,
          avgResolutionTimeMs: 60 * 60 * 1000,
          slaComplianceRate: 0.95,
          resolutionByCategory: {} as any,
          resolutionByPriority: {} as any,
          escalationCount: 1,
          satisfactionScore: 90,
        },
      });
      analytics.registerEngineer(engineer);

      // Good dispatches
      for (let i = 0; i < 10; i++) {
        analytics.recordDispatch(createDispatchResult({
          id: `D-${i}`,
          assignee: 'eng-perf',
          accepted: true,
          score: 90,
        }));
      }

      const perf = analytics.getEngineerPerformance('eng-perf');
      expect(perf).not.toBeNull();
      expect(perf!.performanceGrade).toBeDefined();
      expect(['A', 'B', 'C', 'D', 'F']).toContain(perf!.performanceGrade);
    });

    it('should get all engineer performances', () => {
      analytics.registerEngineer(createTestEngineer({ id: 'eng-1' }));
      analytics.registerEngineer(createTestEngineer({ id: 'eng-2' }));

      analytics.recordDispatch(createDispatchResult({ assignee: 'eng-1', score: 80 }));
      analytics.recordDispatch(createDispatchResult({ assignee: 'eng-2', score: 90 }));

      const performances = analytics.getAllEngineerPerformances();
      expect(performances.length).toBe(2);
      // Sorted by score descending
      expect(performances[0].avgDispatchScore).toBeGreaterThanOrEqual(performances[1].avgDispatchScore);
    });
  });

  // ==================== Clear ====================

  describe('clearAll', () => {
    it('should clear all data', () => {
      analytics.recordDispatch(createDispatchResult());
      analytics.recordTicketCreated(createTestTicket());
      analytics.registerEngineer(createTestEngineer());

      analytics.clearAll();

      const metrics = analytics.getDispatchMetrics();
      expect(metrics.totalDispatches).toBe(0);
    });
  });
});
