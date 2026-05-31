/**
 * DispatchResultRepository
 * Dispatch result data access layer (ticketing analytics)
 */

import { BaseRepository } from '../db/base-repository';

export interface DispatchResultEntity {
  id: string;
  tenantId: string;
  ticketId: string;
  assignee: string;
  reason: string | null;
  score: number;
  dispatchedAt: Date;
  dispatchType: string;
  scoreBreakdown: Record<string, any> | null;
  accepted: boolean;
  timeToAcceptanceMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class DispatchResultRepository extends BaseRepository<DispatchResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'dispatch_results');
  }

  async findByTicketId(ticketId: string): Promise<DispatchResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_results WHERE ticket_id = $1 ORDER BY dispatched_at DESC`,
      [ticketId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByAssignee(assignee: string, limit: number = 100): Promise<DispatchResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_results WHERE assignee = $1 ORDER BY dispatched_at DESC LIMIT $2`,
      [assignee, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<DispatchResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_results WHERE tenant_id = $1 ORDER BY dispatched_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPeriod(start: Date, end: Date): Promise<DispatchResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_results WHERE dispatched_at >= $1 AND dispatched_at <= $2 ORDER BY dispatched_at DESC`,
      [start, end],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateAccepted(ticketId: string, accepted: boolean, timeToAcceptanceMs?: number): Promise<void> {
    await this.db.query(
      `UPDATE dispatch_results SET accepted = $2, time_to_acceptance_ms = $3, updated_at = NOW() WHERE ticket_id = $1`,
      [ticketId, accepted, timeToAcceptanceMs ?? null],
    );
  }

  protected mapRowToEntity(row: any): DispatchResultEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ticketId: row.ticket_id,
      assignee: row.assignee,
      reason: row.reason,
      score: parseFloat(row.score) || 0,
      dispatchedAt: row.dispatched_at ? new Date(row.dispatched_at) : new Date(),
      dispatchType: row.dispatch_type || 'auto',
      scoreBreakdown: row.score_breakdown,
      accepted: row.accepted ?? false,
      timeToAcceptanceMs: row.time_to_acceptance_ms,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
