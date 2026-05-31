/**
 * DispatchEventRepository
 * Dispatch event data access layer (ticketing analytics)
 */

import { BaseRepository } from '../db/base-repository';

export interface DispatchEventEntity {
  id: string;
  ticketId: string;
  createdAt: Date;
  assignedAt: Date | null;
  acceptedAt: Date | null;
  resolvedAt: Date | null;
  dispatchResult: Record<string, any> | null;
  priority: string;
  category: string;
  insertedAt: Date;
}

export class DispatchEventRepository extends BaseRepository<DispatchEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'dispatch_events');
  }

  async findByTicketId(ticketId: string): Promise<DispatchEventEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_events WHERE ticket_id = $1 ORDER BY inserted_at DESC LIMIT 1`,
      [ticketId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateAssignment(ticketId: string, assignedAt: Date, dispatchResult?: Record<string, any>): Promise<void> {
    await this.db.query(
      `UPDATE dispatch_events SET assigned_at = $2, dispatch_result = $3 WHERE ticket_id = $1`,
      [ticketId, assignedAt, dispatchResult ? JSON.stringify(dispatchResult) : null],
    );
  }

  async updateAcceptance(ticketId: string, acceptedAt: Date): Promise<void> {
    await this.db.query(
      `UPDATE dispatch_events SET accepted_at = $2 WHERE ticket_id = $1`,
      [ticketId, acceptedAt],
    );
  }

  async updateResolution(ticketId: string, resolvedAt: Date): Promise<void> {
    await this.db.query(
      `UPDATE dispatch_events SET resolved_at = $2 WHERE ticket_id = $1`,
      [ticketId, resolvedAt],
    );
  }

  async findByPeriod(start: Date, end: Date): Promise<DispatchEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_events WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC`,
      [start, end],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): DispatchEventEntity {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      createdAt: row.created_at,
      assignedAt: row.assigned_at,
      acceptedAt: row.accepted_at,
      resolvedAt: row.resolved_at,
      dispatchResult: row.dispatch_result,
      priority: row.priority,
      category: row.category,
      insertedAt: row.inserted_at,
    };
  }
}
