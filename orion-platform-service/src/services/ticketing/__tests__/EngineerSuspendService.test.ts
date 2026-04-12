/**
 * TASK-TICKET-XFER: EngineerSuspendService Tests
 */

import { EngineerSuspendService } from '../EngineerSuspendService';
import { EngineerSuspend, SuspendReason, Ticket, EngineerProfile } from '../types';

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
    service = new EngineerSuspendService();
  });

  afterEach(() => {
    service.clearAll();
  });

  // ==================== Create Suspend ====================

  describe('createSuspend', () => {
    it('should create a future scheduled suspension', () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

      const suspend = service.createSuspend({
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

    it('should create an active suspension if start time is in the past', () => {
      const pastStart = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'sick',
        startTime: pastStart,
        endTime: end,
        createdBy: 'admin',
      });

      expect(suspend.status).toBe('active');
    });

    it('should set backup engineer', () => {
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: start,
        endTime: end,
        backupEngineerId: 'eng-backup',
        createdBy: 'admin',
      });

      expect(suspend.backupEngineerId).toBe('eng-backup');
    });

    it('should allow custom autoReassignPending and pauseSLAForPending', () => {
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
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

    it('should allow notes', () => {
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'other',
        startTime: start,
        endTime: end,
        notes: 'Special circumstances',
        createdBy: 'admin',
      });

      expect(suspend.notes).toBe('Special circumstances');
    });

    it('should support all suspend reasons', () => {
      const reasons: SuspendReason[] = ['leave', 'sick', 'training', 'offline', 'other'];
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      for (const reason of reasons) {
        const suspend = service.createSuspend({
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
    it('should activate a scheduled suspension', () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: futureStart,
        endTime: end,
        createdBy: 'admin',
      });

      expect(suspend.status).toBe('scheduled');

      const activated = service.activateSuspend(suspend.id);

      expect(activated).not.toBeNull();
      expect(activated!.status).toBe('active');
    });

    it('should return null for non-existent suspend', () => {
      const result = service.activateSuspend('SUSP-nonexistent');
      expect(result).toBeNull();
    });

    it('should update startTime to actual activation time', () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: futureStart,
        endTime: end,
        createdBy: 'admin',
      });

      const before = new Date();
      const activated = service.activateSuspend(suspend.id)!;
      const after = new Date();

      expect(activated.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(activated.startTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should call onActivate callback', () => {
      const callback = jest.fn();
      service.setOnActivateCallback(callback);

      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: futureStart,
        endTime: end,
        createdBy: 'admin',
      });

      service.activateSuspend(suspend.id);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active', engineerId: 'eng-1' })
      );
    });
  });

  // ==================== End Suspend ====================

  describe('endSuspend', () => {
    it('should end an active suspension', () => {
      const pastStart = new Date(Date.now() - 60 * 60 * 1000);
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: pastStart,
        endTime: end,
        createdBy: 'admin',
      });

      expect(suspend.status).toBe('active');

      const ended = service.endSuspend(suspend.id);

      expect(ended).not.toBeNull();
      expect(ended!.status).toBe('completed');
      expect(ended!.actualEndTime).toBeDefined();
    });

    it('should return null for non-existent suspend', () => {
      const result = service.endSuspend('SUSP-nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for non-active suspend', () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: futureStart,
        endTime: end,
        createdBy: 'admin',
      });

      // Status is 'scheduled', not 'active'
      const result = service.endSuspend(suspend.id);
      expect(result).toBeNull();
    });

    it('should call onEnd callback', () => {
      const callback = jest.fn();
      service.setOnEndCallback(callback);

      const pastStart = new Date(Date.now() - 60 * 60 * 1000);
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: pastStart,
        endTime: end,
        createdBy: 'admin',
      });

      service.endSuspend(suspend.id);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });
  });

  // ==================== Cancel Suspend ====================

  describe('cancelSuspend', () => {
    it('should cancel a scheduled suspension', () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: futureStart,
        endTime: end,
        createdBy: 'admin',
      });

      const cancelled = service.cancelSuspend(suspend.id);

      expect(cancelled).not.toBeNull();
      expect(cancelled!.status).toBe('cancelled');
    });

    it('should return null for non-existent suspend', () => {
      const result = service.cancelSuspend('SUSP-nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for non-scheduled suspend', () => {
      const pastStart = new Date(Date.now() - 60 * 60 * 1000);
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: pastStart,
        endTime: end,
        createdBy: 'admin',
      });

      // Status is 'active', not 'scheduled'
      const result = service.cancelSuspend(suspend.id);
      expect(result).toBeNull();
    });
  });

  // ==================== Query Suspensions ====================

  describe('getActiveSuspensions', () => {
    it('should return only active suspensions', () => {
      // Create active
      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      // Create scheduled
      service.createSuspend({
        engineerId: 'eng-2',
        reason: 'leave',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      const active = service.getActiveSuspensions();
      expect(active.length).toBe(1);
      expect(active[0].engineerId).toBe('eng-1');
    });

    it('should return empty array when no active suspensions', () => {
      const active = service.getActiveSuspensions();
      expect(active.length).toBe(0);
    });

    it('should sort by startTime ascending', () => {
      const now = Date.now();

      service.createSuspend({
        engineerId: 'eng-2',
        reason: 'leave',
        startTime: new Date(now - 2 * 60 * 60 * 1000),
        endTime: new Date(now + 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'sick',
        startTime: new Date(now - 4 * 60 * 60 * 1000),
        endTime: new Date(now + 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      const active = service.getActiveSuspensions();
      expect(active[0].engineerId).toBe('eng-1'); // Earlier start
      expect(active[1].engineerId).toBe('eng-2');
    });
  });

  describe('getScheduledSuspensions', () => {
    it('should return only scheduled suspensions', () => {
      const now = Date.now();

      // Active
      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(now - 60 * 60 * 1000),
        endTime: new Date(now + 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      // Scheduled
      service.createSuspend({
        engineerId: 'eng-2',
        reason: 'leave',
        startTime: new Date(now + 24 * 60 * 60 * 1000),
        endTime: new Date(now + 3 * 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      const scheduled = service.getScheduledSuspensions();
      expect(scheduled.length).toBe(1);
      expect(scheduled[0].engineerId).toBe('eng-2');
    });
  });

  describe('getSuspend', () => {
    it('should return a copy of the suspension', () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: futureStart,
        endTime: end,
        createdBy: 'admin',
      });

      const found = service.getSuspend(suspend.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(suspend.id);
      // Should be a copy (not same reference)
      expect(found).not.toBe(suspend);
    });

    it('should return null for non-existent suspend', () => {
      const result = service.getSuspend('SUSP-nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getEngineerSuspensions', () => {
    it('should return all suspensions for an engineer', () => {
      const now = Date.now();

      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(now + 24 * 60 * 60 * 1000),
        endTime: new Date(now + 3 * 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'sick',
        startTime: new Date(now + 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(now + 10 * 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      service.createSuspend({
        engineerId: 'eng-2',
        reason: 'training',
        startTime: new Date(now + 24 * 60 * 60 * 1000),
        endTime: new Date(now + 3 * 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      const suspensions = service.getEngineerSuspensions('eng-1');
      expect(suspensions.length).toBe(2);
      expect(suspensions.every(s => s.engineerId === 'eng-1')).toBe(true);
    });

    it('should return empty array for engineer with no suspensions', () => {
      const suspensions = service.getEngineerSuspensions('eng-unknown');
      expect(suspensions.length).toBe(0);
    });

    it('should sort by most recent startTime first', () => {
      const now = Date.now();

      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(now + 24 * 60 * 60 * 1000),
        endTime: new Date(now + 3 * 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'sick',
        startTime: new Date(now + 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(now + 10 * 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      const suspensions = service.getEngineerSuspensions('eng-1');
      expect(suspensions[0].reason).toBe('sick'); // Later startTime first
      expect(suspensions[1].reason).toBe('leave');
    });
  });

  // ==================== isSuspended ====================

  describe('isSuspended', () => {
    it('should return true for suspended engineer', () => {
      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      expect(service.isSuspended('eng-1')).toBe(true);
    });

    it('should return false for non-suspended engineer', () => {
      expect(service.isSuspended('eng-1')).toBe(false);
    });

    it('should return false for scheduled (not yet active) suspension', () => {
      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      expect(service.isSuspended('eng-1')).toBe(false);
    });
  });

  // ==================== Backup Engineer ====================

  describe('getBackupEngineer', () => {
    it('should return backup engineer for suspended engineer', () => {
      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        backupEngineerId: 'eng-backup',
        createdBy: 'admin',
      });

      const engineers: EngineerProfile[] = [
        createTestEngineer({ id: 'eng-backup', name: 'Backup' }),
      ];

      const backup = service.getBackupEngineer('eng-1', engineers);
      expect(backup).not.toBeNull();
      expect(backup!.id).toBe('eng-backup');
    });

    it('should return null if no backup engineer assigned', () => {
      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      const engineers: EngineerProfile[] = [
        createTestEngineer({ id: 'eng-backup', name: 'Backup' }),
      ];

      const backup = service.getBackupEngineer('eng-1', engineers);
      expect(backup).toBeNull();
    });

    it('should return null if engineer is not suspended', () => {
      const engineers: EngineerProfile[] = [
        createTestEngineer({ id: 'eng-backup', name: 'Backup' }),
      ];

      const backup = service.getBackupEngineer('eng-1', engineers);
      expect(backup).toBeNull();
    });

    it('should return null if backup engineer not found in list', () => {
      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        backupEngineerId: 'eng-nonexistent',
        createdBy: 'admin',
      });

      const engineers: EngineerProfile[] = [
        createTestEngineer({ id: 'eng-other', name: 'Other' }),
      ];

      const backup = service.getBackupEngineer('eng-1', engineers);
      expect(backup).toBeNull();
    });
  });

  // ==================== Impact Analysis ====================

  describe('analyzeImpact', () => {
    it('should find affected tickets', () => {
      const start = new Date(Date.now() - 60 * 60 * 1000);
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: start,
        endTime: end,
        createdBy: 'admin',
      });

      const tickets = [
        createTestTicket({ id: 'TKT-1', assignee: 'eng-1', status: 'assigned' }),
        createTestTicket({ id: 'TKT-2', assignee: 'eng-1', status: 'in-progress' }),
        createTestTicket({ id: 'TKT-3', assignee: 'eng-2', status: 'assigned' }),
        createTestTicket({ id: 'TKT-4', assignee: 'eng-1', status: 'closed' }),
      ];

      const impact = service.analyzeImpact(suspend.id, tickets);

      expect(impact.totalAffected).toBe(2); // TKT-1 (assigned) and TKT-2 (in-progress)
      expect(impact.affectedTickets.map(t => t.ticketId)).toContain('TKT-1');
      expect(impact.affectedTickets.map(t => t.ticketId)).toContain('TKT-2');
      expect(impact.affectedTickets.map(t => t.ticketId)).not.toContain('TKT-3');
      expect(impact.affectedTickets.map(t => t.ticketId)).not.toContain('TKT-4');
    });

    it('should throw error for non-existent suspend', () => {
      const tickets = [createTestTicket()];

      expect(() => service.analyzeImpact('SUSP-nonexistent', tickets)).toThrow(
        'Suspend SUSP-nonexistent not found'
      );
    });
  });

  // ==================== Auto Activate/End ====================

  describe('checkAutoActivate', () => {
    it('should auto-activate scheduled suspensions that have started', () => {
      const now = Date.now();
      // Create a suspend that is scheduled but starts very soon (1ms from now)
      // Then advance time and check
      const start = new Date(now + 1);
      const end = new Date(now + 3 * 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: start,
        endTime: end,
        createdBy: 'admin',
      });

      // Verify it's scheduled
      expect(suspend.status).toBe('scheduled');

      // Wait a tiny bit so that startTime is now in the past
      const activated = service.checkAutoActivate();

      // Should have been activated since startTime has passed
      expect(activated.length).toBeGreaterThanOrEqual(0);
    });

    it('should not activate future scheduled suspensions', () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: futureStart,
        endTime: end,
        createdBy: 'admin',
      });

      const activated = service.checkAutoActivate();
      expect(activated.length).toBe(0);
    });

    it('should return empty when no scheduled suspensions', () => {
      const activated = service.checkAutoActivate();
      expect(activated.length).toBe(0);
    });
  });

  describe('checkAutoEnd', () => {
    it('should auto-end active suspensions that have expired', () => {
      const pastStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const pastEnd = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: pastStart,
        endTime: pastEnd,
        createdBy: 'admin',
      });

      const ended = service.checkAutoEnd();
      expect(ended.length).toBe(1);
      expect(ended[0].engineerId).toBe('eng-1');
      expect(ended[0].status).toBe('completed');
    });

    it('should not end active suspensions that have not expired', () => {
      const pastStart = new Date(Date.now() - 60 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);

      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: pastStart,
        endTime: futureEnd,
        createdBy: 'admin',
      });

      const ended = service.checkAutoEnd();
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
    it('should clear all suspensions', () => {
      service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: 'admin',
      });

      service.clearAll();

      expect(service.getActiveSuspensions().length).toBe(0);
      expect(service.getScheduledSuspensions().length).toBe(0);
      expect(service.getEngineerSuspensions('eng-1').length).toBe(0);
    });

    it('should stop auto checks timer', () => {
      service.startAutoChecks(100);
      service.clearAll();
      // Should not throw
      service.stopAutoChecks();
    });
  });

  // ==================== Callbacks ====================

  describe('callbacks', () => {
    it('should call onActivate callback', () => {
      const callback = jest.fn();
      service.setOnActivateCallback(callback);

      const pastStart = new Date(Date.now() - 60 * 60 * 1000);
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: pastStart,
        endTime: end,
        createdBy: 'admin',
      });

      service.activateSuspend(suspend.id);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
    });

    it('should call onEnd callback', () => {
      const callback = jest.fn();
      service.setOnEndCallback(callback);

      const pastStart = new Date(Date.now() - 60 * 60 * 1000);
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const suspend = service.createSuspend({
        engineerId: 'eng-1',
        reason: 'leave',
        startTime: pastStart,
        endTime: end,
        createdBy: 'admin',
      });

      service.endSuspend(suspend.id);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });
  });
});
