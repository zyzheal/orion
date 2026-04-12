/**
 * TASK-TICKET-XFER: Ticket Transfer Service
 *
 * Handles:
 * - Manual ticket transfers between engineers
 * - Automatic timeout-based transfers
 * - Transfer history and statistics
 * - Transfer limit enforcement
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Ticket,
  TicketTransfer,
  TransferType,
  AutoTransferConfig,
  TransferStats,
  TicketPriority,
  EngineerProfile,
} from './types';

const DEFAULT_AUTO_TRANSFER_CONFIG: AutoTransferConfig = {
  notStartedTimeout: {
    critical: 15 * 60 * 1000,
    high: 30 * 60 * 1000,
    medium: 2 * 60 * 60 * 1000,
    low: 8 * 60 * 60 * 1000,
  },
  inProgressTimeout: {
    critical: 2 * 60 * 60 * 1000,
    high: 4 * 60 * 60 * 1000,
    medium: 12 * 60 * 60 * 1000,
    low: 36 * 60 * 60 * 1000,
  },
  maxTransferCount: 3,
  enabled: true,
  checkIntervalMs: 5 * 60 * 1000,
};

/**
 * Ticket Transfer Service
 *
 * Handles:
 * - Manual ticket transfers between engineers
 * - Automatic timeout-based transfers
 * - Transfer history and statistics
 * - Transfer limit enforcement
 */
export class TicketTransferService {
  private transfers: TicketTransfer[] = [];
  private config: AutoTransferConfig;
  private autoTransferTimer?: NodeJS.Timeout;
  private onTransferCallback?: (transfer: TicketTransfer, ticket: Ticket) => void;

  constructor(config?: Partial<AutoTransferConfig>) {
    this.config = { ...DEFAULT_AUTO_TRANSFER_CONFIG, ...config };
  }

  /**
   * Manually transfer a ticket from one engineer to another
   */
  transferTicket(
    ticket: Ticket,
    fromEngineer: string,
    toEngineer: string,
    initiatedBy: string,
    reason: string
  ): { transfer: TicketTransfer; holdDurationMs: number } | { error: string } {
    // Validate ticket is assigned to fromEngineer
    if (ticket.assignee !== fromEngineer) {
      return { error: `Ticket ${ticket.id} is not assigned to ${fromEngineer}` };
    }

    // Check transfer limit
    const existingTransfers = this.transfers.filter(t => t.ticketId === ticket.id);
    if (existingTransfers.length >= this.config.maxTransferCount) {
      return { error: `Ticket ${ticket.id} has reached maximum transfer limit (${this.config.maxTransferCount})` };
    }

    // Cannot transfer to same engineer
    if (fromEngineer === toEngineer) {
      return { error: 'Cannot transfer to the same engineer' };
    }

    // Calculate hold duration
    const holdDurationMs = Date.now() - ticket.updatedAt.getTime();

    const transfer: TicketTransfer = {
      id: `XFER-${uuidv4()}`,
      ticketId: ticket.id,
      fromEngineer,
      toEngineer,
      transferType: 'manual',
      reason,
      initiatedBy,
      transferredAt: new Date(),
      holdDurationMs,
      accepted: true,
    };

    this.transfers.push(transfer);

    // Notify callback
    this.onTransferCallback?.(transfer, ticket);

    return { transfer, holdDurationMs };
  }

  /**
   * Check and auto-transfer tickets that have timed out
   */
  checkAndAutoTransfer(
    tickets: Ticket[],
    findBestEngineer: (ticket: Ticket, excludeEngineers?: string[]) => { engineer: EngineerProfile } | null
  ): { transfer: TicketTransfer; ticket: Ticket }[] {
    if (!this.config.enabled) return [];

    const now = Date.now();
    const autoTransfers: { transfer: TicketTransfer; ticket: Ticket }[] = [];

    for (const ticket of tickets) {
      // Skip unassigned, closed, or resolved tickets
      if (!ticket.assignee || ticket.status === 'closed' || ticket.status === 'resolved') continue;

      // Skip excluded engineers
      if (this.config.excludedEngineers?.includes(ticket.assignee)) continue;

      // Check transfer limit
      const existingTransfers = this.transfers.filter(t => t.ticketId === ticket.id);
      if (existingTransfers.length >= this.config.maxTransferCount) continue;

      // Get timeout threshold based on status and priority
      const timeout = this.getTimeoutForTicket(ticket);
      if (!timeout) continue;

      const holdDuration = now - ticket.updatedAt.getTime();
      if (holdDuration < timeout) continue;

      // Find a new engineer (exclude current assignee and previous assignees)
      const excluded = this.getPreviousAssignees(ticket.id);
      const best = findBestEngineer(ticket, excluded);

      if (!best) continue;

      // Execute auto transfer
      const transfer: TicketTransfer = {
        id: `XFER-${uuidv4()}`,
        ticketId: ticket.id,
        fromEngineer: ticket.assignee,
        toEngineer: best.engineer.id,
        transferType: ticket.status === 'assigned' ? 'auto-timeout' : 'escalation',
        reason: `Auto-transfer: ${ticket.status} exceeded ${ticket.priority} timeout (${Math.round(holdDuration / 60000)}min)`,
        initiatedBy: 'system',
        transferredAt: new Date(),
        holdDurationMs: holdDuration,
        accepted: true,
      };

      this.transfers.push(transfer);
      autoTransfers.push({ transfer, ticket });
      this.onTransferCallback?.(transfer, ticket);
    }

    return autoTransfers;
  }

