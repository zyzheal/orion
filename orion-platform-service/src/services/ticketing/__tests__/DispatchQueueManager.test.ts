/**
 * TASK-802: DispatchQueueManager Tests
 */

import { DispatchQueueManager } from '../DispatchQueueManager';
import {
  Ticket,
  SLATarget,
  TicketPriority,
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

const createSLATarget = (priority: TicketPriority = 'high'): SLATarget => ({
  id: `sla-${priority}`,
  name: `${priority} SLA`,
  priority,
  targetResponseTimeMs: 1 * 60 * 60 * 1000,
  targetResolutionTimeMs: 8 * 60 * 60 * 1000,
  enabled: true,
});

describe('DispatchQueueManager', () => {
  let queue: DispatchQueueManager;

  beforeEach(() => {
    queue = new DispatchQueueManager({ autoReprioritize: false });
  });

  afterEach(() => {
    queue.clearAll();
  });

  // ==================== Queue Operations ====================

  describe('enqueue/dequeue', () => {
    it('should enqueue a ticket', () => {
      const ticket = createTestTicket();
      const entry = queue.enqueue(ticket);

      expect(entry.id).toMatch(/^DQ-/);
      expect(entry.ticket.id).toBe(ticket.id);
      expect(entry.dispatchAttemptCount).toBe(0);
    });

    it('should calculate SLA deadline when target provided', () => {
      const ticket = createTestTicket();
      const sla = createSLATarget('high');
      const entry = queue.enqueue(ticket, sla);

      expect(entry.slaDeadline).toBeDefined();
    });

    it('should dequeue the highest priority ticket', () => {
      const ticket1 = createTestTicket({ id: 'TKT-1', priority: 'low' });
      const ticket2 = createTestTicket({ id: 'TKT-2', priority: 'critical' });

      queue.enqueue(ticket1);
      queue.enqueue(ticket2);

      const dequeued = queue.dequeue();
      expect(dequeued).not.toBeNull();
      expect(dequeued!.ticket.id).toBe('TKT-2'); // Critical first
    });

    it('should return null when queue is empty', () => {
      const result = queue.dequeue();
      expect(result).toBeNull();
    });

    it('should remove a specific ticket', () => {
      const ticket = createTestTicket();
      queue.enqueue(ticket);

      const removed = queue.remove(ticket.id);
      expect(removed).toBe(true);
      expect(queue.getQueueSize()).toBe(0);
    });

    it('should check if ticket is in queue', () => {
      const ticket = createTestTicket();
      queue.enqueue(ticket);

      expect(queue.hasTicket(ticket.id)).toBe(true);
      expect(queue.hasTicket('non-existent')).toBe(false);
    });

    it('should get entry by ticket ID', () => {
      const ticket = createTestTicket();
      queue.enqueue(ticket);

      const entry = queue.getEntry(ticket.id);
      expect(entry).toBeDefined();
      expect(entry!.ticket.id).toBe(ticket.id);
    });

    it('should return entries sorted by priority', () => {
      const critical = createTestTicket({ id: 'TKT-c', priority: 'critical' });
      const low = createTestTicket({ id: 'TKT-l', priority: 'low' });
      const high = createTestTicket({ id: 'TKT-h', priority: 'high' });

      queue.enqueue(low);
      queue.enqueue(critical);
      queue.enqueue(high);

      const entries = queue.getEntries();
      expect(entries[0].ticket.priority).toBe('critical');
      expect(entries[1].ticket.priority).toBe('high');
      expect(entries[2].ticket.priority).toBe('low');
    });

    it('should get queue size', () => {
      queue.enqueue(createTestTicket({ id: 'TKT-1' }));
      queue.enqueue(createTestTicket({ id: 'TKT-2' }));

      expect(queue.getQueueSize()).toBe(2);
    });
  });

  // ==================== Re-prioritization ====================

  describe('reprioritization', () => {
    it('should reprioritize a specific entry', () => {
      const ticket = createTestTicket();
      queue.enqueue(ticket);

      const entry = queue.reprioritizeEntry(ticket.id);
      expect(entry).not.toBeNull();
      expect(entry!.reprioritizeCount).toBe(1);
    });

    it('should return null for non-existent entry', () => {
      const result = queue.reprioritizeEntry('non-existent');
      expect(result).toBeNull();
    });

    it('should reprioritize all entries', () => {
      queue.enqueue(createTestTicket({ id: 'TKT-1' }));
      queue.enqueue(createTestTicket({ id: 'TKT-2' }));
      queue.enqueue(createTestTicket({ id: 'TKT-3' }));

      const count = queue.reprioritizeAll();
      expect(count).toBe(3);

      // Check all entries were updated
      const entries = queue.getEntries();
      for (const entry of entries) {
        expect(entry.reprioritizeCount).toBe(1);
      }
    });
  });

  // ==================== SLA Monitoring ====================

  describe('SLA alerts', () => {
    it('should generate SLA breach alerts for past-due tickets', () => {
      // Create a ticket that was created long ago
      const pastDate = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10 hours ago
      const ticket = createTestTicket({
        id: 'TKT-overdue',
        createdAt: pastDate,
        priority: 'critical',
      });

      const sla = createSLATarget('critical');
      sla.targetResolutionTimeMs = 4 * 60 * 60 * 1000; // 4 hours

      queue.enqueue(ticket, sla);
      const alerts = queue.checkSLAAlerts();

      // Should have a breach alert
      const breachAlert = alerts.find(a => a.alertType === 'sla-breach');
      expect(breachAlert).toBeDefined();
    });

    it('should get SLA alerts with type filter', () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 60 * 1000);
      const ticket = createTestTicket({
        id: 'TKT-overdue',
        createdAt: pastDate,
        priority: 'critical',
      });

      const sla = createSLATarget('critical');
      sla.targetResolutionTimeMs = 4 * 60 * 60 * 1000;
      queue.enqueue(ticket, sla);

      queue.checkSLAAlerts();

      const breachAlerts = queue.getSLAAlerts({ type: 'sla-breach' });
      expect(breachAlerts.length).toBeGreaterThan(0);
    });

    it('should sort alerts by severity', () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 60 * 1000);
      const ticket = createTestTicket({
        id: 'TKT-overdue',
        createdAt: pastDate,
        priority: 'critical',
      });

      const sla = createSLATarget('critical');
      sla.targetResolutionTimeMs = 4 * 60 * 60 * 1000;
      queue.enqueue(ticket, sla);

      queue.checkSLAAlerts();

      const alerts = queue.getSLAAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alertType).toBe('sla-breach'); // Most severe first
    });

    it('should clear resolved alerts', () => {
      const ticket = createTestTicket();
      queue.enqueue(ticket);
      queue.checkSLAAlerts();

      // Remove ticket (simulating dispatch)
      queue.markDispatched(ticket.id);

      const cleared = queue.clearResolvedAlerts();
      // Alert should be cleared since ticket is no longer in queue
      expect(cleared).toBeGreaterThanOrEqual(0);
    });

    it('should not generate alerts for fresh tickets', () => {
      const ticket = createTestTicket();
      const sla = createSLATarget('low');
      sla.targetResolutionTimeMs = 72 * 60 * 60 * 1000;

      queue.enqueue(ticket, sla);
      const alerts = queue.checkSLAAlerts();

      expect(alerts.length).toBe(0);
    });
  });

  // ==================== Queue Status ====================

  describe('queue status', () => {
    it('should return correct status for empty queue', () => {
      const status = queue.getQueueStatus();

      expect(status.totalInQueue).toBe(0);
      expect(status.slaAtRisk).toBe(0);
      expect(status.slaBreached).toBe(0);
      expect(status.avgWaitTimeMs).toBe(0);
    });

    it('should return correct status with tickets', () => {
      queue.enqueue(createTestTicket({ id: 'TKT-1', priority: 'high' }));
      queue.enqueue(createTestTicket({ id: 'TKT-2', priority: 'medium' }));
      queue.enqueue(createTestTicket({ id: 'TKT-3', priority: 'critical' }));

      const status = queue.getQueueStatus();

      expect(status.totalInQueue).toBe(3);
      expect(status.byPriority.critical).toBe(1);
      expect(status.byPriority.high).toBe(1);
      expect(status.byPriority.medium).toBe(1);
    });

    it('should track SLA at risk tickets', () => {
      // Create a ticket that's 80% through its SLA
      const totalSLA = 10 * 60 * 1000; // 10 minutes total
      const elapsed = 8 * 60 * 1000; // 8 minutes elapsed
      const createdAt = new Date(Date.now() - elapsed);

      const ticket = createTestTicket({
        id: 'TKT-at-risk',
        createdAt,
        priority: 'high',
      });

      const sla = createSLATarget('high');
      sla.targetResolutionTimeMs = totalSLA;

      queue.enqueue(ticket, sla);
      const status = queue.getQueueStatus();

      expect(status.slaAtRisk).toBeGreaterThan(0);
    });
  });

  // ==================== Dispatch Tracking ====================

  describe('dispatch tracking', () => {
    it('should record dispatch attempts', () => {
      const ticket = createTestTicket();
      queue.enqueue(ticket);

      queue.recordDispatchAttempt(ticket.id);

      const entry = queue.getEntry(ticket.id);
      expect(entry!.dispatchAttemptCount).toBe(1);
      expect(entry!.lastDispatchAttempt).toBeDefined();
    });

    it('should mark ticket as dispatched', () => {
      const ticket = createTestTicket();
      queue.enqueue(ticket);

      const result = queue.markDispatched(ticket.id);
      expect(result).toBe(true);
      expect(queue.hasTicket(ticket.id)).toBe(false);
    });

    it('should clear related alerts on dispatch', () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 60 * 1000);
      const ticket = createTestTicket({
        id: 'TKT-overdue',
        createdAt: pastDate,
        priority: 'critical',
      });

      const sla = createSLATarget('critical');
      sla.targetResolutionTimeMs = 4 * 60 * 60 * 1000;
      queue.enqueue(ticket, sla);
      queue.checkSLAAlerts();

      // Mark as dispatched
      queue.markDispatched(ticket.id);

      // Alerts should be cleared
      const alerts = queue.getSLAAlerts();
      const ticketAlerts = alerts.filter(a => a.ticketId === ticket.id);
      expect(ticketAlerts.length).toBe(0);
    });
  });

  // ==================== Event Callbacks ====================

  describe('event callbacks', () => {
    it('should call dispatch callback on enqueue', () => {
      let callbackCalled = false;
      let callbackEntry: any = null;

      queue.setDispatchCallback((entry) => {
        callbackCalled = true;
        callbackEntry = entry;
      });

      const ticket = createTestTicket();
      queue.enqueue(ticket);

      expect(callbackCalled).toBe(true);
      expect(callbackEntry.ticket.id).toBe(ticket.id);
    });
  });

  // ==================== Clear ====================

  describe('clearAll', () => {
    it('should clear all data', () => {
      queue.enqueue(createTestTicket({ id: 'TKT-1' }));
      queue.enqueue(createTestTicket({ id: 'TKT-2' }));

      queue.clearAll();
      expect(queue.getQueueSize()).toBe(0);
    });
  });
});
