/**
 * TASK-802: Dispatch Queue Manager
 *
 * SLA-aware priority queue for ticket dispatch with
 * dynamic re-prioritization based on deadline proximity.
 * Monitors queue health and generates SLA alerts.
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import {
  Ticket,
  TicketPriority,
  DispatchQueueEntry,
  DispatchQueueStatus,
  SLAAlert,
  SLATarget,
} from './types';
import { DispatchQueueEntryRepository, SLATargetRepository, SLAAlertRepository } from '../../repositories/DispatchQueueRepository';

const logger = createLogger('LDispatch-LQueue-LManager');

/**
 * Default SLA warning thresholds (percentage of time elapsed)
 */
const SLA_WARNING_THRESHOLD = 0.75; // Warn at 75% of SLA elapsed
const SLA_CRITICAL_THRESHOLD = 0.9; // Critical at 90% of SLA elapsed

/**
 * Priority base scores for queue ordering
 */
const PRIORITY_BASE_SCORES: Record<TicketPriority, number> = {
  critical: 1000,
  high: 500,
  medium: 100,
  low: 10,
};

/**
 * Re-prioritization check interval
 */
const DEFAULT_REPRIORITY_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Dispatch Queue Manager
 *
 * Manages a priority queue of unassigned tickets,
 * handling SLA-aware ordering and dynamic re-prioritization.
 */
export class DispatchQueueManager {
  /** Queue entries indexed by ticket ID (runtime cache) */
  private queueEntryRepository?: DispatchQueueEntryRepository;
  private queue: Map<string, DispatchQueueEntry> = new Map();

  /** SLA targets (runtime cache) */
  private slaTargetRepository?: SLATargetRepository;
  private slaTargets: Map<string, SLATarget> = new Map();

  /** SLA alerts (runtime cache) */
  private slaAlertRepository?: SLAAlertRepository;
  private alerts: Map<string, SLAAlert> = new Map();

  /** Re-prioritization timer */
  private repriorityTimer?: NodeJS.Timeout;

  /** Re-prioritization interval */
  private repriorityIntervalMs: number;

  /** Event callback for new dispatch opportunities */
  private onDispatchAvailable?: (entry: DispatchQueueEntry) => void;

  constructor(options?: {
    /** Re-prioritization check interval (ms) */
    repriorityIntervalMs?: number;
    /** Auto re-prioritization on start */
    autoReprioritize?: boolean;
    /** Database connection for repository persistence */
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
  }) {
    this.repriorityIntervalMs = options?.repriorityIntervalMs ?? DEFAULT_REPRIORITY_INTERVAL_MS;
    if (options?.db) {
      this.queueEntryRepository = new DispatchQueueEntryRepository(options.db);
      this.slaTargetRepository = new SLATargetRepository(options.db);
      this.slaAlertRepository = new SLAAlertRepository(options.db);
    }
  }

  /**
   * Enqueue a ticket for dispatch
   */
  enqueue(
    ticket: Ticket,
    slaTarget?: SLATarget
  ): DispatchQueueEntry {
    const now = new Date();
    const slaDeadline = this.calculateSLADeadline(ticket, slaTarget);

    const entry: DispatchQueueEntry = {
      id: `DQ-${uuidv4()}`,
      ticket,
      dispatchPriority: this.calculatePriority(ticket, slaDeadline),
      enqueuedAt: now,
      slaDeadline,
      reprioritizeCount: 0,
      dispatchAttemptCount: 0,
    };

    this.queue.set(ticket.id, entry);

    // Persist queue entry to repository
    if (this.queueEntryRepository) {
      this.queueEntryRepository.create({
        id: entry.id,
        ticketId: ticket.id,
        ticketData: ticket as any,
        dispatchPriority: entry.dispatchPriority,
        slaDeadline: entry.slaDeadline || null,
      }).catch(() => {/* ignore */});
    }

    // Register SLA target if provided
    if (slaTarget) {
      this.slaTargets.set(slaTarget.id, slaTarget);

      // Persist SLA target to repository
      if (this.slaTargetRepository) {
        this.slaTargetRepository.create({
          id: slaTarget.id,
          name: slaTarget.name || '',
          priority: slaTarget.priority || '',
          targetResponseTimeMs: slaTarget.targetResponseTimeMs || 0,
          targetResolutionTimeMs: slaTarget.targetResolutionTimeMs || 0,
          enabled: true,
        }).catch(() => {/* ignore */});
      }
    }

    // Notify listeners
    this.onDispatchAvailable?.(entry);

    return entry;
  }

