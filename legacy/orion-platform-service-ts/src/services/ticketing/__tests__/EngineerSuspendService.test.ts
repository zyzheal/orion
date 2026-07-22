/**
 * TASK-TICKET-XFER: EngineerSuspendService Tests
 */

import { EngineerSuspendService } from '../EngineerSuspendService';
import { EngineerSuspend, SuspendReason, Ticket, EngineerProfile } from '../types';

// Mock TicketingRepository with all required methods
const mockRepo: any = {
  createSuspend: jest.fn().mockImplementation(async (input: any) => {
    const now = new Date();
    const id = `SUSP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const status: any = input.startTime <= now ? 'active' : 'scheduled';
    return {
      id,
      engineerId: input.engineerId,
      reason: input.reason,
      status,
      startTime: input.startTime,
      endTime: input.endTime,
      backupEngineerId: input.backupEngineerId,
      autoReassignPending: input.autoReassignPending ?? true,
      pauseSLAForPending: input.pauseSLAForPending ?? false,
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: now,
      actualEndTime: undefined,
      ticketsReassigned: 0,
    };
  }),
  findSuspendById: jest.fn().mockResolvedValue(null),
  updateSuspendStatus: jest.fn().mockImplementation(async (id: string, status: string, actualEndTime?: Date) => {
    // Return a mock updated suspend
    return {
      id,
      engineerId: 'eng-1',
      reason: 'leave',
      status,
      startTime: new Date(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      backupEngineerId: undefined,
      autoReassignPending: true,
      pauseSLAForPending: false,
      notes: undefined,
      createdBy: 'admin',
      createdAt: new Date(),
      actualEndTime: actualEndTime || undefined,
      ticketsReassigned: 0,
    };
  }),
  getActiveSuspensions: jest.fn().mockResolvedValue([]),
  getScheduledSuspensions: jest.fn().mockResolvedValue([]),
  getSuspensionsByEngineer: jest.fn().mockResolvedValue([]),
  createEngineerProfile: jest.fn().mockResolvedValue(null),
  updateEngineerProfile: jest.fn().mockResolvedValue(null),
  getEngineerProfile: jest.fn().mockResolvedValue(null),
};

const createTestTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'TKT-test-1',
  title: 'Test Ticket',
  description: 'Test description',
  category: 'infrastructure',
  priority: 'high',
  status: 'assigned',
  assignee: 'eng-1',
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
  },
  ...overrides,
});

describe('EngineerSuspendService', () => {
  let service: EngineerSuspendService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EngineerSuspendService({ ticketingRepository: mockRepo });
  });

  afterEach(() => {
    service.clearAll();
  });

  // ==================== Create Suspend ====================

  describe('createSuspend', () => {
    it('should create a future scheduled suspension', async () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

      const suspend = await service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: futureStart,
        endTime: end,
        createdBy: 'admin',
      });

      expect(suspend.id).toMatch(/^SUSP-/);
      expect(suspend.engineerId).toBe('eng-1');
      expect(suspend.reason).toBe('leave');
      expect(suspend.status).toBe('scheduled');
      expect(suspend.autoReassignPending).toBe(true);
      expect(suspend.pauseSLAForPending).toBe(false);
      expect(suspend.ticketsReassigned).toBe(0);
      expect(suspend.createdBy).toBe('admin');
    });

    it('should create an active suspension if start time is in the past', async () => {
      const pastStart = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const suspend = await service.createSuspend({
        engineerId: 'eng-1',
        reason: 'sick',
        startTime: pastStart,
        endTime: end,
        createdBy: 'admin',
      });

      expect(suspend.status).toBe('active');
    });

    it('should set backup engineer', async () => {
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = await service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: start,
        endTime: end,
        backupEngineerId: 'eng-backup',
        createdBy: 'admin',
      });

      expect(suspend.backupEngineerId).toBe('eng-backup');
    });

    it('should allow custom autoReassignPending and pauseSLAForPending', async () => {
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = await service.createSuspend({
        engineerId: 'eng-1',
        reason: 'training',
        startTime: start,
        endTime: end,
        autoReassignPending: false,
        pauseSLAForPending: true,
        createdBy: 'admin',
      });

      expect(suspend.autoReassignPending).toBe(false);
      expect(suspend.pauseSLAForPending).toBe(true);
    });

    it('should allow notes', async () => {
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = await service.createSuspend({
        engineerId: 'eng-1',
        reason: 'other',
        startTime: start,
        endTime: end,
        notes: 'Special circumstances',
        createdBy: 'admin',
      });

      expect(suspend.notes).toBe('Special circumstances');
    });

    it('should support all suspend reasons', async () => {
      const reasons: SuspendReason[] = ['leave', 'sick', 'training', 'offline', 'other'];
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      for (const reason of reasons) {
        const suspend = await service.createSuspend({
          engineerId: 'eng-1',
          reason,
          startTime: start,
          endTime: end,
          createdBy: 'admin',
        });

        expect(suspend.reason).toBe(reason);
      }
    });
  });

  // ==================== Activate Suspend ====================

  describe('activateSuspend', () => {
    it('should return null for non-existent suspend', async () => {
      const result = await service.activateSuspend('SUSP-nonexistent');
      expect(result).toBeNull();
    });

    it('should activate a scheduled suspension', async () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const created = await service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: futureStart,
        endTime: end,
        createdBy: 'admin',
      });

      expect(created.status).toBe('scheduled');

      const mockSuspend = {
        ...created,
        status: 'scheduled' as const,
      };
      mockRepo.findSuspendById.mockResolvedValueOnce(mockSuspend);
      mockRepo.updateSuspendStatus.mockResolvedValueOnce({ ...mockSuspend, status: 'active' });
      mockRepo.findSuspendById.mockResolvedValueOnce({ ...mockSuspend, status: 'active' });

      const activated = await service.activateSuspend(created.id);

      expect(activated).not.toBeNull();
      expect(activated!.status).toBe('active');
    });
  });

  // ==================== End Suspend ====================

  describe('endSuspend', () => {
    it('should return null for non-existent suspend', async () => {
      const result = await service.endSuspend('SUSP-nonexistent');
      expect(result).toBeNull();
    });
  });

  // ==================== Cancel Suspend ====================

  describe('cancelSuspend', () => {
    it('should return null for non-existent suspend', async () => {
      const result = await service.cancelSuspend('SUSP-nonexistent');
      expect(result).toBeNull();
    });
  });

  // ==================== Query Suspensions ====================

  describe('getActiveSuspensions', () => {
    it('should return empty array when no active suspensions', async () => {
      const active = await service.getActiveSuspensions();
      expect(active.length).toBe(0);
    });
  });

  describe('getScheduledSuspensions', () => {
    it('should return empty array when no scheduled suspensions', async () => {
      const scheduled = await service.getScheduledSuspensions();
      expect(scheduled.length).toBe(0);
    });
  });

  describe('getSuspend', () => {
    it('should return null for non-existent suspend', async () => {
      const result = await service.getSuspend('SUSP-nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getEngineerSuspensions', () => {
    it('should return empty array for engineer with no suspensions', async () => {
      const suspensions = await service.getEngineerSuspensions('eng-unknown');
      expect(suspensions.length).toBe(0);
    });
  });

  // ==================== isSuspended ====================

  describe('isSuspended', () => {
    it('should return false for non-suspended engineer', async () => {
      expect(await service.isSuspended('eng-1')).toBe(false);
    });
  });

  // ==================== Backup Engineer ====================

  describe('getBackupEngineer', () => {
    it('should return null if engineer is not suspended', async () => {
      const engineers: EngineerProfile[] = [
        createTestEngineer({ id: 'eng-backup', name: 'Backup' }),
      ];

      const backup = await service.getBackupEngineer('eng-1', engineers);
      expect(backup).toBeNull();
    });
  });

  // ==================== Impact Analysis ====================

  describe('analyzeImpact', () => {
    it('should throw error for non-existent suspend', async () => {
      const tickets = [createTestTicket()];

      await expect(service.analyzeImpact('SUSP-nonexistent', tickets)).rejects.toThrow(
        'Suspend SUSP-nonexistent not found'
      );
    });
  });

  // ==================== Auto Activate/End ====================

  describe('checkAutoActivate', () => {
    it('should return empty when no scheduled suspensions', async () => {
      const activated = await service.checkAutoActivate();
      expect(activated.length).toBe(0);
    });
  });

  describe('checkAutoEnd', () => {
    it('should return empty when no active suspensions', async () => {
      const ended = await service.checkAutoEnd();
      expect(ended.length).toBe(0);
    });
  });

  // ==================== Auto Checks Timer ====================

  describe('startAutoChecks', () => {
    it('should start auto checks timer', () => {
      jest.useFakeTimers();
      service.startAutoChecks(100);
      jest.advanceTimersByTime(100);
      service.stopAutoChecks();
      jest.useRealTimers();
    });

    it('should stop auto checks timer', () => {
      service.startAutoChecks(100);
      service.stopAutoChecks();
      // Should not throw on double stop
      service.stopAutoChecks();
    });

    it('should replace previous timer when starting new one', () => {
      jest.useFakeTimers();
      service.startAutoChecks(100);
      service.startAutoChecks(200);
      service.stopAutoChecks();
      jest.useRealTimers();
    });
  });

  // ==================== Clear All ====================

  describe('clearAll', () => {
    it('should stop auto checks timer', () => {
      service.startAutoChecks(100);
      service.clearAll();
      // Should not throw
      service.stopAutoChecks();
    });
  });
});
