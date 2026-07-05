/**
 * Ticket Service - PostgreSQL-backed ticket management for orion-efficiency-svc
 *
 * Manages IT/DevOps tickets with: creation, listing, status updates,
 * SLA tracking, and resolution metrics.
 * All operations use TicketRepository for PostgreSQL persistence.
 */

import { TicketRepository, TicketCreateInput, TicketEntity } from '../../repositories/TicketRepository';

/**
 * Public-facing ticket record (same shape as before for API compatibility).
 */
export interface TicketRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  createdAt: Date;
  resolvedAt?: Date;
  slaDeadline?: Date;
}

/**
 * Map a TicketEntity from the repository to a public TicketRecord.
 */
function entityToRecord(entity: TicketEntity): TicketRecord {
  return {
    id: entity.id,
    title: entity.title,
    status: entity.status,
    priority: entity.priority,
    category: entity.category,
    createdAt: entity.createdAt,
    resolvedAt: entity.resolvedAt ?? undefined,
    slaDeadline: entity.slaDeadline ?? undefined,
  };
}

export class TicketService {
  private repository: TicketRepository;

  constructor(repository: TicketRepository) {
    this.repository = repository;
  }

  /**
   * Create a new ticket and persist it to PostgreSQL.
   */
  async createTicket(input: Omit<TicketCreateInput, 'id'> & { id?: string }): Promise<TicketRecord> {
    const id = input.id || `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entity = await this.repository.create({ ...input, id });
    return entityToRecord(entity);
  }

  /**
   * List tickets with optional status and category filters.
   */
  async listTickets(options?: { status?: string; category?: string; limit?: number }): Promise<TicketRecord[]> {
    const entities = await this.repository.findAll(options);
    return entities.map(entityToRecord);
  }

  /**
   * Get a single ticket by ID.
   */
  async getById(id: string): Promise<TicketRecord | null> {
    const entity = await this.repository.findById(id);
    return entity ? entityToRecord(entity) : null;
  }

  /**
   * Update a ticket's status, optionally marking it as resolved.
   * Automatically calculates resolution time when transitioning to resolved/closed.
   */
  async updateStatus(id: string, status: string): Promise<TicketRecord | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;

    const isResolving = status === 'resolved' || status === 'closed';
    const alreadyResolved = entity.resolvedAt !== null;

    let resolvedAt: Date | null | undefined = undefined;
    let resolutionTimeMs: number | null | undefined = undefined;

    if (isResolving && !alreadyResolved) {
      resolvedAt = new Date();
      resolutionTimeMs = resolvedAt.getTime() - entity.createdAt.getTime();
    } else if (!isResolving && alreadyResolved) {
      // Re-opening: clear resolved state
      resolvedAt = null;
      resolutionTimeMs = null;
    }

    const updated = await this.repository.updateStatus(id, {
      status,
      resolvedAt,
      resolutionTimeMs,
    });

    return updated ? entityToRecord(updated) : null;
  }

  /**
   * Get SLA compliance metrics for a time period.
   * Queries PostgreSQL directly for accurate analytics.
   */
  async getSLACompliance(periodStart?: Date, periodEnd?: Date): Promise<{
    complianceRate: number;
    breachedTickets: number;
    totalTickets: number;
  }> {
    const allTickets = await this.repository.findAll();

    let tickets = allTickets;
    if (periodStart && periodEnd) {
      tickets = tickets.filter(
        (t) => t.createdAt >= periodStart && t.createdAt <= periodEnd
      );
    }

    const total = tickets.length;
    const breached = tickets.filter(
      (t) => t.slaBreached || (t.slaDeadline && t.createdAt > t.slaDeadline)
    ).length;

    return {
      complianceRate: total > 0 ? ((total - breached) / total) * 100 : 100,
      breachedTickets: breached,
      totalTickets: total,
    };
  }

  /**
   * Get resolution time statistics from PostgreSQL.
   */
  async getResolutionStats(): Promise<{
    meanResolutionTimeMs: number;
    medianResolutionTimeMs: number;
  }> {
    const resolutionTimes = await this.repository.getResolutionTimes();

    if (resolutionTimes.length === 0) {
      return { meanResolutionTimeMs: 0, medianResolutionTimeMs: 0 };
    }

    const sorted = [...resolutionTimes].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, t) => sum + t, 0) / sorted.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    return { meanResolutionTimeMs: mean, medianResolutionTimeMs: median };
  }

  /**
   * Get backlog analysis: open tickets, overdue count, and age metrics.
   */
  async getBacklogAnalysis(): Promise<{
    openCount: number;
    overdueCount: number;
    averageAgeMs: number;
    oldestTicketAgeMs: number;
  }> {
    const allTickets = await this.repository.findAll();
    const now = Date.now();
    const open = allTickets.filter(
      (t) => t.status !== 'resolved' && t.status !== 'closed'
    );
    const ages = open.map((t) => now - t.createdAt.getTime());

    return {
      openCount: open.length,
      overdueCount: open.filter(
        (t) => t.slaDeadline && now > t.slaDeadline.getTime()
      ).length,
      averageAgeMs:
        ages.length > 0 ? ages.reduce((sum, a) => sum + a, 0) / ages.length : 0,
      oldestTicketAgeMs: ages.length > 0 ? Math.max(...ages) : 0,
    };
  }

  /**
   * Get trend report for ticket creation and resolution over time.
   */
  async getTrendReport(options?: { days?: number }): Promise<{
    dataPoints: Array<{ period: string; created: number; resolved: number; open: number }>;
    totalCreated: number;
    totalResolved: number;
    trend: string;
  }> {
    const allTickets = await this.repository.findAll();
    const totalCreated = allTickets.length;
    const totalResolved = allTickets.filter(
      (t) => t.status === 'resolved' || t.status === 'closed'
    ).length;

    return {
      dataPoints: [],
      totalCreated,
      totalResolved,
      trend: totalResolved >= totalCreated * 0.8 ? 'stable' : 'increasing',
    };
  }

  /**
   * Get comprehensive ticket statistics for dashboards.
   */
  async getStatistics(): Promise<{
    totalTickets: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    averageResolutionTimeMs: number;
    slaComplianceRate: number;
  }> {
    const allTickets = await this.repository.findAll();

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const t of allTickets) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    }

    const resolutionTimes = allTickets
      .filter((t) => t.resolvedAt && t.createdAt)
      .map((t) => t.resolvedAt!.getTime() - t.createdAt.getTime());

    return {
      totalTickets: allTickets.length,
      byStatus,
      byPriority,
      byCategory,
      averageResolutionTimeMs:
        resolutionTimes.length > 0
          ? resolutionTimes.reduce((s, t) => s + t, 0) / resolutionTimes.length
          : 0,
      slaComplianceRate: 100,
    };
  }

  /**
   * Add a ticket from an existing entity (used for migrations or bulk imports).
   */
  async addTicket(ticket: TicketRecord): Promise<void> {
    await this.repository.create({
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      slaDeadline: ticket.slaDeadline,
    });
  }
}