  /**
   * Dequeue the highest priority ticket
   */
  dequeue(): DispatchQueueEntry | null {
    if (this.queue.size === 0) return null;

    // Find highest priority entry
    let best: DispatchQueueEntry | null = null;
    let bestPriority = -Infinity;

    for (const entry of this.queue.values()) {
      if (entry.dispatchPriority > bestPriority) {
        bestPriority = entry.dispatchPriority;
        best = entry;
      }
    }

    if (best) {
      this.queue.delete(best.ticket.id);

      // Persist to repository
      if (this.queueEntryRepository) {
        this.queueEntryRepository.deleteByTicketId(best.ticket.id).catch(() => {/* ignore */});
      }
    }

    return best;
  }

  /**
   * Remove a specific ticket from the queue
   */
  remove(ticketId: string): boolean {
    const deleted = this.queue.delete(ticketId);

    // Persist to repository
    if (deleted && this.queueEntryRepository) {
      this.queueEntryRepository.deleteByTicketId(ticketId).catch(() => {/* ignore */});
    }

    return deleted;
  }

  /**
   * Check if a ticket is in the queue
   */
  hasTicket(ticketId: string): boolean {
    return this.queue.has(ticketId);
  }

  /**
   * Get a queue entry by ticket ID
   */
  getEntry(ticketId: string): DispatchQueueEntry | undefined {
    return this.queue.get(ticketId);
  }

  /**
   * Get all queue entries (sorted by priority)
   */
  getEntries(): DispatchQueueEntry[] {
    return Array.from(this.queue.values()).sort(
      (a, b) => b.dispatchPriority - a.dispatchPriority
    );
  }

  /**
   * Get entries for a specific engineer (that were attempted)
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  // ==================== Re-prioritization ====================

  /**
   * Re-prioritize a specific entry
   */
  reprioritizeEntry(ticketId: string): DispatchQueueEntry | null {
    const entry = this.queue.get(ticketId);
    if (!entry) return null;

    const newPriority = this.calculatePriority(entry.ticket, entry.slaDeadline);

    entry.dispatchPriority = newPriority;
    entry.reprioritizeCount += 1;

    this.queue.set(ticketId, entry);

    // Persist to repository
    if (this.queueEntryRepository) {
      this.queueEntryRepository.updatePriority(entry.id, newPriority, entry.reprioritizeCount).catch(() => {/* ignore */});
    }

    return entry;
  }

  /**
   * Re-prioritize all entries in the queue
   */
  reprioritizeAll(): number {
    let count = 0;

    for (const ticketId of this.queue.keys()) {
      this.reprioritizeEntry(ticketId);
      count++;
    }

    return count;
  }

  /**
   * Start automatic re-prioritization
   */
  startAutoReprioritize(intervalMs?: number): void {
    this.stopAutoReprioritize();

    const interval = intervalMs ?? this.repriorityIntervalMs;
    this.repriorityTimer = setInterval(() => {
      const count = this.reprioritizeAll();
      this.checkSLAAlerts();

      if (count > 0) {
        logger.info(
          `[DispatchQueueManager] Re-prioritized ${count} entries, ${this.alerts.size} SLA alerts`
        );
      }
    }, interval);
  }

  /**
   * Stop automatic re-prioritization
   */
  stopAutoReprioritize(): void {
    if (this.repriorityTimer) {
      clearInterval(this.repriorityTimer);
      this.repriorityTimer = undefined;
    }
  }

  // ==================== SLA Monitoring ====================

