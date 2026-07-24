/**
 * TicketTransferService - handles ticket transfers between engineers.
 */
import { Ticket, TicketTransfer, TransferStats, AutoTransferConfig, EngineerSuspend } from '../types/ticketing';

export class TicketTransferService {
  private transfers: TicketTransfer[] = [];
  private config: AutoTransferConfig = {
    maxTransfersPerDay: 5,
    autoTransferAfterHours: 24,
    notifyOnTransfer: true,
    requireReason: true,
  };
  private transferCallback?: (transfer: TicketTransfer, ticket: Ticket) => void;

  setTransferCallback(cb: (transfer: TicketTransfer, ticket: Ticket) => void): void {
    this.transferCallback = cb;
  }

  transferTicket(
    ticket: Ticket,
    fromEngineer: string,
    toEngineer: string,
    initiatedBy: string,
    reason: string
  ): { transfer: TicketTransfer; holdDurationMs: number } | { error: string } {
    if (fromEngineer === toEngineer) {
      return { error: 'Cannot transfer to the same engineer' };
    }

    const now = new Date();
    const transfer: TicketTransfer = {
      id: `TRF-${crypto.randomUUID().slice(0, 8)}`,
      ticketId: ticket.id,
      fromEngineer,
      toEngineer,
      initiatedBy,
      reason,
      createdAt: now,
      status: 'completed',
    };

    this.transfers.push(transfer);
    ticket.assignee = toEngineer;
    ticket.updatedAt = now;

    if (this.transferCallback) {
      this.transferCallback(transfer, ticket);
    }

    return { transfer, holdDurationMs: 0 };
  }

  getTransferHistory(ticketId: string): TicketTransfer[] {
    return this.transfers.filter(t => t.ticketId === ticketId);
  }

  getTransferStats(periodStart?: Date, periodEnd?: Date): TransferStats {
    let filtered = this.transfers;
    if (periodStart) {
      filtered = filtered.filter(t => t.createdAt >= periodStart);
    }
    if (periodEnd) {
      filtered = filtered.filter(t => t.createdAt <= periodEnd);
    }

    const byEngineer: Record<string, number> = {};
    for (const t of filtered) {
      byEngineer[t.toEngineer] = (byEngineer[t.toEngineer] || 0) + 1;
    }

    return {
      totalTransfers: filtered.length,
      byEngineer,
      avgHoldDurationMs: 0,
    };
  }

  getMostTransferredTickets(limit: number = 10): { ticketId: string; count: number }[] {
    const countMap = new Map<string, number>();
    for (const t of this.transfers) {
      countMap.set(t.ticketId, (countMap.get(t.ticketId) || 0) + 1);
    }
    return Array.from(countMap.entries())
      .map(([ticketId, count]) => ({ ticketId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  updateConfig(config: Partial<AutoTransferConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): AutoTransferConfig {
    return { ...this.config };
  }

  transferDueToSuspend(ticket: Ticket, toEngineer: string, createdBy: string): { transfer: TicketTransfer } | { error: string } {
    if (!ticket.assignee) {
      return { error: 'Ticket has no assignee to transfer from' };
    }
    const result = this.transferTicket(
      ticket,
      ticket.assignee,
      toEngineer,
      createdBy,
      'Auto-transfer due to engineer suspension'
    );
    if ('error' in result) {
      return result;
    }
    return { transfer: result.transfer };
  }

  clearAll(): void {
    this.transfers = [];
  }
}
