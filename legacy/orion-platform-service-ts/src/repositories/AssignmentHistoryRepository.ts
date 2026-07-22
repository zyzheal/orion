/**
 * AssignmentHistoryRepository
 * Assignment history data access layer (ticketing load balancer)
 */

import { BaseRepository } from '../db/base-repository';

export interface AssignmentHistoryEntity {
  id: string;
  tenantId: string;
  ticketId: string;
  assignee: string;
  assignedBy: string;
  assignedAt: Date;
  reason: string | null;
  matchScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AssignmentHistoryRepository extends BaseRepository<AssignmentHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'assignment_history');
  }

  async findByAssignee(assignee: string, limit: number = 50): Promise<AssignmentHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM assignment_history WHERE assignee = $1 ORDER BY assigned_at DESC LIMIT $2`,
      [assignee, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTicketId(ticketId: string): Promise<AssignmentHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM assignment_history WHERE ticket_id = $1 ORDER BY assigned_at ASC`,
      [ticketId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<AssignmentHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM assignment_history WHERE tenant_id = $1 ORDER BY assigned_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPeriod(start: Date, end: Date): Promise<AssignmentHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM assignment_history WHERE assigned_at >= $1 AND assigned_at <= $2 ORDER BY assigned_at DESC`,
      [start, end],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AssignmentHistoryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ticketId: row.ticket_id,
      assignee: row.assignee,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at ? new Date(row.assigned_at) : new Date(),
      reason: row.reason,
      matchScore: row.match_score ? parseFloat(row.match_score) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