  /**
   * Check and generate SLA alerts
   */
  checkSLAAlerts(): SLAAlert[] {
    const newAlerts: SLAAlert[] = [];
    const now = Date.now();

    for (const entry of this.queue.values()) {
      if (!entry.slaDeadline) continue;

      const remaining = entry.slaDeadline.getTime() - now;
      const total = entry.slaDeadline.getTime() - entry.ticket.createdAt.getTime();

      if (total <= 0) continue;

      const elapsedRatio = 1 - (remaining / total);

      // Remove existing alert for this entry
      const existingAlertKey = Array.from(this.alerts.entries()).find(
        ([, alert]) => alert.queueEntryId === entry.id
      );
      if (existingAlertKey) {
        this.alerts.delete(existingAlertKey[0]);
      }

      let alertType: SLAAlert['alertType'];
      let message: string;

      if (remaining < 0) {
        alertType = 'sla-breach';
        message = `Ticket ${entry.ticket.id} SLA breached ${Math.abs(Math.round(remaining / 60000))} minutes ago`;
      } else if (elapsedRatio >= SLA_CRITICAL_THRESHOLD) {
        alertType = 'sla-critical';
        message = `Ticket ${entry.ticket.id} critical: ${Math.round(remaining / 60000)} minutes remaining (${Math.round(elapsedRatio * 100)}% elapsed)`;
      } else if (elapsedRatio >= SLA_WARNING_THRESHOLD) {
        alertType = 'sla-warning';
        message = `Ticket ${entry.ticket.id} warning: ${Math.round(remaining / 60000)} minutes remaining`;
      } else {
        continue; // No alert needed
      }

      const alert: SLAAlert = {
        id: `SLA-${uuidv4()}`,
        queueEntryId: entry.id,
        ticketId: entry.ticket.id,
        alertType,
        timeRemainingMs: remaining,
        generatedAt: new Date(),
        message,
      };

      this.alerts.set(alert.id, alert);
      newAlerts.push(alert);

      // Persist to repository
      if (this.slaAlertRepository) {
        this.slaAlertRepository.create({
          id: alert.id,
          queueEntryId: alert.queueEntryId,
          ticketId: alert.ticketId,
          alertType: alert.alertType,
          timeRemainingMs: alert.timeRemainingMs,
          message: alert.message,
        }).catch(() => {/* ignore */});
      }
    }

    return newAlerts;
  }

  /**
   * Get all active SLA alerts
   */
  getSLAAlerts(options?: {
    type?: SLAAlert['alertType'];
    limit?: number;
  }): SLAAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (options?.type) {
      alerts = alerts.filter((a) => a.alertType === options.type);
    }

    // Sort by most critical first
    const typeOrder: Record<SLAAlert['alertType'], number> = {
      'sla-breach': 0,
      'sla-critical': 1,
      'sla-warning': 2,
    };
    alerts.sort((a, b) => typeOrder[a.alertType] - typeOrder[b.alertType]);

    if (options?.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts(): number {
    const before = this.alerts.size;
    const now = Date.now();
    const deletedIds: string[] = [];

    for (const [id, alert] of this.alerts.entries()) {
      // Remove alerts for tickets no longer in queue
      if (!this.queue.has(alert.ticketId)) {
        this.alerts.delete(id);
        deletedIds.push(id);
        continue;
      }

      // Remove warning alerts that have been resolved
      const entry = this.queue.get(alert.ticketId);
      if (entry?.slaDeadline && entry.slaDeadline.getTime() - now > 0) {
        const elapsed = 1 - ((entry.slaDeadline.getTime() - now) /
          (entry.slaDeadline.getTime() - entry.ticket.createdAt.getTime()));

        if (alert.alertType === 'sla-warning' && elapsed < SLA_WARNING_THRESHOLD) {
          this.alerts.delete(id);
          deletedIds.push(id);
        }
      }
    }

    // Persist deletions to repository
    if (deletedIds.length > 0 && this.slaAlertRepository) {
      for (const id of deletedIds) {
        this.slaAlertRepository.delete(id).catch(() => {/* ignore */});
      }
    }

    return before - this.alerts.size;
  }

  // ==================== Queue Status ====================

  /**
   * Get queue status summary
   */
  getQueueStatus(): DispatchQueueStatus {
    const entries = this.getEntries();
    const now = Date.now();

    const byPriority: Record<TicketPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let totalWaitTime = 0;
    let oldestWaitTime = 0;
    let slaAtRisk = 0;
    let slaBreached = 0;

    for (const entry of entries) {
      byPriority[entry.ticket.priority]++;

      const waitTime = now - entry.enqueuedAt.getTime();
      totalWaitTime += waitTime;
      if (waitTime > oldestWaitTime) {
        oldestWaitTime = waitTime;
      }

      if (entry.slaDeadline) {
        const remaining = entry.slaDeadline.getTime() - now;
        const total = entry.slaDeadline.getTime() - entry.ticket.createdAt.getTime();

        if (remaining < 0) {
          slaBreached++;
        } else if (total > 0 && (1 - remaining / total) >= SLA_WARNING_THRESHOLD) {
          slaAtRisk++;
        }
      }
    }

    return {
      totalInQueue: entries.length,
      byPriority,
      slaAtRisk,
      slaBreached,
      avgWaitTimeMs: entries.length > 0 ? Math.round(totalWaitTime / entries.length) : 0,
      oldestWaitTimeMs: oldestWaitTime,
    };
  }

  // ==================== Dispatch Tracking ====================

  /**
   * Record a dispatch attempt for a queue entry
   */
  recordDispatchAttempt(ticketId: string): void {
    const entry = this.queue.get(ticketId);
    if (!entry) return;

    entry.dispatchAttemptCount += 1;
    entry.lastDispatchAttempt = new Date();
    this.queue.set(ticketId, entry);

    // Persist to repository
    if (this.queueEntryRepository) {
      this.queueEntryRepository.recordDispatchAttempt(entry.id).catch(() => {/* ignore */});
    }
  }

  /**
   * Mark a ticket as dispatched (remove from queue)
   */
  markDispatched(ticketId: string): boolean {
    const entry = this.queue.get(ticketId);
    if (!entry) return false;

    this.queue.delete(ticketId);

    // Clear related alerts
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.ticketId === ticketId) {
        this.alerts.delete(id);
      }
    }

