/**
 * BICommentRecordRepository
 * BI comment record data access layer (ticketing analytics)
 */

import { BaseRepository } from '../db/base-repository';

export interface BICommentRecordEntity {
  id: string;
  tenantId: string;
  ticketId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BICommentRecordRepository extends BaseRepository<BICommentRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'bi_comment_records');
  }

  async findByTicketId(ticketId: string): Promise<BICommentRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM bi_comment_records WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [ticketId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByAuthorId(authorId: string, limit: number = 100): Promise<BICommentRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM bi_comment_records WHERE author_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [authorId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPeriod(start: Date, end: Date): Promise<BICommentRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM bi_comment_records WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC`,
      [start, end],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 500): Promise<BICommentRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM bi_comment_records WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByAuthorId(authorId: string, start?: Date, end?: Date): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM bi_comment_records WHERE author_id = $1`;
    const params: any[] = [authorId];
    if (start) { params.push(start); query += ` AND created_at >= $${params.length}`; }
    if (end) { params.push(end); query += ` AND created_at <= $${params.length}`; }
    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): BICommentRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ticketId: row.ticket_id,
      authorId: row.author_id,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
