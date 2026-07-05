/**
 * TicketLoadRecordRepository
 * Ticket load record data access layer (ticketing load balancer)
 */

import { BaseRepository } from '../db/base-repository';

export interface TicketLoadRecordEntity {
  id: string;
  ticketId: string;
  engineerId: string;
  category: string;
  assignedAt: Date;
  estimatedEffortHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TicketLoadRecordRepository extends BaseRepository<TicketLoadRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ticket_load_records');
  }

  async findAllRecords(): Promise<TicketLoadRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_load_records ORDER BY assigned_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTicketId(ticketId: string): Promise<TicketLoadRecordEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ticket_load_records WHERE ticket_id = $1`,
      [ticketId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByEngineerId(engineerId: string): Promise<TicketLoadRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_load_records WHERE engineer_id = $1 ORDER BY assigned_at DESC`,
      [engineerId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteByTicketId(ticketId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ticket_load_records WHERE ticket_id = $1`,
      [ticketId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteByEngineerId(engineerId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ticket_load_records WHERE engineer_id = $1`,
      [engineerId],
    );
    return result.rowCount ?? 0;
  }

  async countByEngineerId(engineerId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM ticket_load_records WHERE engineer_id = $1`,
      [engineerId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): TicketLoadRecordEntity {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      engineerId: row.engineer_id,
      category: row.category,
      assignedAt: row.assigned_at,
      estimatedEffortHours: row.estimated_effort_hours,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
