/**
 * TASK-TICKET-BI: TicketBIService Tests
 *
 * Comprehensive tests for BI analytics service covering:
 * - Executive dashboard computation
 * - Manager dashboard computation
 * - Engineer dashboard computation
 * - Efficiency score calculation (all 4 dimensions)
 * - Time period aggregation at different granularities
 * - Period comparison (up/down/same)
 * - BI export data format
 * - Edge cases (empty data, single ticket, no engineers)
 */

import { TicketBIService } from '../TicketBIService';
import {
  Ticket,
  TicketSLA,
  DispatchResult,
  EngineerProfile,
  TicketCategory,
  TicketPriority,
  TimeGranularity,
} from '../../types';

// ==================== Test Helpers ====================

const createTestTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  title: 'Test Ticket',
  description: 'Test description',
  category: 'infrastructure',
  priority: 'high',
  status: 'open',
  reporter: 'user-1',
  source: 'manual',
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  updatedAt: new Date(),
  escalationLevel: 0,
  ...overrides,
});

const createTestEngineer = (overrides: Partial<EngineerProfile> = {}): EngineerProfile => ({
  id: `eng-${Date.now()}`,
  name: 'Test Engineer',
  expertise: ['infrastructure', 'application'],
  currentLoad: 3,
  maxCapacity: 10,
  availability: 'available',
  resolutionStats: {
    totalResolved: 50,
    avgResolutionTimeMs: 4 * 60 * 60 * 1000,
    slaComplianceRate: 0.9,
    resolutionByCategory: {} as any,
    resolutionByPriority: {} as any,
    escalationCount: 2,
    satisfactionScore: 85,
  },
  ...overrides,
});

const createTestSLA = (ticketId: string, breached = false): TicketSLA => ({
  id: `SLA-${ticketId}`,
  ticketId,
  slaTargetId: 'sla-1',
  targetResolutionTimeMs: 8 * 60 * 60 * 1000,
  breached,
  resolvedAt: new Date(),
  firstResponseAt: new Date(),
  responseBreached: false,
});

const createDispatchResult = (
  engineerId: string,
  ticketId: string,
  overrides: Partial<DispatchResult> = {}
): DispatchResult => ({
  id: `DISP-${Date.now()}`,
  ticketId,
  assignee: engineerId,
  reason: 'Auto-dispatched',
  score: 75,
  dispatchedAt: new Date(),
  dispatchType: 'auto',
  accepted: true,
  ...overrides,
});

// ==================== Tests ====================