  /**
   * Transfer due to engineer suspension (backup assignment)
   */
  transferDueToSuspend(
    ticket: Ticket,
    backupEngineerId: string,
    initiatedBy: string
  ): { transfer: TicketTransfer } | { error: string } {
    if (!ticket.assignee) {
      return { error: `Ticket ${ticket.id} is not assigned` };
    }

    const transfer: TicketTransfer = {
      id: `XFER-${uuidv4()}`,
      ticketId: ticket.id,
      fromEngineer: ticket.assignee,
      toEngineer: backupEngineerId,
      transferType: 'backup',
      reason: `Transfer due to ${ticket.assignee} suspension, assigned to backup`,
      initiatedBy,
      transferredAt: new Date(),
      holdDurationMs: Date.now() - ticket.updatedAt.getTime(),
      accepted: true,
    };

    this.transfers.push(transfer);
    this.onTransferCallback?.(transfer, ticket);

    return { transfer };
  }

  /**
   * Get transfer history for a ticket
   */
  getTransferHistory(ticketId: string): TicketTransfer[] {
    return this.transfers
      .filter(t => t.ticketId === ticketId)
      .sort((a, b) => b.transferredAt.getTime() - a.transferredAt.getTime());
  }

  /**
   * Get transfer history for an engineer
   */
  getEngineerTransfers(engineerId: string): {
    transferredFrom: TicketTransfer[];
    transferredTo: TicketTransfer[];
  } {
    return {
      transferredFrom: this.transfers.filter(t => t.fromEngineer === engineerId),
      transferredTo: this.transfers.filter(t => t.toEngineer === engineerId),
    };
  }

  /**
   * Get transfer statistics
   */
  getTransferStats(periodStart?: Date, periodEnd?: Date): TransferStats {
    let filtered = [...this.transfers];
    if (periodStart) filtered = filtered.filter(t => t.transferredAt >= periodStart);
    if (periodEnd) filtered = filtered.filter(t => t.transferredAt <= periodEnd);

    const byType: Record<TransferType, number> = {
      manual: 0,
      'auto-timeout': 0,
      escalation: 0,
      backup: 0,
    };
    for (const t of filtered) byType[t.transferType]++;

    const engineerCounts: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};
    let totalHoldTime = 0;
    let holdCount = 0;
    let maxPerTicket = 0;

    for (const t of filtered) {
      engineerCounts[t.fromEngineer] = (engineerCounts[t.fromEngineer] || 0) + 1;
      reasonCounts[t.reason.split(':')[0]] = (reasonCounts[t.reason.split(':')[0]] || 0) + 1;
      if (t.holdDurationMs) {
        totalHoldTime += t.holdDurationMs;
        holdCount++;
      }
    }

    // Max transfers per ticket
    const ticketCounts: Record<string, number> = {};
    for (const t of filtered) {
      ticketCounts[t.ticketId] = (ticketCounts[t.ticketId] || 0) + 1;
      maxPerTicket = Math.max(maxPerTicket, ticketCounts[t.ticketId]);
    }

    const mostTransferred = Object.entries(engineerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([engineerId, count]) => ({ engineerId, count }));

    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));

    return {
      totalTransfers: filtered.length,
      byType,
      mostTransferred,
      topReasons,
      avgHoldTimeMs: holdCount > 0 ? Math.round(totalHoldTime / holdCount) : 0,
      maxTransfersPerTicket: maxPerTicket,
    };
  }

  /**
   * Get most transferred tickets
   */
  getMostTransferredTickets(limit: number = 10): { ticketId: string; count: number }[] {
    const counts: Record<string, number> = {};
    for (const t of this.transfers) {
      counts[t.ticketId] = (counts[t.ticketId] || 0) + 1;
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([ticketId, count]) => ({ ticketId, count }));
  }

  /**
   * Set callback for when transfers happen
   */
  setTransferCallback(cb: (transfer: TicketTransfer, ticket: Ticket) => void): void {
    this.onTransferCallback = cb;
  }

  /**
   * Update auto transfer config
   */
  updateConfig(config: Partial<AutoTransferConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config
   */
  getConfig(): AutoTransferConfig {
    return { ...this.config };
  }

  /**
   * Start auto transfer checks
   */
  startAutoTransfer(intervalMs?: number): void {
    this.stopAutoTransfer();
    const interval = intervalMs ?? this.config.checkIntervalMs;
    this.autoTransferTimer = setInterval(() => {
      // Note: actual check requires tickets and findBestEngineer callback
      // This is handled by the parent service
    }, interval);
  }

  /**
   * Stop auto transfer checks
   */
  stopAutoTransfer(): void {
    if (this.autoTransferTimer) {
      clearInterval(this.autoTransferTimer);
      this.autoTransferTimer = undefined;
    }
  }

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.transfers = [];
    this.stopAutoTransfer();
  }

  // ==================== Internal Helpers ====================

  private getTimeoutForTicket(ticket: Ticket): number | null {
    if (ticket.status === 'assigned') {
      return this.config.notStartedTimeout[ticket.priority];
    }
    if (ticket.status === 'in-progress') {
      return this.config.inProgressTimeout[ticket.priority];
    }
    return null;
  }

  private getPreviousAssignees(ticketId: string): string[] {
    const transfers = this.transfers.filter(t => t.ticketId === ticketId);
    return [...new Set(transfers.map(t => t.fromEngineer))];
  }
}
