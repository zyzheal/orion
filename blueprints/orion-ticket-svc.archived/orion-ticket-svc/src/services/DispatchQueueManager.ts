/**
 * DispatchQueueManager - manages dispatch queue for unassigned tickets.
 *
 * Migrated from in-memory Map storage to PostgreSQL using the dispatch_queue table.
 * All queue entries are persisted via DispatchQueueRepository.
 */
import { Ticket, SLAAlert, DispatchQueueStatus, SLATarget, TicketAssignment, TicketPriority } from '../types/ticketing';
import {
  DispatchQueueRepository,
  DispatchQueueRow,
  DispatchQueuePayload,
} from '../repositories/DispatchQueueRepository';

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
  private repository: DispatchQueueRepository;
  private autoReprioritizeInterval?: ReturnType<typeof setInterval>;
  private dispatchCallback?: (entry: DispatchQueueEntry) => void;

  constructor(repository: DispatchQueueRepository) {
    this.repository = repository;
  }

  /**
   * Convert a DB row to the in-memory DispatchQueueEntry type.
   */
  private rowToEntry(row: DispatchQueueRow): DispatchQueueEntry | null {
    const payload = DispatchQueueRepository.parsePayload(row);
    if (!payload) return null;

    return {
      id: row.id,
      ticket: payload.ticket,
      dispatchPriority: payload.dispatchPriority,
      enqueuedAt: payload.enqueuedAt,
      slaDeadline: payload.slaDeadline,
      reprioritizeCount: payload.reprioritizeCount,
      dispatchAttemptCount: payload.dispatchAttemptCount,
    };
  }

  /**
   * Add a ticket to the dispatch queue.
   */
  async enqueue(ticket: Ticket, slaTarget?: SLATarget): Promise<void> {
    const priorityMap: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };
    const entryId = `DQ-${ticket.id}`;

    const payload: DispatchQueuePayload = {
      ticket,
      dispatchPriority: priorityMap[ticket.priority] || 3,
      enqueuedAt: new Date(),
      // Compute SLA deadline from target resolution time
      slaDeadline: slaTarget ? new Date(Date.now() + slaTarget.targetResolutionTimeMs) : undefined,
      reprioritizeCount: 0,
      dispatchAttemptCount: 0,
    };

    await this.repository.create({
      id: entryId,
      tenantId: '00000000-0000-0000-0000-000000000001', // default tenant
      ticketId: ticket.id,
      strategy: 'round_robin',
      status: 'pending',
      payload,
    });
  }

  /**
   * Remove a ticket from the dispatch queue by ticket ID.
   */
  async dequeue(ticketId: string): Promise<DispatchQueueEntry | undefined> {
    const key = `DQ-${ticketId}`;
    const row = await this.repository.findByQueueId(key);
    if (!row) return undefined;

    const entry = this.rowToEntry(row);
    if (entry) {
      await this.repository.deleteById(key);
    }
    return entry ?? undefined;
  }

  /**
   * Get the overall dispatch queue status summary.
   */
  async getQueueStatus(): Promise<DispatchQueueStatus> {
    const rows = await this.repository.findAll();
    const entries = rows.map(r => this.rowToEntry(r)).filter(Boolean) as DispatchQueueEntry[];

    const byPriority: Record<string, number> = {};
    for (const e of entries) {
      byPriority[e.ticket.priority] = (byPriority[e.ticket.priority] || 0) + 1;
    }

    const now = Date.now();
    const waitTimes = entries.map(e => now - e.enqueuedAt.getTime());
    const slaAtRisk = entries.filter(e => e.slaDeadline && e.slaDeadline.getTime() - now < 3600_000).length;
    const slaBreached = entries.filter(e => e.slaDeadline && e.slaDeadline < new Date()).length;

    return {
      totalInQueue: entries.length,
      byPriority: byPriority as Record<TicketPriority, number>,
      slaAtRisk,
      slaBreached,
      avgWaitTimeMs: waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0,
      oldestWaitTimeMs: waitTimes.length > 0 ? Math.max(...waitTimes) : 0,
    };
  }

  /**
   * Get all queue entries sorted by dispatch priority.
   */
  async getEntries(): Promise<DispatchQueueEntry[]> {
    const rows = await this.repository.findAll();
    const entries = rows.map(r => this.rowToEntry(r)).filter(Boolean) as DispatchQueueEntry[];
    return entries.sort((a, b) => a.dispatchPriority - b.dispatchPriority);
  }

  /**
   * Get SLA alerts for queue entries approaching or past SLA breach.
   */
  async getSLAAlerts(options?: { type?: 'sla-warning' | 'sla-critical' | 'sla-breach'; limit?: number }): Promise<SLAAlert[]> {
    const rows = await this.repository.findAll();
    const now = Date.now();
    const alerts: SLAAlert[] = [];

    for (const row of rows) {
      const payload = DispatchQueueRepository.parsePayload(row);
      if (!payload || !payload.slaDeadline) continue;

      const timeLeft = payload.slaDeadline.getTime() - now;
      if (timeLeft < 0) {
        alerts.push({
          id: `SLA-${row.id}`,
          queueEntryId: row.id,
          ticketId: payload.ticket.id,
          alertType: 'sla-breach',
          timeRemainingMs: timeLeft,
          message: `SLA breached for ticket ${payload.ticket.id}`,
          generatedAt: new Date(),
        });
      } else if (timeLeft < 1800_000) {
        alerts.push({
          id: `SLA-${row.id}`,
          queueEntryId: row.id,
          ticketId: payload.ticket.id,
          alertType: 'sla-critical',
          timeRemainingMs: timeLeft,
          message: `SLA critical for ticket ${payload.ticket.id}`,
          generatedAt: new Date(),
        });
      } else if (timeLeft < 3600_000) {
        alerts.push({
          id: `SLA-${row.id}`,
          queueEntryId: row.id,
          ticketId: payload.ticket.id,
          alertType: 'sla-warning',
          timeRemainingMs: timeLeft,
          message: `SLA at risk for ticket ${payload.ticket.id}`,
          generatedAt: new Date(),
        });
      }
    }

    let filtered = alerts;
    if (options?.type) {
      filtered = alerts.filter(a => a.alertType === options.type);
    }
    return filtered.slice(0, options?.limit || 100);
  }

  /**
   * Reprioritize all pending entries: boost priority for entries nearing SLA deadline.
   */
  async reprioritize(): Promise<void> {
    const rows = await this.repository.findAllPending();
    const now = Date.now();

    for (const row of rows) {
      const payload = DispatchQueueRepository.parsePayload(row);
      if (!payload || !payload.slaDeadline) continue;

      const timeLeft = payload.slaDeadline.getTime() - now;
      if (timeLeft < 3600_000 && payload.dispatchPriority > 1) {
        payload.dispatchPriority = Math.max(1, payload.dispatchPriority - 1);
        payload.reprioritizeCount++;
        await this.repository.updatePayload(row.id, payload);
      }
    }
  }

  /**
   * Get the next entry for dispatch (highest priority pending entry).
   */
  async getNextForDispatch(): Promise<TicketAssignment | undefined> {
    const entries = await this.getEntries();
    if (entries.length === 0) return undefined;

    const next = entries[0];
    next.dispatchAttemptCount++;

    // Persist the updated attempt count
    const row = await this.repository.findByQueueId(next.id);
    if (row) {
      const payload = DispatchQueueRepository.parsePayload(row);
      if (payload) {
        payload.dispatchAttemptCount = next.dispatchAttemptCount;
        await this.repository.updatePayload(next.id, payload);
      }
    }

    if (this.dispatchCallback) {
      this.dispatchCallback(next);
    }

    return {
      id: next.id,
      ticketId: next.ticket.id,
      assignee: '',
      assignedBy: 'dispatch-queue',
      assignedAt: new Date(),
      reason: 'Auto-dispatch from queue',
    };
  }

  /**
   * Set a callback to invoke when an entry is dispatched.
   */
  setDispatchCallback(cb: (entry: DispatchQueueEntry) => void): void {
    this.dispatchCallback = cb;
  }

  /**
   * Record a dispatch attempt for a ticket (increment counter).
   */
  async recordDispatchAttempt(ticketId: string): Promise<void> {
    const entry = await this.repository.findByQueueId(`DQ-${ticketId}`);
    if (!entry) return;

    const payload = DispatchQueueRepository.parsePayload(entry);
    if (!payload) return;

    payload.dispatchAttemptCount++;
    await this.repository.updatePayload(entry.id, payload);
  }

  /**
   * Mark a ticket as dispatched (remove from queue).
   */
  async markDispatched(ticketId: string): Promise<void> {
    await this.repository.deleteById(`DQ-${ticketId}`);
  }

  /**
   * Start automatic reprioritization timer (every 60 seconds by default).
   */
  startAutoReprioritize(intervalMs: number = 60000): void {
    this.stopAutoReprioritize();
    this.autoReprioritizeInterval = setInterval(() => this.reprioritize(), intervalMs);
  }

  /**
   * Stop automatic reprioritization timer.
   */
  stopAutoReprioritize(): void {
    if (this.autoReprioritizeInterval) {
      clearInterval(this.autoReprioritizeInterval);
      this.autoReprioritizeInterval = undefined;
    }
  }

  /**
   * Clear all entries and stop the auto-reprioritize timer.
   */
  async clear(): Promise<void> {
    await this.repository.clearAll();
    this.stopAutoReprioritize();
  }
}
