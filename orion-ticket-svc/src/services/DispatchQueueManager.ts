/**
 * DispatchQueueManager Stub - manages dispatch queue for unassigned tickets.
 */
import { Ticket, SLAAlert, DispatchQueueStatus, SLATarget, TicketAssignment } from '../types/ticketing';

export interface DispatchQueueEntry {
  id: string;
  ticket: Ticket;
  dispatchPriority: number;
  enqueuedAt: Date;
  slaDeadline?: Date;
  reprioritizeCount: number;
  dispatchAttemptCount: number;
}

export class DispatchQueueManager {
  enqueue(ticket: Ticket, slaTarget?: SLATarget): void {}
  startAutoReprioritize(): void {}
  stopAutoReprioritize(): void {}
  setDispatchCallback(cb: (entry: DispatchQueueEntry) => void): void {}
  recordDispatchAttempt(ticketId: string): void {}
  markDispatched(ticketId: string): void {}
  getQueueStatus(): DispatchQueueStatus {
    return { totalInQueue: 0, byPriority: {} as any, slaAtRisk: 0, slaBreached: 0, avgWaitTimeMs: 0, oldestWaitTimeMs: 0 };
  }
  getEntries(): DispatchQueueEntry[] {
    return [];
  }
  getSLAAlerts(options?: { type?: 'sla-warning' | 'sla-critical' | 'sla-breach'; limit?: number }): SLAAlert[] {
    return [];
  }
  clearAll(): void {}
}
