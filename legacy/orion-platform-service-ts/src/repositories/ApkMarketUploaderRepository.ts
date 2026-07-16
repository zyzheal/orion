/**
 * ApkMarketUploaderRepository
 * Data access layer for APK market registration metadata.
 * Tracks which markets are registered and their status.
 * The actual MarketUploader objects (with upload methods) remain in-memory
 * as they contain executable code that cannot be serialized to a database.
 */

import { NotFoundError, DatabaseError } from '../errors';
import { BaseRepository } from '../db/base-repository';

export interface ApkMarketRegistrationEntity {
  id: string;
  market_name: string;
  status: string;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export class ApkMarketUploaderRepository extends BaseRepository<ApkMarketRegistrationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'apk_market_registrations');
  }

  /**
   * Find a market registration by market name
   */
  async findByMarketName(marketName: string): Promise<ApkMarketRegistrationEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE market_name = $1`,
      [marketName],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all active market registrations
   */
  async findActive(): Promise<ApkMarketRegistrationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE status = 'active' ORDER BY market_name ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all market registrations for a tenant
   */
  async findAllMarkets(): Promise<ApkMarketRegistrationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} ORDER BY market_name ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Upsert a market registration
   */
  async upsertRegistration(marketName: string, status: string, config?: Record<string, unknown>): Promise<ApkMarketRegistrationEntity> {
    const result = await this.db.query(
      `INSERT INTO ${this.tableName} (id, market_name, status, config)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (market_name) DO UPDATE
         SET status = $3, config = $4, updated_at = NOW()
       RETURNING *`,
      [`market-${marketName}`, marketName, status, config ?? {}],
    );
    if (result.rows.length === 0) {
      throw new DatabaseError('upsert market registration');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update market status
   */
  async updateStatus(marketName: string, status: string): Promise<ApkMarketRegistrationEntity> {
    const result = await this.db.query(
      `UPDATE ${this.tableName} SET status = $1, updated_at = NOW() WHERE market_name = $2 RETURNING *`,
      [status, marketName],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('MarketRegistration', marketName);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ApkMarketRegistrationEntity {
    return {
      id: row.id,
      market_name: row.market_name,
      status: row.status,
      config: row.config ?? {},
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
