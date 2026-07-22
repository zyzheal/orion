/**
 * CacheStrategyRepository - PostgreSQL persistence for cache strategies
 */

import { DatabasePool } from '../utils/database';
import type {
  CacheStrategy,
  CacheStrategyCreateInput,
  CacheStrategyUpdateInput,
  CacheStrategyFilter,
  CacheType,
} from '../models/CacheStrategy';

export class CacheStrategyRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * Create a new cache strategy
   */
  async create(input: CacheStrategyCreateInput): Promise<CacheStrategy> {
    const result = await this.pool.query(
      `INSERT INTO cache_strategies
        (tenant_id, name, type, key_template, paths, restore_keys, max_age, enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.tenantId,
        input.name,
        input.type,
        input.keyTemplate,
        input.paths,
        input.restoreKeys || [],
        input.maxAge,
        input.enabled !== false,
        input.createdBy || null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find by ID
   */
  async findById(tenantId: string, id: string): Promise<CacheStrategy | null> {
    const result = await this.pool.query(
      'SELECT * FROM cache_strategies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find by type
   */
  async findByType(tenantId: string, type: CacheType): Promise<CacheStrategy[]> {
    const result = await this.pool.query(
      'SELECT * FROM cache_strategies WHERE type = $1 AND tenant_id = $2 AND enabled = true',
      [type, tenantId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * List with filters
   */
  async findAll(filter: CacheStrategyFilter): Promise<{ data: CacheStrategy[]; total: number }> {
    const { tenantId, type, enabled, page = 1, limit = 20 } = filter;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (type) {
      whereClause += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (enabled !== undefined) {
      whereClause += ` AND enabled = $${paramIndex}`;
      params.push(enabled);
      paramIndex++;
    }

    // Count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM cache_strategies ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data
    params.push(limit, offset);
    const dataResult = await this.pool.query(
      `SELECT * FROM cache_strategies ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      data: dataResult.rows.map((row) => this.mapRow(row)),
      total,
    };
  }

  /**
   * Update cache strategy
   */
  async update(
    tenantId: string,
    id: string,
    input: CacheStrategyUpdateInput
  ): Promise<CacheStrategy | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      setClauses.push(`name = $${paramIndex++}`);
    }
    if (input.keyTemplate !== undefined) {
      params.push(input.keyTemplate);
      setClauses.push(`key_template = $${paramIndex++}`);
    }
    if (input.paths !== undefined) {
      params.push(input.paths);
      setClauses.push(`paths = $${paramIndex++}`);
    }
    if (input.restoreKeys !== undefined) {
      params.push(input.restoreKeys);
      setClauses.push(`restore_keys = $${paramIndex++}`);
    }
    if (input.maxAge !== undefined) {
      params.push(input.maxAge);
      setClauses.push(`max_age = $${paramIndex++}`);
    }
    if (input.enabled !== undefined) {
      params.push(input.enabled);
      setClauses.push(`enabled = $${paramIndex++}`);
    }

    if (setClauses.length === 0) {
      return this.findById(tenantId, id);
    }

    params.push(id, tenantId);
    setClauses.push(`updated_at = NOW()`);

    const result = await this.pool.query(
      `UPDATE cache_strategies SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Delete cache strategy
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM cache_strategies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Record cache hit
   */
  async recordHit(tenantId: string, strategyId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO cache_stats (tenant_id, strategy_id, hits, last_hit_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (tenant_id, strategy_id)
       DO UPDATE SET hits = cache_stats.hits + 1, last_hit_at = NOW()`,
      [tenantId, strategyId]
    );
  }

  /**
   * Record cache miss
   */
  async recordMiss(tenantId: string, strategyId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO cache_stats (tenant_id, strategy_id, misses)
       VALUES ($1, $2, 1)
       ON CONFLICT (tenant_id, strategy_id)
       DO UPDATE SET misses = cache_stats.misses + 1`,
      [tenantId, strategyId]
    );
  }

  /**
   * Get stats for a strategy
   */
  async getStats(tenantId: string, strategyId: string): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT * FROM cache_stats WHERE tenant_id = $1 AND strategy_id = $2`,
      [tenantId, strategyId]
    );
    return result.rows[0] || null;
  }

  /**
   * Map database row to CacheStrategy
   */
  private mapRow(row: any): CacheStrategy {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type as CacheType,
      keyTemplate: row.key_template,
      paths: row.paths || [],
      restoreKeys: row.restore_keys || [],
      maxAge: row.max_age,
      enabled: row.enabled,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}