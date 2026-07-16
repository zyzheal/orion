/**
 * BITransferRecordRepository
 * BI transfer record data access layer (ticketing analytics)
 */

import { BaseRepository } from '../db/base-repository';

export interface BITransferRecordEntity {
  id: string;
  tenantId: string;
  ticketId: string;
  fromEngineer: string;
  toEngineer: string;
  reason: string | null;
  transferredAt: Date;
  holdTimeMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class BITransferRecordRepository extends BaseRepository<BITransferRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'bi_transfer_records');
  }

  async findByTicketId(ticketId: string): Promise<BITransferRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM bi_transfer_records WHERE ticket_id = $1 ORDER BY transferred_at DESC`,
      [ticketId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByFromEngineer(fromEngineer: string, limit: number = 100): Promise<BITransferRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM bi_transfer_records WHERE from_engineer = $1 ORDER BY transferred_at DESC LIMIT $2`,
      [fromEngineer, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByToEngineer(toEngineer: string, limit: number = 100): Promise<BITransferRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM bi_transfer_records WHERE to_engineer = $1 ORDER BY transferred_at DESC LIMIT $2`,
      [toEngineer, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPeriod(start: Date, end: Date): Promise<BITransferRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM bi_transfer_records WHERE transferred_at >= $1 AND transferred_at <= $2 ORDER BY transferred_at DESC`,
      [start, end],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 500): Promise<BITransferRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM bi_transfer_records WHERE tenant_id = $1 ORDER BY transferred_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): BITransferRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ticketId: row.ticket_id,
      fromEngineer: row.from_engineer,
      toEngineer: row.to_engineer,
      reason: row.reason,
      transferredAt: row.transferred_at ? new Date(row.transferred_at) : new Date(),
      holdTimeMs: row.hold_time_ms,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
