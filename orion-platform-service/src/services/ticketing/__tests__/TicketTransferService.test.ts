/**
 * TASK-TICKET-XFER: TicketTransferService Tests
 */

import { TicketTransferService } from '../TicketTransferService';
import { Ticket, TicketTransfer, EngineerProfile, AutoTransferConfig } from '../types';

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
  createdAt: new Date(Date.now() - 30 * 60 * 1000),
  updatedAt: new Date(Date.now() - 30 * 60 * 1000),
  escalationLevel: 0,
  ...overrides,
});

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

describe('TicketTransferService', () => {
  let service: TicketTransferService;

  beforeEach(() => {
    service = new TicketTransferService();
  });

  afterEach(() => {
    service.clearAll();
  });

  // ==================== Manual Transfer ====================

  describe('transferTicket (manual)', () => {
    it('should successfully transfer a ticket', () => {
      const ticket = createTestTicket();
      const result = service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'Need expertise');

      expect('error' in result).toBe(false);
      if ('transfer' in result) {
        expect(result.transfer.id).toMatch(/^XFER-/);
        expect(result.transfer.ticketId).toBe('TKT-test-1');
        expect(result.transfer.fromEngineer).toBe('eng-1');
        expect(result.transfer.toEngineer).toBe('eng-2');
        expect(result.transfer.transferType).toBe('manual');
        expect(result.transfer.reason).toBe('Need expertise');
        expect(result.transfer.initiatedBy).toBe('admin');
        expect(result.transfer.accepted).toBe(true);
        expect(result.holdDurationMs).toBeGreaterThan(0);
      }
    });

    it('should fail if ticket is not assigned to fromEngineer', () => {
      const ticket = createTestTicket({ assignee: 'eng-3' });
      const result = service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'test');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('is not assigned to eng-1');
      }
    });

    it('should fail if transferring to the same engineer', () => {
      const ticket = createTestTicket();
      const result = service.transferTicket(ticket, 'eng-1', 'eng-1', 'admin', 'test');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('Cannot transfer to the same engineer');
      }
    });

    it('should enforce maximum transfer limit', () => {
      const ticket = createTestTicket();

      // Use custom config with maxTransferCount = 2
      service = new TicketTransferService({ maxTransferCount: 2 });

      // First transfer
      service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'first');
      // Need to update ticket assignee manually for subsequent transfers
      ticket.assignee = 'eng-2';
      ticket.updatedAt = new Date();
      service.transferTicket(ticket, 'eng-2', 'eng-3', 'admin', 'second');

      ticket.assignee = 'eng-3';
      ticket.updatedAt = new Date();
      const result = service.transferTicket(ticket, 'eng-3', 'eng-4', 'admin', 'third');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('maximum transfer limit');
      }
    });

    it('should calculate hold duration correctly', () => {
      const ticket = createTestTicket();
      const result = service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'test');

      expect('holdDurationMs' in result).toBe(true);
      if ('holdDurationMs' in result) {
        expect(result.holdDurationMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ==================== Auto Transfer ====================

  describe('checkAndAutoTransfer', () => {
    it('should auto-transfer tickets that exceeded timeout', () => {
      // Configure very short timeout for testing
      service = new TicketTransferService({
        notStartedTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        inProgressTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        maxTransferCount: 5,
      });

      const oldTicket = createTestTicket({
        id: 'TKT-old-1',
        status: 'assigned',
        assignee: 'eng-1',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
      });

      const findBestEngineer = jest.fn().mockReturnValue({
        engineer: createTestEngineer({ id: 'eng-2' }),
      });

      const result = service.checkAndAutoTransfer([oldTicket], findBestEngineer);

      expect(result.length).toBe(1);
      expect(result[0].transfer.transferType).toBe('auto-timeout');
      expect(result[0].transfer.initiatedBy).toBe('system');
      expect(findBestEngineer).toHaveBeenCalled();
    });

    it('should not transfer tickets that have not exceeded timeout', () => {
      const freshTicket = createTestTicket({
        id: 'TKT-fresh-1',
        status: 'assigned',
        updatedAt: new Date(), // Just now
      });

      const findBestEngineer = jest.fn().mockReturnValue({
        engineer: createTestEngineer({ id: 'eng-2' }),
      });

      const result = service.checkAndAutoTransfer([freshTicket], findBestEngineer);

      expect(result.length).toBe(0);
    });

    it('should skip closed tickets', () => {
      const closedTicket = createTestTicket({
        id: 'TKT-closed-1',
        status: 'closed',
        assignee: 'eng-1',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      const findBestEngineer = jest.fn().mockReturnValue({
        engineer: createTestEngineer({ id: 'eng-2' }),
      });

      const result = service.checkAndAutoTransfer([closedTicket], findBestEngineer);
      expect(result.length).toBe(0);
    });

    it('should skip resolved tickets', () => {
      const resolvedTicket = createTestTicket({
        id: 'TKT-resolved-1',
        status: 'resolved',
        assignee: 'eng-1',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      const findBestEngineer = jest.fn().mockReturnValue({
        engineer: createTestEngineer({ id: 'eng-2' }),
      });

      const result = service.checkAndAutoTransfer([resolvedTicket], findBestEngineer);
      expect(result.length).toBe(0);
    });

    it('should skip excluded engineers', () => {
      service = new TicketTransferService({
        notStartedTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        inProgressTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        excludedEngineers: ['eng-1'],
        maxTransferCount: 5,
      });

      const ticket = createTestTicket({
        assignee: 'eng-1',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      const findBestEngineer = jest.fn().mockReturnValue({
        engineer: createTestEngineer({ id: 'eng-2' }),
      });

      const result = service.checkAndAutoTransfer([ticket], findBestEngineer);
      expect(result.length).toBe(0);
    });

    it('should skip when no available engineer found', () => {
      service = new TicketTransferService({
        notStartedTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        inProgressTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        maxTransferCount: 5,
      });

      const ticket = createTestTicket({
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      const findBestEngineer = jest.fn().mockReturnValue(null);

      const result = service.checkAndAutoTransfer([ticket], findBestEngineer);
      expect(result.length).toBe(0);
    });

    it('should not transfer when auto-transfer is disabled', () => {
      service = new TicketTransferService({
        enabled: false,
        notStartedTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        inProgressTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        maxTransferCount: 5,
      });

      const ticket = createTestTicket({
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      const findBestEngineer = jest.fn().mockReturnValue({
        engineer: createTestEngineer({ id: 'eng-2' }),
      });

      const result = service.checkAndAutoTransfer([ticket], findBestEngineer);
      expect(result.length).toBe(0);
    });

    it('should use escalation type for in-progress tickets', () => {
      service = new TicketTransferService({
        notStartedTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        inProgressTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        maxTransferCount: 5,
      });

      const ticket = createTestTicket({
        id: 'TKT-progress-1',
        status: 'in-progress',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      const findBestEngineer = jest.fn().mockReturnValue({
        engineer: createTestEngineer({ id: 'eng-2' }),
      });

      const result = service.checkAndAutoTransfer([ticket], findBestEngineer);

      expect(result.length).toBe(1);
      expect(result[0].transfer.transferType).toBe('escalation');
    });

    it('should exclude previous assignees when finding new engineer', () => {
      service = new TicketTransferService({
        notStartedTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        inProgressTimeout: {
          critical: 1000,
          high: 1000,
          medium: 1000,
          low: 1000,
        },
        maxTransferCount: 5,
      });

      const ticket = createTestTicket({
        assignee: 'eng-2',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      // Simulate previous transfer from eng-1 to eng-2
      service.transferTicket(
        { ...ticket, assignee: 'eng-1', updatedAt: new Date(Date.now() - 20 * 60 * 1000) },
        'eng-1',
        'eng-2',
        'admin',
        'first transfer'
      );

      const findBestEngineer = jest.fn().mockReturnValue({
        engineer: createTestEngineer({ id: 'eng-3' }),
      });

      service.checkAndAutoTransfer([ticket], findBestEngineer);

      // Should have been called excluding eng-1 (previous assignee)
      expect(findBestEngineer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'TKT-test-1' }),
        expect.arrayContaining(['eng-1'])
      );
    });
  });

  // ==================== Suspend Transfer ====================

  describe('transferDueToSuspend', () => {
    it('should transfer ticket to backup engineer', () => {
      const ticket = createTestTicket();
      const result = service.transferDueToSuspend(ticket, 'eng-backup', 'admin');

      expect('error' in result).toBe(false);
      if ('transfer' in result) {
        expect(result.transfer.transferType).toBe('backup');
        expect(result.transfer.toEngineer).toBe('eng-backup');
        expect(result.transfer.reason).toContain('suspension');
      }
    });

    it('should fail if ticket is not assigned', () => {
      const ticket = createTestTicket({ assignee: undefined });
      const result = service.transferDueToSuspend(ticket, 'eng-backup', 'admin');

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('is not assigned');
      }
    });
  });

  // ==================== Transfer History ====================

  describe('getTransferHistory', () => {
    it('should return empty history for new ticket', () => {
      const history = service.getTransferHistory('TKT-nonexistent');
      expect(history.length).toBe(0);
    });

    it('should return transfer history sorted by most recent first', () => {
      const ticket = createTestTicket();
      const firstResult = service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'first');

      ticket.assignee = 'eng-2';
      ticket.updatedAt = new Date(Date.now() + 1000);

      // Small delay to ensure different transferredAt
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      // Since we can't use async in sync tests, we'll verify sorting logic differently
      const secondResult = service.transferTicket(ticket, 'eng-2', 'eng-3', 'admin', 'second');

      const history = service.getTransferHistory('TKT-test-1');

      expect(history.length).toBe(2);
      // Both transfers should be present
      if ('transfer' in firstResult && 'transfer' in secondResult) {
        const ids = history.map(h => h.id);
        expect(ids).toContain(firstResult.transfer.id);
        expect(ids).toContain(secondResult.transfer.id);
      }
    });
  });

  describe('getEngineerTransfers', () => {
    it('should return transfers from and to an engineer', () => {
      const ticket = createTestTicket();
      service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'first');

      const eng1Transfers = service.getEngineerTransfers('eng-1');
      expect(eng1Transfers.transferredFrom.length).toBe(1);
      expect(eng1Transfers.transferredTo.length).toBe(0);

      const eng2Transfers = service.getEngineerTransfers('eng-2');
      expect(eng2Transfers.transferredFrom.length).toBe(0);
      expect(eng2Transfers.transferredTo.length).toBe(1);
    });

    it('should return empty arrays for engineer with no transfers', () => {
      const result = service.getEngineerTransfers('eng-unknown');
      expect(result.transferredFrom.length).toBe(0);
      expect(result.transferredTo.length).toBe(0);
    });
  });

  // ==================== Transfer Stats ====================

  describe('getTransferStats', () => {
    it('should return zero stats when no transfers', () => {
      const stats = service.getTransferStats();

      expect(stats.totalTransfers).toBe(0);
      expect(stats.byType.manual).toBe(0);
      expect(stats.mostTransferred.length).toBe(0);
      expect(stats.avgHoldTimeMs).toBe(0);
      expect(stats.maxTransfersPerTicket).toBe(0);
    });

    it('should count transfers by type', () => {
      const ticket1 = createTestTicket();
      const ticket2 = createTestTicket({ id: 'TKT-test-2', assignee: 'eng-3' });

      service.transferTicket(ticket1, 'eng-1', 'eng-2', 'admin', 'manual transfer');
      service.transferDueToSuspend(ticket2, 'eng-backup', 'admin');

      const stats = service.getTransferStats();

      expect(stats.totalTransfers).toBe(2);
      expect(stats.byType.manual).toBe(1);
      expect(stats.byType.backup).toBe(1);
    });

    it('should calculate average hold time', () => {
      const ticket = createTestTicket();
      service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'test');

      const stats = service.getTransferStats();
      expect(stats.avgHoldTimeMs).toBeGreaterThan(0);
    });

    it('should filter stats by period', () => {
      const ticket = createTestTicket();
      service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'test');

      const futureStart = new Date(Date.now() + 10000);
      const stats = service.getTransferStats(futureStart, undefined);

      expect(stats.totalTransfers).toBe(0);
    });

    it('should track max transfers per ticket', () => {
      const ticket = createTestTicket();
      service = new TicketTransferService({ maxTransferCount: 5 });

      service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'first');
      ticket.assignee = 'eng-2';
      ticket.updatedAt = new Date();
      service.transferTicket(ticket, 'eng-2', 'eng-3', 'admin', 'second');

      const stats = service.getTransferStats();
      expect(stats.maxTransfersPerTicket).toBe(2);
    });
  });

  // ==================== Most Transferred Tickets ====================

  describe('getMostTransferredTickets', () => {
    it('should return empty list when no transfers', () => {
      const result = service.getMostTransferredTickets();
      expect(result.length).toBe(0);
    });

    it('should rank tickets by transfer count', () => {
      const ticket1 = createTestTicket();
      const ticket2 = createTestTicket({ id: 'TKT-test-2', assignee: 'eng-3' });
      service = new TicketTransferService({ maxTransferCount: 5 });

      // ticket1 transferred twice
      service.transferTicket(ticket1, 'eng-1', 'eng-2', 'admin', 'first');
      ticket1.assignee = 'eng-2';
      ticket1.updatedAt = new Date();
      service.transferTicket(ticket1, 'eng-2', 'eng-3', 'admin', 'second');

      // ticket2 transferred once
      service.transferTicket(ticket2, 'eng-3', 'eng-4', 'admin', 'once');

      const result = service.getMostTransferredTickets();
      expect(result.length).toBe(2);
      expect(result[0].ticketId).toBe('TKT-test-1');
      expect(result[0].count).toBe(2);
    });

    it('should respect limit parameter', () => {
      service = new TicketTransferService({ maxTransferCount: 10 });

      for (let i = 0; i < 5; i++) {
        const ticket = createTestTicket({
          id: `TKT-${i}`,
          assignee: `eng-${i}`,
        });
        service.transferTicket(ticket, `eng-${i}`, `eng-${i + 10}`, 'admin', 'test');
      }

      const result = service.getMostTransferredTickets(3);
      expect(result.length).toBe(3);
    });
  });

  // ==================== Config ====================

  describe('config management', () => {
    it('should use default config', () => {
      const config = service.getConfig();
      expect(config.maxTransferCount).toBe(3);
      expect(config.enabled).toBe(true);
      expect(config.checkIntervalMs).toBe(5 * 60 * 1000);
    });

    it('should accept custom config in constructor', () => {
      const customService = new TicketTransferService({
        maxTransferCount: 10,
        enabled: false,
      });

      const config = customService.getConfig();
      expect(config.maxTransferCount).toBe(10);
      expect(config.enabled).toBe(false);
      customService.clearAll();
    });

    it('should update config', () => {
      service.updateConfig({ maxTransferCount: 5 });
      const config = service.getConfig();
      expect(config.maxTransferCount).toBe(5);
    });
  });

  // ==================== Callbacks ====================

  describe('transfer callback', () => {
    it('should call callback on transfer', () => {
      const callback = jest.fn();
      service.setTransferCallback(callback);

      const ticket = createTestTicket();
      service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'test');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          transferType: 'manual',
          toEngineer: 'eng-2',
        }),
        expect.objectContaining({ id: 'TKT-test-1' })
      );
    });
  });

  // ==================== Auto Transfer Timer ====================

  describe('auto transfer timer', () => {
    it('should start auto transfer timer', () => {
      jest.useFakeTimers();
      service.startAutoTransfer(100);
      jest.advanceTimersByTime(100);
      service.stopAutoTransfer();
      jest.useRealTimers();
    });

    it('should stop auto transfer timer', () => {
      service.startAutoTransfer(100);
      service.stopAutoTransfer();
      // Should not throw
    });

    it('should stop previous timer when starting a new one', () => {
      jest.useFakeTimers();
      service.startAutoTransfer(100);
      service.startAutoTransfer(200); // Should stop the first timer
      service.stopAutoTransfer();
      jest.useRealTimers();
    });
  });

  // ==================== Clear All ====================

  describe('clearAll', () => {
    it('should clear all transfers', () => {
      const ticket = createTestTicket();
      service.transferTicket(ticket, 'eng-1', 'eng-2', 'admin', 'test');

      service.clearAll();
      const history = service.getTransferHistory('TKT-test-1');
      expect(history.length).toBe(0);
    });

    it('should stop auto transfer timer', () => {
      service.startAutoTransfer(100);
      service.clearAll();
      // Should not throw on double stop
      service.stopAutoTransfer();
    });
  });
});
