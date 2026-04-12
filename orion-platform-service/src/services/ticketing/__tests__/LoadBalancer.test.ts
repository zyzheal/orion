/**
 * TASK-802: LoadBalancer Tests
 */

import { LoadBalancer } from '../LoadBalancer';
import {
  EngineerProfile,
  TicketCategory,
} from '../types';

const createTestEngineer = (overrides: Partial<EngineerProfile> = {}): EngineerProfile => ({
  id: 'eng-1',
  name: 'Test Engineer',
  expertise: ['infrastructure', 'network'],
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
  },
  ...overrides,
});

describe('LoadBalancer', () => {
  let balancer: LoadBalancer;

  beforeEach(() => {
    balancer = new LoadBalancer();
  });

  afterEach(() => {
    balancer.clearAll();
  });

  // ==================== Engineer Management ====================

  describe('engineer management', () => {
    it('should register an engineer', () => {
      const profile = createTestEngineer();
      balancer.registerEngineer(profile);

      const found = balancer.getEngineer('eng-1');
      expect(found).toBeDefined();
    });

    it('should update an engineer', () => {
      balancer.registerEngineer(createTestEngineer());
      balancer.updateEngineer('eng-1', { maxCapacity: 15 });

      const engineer = balancer.getEngineer('eng-1');
      expect(engineer!.maxCapacity).toBe(15);
    });

    it('should remove an engineer and their ticket loads', () => {
      balancer.registerEngineer(createTestEngineer());
      balancer.recordAssignment({
        ticketId: 'TKT-1',
        engineerId: 'eng-1',
        category: 'infrastructure',
      });

      balancer.removeEngineer('eng-1');
      expect(balancer.getEngineer('eng-1')).toBeUndefined();
    });

    it('should list all engineers', () => {
      balancer.registerEngineer(createTestEngineer({ id: 'eng-1' }));
      balancer.registerEngineer(createTestEngineer({ id: 'eng-2' }));

      const engineers = balancer.listEngineers();
      expect(engineers.length).toBe(2);
    });
  });

  // ==================== Load Tracking ====================

  describe('load tracking', () => {
    beforeEach(() => {
      balancer.registerEngineer(createTestEngineer({ id: 'eng-1', currentLoad: 0, maxCapacity: 10 }));
    });

    it('should record an assignment', () => {
      balancer.recordAssignment({
        ticketId: 'TKT-1',
        engineerId: 'eng-1',
        category: 'infrastructure',
      });

      const load = balancer.getEngineerLoad('eng-1');
      expect(load).not.toBeNull();
      expect(load!.currentLoad).toBe(1);
    });

    it('should remove an assignment', () => {
      balancer.recordAssignment({
        ticketId: 'TKT-1',
        engineerId: 'eng-1',
        category: 'infrastructure',
      });

      balancer.removeAssignment('TKT-1');

      const load = balancer.getEngineerLoad('eng-1');
      expect(load!.currentLoad).toBe(0);
    });

    it('should get engineer load info', () => {
      balancer.recordAssignment({ ticketId: 'TKT-1', engineerId: 'eng-1', category: 'infrastructure' });
      balancer.recordAssignment({ ticketId: 'TKT-2', engineerId: 'eng-1', category: 'infrastructure' });

      const load = balancer.getEngineerLoad('eng-1');
      expect(load).not.toBeNull();
      expect(load!.currentLoad).toBe(2);
      expect(load!.maxCapacity).toBe(10);
      expect(load!.utilizationPercent).toBe(20);
    });

    it('should return null for non-existent engineer', () => {
      const load = balancer.getEngineerLoad('non-existent');
      expect(load).toBeNull();
    });

    it('should get all loads', () => {
      balancer.registerEngineer(createTestEngineer({ id: 'eng-2' }));

      const loads = balancer.getAllLoads();
      expect(loads.length).toBe(2);
    });

    it('should check if engineer is overloaded', () => {
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-full',
        currentLoad: 9,
        maxCapacity: 10,
      }));

      expect(balancer.isOverloaded('eng-full')).toBe(true);
    });

    it('should not flag moderate load as overloaded', () => {
      expect(balancer.isOverloaded('eng-1')).toBe(false);
    });

    it('should get ticket load record', () => {
      balancer.recordAssignment({
        ticketId: 'TKT-1',
        engineerId: 'eng-1',
        category: 'infrastructure',
      });

      const record = balancer.getTicketLoad('TKT-1');
      expect(record).toBeDefined();
      expect(record!.engineerId).toBe('eng-1');
    });

    it('should get engineer tickets', () => {
      balancer.recordAssignment({ ticketId: 'TKT-1', engineerId: 'eng-1', category: 'infrastructure' });
      balancer.recordAssignment({ ticketId: 'TKT-2', engineerId: 'eng-1', category: 'network' });

      const tickets = balancer.getEngineerTickets('eng-1');
      expect(tickets.length).toBe(2);
    });
  });

  // ==================== Load Balancing ====================

  describe('load balancing', () => {
    beforeEach(() => {
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-1',
        currentLoad: 9,
        maxCapacity: 10,
      }));
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-2',
        currentLoad: 1,
        maxCapacity: 10,
      }));
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-3',
        currentLoad: 0,
        maxCapacity: 10,
      }));

      // Add tickets to eng-1 (need 9 to exceed 85% of 10)
      for (let i = 0; i < 9; i++) {
        balancer.recordAssignment({
          ticketId: `TKT-${i}`,
          engineerId: 'eng-1',
          category: 'infrastructure',
        });
      }
    });

    it('should generate balancing report', () => {
      const report = balancer.getBalancingReport();

      expect(report.engineerLoads.length).toBe(3);
      expect(report.overloadedEngineers.length).toBeGreaterThan(0);
      expect(report.underutilizedEngineers.length).toBeGreaterThan(0);
      expect(report.balanceScore).toBeGreaterThanOrEqual(0);
      expect(report.balanceScore).toBeLessThanOrEqual(1);
    });

    it('should suggest reassignments', () => {
      const suggestions = balancer.suggestReassignments();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should find least loaded engineer', () => {
      const leastLoaded = balancer.findLeastLoadedEngineer('infrastructure');
      expect(leastLoaded).not.toBeNull();
      expect(leastLoaded!.id).toBe('eng-3'); // 0 load
    });

    it('should find engineer with relevant expertise when load is equal', () => {
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-4',
        currentLoad: 0,
        maxCapacity: 10,
        expertise: ['database'],
      }));

      // eng-3 and eng-4 have same load, eng-3 has infrastructure expertise
      const leastLoaded = balancer.findLeastLoadedEngineer('infrastructure');
      expect(leastLoaded).not.toBeNull();
      expect(leastLoaded!.expertise).toContain('infrastructure');
    });

    it('should return null when all engineers are at capacity', () => {
      balancer.clearAll();
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-full',
        currentLoad: 10,
        maxCapacity: 10,
      }));

      const result = balancer.findLeastLoadedEngineer('infrastructure');
      expect(result).toBeNull();
    });
  });

  // ==================== Capacity Planning ====================

  describe('capacity planning', () => {
    beforeEach(() => {
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-1',
        currentLoad: 5,
        maxCapacity: 10,
      }));
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-2',
        currentLoad: 3,
        maxCapacity: 10,
        availability: 'offline', // Should still count for capacity
      }));
    });

    it('should get team capacity', () => {
      const capacity = balancer.getTeamCapacity();

      expect(capacity.totalCapacity).toBe(20);
      expect(capacity.totalLoad).toBe(8);
      expect(capacity.availableCapacity).toBe(12);
      expect(capacity.utilizationRate).toBe(0.4);
      expect(capacity.engineerCount).toBe(2);
    });

    it('should check if team can accept more tickets', () => {
      expect(balancer.canAcceptMoreTickets(10)).toBe(true);
      expect(balancer.canAcceptMoreTickets(15)).toBe(false);
    });

    it('should get available engineers', () => {
      const available = balancer.getAvailableEngineers();

      // eng-2 is offline
      expect(available.length).toBe(1);
      expect(available[0].id).toBe('eng-1');
    });

    it('should get available engineers with custom max load', () => {
      const available = balancer.getAvailableEngineers(4);

      // Only eng-2 has load < 4, but it's offline
      // eng-1 has load 5, so it's excluded
      expect(available.length).toBe(0);
    });
  });

  // ==================== Assignment History ====================

  describe('assignment history', () => {
    it('should record assignment history', () => {
      balancer.recordAssignmentHistory({
        id: 'ASGN-1',
        ticketId: 'TKT-1',
        assignee: 'eng-1',
        assignedBy: 'user-1',
        assignedAt: new Date(),
        reason: 'Test',
      });

      const history = balancer.getAssignmentHistory();
      expect(history.length).toBe(1);
    });

    it('should filter history by engineer', () => {
      balancer.recordAssignmentHistory({
        id: 'ASGN-1',
        ticketId: 'TKT-1',
        assignee: 'eng-1',
        assignedBy: 'user-1',
        assignedAt: new Date(),
        reason: 'Test',
      });
      balancer.recordAssignmentHistory({
        id: 'ASGN-2',
        ticketId: 'TKT-2',
        assignee: 'eng-2',
        assignedBy: 'user-1',
        assignedAt: new Date(),
        reason: 'Test',
      });

      const history = balancer.getAssignmentHistory({ engineerId: 'eng-1' });
      expect(history.length).toBe(1);
      expect(history[0].assignee).toBe('eng-1');
    });

    it('should limit history results', () => {
      for (let i = 0; i < 5; i++) {
        balancer.recordAssignmentHistory({
          id: `ASGN-${i}`,
          ticketId: `TKT-${i}`,
          assignee: 'eng-1',
          assignedBy: 'user-1',
          assignedAt: new Date(),
          reason: 'Test',
        });
      }

      const history = balancer.getAssignmentHistory({ limit: 3 });
      expect(history.length).toBe(3);
    });
  });

  // ==================== Balance Workload ====================

  describe('balanceWorkload', () => {
    it('should return empty when well balanced', () => {
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-1',
        currentLoad: 5,
        maxCapacity: 10,
      }));
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-2',
        currentLoad: 5,
        maxCapacity: 10,
      }));

      const suggestions = balancer.balanceWorkload();
      expect(suggestions.length).toBe(0);
    });

    it('should return suggestions when unbalanced', () => {
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-1',
        currentLoad: 9,
        maxCapacity: 10,
      }));
      balancer.registerEngineer(createTestEngineer({
        id: 'eng-2',
        currentLoad: 0,
        maxCapacity: 10,
      }));

      for (let i = 0; i < 9; i++) {
        balancer.recordAssignment({
          ticketId: `TKT-${i}`,
          engineerId: 'eng-1',
          category: 'infrastructure',
        });
      }

      const suggestions = balancer.balanceWorkload();
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  // ==================== Clear ====================

  describe('clearAll', () => {
    it('should clear all data', () => {
      balancer.registerEngineer(createTestEngineer());
      balancer.recordAssignment({
        ticketId: 'TKT-1',
        engineerId: 'eng-1',
        category: 'infrastructure',
      });

      balancer.clearAll();
      expect(balancer.listEngineers().length).toBe(0);
    });
  });
});
