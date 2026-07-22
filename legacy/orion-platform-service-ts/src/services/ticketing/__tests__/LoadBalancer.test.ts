/**
 * TASK-802: LoadBalancer Tests
 */

import { LoadBalancer } from '../LoadBalancer';
import {
  EngineerProfile,
  TicketCategory,
} from '../types';

// Mock TicketingRepository with all required methods
const mockRepo: any = {
  createEngineerProfile: jest.fn().mockResolvedValue(null),
  findEngineerProfileById: jest.fn().mockResolvedValue(null),
  findAllEngineerProfiles: jest.fn().mockResolvedValue([]),
  updateEngineerProfile: jest.fn().mockResolvedValue(null),
  deleteEngineerProfile: jest.fn().mockResolvedValue(true),
  getAvailableEngineers: jest.fn().mockResolvedValue([]),
};

describe('LoadBalancer', () => {
  let balancer: LoadBalancer;

  beforeEach(() => {
    jest.clearAllMocks();
    balancer = new LoadBalancer({ ticketingRepository: mockRepo });
  });

  afterEach(() => {
    balancer.clearAll();
  });

  // ==================== Engineer Management ====================

  describe('engineer management', () => {
    it('should register an engineer', async () => {
      const profile: EngineerProfile = {
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
      };
      mockRepo.createEngineerProfile.mockResolvedValueOnce(profile);
      mockRepo.findEngineerProfileById.mockResolvedValueOnce(profile);

      await balancer.registerEngineer(profile);
      const found = await balancer.getEngineer('eng-1');
      expect(found).toBeDefined();
    });

    it('should update an engineer', async () => {
      const profile: EngineerProfile = {
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
      };
      mockRepo.createEngineerProfile.mockResolvedValueOnce(profile);
      mockRepo.findEngineerProfileById.mockResolvedValueOnce(profile);
      mockRepo.updateEngineerProfile.mockResolvedValueOnce({ ...profile, maxCapacity: 15 });

      await balancer.registerEngineer(profile);
      await balancer.updateEngineer('eng-1', { maxCapacity: 15 });

      const engineer = await balancer.getEngineer('eng-1');
      expect(engineer).toBeTruthy();
    });

    it('should remove an engineer and their ticket loads', async () => {
      const profile: EngineerProfile = {
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
        },
      };
      mockRepo.createEngineerProfile.mockResolvedValueOnce(profile);
      mockRepo.findEngineerProfileById.mockResolvedValueOnce(null);

      await balancer.registerEngineer(profile);
      await balancer.recordAssignment({
        ticketId: 'TKT-1',
        engineerId: 'eng-1',
        category: 'infrastructure',
      });

      await balancer.removeEngineer('eng-1');
      expect(await balancer.getEngineer('eng-1')).toBeUndefined();
    });

    it('should list all engineers', async () => {
      mockRepo.findAllEngineerProfiles.mockResolvedValueOnce([]);

      const engineers = await balancer.listEngineers();
      expect(Array.isArray(engineers)).toBe(true);
    });
  });

  // ==================== Load Tracking ====================

  describe('load tracking', () => {
    it('should return null for non-existent engineer', async () => {
      const load = await balancer.getEngineerLoad('non-existent');
      expect(load).toBeNull();
    });

    it('should get ticket load record', async () => {
      balancer.recordAssignment({
        ticketId: 'TKT-1',
        engineerId: 'eng-1',
        category: 'infrastructure',
      });

      const record = balancer.getTicketLoad('TKT-1');
      expect(record).toBeDefined();
      expect(record!.engineerId).toBe('eng-1');
    });

    it('should get engineer tickets', async () => {
      balancer.recordAssignment({ ticketId: 'TKT-1', engineerId: 'eng-1', category: 'infrastructure' });
      balancer.recordAssignment({ ticketId: 'TKT-2', engineerId: 'eng-1', category: 'network' });

      const tickets = balancer.getEngineerTickets('eng-1');
      expect(tickets.length).toBe(2);
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

  // ==================== Clear ====================

  describe('clearAll', () => {
    it('should clear all data', () => {
      balancer.clearAll();
      expect(balancer.getAssignmentHistory().length).toBe(0);
    });
  });
});
