/**
 * TicketRelationAnalysisRepository
 * Ticket relation analysis data access layer
 */

import { BaseRepository } from '../db/base-repository';

export interface TicketRelationAnalysisEntity {
  id: string;
  tenantId: string;
  ticketId: string;
  relatedTicketId: string;
  relationType: string;
  confidence: number | null;
  createdBy: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TicketRelationAnalysisRepository extends BaseRepository<TicketRelationAnalysisEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ticket_relation_analysis');
  }

  async findByTicketId(ticketId: string): Promise<TicketRelationAnalysisEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_relation_analysis WHERE ticket_id = $1 OR related_ticket_id = $1 ORDER BY created_at DESC`,
      [ticketId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRelationType(relationType: string, limit: number = 100): Promise<TicketRelationAnalysisEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_relation_analysis WHERE relation_type = $1 ORDER BY created_at DESC LIMIT $2`,
      [relationType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findExistingRelation(ticketId: string, relatedTicketId: string): Promise<TicketRelationAnalysisEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ticket_relation_analysis
       WHERE (ticket_id = $1 AND related_ticket_id = $2) OR (ticket_id = $2 AND related_ticket_id = $1) LIMIT 1`,
      [ticketId, relatedTicketId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantId(tenantId: string, limit: number = 200): Promise<TicketRelationAnalysisEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_relation_analysis WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteByTicketId(ticketId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ticket_relation_analysis WHERE ticket_id = $1 OR related_ticket_id = $1`,
      [ticketId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): TicketRelationAnalysisEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ticketId: row.ticket_id,
      relatedTicketId: row.related_ticket_id,
      relationType: row.relation_type || 'related',
      confidence: row.confidence ? parseFloat(row.confidence) : null,
      createdBy: row.created_by,
      description: row.description,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
