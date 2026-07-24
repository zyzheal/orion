/**
 * DeprecationRepository - PostgreSQL data access layer for API deprecations.
 *
 * Maps camelCase entity fields to snake_case DB columns.
 */

import type { Pool } from 'pg';
import { Deprecation } from '../types/governance.js';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface CreateDeprecationInput {
  id: string;
  contractId: string;
  version: string;
  reason: string;
  replacementVersion?: string;
  sunsetDate: Date;
}

export interface DeprecationUpdateInput {
  reason?: string;
  replacementVersion?: string;
  sunsetDate?: Date;
  notificationSent?: boolean;
  status?: string;
}

export class DeprecationRepository {
  constructor(private pool: DbClient) {}

  /**
   * Create a new deprecation record.
   */
  async create(input: CreateDeprecationInput): Promise<Deprecation> {
    const now = new Date();
    const result = await this.pool.query(
      `INSERT INTO deprecations (
        id, contract_id, version, reason, replacement_version,
        sunset_date, notification_sent, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.id,
        input.contractId,
        input.version,
        input.reason,
        input.replacementVersion ?? null,
        input.sunsetDate,
        false,
        'pending',
        now,
        now,
      ]
    );
    return this.mapRowToDeprecation(result.rows[0]);
  }

  /**
   * Find a deprecation by ID.
   */
  async findById(id: string): Promise<Deprecation | null> {
    const result = await this.pool.query(
      'SELECT * FROM deprecations WHERE id = $1',
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToDeprecation(result.rows[0]);
  }

  /**
   * Find all deprecations for a given contract.
   */
  async findByContract(contractId: string): Promise<Deprecation[]> {
    const result = await this.pool.query(
      'SELECT * FROM deprecations WHERE contract_id = $1 ORDER BY created_at DESC',
      [contractId]
    );
    return result.rows.map((row: any) => this.mapRowToDeprecation(row));
  }

  /**
   * Find deprecations by status.
   */
  async findByStatus(status: string): Promise<Deprecation[]> {
    const result = await this.pool.query(
      'SELECT * FROM deprecations WHERE status = $1 ORDER BY sunset_date ASC',
      [status]
    );
    return result.rows.map((row: any) => this.mapRowToDeprecation(row));
  }

  /**
   * Find deprecations that have passed their sunset date and are not yet completed.
   */
  async findOverdue(): Promise<Deprecation[]> {
    const result = await this.pool.query(
      `SELECT * FROM deprecations
       WHERE sunset_date < NOW() AND status NOT IN ('sunset', 'completed')
       ORDER BY sunset_date ASC`
    );
    return result.rows.map((row: any) => this.mapRowToDeprecation(row));
  }

  /**
   * Mark notification as sent.
   */
  async markNotified(id: string): Promise<Deprecation | null> {
    const result = await this.pool.query(
      `UPDATE deprecations SET notification_sent = true, status = 'notified', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToDeprecation(result.rows[0]);
  }

  /**
   * Update a deprecation's mutable fields.
   */
  async update(id: string, updates: DeprecationUpdateInput): Promise<Deprecation | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.reason !== undefined) {
      setClauses.push(`reason = $${params.length + 1}`);
      params.push(updates.reason);
    }
    if (updates.replacementVersion !== undefined) {
      setClauses.push(`replacement_version = $${params.length + 1}`);
      params.push(updates.replacementVersion);
    }
    if (updates.sunsetDate !== undefined) {
      setClauses.push(`sunset_date = $${params.length + 1}`);
      params.push(updates.sunsetDate);
    }
    if (updates.notificationSent !== undefined) {
      setClauses.push(`notification_sent = $${params.length + 1}`);
      params.push(updates.notificationSent);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${params.length + 1}`);
      params.push(updates.status);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE deprecations SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return result.rows.length === 0 ? null : this.mapRowToDeprecation(result.rows[0]);
  }

  /**
   * Delete a deprecation.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM deprecations WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToDeprecation(row: any): Deprecation {
    return {
      id: row.id,
      contractId: row.contract_id,
      version: row.version,
      reason: row.reason,
      replacementVersion: row.replacement_version ?? undefined,
      sunsetDate: row.sunset_date instanceof Date ? row.sunset_date.toISOString() : String(row.sunset_date),
      notificationSent: row.notification_sent === true,
      status: row.status,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }
}
