/**
 * WikiSpaceRepository - PostgreSQL data access layer for wiki spaces.
 *
 * Maps camelCase entity fields to snake_case DB columns.
 */

import type { Pool } from 'pg';
import { WikiSpace } from '../types/pandawiki.js';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface CreateWikiSpaceInput {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
}

export class WikiSpaceRepository {
  constructor(private pool: DbClient) {}

  /**
   * Create a new wiki space.
   */
  async create(input: CreateWikiSpaceInput): Promise<WikiSpace> {
    const now = new Date();
    const result = await this.pool.query(
      `INSERT INTO wiki_spaces (id, name, description, tenant_id, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        input.id,
        input.name,
        input.description ?? null,
        input.tenantId,
        now,
      ]
    );
    return this.mapRowToSpace(result.rows[0]);
  }

  /**
   * Find a wiki space by ID.
   */
  async findById(id: string): Promise<WikiSpace | null> {
    const result = await this.pool.query(
      'SELECT * FROM wiki_spaces WHERE id = $1',
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToSpace(result.rows[0]);
  }

  /**
   * Find all spaces for a tenant.
   */
  async findByTenant(tenantId: string): Promise<WikiSpace[]> {
    const result = await this.pool.query(
      'SELECT * FROM wiki_spaces WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows.map((row: any) => this.mapRowToSpace(row));
  }

  /**
   * List all spaces with optional limit.
   */
  async findAll(limit = 100): Promise<WikiSpace[]> {
    const result = await this.pool.query(
      'SELECT * FROM wiki_spaces ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map((row: any) => this.mapRowToSpace(row));
  }

  /**
   * Update a space's name or description.
   */
  async update(id: string, updates: { name?: string; description?: string }): Promise<WikiSpace | null> {
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

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE wiki_spaces SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return result.rows.length === 0 ? null : this.mapRowToSpace(result.rows[0]);
  }

  /**
   * Delete a wiki space.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM wiki_spaces WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToSpace(row: any): WikiSpace {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      tenantId: row.tenant_id,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }
}
