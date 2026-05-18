/**
 * ContractRepository - PostgreSQL data access layer for API contracts.
 *
 * Maps camelCase entity fields to snake_case DB columns.
 * Uses JSONB for schema, TEXT[] for tags.
 */

import type { Pool } from 'pg';
import {
  ApiContract,
  CreateContractInput,
  UpdateContractInput,
} from '../types/governance.js';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export class ContractRepository {
  constructor(private pool: DbClient) {}

  /**
   * Create a new API contract.
   */
  async create(input: CreateContractInput): Promise<ApiContract> {
    const now = new Date();
    const result = await this.pool.query(
      `INSERT INTO api_contracts (
        id, name, description, api_name, version, status,
        schema, endpoint, method, authentication, rate_limit,
        tags, owner_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        crypto.randomUUID(),
        input.name,
        input.description,
        input.apiName,
        input.version,
        'draft',
        JSON.stringify(input.schema),
        input.endpoint,
        input.method,
        input.authentication,
        input.rateLimit ?? null,
        input.tags,
        input.ownerId,
        now,
        now,
      ]
    );
    return this.mapRowToContract(result.rows[0]);
  }

  /**
   * Find a contract by ID.
   */
  async findById(id: string): Promise<ApiContract | null> {
    const result = await this.pool.query(
      'SELECT * FROM api_contracts WHERE id = $1',
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToContract(result.rows[0]);
  }

  /**
   * Find all contracts for a given API name.
   */
  async findByApi(apiName: string): Promise<ApiContract[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_contracts WHERE api_name = $1 ORDER BY created_at DESC',
      [apiName]
    );
    return result.rows.map((row: any) => this.mapRowToContract(row));
  }

  /**
   * Find contracts by status.
   */
  async findByStatus(status: string): Promise<ApiContract[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_contracts WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );
    return result.rows.map((row: any) => this.mapRowToContract(row));
  }

  /**
   * Find contracts by owner.
   */
  async findByOwner(ownerId: string): Promise<ApiContract[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_contracts WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    return result.rows.map((row: any) => this.mapRowToContract(row));
  }

  /**
   * List all contracts with optional limit.
   */
  async findAll(limit = 100): Promise<ApiContract[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_contracts ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map((row: any) => this.mapRowToContract(row));
  }

  /**
   * Update a contract's mutable fields.
   */
  async update(id: string, updates: UpdateContractInput): Promise<ApiContract | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push(`name = $${params.length + 1}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${params.length + 1}`);
      params.push(updates.description);
    }
    if (updates.schema !== undefined) {
      setClauses.push(`schema = $${params.length + 1}`);
      params.push(JSON.stringify(updates.schema));
    }
    if (updates.endpoint !== undefined) {
      setClauses.push(`endpoint = $${params.length + 1}`);
      params.push(updates.endpoint);
    }
    if (updates.method !== undefined) {
      setClauses.push(`method = $${params.length + 1}`);
      params.push(updates.method);
    }
    if (updates.authentication !== undefined) {
      setClauses.push(`authentication = $${params.length + 1}`);
      params.push(updates.authentication);
    }
    if (updates.rateLimit !== undefined) {
      setClauses.push(`rate_limit = $${params.length + 1}`);
      params.push(updates.rateLimit);
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${params.length + 1}`);
      params.push(updates.tags);
    }
    if (updates.ownerId !== undefined) {
      setClauses.push(`owner_id = $${params.length + 1}`);
      params.push(updates.ownerId);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE api_contracts SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return result.rows.length === 0 ? null : this.mapRowToContract(result.rows[0]);
  }

  /**
   * Mark a contract as deprecated.
   */
  async deprecate(id: string): Promise<ApiContract | null> {
    const result = await this.pool.query(
      `UPDATE api_contracts SET status = 'deprecated', deprecated_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status NOT IN ('retired', 'deprecated') RETURNING *`,
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToContract(result.rows[0]);
  }

  /**
   * Delete a contract.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM api_contracts WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToContract(row: any): ApiContract {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      apiName: row.api_name,
      version: row.version,
      status: row.status,
      schema: (row.schema as Record<string, unknown>) ?? {},
      endpoint: row.endpoint,
      method: row.method,
      authentication: row.authentication,
      rateLimit: row.rate_limit ? Number(row.rate_limit) : undefined,
      tags: row.tags ?? [],
      ownerId: row.owner_id,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      deprecatedAt: row.deprecated_at
        ? (row.deprecated_at instanceof Date ? row.deprecated_at.toISOString() : String(row.deprecated_at))
        : undefined,
    };
  }
}