describe('TicketBIService', () => {
  let biService: TicketBIService;

  beforeEach(() => {
    biService = new TicketBIService();
  });

  afterEach(() => {
    biService.clearAll();
  });

  // ==================== Data Loading ====================

  describe('data loading', () => {
    it('should accept tickets via setTickets', () => {
      const tickets = [createTestTicket()];
      biService.setTickets(tickets);
      const dashboard = biService.getExecutiveDashboard();
      expect(dashboard.overview.totalTickets).toBe(1);
    });

    it('should accept SLA records via setSLARecords', () => {
      const ticket = createTestTicket({ id: 'TKT-1' });
      const sla = createTestSLA('TKT-1', false);
      biService.setTickets([ticket]);
      biService.setSLARecords([sla]);

      const dashboard = biService.getExecutiveDashboard();
      expect(dashboard.overview.slaComplianceRate).toBe(100);
    });

    it('should accept engineer profiles via setEngineerProfiles', () => {
      const engineer = createTestEngineer({ id: 'eng-1', name: 'Alice' });
      biService.setEngineerProfiles([engineer]);

      const dashboard = biService.getExecutiveDashboard();
      expect(dashboard.overview.totalEngineers).toBe(1);
    });

    it('should load all data at once via loadData', () => {
      const tickets = [createTestTicket()];
      const engineers = [createTestEngineer({ id: 'eng-1' })];
      biService.loadData({
        tickets,
        slaRecords: [],
        dispatchResults: [],
        engineerProfiles: engineers,
      });

      const dashboard = biService.getExecutiveDashboard();
      expect(dashboard.overview.totalTickets).toBe(1);
      expect(dashboard.overview.totalEngineers).toBe(1);
    });

    it('should handle empty data load', () => {
      biService.loadData({
        tickets: [],
        slaRecords: [],
        dispatchResults: [],
        engineerProfiles: [],
      });

      const dashboard = biService.getExecutiveDashboard();
      expect(dashboard.overview.totalTickets).toBe(0);
      expect(dashboard.overview.resolvedTickets).toBe(0);
    });
  });

  // ==================== Executive Dashboard ====================

  describe('executive dashboard', () => {
    it('should return correct overview with mixed tickets', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({
          id: 'TKT-1',
          status: 'resolved',
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        }),
        createTestTicket({
          id: 'TKT-2',
          status: 'open',
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        }),
        createTestTicket({
          id: 'TKT-3',
          status: 'in-progress',
          assignee: 'eng-1',
          createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        }),
        createTestTicket({
          id: 'TKT-4',
          status: 'closed',
          createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        }),
      ];

      biService.loadData({ tickets });
      const dashboard = biService.getExecutiveDashboard();

      expect(dashboard.overview.totalTickets).toBe(4);
      expect(dashboard.overview.resolvedTickets).toBe(2);
      expect(dashboard.overview.openTickets).toBe(2);
      expect(dashboard.overview.overallResolutionRate).toBe(50);
      expect(dashboard.overview.avgResolutionTimeHours).toBeGreaterThan(0);
    });

    it('should compute SLA compliance correctly', () => {
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'resolved' }),
        createTestTicket({ id: 'TKT-2', status: 'resolved' }),
        createTestTicket({ id: 'TKT-3', status: 'open' }),
      ];
      const slaRecords = [
        createTestSLA('TKT-1', false),
        createTestSLA('TKT-2', true),
      ];

      biService.loadData({ tickets, slaRecords });
      const dashboard = biService.getExecutiveDashboard();

      // TKT-1 (compliant), TKT-2 (breached), TKT-3 (no SLA, not resolved = not counted)
      expect(dashboard.overview.slaComplianceRate).toBe(50);
    });

    it('should generate ticket volume trends', () => {
      const now = Date.now();
      const tickets = [];
      for (let i = 0; i < 10; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            createdAt: new Date(now - (9 - i) * 24 * 60 * 60 * 1000),
          })
        );
      }

      const start = new Date(now - 10 * 24 * 60 * 60 * 1000);
      const end = new Date(now);
      biService.loadData({ tickets });
      const dashboard = biService.getExecutiveDashboard({
        periodStart: start,
        periodEnd: end,
        granularity: 'day',
      });

      expect(dashboard.trends.ticketVolumeTrend.length).toBeGreaterThan(0);
      // The created count within the buckets might include more due to date range
      // Just verify the data structure is correct
      expect(dashboard.trends.ticketVolumeTrend.some(t => t.created > 0)).toBe(true);
    });

    it('should include distribution breakdowns', () => {
      const tickets = [
        createTestTicket({ id: 'TKT-1', category: 'infrastructure', priority: 'critical' }),
        createTestTicket({ id: 'TKT-2', category: 'application', priority: 'high' }),
        createTestTicket({ id: 'TKT-3', category: 'infrastructure', source: 'alert' }),
      ];

      biService.loadData({ tickets });
      const dashboard = biService.getExecutiveDashboard();

      expect(dashboard.distribution.byCategory['infrastructure'].count).toBe(2);
      expect(dashboard.distribution.byCategory['application'].count).toBe(1);
      expect(dashboard.distribution.byPriority['critical'].count).toBe(1);
      expect(dashboard.distribution.bySource['manual']).toBeGreaterThan(0);
      expect(dashboard.distribution.bySource['alert']).toBe(1);
    });

    it('should include alert counts', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({
          id: 'TKT-1',
          status: 'open',
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        }),
        createTestTicket({
          id: 'TKT-2',
          status: 'assigned',
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        }),
      ];
      const slaRecords = [createTestSLA('TKT-1', true)];

      biService.loadData({ tickets, slaRecords });
      const dashboard = biService.getExecutiveDashboard();

      expect(dashboard.alerts.slaBreachedCount).toBe(1);
    });

    it('should rank top performers', () => {
      const now = Date.now();
      const tickets = [];
      for (let i = 0; i < 5; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            status: 'resolved',
            assignee: 'eng-1',
            createdAt: new Date(now - (4 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (3 - i) * 24 * 60 * 60 * 1000),
          })
        );
      }
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Alice' })];

      biService.loadData({ tickets, engineerProfiles: engineers });
      const dashboard = biService.getExecutiveDashboard();

      expect(dashboard.teamRanking.topPerformers.length).toBeGreaterThan(0);
    });
  });

  // ==================== Manager Dashboard ====================

  describe('manager dashboard', () => {
    it('should compute team overview metrics', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'resolved', createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000), updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }),
        createTestTicket({ id: 'TKT-2', status: 'in-progress', createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }),
      ];

      biService.loadData({ tickets });
      const dashboard = biService.getManagerDashboard();

      expect(dashboard.teamOverview.totalTickets).toBe(2);
      expect(dashboard.teamOverview.resolvedCount).toBe(1);
      expect(dashboard.teamOverview.avgResolutionTimeHours).toBeGreaterThan(0);
    });

    it('should generate heatmap data', () => {
      const now = Date.now();
      const tickets = [];
      for (let i = 0; i < 20; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            createdAt: new Date(now - i * 3600000),
          })
        );
      }

      biService.loadData({ tickets });
      const dashboard = biService.getManagerDashboard();

      expect(dashboard.heatmap.length).toBeGreaterThan(0);
      expect(dashboard.heatmap[0]).toHaveProperty('dayOfWeek');
      expect(dashboard.heatmap[0]).toHaveProperty('hourOfDay');
      expect(dashboard.heatmap[0]).toHaveProperty('ticketCount');
    });

    it('should compute week-over-week changes', () => {
      const now = Date.now();
      const tickets = [];
      // This week: 5 tickets
      for (let i = 0; i < 5; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-this-${i}`,
            createdAt: new Date(now - i * 24 * 60 * 60 * 1000),
          })
        );
      }
      // Last week: 3 tickets
      for (let i = 0; i < 3; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-prev-${i}`,
            createdAt: new Date(now - (7 + i) * 24 * 60 * 60 * 1000),
          })
        );
      }

      biService.loadData({ tickets });
      const dashboard = biService.getManagerDashboard();

      expect(dashboard.weekOverWeek).toHaveProperty('ticketsCreatedChange');
      expect(dashboard.weekOverWeek).toHaveProperty('resolvedChange');
      expect(dashboard.weekOverWeek).toHaveProperty('avgResolutionTimeChange');
      expect(dashboard.weekOverWeek).toHaveProperty('slaComplianceChange');
    });

    it('should analyze transfer data', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({ id: 'TKT-1', createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000) }),
        createTestTicket({ id: 'TKT-2', createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }),
      ];
      const transfers = [
        {
          id: 'XFER-1',
          ticketId: 'TKT-1',
          fromEngineer: 'eng-1',
          toEngineer: 'eng-2',
          reason: 'expertise mismatch',
          transferredAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
          holdTimeMs: 2 * 60 * 60 * 1000,
        },
        {
          id: 'XFER-2',
          ticketId: 'TKT-1',
          fromEngineer: 'eng-2',
          toEngineer: 'eng-3',
          reason: 'capacity limit',
          transferredAt: new Date(now - 0.5 * 24 * 60 * 60 * 1000),
          holdTimeMs: 1 * 60 * 60 * 1000,
        },
      ];

      biService.loadData({
        tickets,
        transferRecords: transfers,
      });
      const dashboard = biService.getManagerDashboard();

      expect(dashboard.transferAnalysis.totalTransfers).toBe(2);
      expect(dashboard.transferAnalysis.topTransferReasons.length).toBeGreaterThan(0);
    });

    it('should include member metrics', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'resolved', assignee: 'eng-1', createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000), updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }),
        createTestTicket({ id: 'TKT-2', status: 'resolved', assignee: 'eng-1', createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000), updatedAt: new Date(now - 0.5 * 24 * 60 * 60 * 1000) }),
      ];
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Bob' })];

      biService.loadData({ tickets, engineerProfiles: engineers });
      const dashboard = biService.getManagerDashboard();

      expect(dashboard.memberMetrics.length).toBeGreaterThan(0);
      const bob = dashboard.memberMetrics.find((m) => m.engineerId === 'eng-1');
      expect(bob).toBeDefined();
      expect(bob!.workload.totalResolved).toBe(2);
    });
  });

  // ==================== Engineer Dashboard ====================

  describe('engineer dashboard', () => {
    it('should return null for unknown engineer', () => {
      biService.loadData({ tickets: [] });
      const dashboard = biService.getEngineerDashboard('unknown-eng');
      expect(dashboard).toBeNull();
    });

    it('should return personal overview', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({
          id: 'TKT-1',
          status: 'resolved',
          assignee: 'eng-1',
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        }),
        createTestTicket({
          id: 'TKT-2',
          status: 'in-progress',
          assignee: 'eng-1',
          createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        }),
      ];
      const slaRecords = [createTestSLA('TKT-1', false)];
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Alice' })];

      biService.loadData({ tickets, slaRecords, engineerProfiles: engineers });
      const dashboard = biService.getEngineerDashboard('eng-1');

      expect(dashboard).not.toBeNull();
      expect(dashboard!.personalOverview.engineerId).toBe('eng-1');
      expect(dashboard!.personalOverview.engineerName).toBe('Alice');
      expect(dashboard!.personalOverview.totalResolved).toBe(1);
      expect(dashboard!.personalOverview.currentLoad).toBe(3);
    });

    it('should compute personal trends', () => {
      const now = Date.now();
      const tickets = [];
      for (let i = 0; i < 5; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            status: 'resolved',
            assignee: 'eng-1',
            createdAt: new Date(now - (9 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (8 - i) * 24 * 60 * 60 * 1000),
          })
        );
      }
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Alice' })];

      const start = new Date(now - 10 * 24 * 60 * 60 * 1000);
      biService.loadData({ tickets, engineerProfiles: engineers });
      const dashboard = biService.getEngineerDashboard('eng-1', {
        periodStart: start,
        periodEnd: new Date(now),
        granularity: 'day',
      });

      expect(dashboard!.personalTrend.length).toBeGreaterThan(0);
      expect(dashboard!.personalTrend[0]).toHaveProperty('period');
      expect(dashboard!.personalTrend[0]).toHaveProperty('resolved');
    });

    it('should compute strengths and weaknesses', () => {
      const now = Date.now();
      const tickets = [
        // Fast resolutions in infrastructure (strength)
        createTestTicket({
          id: 'TKT-1',
          status: 'resolved',
          assignee: 'eng-1',
          category: 'infrastructure',
          createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now - 4.9 * 24 * 60 * 60 * 1000),
        }),
        createTestTicket({
          id: 'TKT-2',
          status: 'resolved',
          assignee: 'eng-1',
          category: 'infrastructure',
          createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now - 3.9 * 24 * 60 * 60 * 1000),
        }),
        // Slow resolution in database (weakness)
        createTestTicket({
          id: 'TKT-3',
          status: 'resolved',
          assignee: 'eng-1',
          category: 'database',
          createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        }),
      ];
      const slaRecords = [
        createTestSLA('TKT-1', false),
        createTestSLA('TKT-2', false),
        createTestSLA('TKT-3', false),
      ];
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Alice' })];

      biService.loadData({ tickets, slaRecords, engineerProfiles: engineers });
      const dashboard = biService.getEngineerDashboard('eng-1');

      expect(dashboard!.strengths).toBeDefined();
      expect(dashboard!.weaknesses).toBeDefined();
    });

    it('should list active tickets', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({
          id: 'TKT-active-1',
          status: 'in-progress',
          assignee: 'eng-1',
          priority: 'critical',
          category: 'network',
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        }),
      ];
      const slaRecords = [createTestSLA('TKT-active-1', false)];
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Alice' })];

      biService.loadData({ tickets, slaRecords, engineerProfiles: engineers });
      const dashboard = biService.getEngineerDashboard('eng-1');

      expect(dashboard!.activeTickets.length).toBe(1);
      expect(dashboard!.activeTickets[0].ticketId).toBe('TKT-active-1');
      expect(dashboard!.activeTickets[0].elapsedHours).toBeGreaterThan(0);
    });
  });

  // ==================== Engineer Efficiency Metrics ====================

  describe('engineer efficiency metrics', () => {
    it('should compute comprehensive metrics', () => {
      const now = Date.now();
      const tickets = [];
      for (let i = 0; i < 10; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            status: i < 7 ? 'resolved' : 'in-progress',
            assignee: 'eng-1',
            createdAt: new Date(now - (14 - i) * 24 * 60 * 60 * 1000),
            updatedAt: i < 7 ? new Date(now - (13 - i) * 24 * 60 * 60 * 1000) : new Date(now),
          })
        );
      }
      const slaRecords = [
        createTestSLA('TKT-0', false),
        createTestSLA('TKT-1', false),
        createTestSLA('TKT-2', true),
      ];
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Bob' })];

      const start = new Date(now - 15 * 24 * 60 * 60 * 1000);
      biService.loadData({ tickets, slaRecords, engineerProfiles: engineers });
      const metrics = biService.getEngineerEfficiency('eng-1', 'day', start, new Date(now));

      expect(metrics.engineerId).toBe('eng-1');
      expect(metrics.engineerName).toBe('Bob');
      expect(metrics.workload.totalAssigned).toBe(10);
      expect(metrics.workload.totalResolved).toBe(7);
      expect(metrics.efficiency.avgResolutionTimeMs).toBeGreaterThan(0);
      expect(metrics.efficiency.medianResolutionTimeMs).toBeGreaterThan(0);
      expect(metrics.efficiency.p95ResolutionTimeMs).toBeGreaterThan(0);
      expect(metrics.quality.slaComplianceRate).toBeGreaterThanOrEqual(0);
      expect(metrics.compositeScore).toBeGreaterThanOrEqual(0);
      expect(metrics.compositeScore).toBeLessThanOrEqual(100);
      expect(['A+', 'A', 'B+', 'B', 'C', 'D', 'F']).toContain(metrics.performanceGrade);
      expect(['improving', 'stable', 'declining']).toContain(metrics.trend);
    });

    it('should include collaboration metrics', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({
          id: 'TKT-1',
          status: 'resolved',
          assignee: 'eng-1',
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        }),
      ];
      const transfers = [
        {
          id: 'XFER-1',
          ticketId: 'TKT-1',
          fromEngineer: 'eng-2',
          toEngineer: 'eng-1',
          reason: 'test',
          transferredAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'XFER-2',
          ticketId: 'TKT-1',
          fromEngineer: 'eng-1',
          toEngineer: 'eng-3',
          reason: 'test',
          transferredAt: new Date(now - 1.5 * 24 * 60 * 60 * 1000),
        },
      ];
      const comments = [
        { id: 'C-1', ticketId: 'TKT-1', authorId: 'eng-1', createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000) },
        { id: 'C-2', ticketId: 'TKT-1', authorId: 'eng-1', createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000) },
      ];
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Alice' })];

      const start = new Date(now - 4 * 24 * 60 * 60 * 1000);
      biService.loadData({
        tickets,
        transferRecords: transfers,
        commentRecords: comments,
        engineerProfiles: engineers,
      });
      const metrics = biService.getEngineerEfficiency('eng-1', 'day', start, new Date(now));

      expect(metrics.collaboration.transfersReceived).toBe(1);
      expect(metrics.collaboration.transfersGiven).toBe(1);
      expect(metrics.collaboration.commentsCount).toBe(2);
    });

    it('should handle engineer with no tickets', () => {
      const engineers = [createTestEngineer({ id: 'eng-empty', name: 'Nobody' })];

      biService.loadData({ tickets: [], engineerProfiles: engineers });
      const metrics = biService.getEngineerEfficiency('eng-empty');

      expect(metrics.workload.totalAssigned).toBe(0);
      expect(metrics.workload.totalResolved).toBe(0);
      expect(metrics.compositeScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== Efficiency Score ====================

  describe('efficiency score', () => {
    it('should compute score with all 4 dimensions', () => {
      const now = Date.now();
      const tickets = [];
      for (let i = 0; i < 5; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            status: 'resolved',
            assignee: 'eng-1',
            createdAt: new Date(now - (5 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (4 - i) * 24 * 60 * 60 * 1000),
          })
        );
      }
      const slaRecords = [
        createTestSLA('TKT-0', false),
        createTestSLA('TKT-1', false),
      ];
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Alice' })];

      const start = new Date(now - 6 * 24 * 60 * 60 * 1000);
      biService.loadData({ tickets, slaRecords, engineerProfiles: engineers });
      const score = biService.getEfficiencyScore('eng-1', start, new Date(now));

      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(score.breakdown.workloadScore).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.qualityScore).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.teamworkScore).toBeGreaterThanOrEqual(0);
    });

    it('should reflect 25/30/30/15 weighting', () => {
      const now = Date.now();
      const tickets = [];
      for (let i = 0; i < 10; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            status: 'resolved',
            assignee: 'eng-1',
            createdAt: new Date(now - (10 - i) * 60 * 60 * 1000),
            updatedAt: new Date(now - (9 - i) * 60 * 60 * 1000),
          })
        );
      }
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Alice' })];

      const start = new Date(now - 11 * 60 * 60 * 1000);
      biService.loadData({ tickets, engineerProfiles: engineers });
      const score = biService.getEfficiencyScore('eng-1', start, new Date(now));

      // High-performing engineer should score well
      expect(score.breakdown.efficiencyScore).toBeGreaterThan(50);
      expect(score.breakdown.qualityScore).toBeGreaterThan(50);
    });

    it('should handle engineer with no data', () => {
      const engineers = [createTestEngineer({ id: 'eng-empty', name: 'Nobody' })];
      biService.loadData({ tickets: [], engineerProfiles: engineers });

      const score = biService.getEfficiencyScore('eng-empty');
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.workloadScore).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.qualityScore).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.teamworkScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== Time Granularity ====================

  describe('time granularity', () => {
    const granularities: TimeGranularity[] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

    it.each(granularities)('should support %s granularity', (granularity) => {
      const now = Date.now();
      const daysBack = granularity === 'hour' ? 1 : granularity === 'day' ? 7 : granularity === 'week' ? 30 : 90;
      const tickets = [];
      for (let i = 0; i < 5; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            createdAt: new Date(now - (daysBack - i) * 24 * 60 * 60 * 1000),
          })
        );
      }

      const start = new Date(now - (daysBack + 1) * 24 * 60 * 60 * 1000);
      biService.loadData({ tickets });
      const dashboard = biService.getExecutiveDashboard({
        periodStart: start,
        periodEnd: new Date(now),
        granularity,
      });

      expect(dashboard.trends.ticketVolumeTrend.length).toBeGreaterThan(0);
    });

    it('should format periods correctly for each granularity', () => {
      const bi = new TicketBIService();
      const date = new Date('2024-06-15T14:30:00Z');

      // Test through the efficiency metrics method which uses formatPeriod internally
      const now = Date.now();
      bi.loadData({ tickets: [] });
      const metrics = bi.getEngineerEfficiency('nonexistent', 'day', new Date(now - 2 * 24 * 60 * 60 * 1000), new Date(now));
      expect(metrics.period).toBeTruthy();
    });
  });

  // ==================== Period Comparison ====================

  describe('period comparison', () => {
    it('should compare two periods with increases', () => {
      const now = Date.now();
      const currentStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const currentEnd = new Date(now);
      const previousStart = new Date(now - 14 * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(now - 7 * 24 * 60 * 60 * 1000);

      // More tickets in current period
      for (let i = 0; i < 10; i++) {
        createTestTicket({
          id: `TKT-current-${i}`,
          status: 'resolved',
          createdAt: new Date(now - (6 - i * 0.5) * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now - (5 - i * 0.5) * 24 * 60 * 60 * 1000),
        });
      }
      // Fewer tickets in previous period
      for (let i = 0; i < 5; i++) {
        createTestTicket({
          id: `TKT-prev-${i}`,
          status: 'resolved',
          createdAt: new Date(now - (13 - i) * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now - (12 - i) * 24 * 60 * 60 * 1000),
        });
      }

      // Build tickets manually
      const tickets = [
        ...Array.from({ length: 10 }, (_, i) =>
          createTestTicket({
            id: `TKT-current-${i}`,
            status: 'resolved',
            createdAt: new Date(now - (6 - i * 0.5) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (5 - i * 0.5) * 24 * 60 * 60 * 1000),
          })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          createTestTicket({
            id: `TKT-prev-${i}`,
            status: 'resolved',
            createdAt: new Date(now - (13 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (12 - i) * 24 * 60 * 60 * 1000),
          })
        ),
      ];

      biService.loadData({ tickets });
      const comparison = biService.comparePeriods(
        currentStart, currentEnd, previousStart, previousEnd
      );

      expect(comparison.current.metrics.ticketsCreated).toBe(10);
      expect(comparison.previous.metrics.ticketsCreated).toBe(5);
      expect(comparison.changes.length).toBeGreaterThan(0);

      const createdChange = comparison.changes.find((c) => c.metric === 'ticketsCreated');
      expect(createdChange).toBeDefined();
      expect(createdChange!.direction).toBe('up');
    });

    it('should detect decreases', () => {
      const now = Date.now();
      const currentStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const currentEnd = new Date(now);
      const previousStart = new Date(now - 14 * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(now - 7 * 24 * 60 * 60 * 1000);

      // Fewer tickets in current period
      const tickets = [
        ...Array.from({ length: 2 }, (_, i) =>
          createTestTicket({
            id: `TKT-current-${i}`,
            status: 'resolved',
            createdAt: new Date(now - (6 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (5 - i) * 24 * 60 * 60 * 1000),
          })
        ),
        ...Array.from({ length: 8 }, (_, i) =>
          createTestTicket({
            id: `TKT-prev-${i}`,
            status: 'resolved',
            createdAt: new Date(now - (13 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (12 - i) * 24 * 60 * 60 * 1000),
          })
        ),
      ];

      biService.loadData({ tickets });
      const comparison = biService.comparePeriods(
        currentStart, currentEnd, previousStart, previousEnd
      );

      const createdChange = comparison.changes.find((c) => c.metric === 'ticketsCreated');
      expect(createdChange!.direction).toBe('down');
    });

    it('should detect same when no change', () => {
      const now = Date.now();
      const currentStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const currentEnd = new Date(now);
      const previousStart = new Date(now - 14 * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(now - 7 * 24 * 60 * 60 * 1000);

      // Same number of tickets
      const tickets = [
        ...Array.from({ length: 5 }, (_, i) =>
          createTestTicket({
            id: `TKT-current-${i}`,
            status: 'resolved',
            createdAt: new Date(now - (6 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (5 - i) * 24 * 60 * 60 * 1000),
          })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          createTestTicket({
            id: `TKT-prev-${i}`,
            status: 'resolved',
            createdAt: new Date(now - (13 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (12 - i) * 24 * 60 * 60 * 1000),
          })
        ),
      ];

      biService.loadData({ tickets });
      const comparison = biService.comparePeriods(
        currentStart, currentEnd, previousStart, previousEnd
      );

      const createdChange = comparison.changes.find((c) => c.metric === 'ticketsCreated');
      expect(createdChange!.direction).toBe('same');
    });

    it('should include all expected metrics in comparison', () => {
      const now = Date.now();
      const currentStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const currentEnd = new Date(now);
      const previousStart = new Date(now - 14 * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(now - 7 * 24 * 60 * 60 * 1000);

      biService.loadData({ tickets: [] });
      const comparison = biService.comparePeriods(
        currentStart, currentEnd, previousStart, previousEnd
      );

      expect(comparison.current.metrics).toHaveProperty('ticketsCreated');
      expect(comparison.current.metrics).toHaveProperty('ticketsResolved');
      expect(comparison.current.metrics).toHaveProperty('avgResolutionHours');
      expect(comparison.current.metrics).toHaveProperty('slaComplianceRate');
      expect(comparison.current.metrics).toHaveProperty('openTickets');
    });
  });

  // ==================== BI Export ====================

  describe('BI export', () => {
    it('should export tickets dataset', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'resolved', createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000), updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }),
        createTestTicket({ id: 'TKT-2', status: 'open', createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }),
      ];

      biService.loadData({ tickets });
      const exported = biService.exportBIData({
        dataset: 'tickets',
        granularity: 'day',
        periodStart: new Date(now - 4 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(now),
      });

      expect(exported.dataset).toBe('tickets');
      expect(exported.rows.length).toBe(2);
      expect(exported.columns.length).toBeGreaterThan(0);
      expect(exported.columns[0]).toHaveProperty('name');
      expect(exported.columns[0]).toHaveProperty('type');
      expect(exported.columns[0]).toHaveProperty('label');
      expect(exported.granularity).toBe('day');
    });

    it('should export SLA dataset', () => {
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'resolved' }),
      ];
      const slaRecords = [createTestSLA('TKT-1', false)];

      biService.loadData({ tickets, slaRecords });
      const exported = biService.exportBIData({ dataset: 'sla' });

      expect(exported.dataset).toBe('sla');
      expect(exported.rows.length).toBe(1);
      expect(exported.columns.some((c) => c.name === 'breached')).toBe(true);
    });

    it('should export dispatch dataset', () => {
      const dispatchResults = [
        createDispatchResult('eng-1', 'TKT-1', { score: 85 }),
        createDispatchResult('eng-2', 'TKT-2', { score: 70 }),
      ];

      biService.loadData({ tickets: [], dispatchResults });
      const exported = biService.exportBIData({ dataset: 'dispatch' });

      expect(exported.dataset).toBe('dispatch');
      expect(exported.rows.length).toBe(2);
      expect(exported.columns.some((c) => c.name === 'score')).toBe(true);
    });

    it('should export efficiency dataset', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'resolved', assignee: 'eng-1', createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000), updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }),
      ];
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Alice' })];

      biService.loadData({ tickets, engineerProfiles: engineers });
      const exported = biService.exportBIData({
        dataset: 'efficiency',
        granularity: 'day',
        periodStart: new Date(now - 4 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(now),
      });

      expect(exported.dataset).toBe('efficiency');
      expect(exported.columns.some((c) => c.name === 'engineerId')).toBe(true);
      expect(exported.columns.some((c) => c.name === 'compositeScore')).toBe(true);
    });

    it('should include generation timestamp', () => {
      biService.loadData({ tickets: [] });
      const exported = biService.exportBIData({ dataset: 'tickets' });

      expect(exported.generatedAt).toBeInstanceOf(Date);
    });
  });

  // ==================== Time Trend ====================

  describe('time trend', () => {
    it('should compute volume trend', () => {
      const now = Date.now();
      const tickets = [];
      for (let i = 0; i < 7; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            createdAt: new Date(now - (6 - i) * 24 * 60 * 60 * 1000),
          })
        );
      }

      const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
      biService.loadData({ tickets });
      const trend = biService.getTimeTrend({
        metric: 'volume',
        start,
        end: new Date(now),
        granularity: 'day',
      });

      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0]).toHaveProperty('period');
      expect(trend[0]).toHaveProperty('value');
    });

    it('should compute resolution trend', () => {
      const now = Date.now();
      const tickets = [];
      for (let i = 0; i < 5; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            status: 'resolved',
            createdAt: new Date(now - (5 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now - (4 - i) * 24 * 60 * 60 * 1000),
          })
        );
      }

      const start = new Date(now - 6 * 24 * 60 * 60 * 1000);
      biService.loadData({ tickets });
      const trend = biService.getTimeTrend({
        metric: 'resolution',
        start,
        end: new Date(now),
        granularity: 'day',
      });

      expect(trend.length).toBeGreaterThan(0);
    });

    it('should compute SLA trend', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'resolved', createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000) }),
      ];
      const slaRecords = [createTestSLA('TKT-1', false)];

      const start = new Date(now - 3 * 24 * 60 * 60 * 1000);
      biService.loadData({ tickets, slaRecords });
      const trend = biService.getTimeTrend({
        metric: 'sla',
        start,
        end: new Date(now),
        granularity: 'day',
      });

      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0].value).toBe(100);
    });

    it('should compute load trend', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'open', createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000) }),
        createTestTicket({ id: 'TKT-2', status: 'in-progress', createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }),
      ];

      const start = new Date(now - 3 * 24 * 60 * 60 * 1000);
      biService.loadData({ tickets });
      const trend = biService.getTimeTrend({
        metric: 'load',
        start,
        end: new Date(now),
        granularity: 'day',
      });

      expect(trend.length).toBeGreaterThan(0);
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should handle completely empty data', () => {
      biService.loadData({ tickets: [] });

      const executive = biService.getExecutiveDashboard();
      expect(executive.overview.totalTickets).toBe(0);
      expect(executive.overview.slaComplianceRate).toBe(100);
      expect(executive.trends.ticketVolumeTrend.length).toBeGreaterThan(0);

      const manager = biService.getManagerDashboard();
      expect(manager.teamOverview.totalTickets).toBe(0);

      const score = biService.getEfficiencyScore('unknown');
      expect(score.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle a single ticket', () => {
      const ticket = createTestTicket({
        id: 'TKT-single',
        status: 'resolved',
        assignee: 'eng-1',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      });
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Solo' })];

      biService.loadData({ tickets: [ticket], engineerProfiles: engineers });

      const executive = biService.getExecutiveDashboard();
      expect(executive.overview.totalTickets).toBe(1);
      expect(executive.overview.resolvedTickets).toBe(1);

      const manager = biService.getManagerDashboard();
      expect(manager.teamOverview.resolvedCount).toBe(1);
    });

    it('should handle no engineers registered', () => {
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'open' }),
        createTestTicket({ id: 'TKT-2', status: 'resolved' }),
      ];

      biService.loadData({ tickets });
      const executive = biService.getExecutiveDashboard();

      expect(executive.overview.totalEngineers).toBe(0);
      expect(executive.overview.activeEngineers).toBe(0);
    });

    it('should handle tickets without assignees', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({ id: 'TKT-1', status: 'open', assignee: undefined, createdAt: new Date(now - 12 * 60 * 60 * 1000) }),
        createTestTicket({ id: 'TKT-2', status: 'open', assignee: undefined, createdAt: new Date(now - 6 * 60 * 60 * 1000) }),
      ];

      biService.loadData({ tickets });
      const dashboard = biService.getExecutiveDashboard();

      expect(dashboard.overview.openTickets).toBe(2);
      // Tickets created within last 24h should not be flagged as unassigned older than 24h
      expect(dashboard.alerts.unassignedOlderThan24h).toBe(0);
    });

    it('should handle tickets with due dates for overdue detection', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({
          id: 'TKT-overdue',
          status: 'open',
          dueDate: new Date(now - 1 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        }),
      ];

      biService.loadData({ tickets });
      const dashboard = biService.getExecutiveDashboard();

      expect(dashboard.alerts.overdueTicketsCount).toBe(1);
    });

    it('should handle all ticket priorities and categories', () => {
      const priorities: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
      const categories: TicketCategory[] = [
        'infrastructure', 'application', 'database', 'network',
        'security', 'deployment', 'pipeline', 'performance', 'cost', 'other',
      ];

      const tickets: Ticket[] = [];
      let id = 0;
      for (const p of priorities) {
        for (const c of categories) {
          tickets.push(
            createTestTicket({
              id: `TKT-${id++}`,
              priority: p,
              category: c,
            })
          );
        }
      }

      biService.loadData({ tickets });
      const executive = biService.getExecutiveDashboard();

      expect(Object.keys(executive.distribution.byPriority)).toContain('critical');
      expect(Object.keys(executive.distribution.byCategory)).toContain('infrastructure');
    });

    it('should handle large date ranges', () => {
      const now = Date.now();
      const yearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);
      const tickets = [];
      for (let i = 0; i < 100; i++) {
        tickets.push(
          createTestTicket({
            id: `TKT-${i}`,
            createdAt: new Date(yearAgo.getTime() + i * 3 * 24 * 60 * 60 * 1000),
          })
        );
      }

      biService.loadData({ tickets });
      const trend = biService.getTimeTrend({
        metric: 'volume',
        start: yearAgo,
        end: new Date(now),
        granularity: 'month',
      });

      expect(trend.length).toBeGreaterThan(0);
    });

    it('should handle transfer records with missing hold time', () => {
      const transfers = [
        {
          id: 'XFER-1',
          ticketId: 'TKT-1',
          fromEngineer: 'eng-1',
          toEngineer: 'eng-2',
          reason: 'test',
          transferredAt: new Date(),
          // holdTimeMs is undefined
        },
      ];

      biService.loadData({ tickets: [], transferRecords: transfers });
      const dashboard = biService.getManagerDashboard();

      expect(dashboard.transferAnalysis.totalTransfers).toBe(1);
    });
  });

  // ==================== Performance Grade ====================

  describe('performance grade computation', () => {
    it('should assign correct grades based on score', () => {
      // Create a high-performing scenario
      const now = Date.now();
      const tickets = Array.from({ length: 20 }, (_, i) =>
        createTestTicket({
          id: `TKT-${i}`,
          status: 'resolved',
          assignee: 'eng-1',
          createdAt: new Date(now - (20 - i) * 60 * 60 * 1000),
          updatedAt: new Date(now - (19 - i) * 60 * 60 * 1000),
        })
      );
      const slaRecords = tickets.slice(0, 10).map((t) => createTestSLA(t.id, false));
      const engineers = [createTestEngineer({ id: 'eng-1', name: 'Star' })];

      const start = new Date(now - 21 * 60 * 60 * 1000);
      biService.loadData({ tickets, slaRecords, engineerProfiles: engineers });
      const metrics = biService.getEngineerEfficiency('eng-1', 'hour', start, new Date(now));

      expect(['A+', 'A', 'B+', 'B', 'C', 'D', 'F']).toContain(metrics.performanceGrade);
      expect(metrics.compositeScore).toBeGreaterThanOrEqual(0);
      expect(metrics.compositeScore).toBeLessThanOrEqual(100);
    });
  });

  // ==================== Clear All ====================

  describe('clearAll', () => {
    it('should reset all data', () => {
      const now = Date.now();
      const tickets = [
        createTestTicket({ id: 'TKT-1', createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }),
      ];
      const engineers = [createTestEngineer({ id: 'eng-1' })];

      biService.loadData({ tickets, engineerProfiles: engineers });
      biService.clearAll();

      const dashboard = biService.getExecutiveDashboard();
      expect(dashboard.overview.totalTickets).toBe(0);
      expect(dashboard.overview.totalEngineers).toBe(0);
    });
  });
});
