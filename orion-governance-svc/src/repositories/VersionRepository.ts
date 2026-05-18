/**
 * VersionRepository - PostgreSQL data access layer for API versions.
 *
 * Maps camelCase entity fields to snake_case DB columns.
 */

import type { Pool } from 'pg';
import { ApiVersion } from '../types/governance.js';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface CreateVersionInput {
  id: string;
  contractId: string;
  version: string;
  changelog: string;
  status: string;
  breakingChanges: boolean;
  migrationGuide?: string;
}

export interface VersionUpdateInput {
  changelog?: string;
  status?: string;
  breakingChanges?: boolean;
  migrationGuide?: string;
}

export class VersionRepository {
  constructor(private pool: DbClient) {}

  /**
   * Create a new API version.
   */
  async create(input: CreateVersionInput): Promise<ApiVersion> {
    const now = new Date();
    const result = await this.pool.query(
      `INSERT INTO api_versions (
        id, contract_id, version, changelog, status,
        breaking_changes, migration_guide, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.id,
        input.contractId,
        input.version,
        input.changelog,
        input.status,
        input.breakingChanges,
        input.migrationGuide ?? null,
        now,
        now,
      ]
    );
    return this.mapRowToVersion(result.rows[0]);
  }

  /**
   * Find a version by ID.
   */
  async findById(id: string): Promise<ApiVersion | null> {
    const result = await this.pool.query(
      'SELECT * FROM api_versions WHERE id = $1',
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToVersion(result.rows[0]);
  }

  /**
   * Find all versions for a given contract.
   */
  async findByContract(contractId: string): Promise<ApiVersion[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_versions WHERE contract_id = $1 ORDER BY created_at DESC',
      [contractId]
    );
    return result.rows.map((row: any) => this.mapRowToVersion(row));
  }

  /**
   * Find the current version for a contract.
   */
  async findCurrent(contractId: string): Promise<ApiVersion | null> {
    const result = await this.pool.query(
      `SELECT * FROM api_versions WHERE contract_id = $1 AND status = 'current'
       ORDER BY created_at DESC LIMIT 1`,
      [contractId]
    );
    return result.rows.length === 0 ? null : this.mapRowToVersion(result.rows[0]);
  }

  /**
   * Find versions by status.
   */
  async findByStatus(status: string): Promise<ApiVersion[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_versions WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );
    return result.rows.map((row: any) => this.mapRowToVersion(row));
  }

  /**
   * Update a version's mutable fields.
   */
  async update(id: string, updates: VersionUpdateInput): Promise<ApiVersion | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.changelog !== undefined) {
      setClauses.push(`changelog = $${params.length + 1}`);
      params.push(updates.changelog);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${params.length + 1}`);
      params.push(updates.status);
    }
    if (updates.breakingChanges !== undefined) {
      setClauses.push(`breaking_changes = $${params.length + 1}`);
      params.push(updates.breakingChanges);
    }
    if (updates.migrationGuide !== undefined) {
      setClauses.push(`migration_guide = $${params.length + 1}`);
      params.push(updates.migrationGuide);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE api_versions SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return result.rows.length === 0 ? null : this.mapRowToVersion(result.rows[0]);
  }

  /**
   * Delete a version.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM api_versions WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToVersion(row: any): ApiVersion {
    return {
      id: row.id,
      contractId: row.contract_id,
      version: row.version,
      changelog: row.changelog,
      status: row.status,
      breakingChanges: row.breaking_changes === true,
      migrationGuide: row.migration_guide ?? undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }
}
