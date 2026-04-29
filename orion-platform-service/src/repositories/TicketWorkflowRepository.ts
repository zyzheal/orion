/**
 * TicketWorkflowRepository
 * 工单工作流数据访问层
 */

import { BaseRepository } from '../db/base-repository';

export interface TicketWorkflowEntity {
  id: string;
  ticketId: string;
  fromStatus: string;
  toStatus: string;
  triggeredBy?: string;
  triggeredType: string;
  comment?: string;
  createdAt: Date;
}

export interface TicketSLAEntity {
  id: string;
  ticketId: string;
  priority: string;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  responseBreached: boolean;
  resolutionBreached: boolean;
  createdAt: Date;
}

export class TicketWorkflowRepository extends BaseRepository<TicketWorkflowEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ticket_workflow_history');
  }

  async findByTicketId(ticketId: string): Promise<TicketWorkflowEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_workflow_history WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [ticketId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async createEntry(data: Omit<TicketWorkflowEntity, 'id' | 'createdAt'>): Promise<TicketWorkflowEntity> {
    const id = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO ticket_workflow_history (id, ticket_id, from_status, to_status, triggered_by, triggered_type, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [id, data.ticketId, data.fromStatus, data.toStatus, data.triggeredBy ?? null, data.triggeredType, data.comment ?? null],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): TicketWorkflowEntity {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      triggeredBy: row.triggered_by,
      triggeredType: row.triggered_type,
      comment: row.comment,
      createdAt: row.created_at,
    };
  }
}

export class TicketSLARepository extends BaseRepository<TicketSLAEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ticket_sla');
  }

  async findByTicketId(ticketId: string): Promise<TicketSLAEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ticket_sla WHERE ticket_id = $1`,
      [ticketId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async createSLA(data: Omit<TicketSLAEntity, 'id'>): Promise<void> {
    await this.db.query(
      `INSERT INTO ticket_sla (ticket_id, priority, response_time_minutes, resolution_time_minutes, first_response_at, resolved_at, response_breached, resolution_breached, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [data.ticketId, data.priority, data.responseTimeMinutes, data.resolutionTimeMinutes, data.firstResponseAt ?? null, data.resolvedAt ?? null, data.responseBreached, data.resolutionBreached],
    );
  }

  async updateSLA(ticketId: string, updates: Partial<Omit<TicketSLAEntity, 'id' | 'ticketId'>>): Promise<void> {
    const setParts: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.firstResponseAt !== undefined) { setParts.push(`first_response_at = $${idx}`); values.push(updates.firstResponseAt); idx++; }
    if (updates.resolvedAt !== undefined) { setParts.push(`resolved_at = $${idx}`); values.push(updates.resolvedAt); idx++; }
    if (updates.responseBreached !== undefined) { setParts.push(`response_breached = $${idx}`); values.push(updates.responseBreached); idx++; }
    if (updates.resolutionBreached !== undefined) { setParts.push(`resolution_breached = $${idx}`); values.push(updates.resolutionBreached); idx++; }

    if (setParts.length === 0) return;

    values.push(ticketId);

    await this.db.query(
      `UPDATE ticket_sla SET ${setParts.join(', ')} WHERE ticket_id = $${idx}`,
      values,
    );
  }

  async findBreached(): Promise<TicketSLAEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_sla WHERE response_breached = true OR resolution_breached = true ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): TicketSLAEntity {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      priority: row.priority,
      responseTimeMinutes: row.response_time_minutes,
      resolutionTimeMinutes: row.resolution_time_minutes,
      firstResponseAt: row.first_response_at,
      resolvedAt: row.resolved_at,
      responseBreached: row.response_breached,
      resolutionBreached: row.resolution_breached,
      createdAt: row.created_at,
    };
  }
}