    // Persist to repository
    if (this.queueEntryRepository) {
      this.queueEntryRepository.deleteByTicketId(ticketId).catch(() => {/* ignore */});
    }
    if (this.slaAlertRepository) {
      this.slaAlertRepository.deleteByTicketId(ticketId).catch(() => {/* ignore */});
    }

    return true;
  }

  // ==================== Event Callbacks ====================

  /**
   * Set callback for new dispatch opportunities
   */
  setDispatchCallback(callback: (entry: DispatchQueueEntry) => void): void {
    this.onDispatchAvailable = callback;
  }

  // ==================== Internal Helpers ====================

  /**
   * Calculate dispatch priority for queue ordering
   */
  private calculatePriority(ticket: Ticket, slaDeadline?: Date): number {
    // Base priority from ticket priority
    let priority = PRIORITY_BASE_SCORES[ticket.priority];

    // SLA urgency boost
    if (slaDeadline) {
      const now = Date.now();
      const remaining = slaDeadline.getTime() - now;
      const total = slaDeadline.getTime() - ticket.createdAt.getTime();

      if (total > 0) {
        const elapsedRatio = 1 - (remaining / total);

        if (remaining < 0) {
          // Past SLA: huge boost
          priority += 5000;
        } else if (elapsedRatio > 0.9) {
          // Critical: very close to SLA breach
          priority += 2000;
        } else if (elapsedRatio > 0.75) {
          // Warning: approaching SLA breach
          priority += 1000;
        } else if (elapsedRatio > 0.5) {
          // Moderate: half elapsed
          priority += 200;
        }
      }
    }

    // Escalation level boost
    priority += ticket.escalationLevel * 500;

    // Age boost (older tickets get slightly higher priority)
    const ageHours = (Date.now() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
    priority += Math.min(Math.floor(ageHours) * 5, 200);

    return priority;
  }

  /**
   * Calculate SLA deadline for a ticket
   */
  private calculateSLADeadline(ticket: Ticket, slaTarget?: SLATarget): Date | undefined {
    // If ticket already has a dueDate, use that
    if (ticket.dueDate) return ticket.dueDate;

    // If SLA target provided, calculate from ticket creation
    if (slaTarget) {
      return new Date(ticket.createdAt.getTime() + slaTarget.targetResolutionTimeMs);
    }

    return undefined;
  }

  // ==================== Clear ====================

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.stopAutoReprioritize();
    this.queue.clear();
    this.alerts.clear();
    this.slaTargets.clear();
    this.onDispatchAvailable = undefined;
  }
}
