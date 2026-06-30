/**
 * ABExperimentRepository - A/B experiment data access layer
 *
 * Extends BaseRepository for standard CRUD; overrides with custom SQL for
 * JSONB fields (variants, metrics, results) since BaseRepository's generic
 * camelToSnake does not handle them correctly.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export type ExperimentStatus = 'draft' | 'running' | 'completed' | 'cancelled';

export interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  trafficPercentage: number;
  config: Record<string, unknown>;
  isControl: boolean;
}

export interface ExperimentMetric {
  name: string;
  type: 'conversion' | 'engagement' | 'revenue' | 'custom';
  target: number;
}

export interface ABExperiment {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  hypothesis?: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  metrics: ExperimentMetric[];
  startDate?: Date;
  endDate?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  results?: Record<string, unknown>;
}

export interface ExperimentFindAllOptions {
  tenantId?: string;
  status?: ExperimentStatus;
  limit?: number;
  offset?: number;
}

export class ABExperimentRepository extends BaseRepository<ABExperiment> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'ab_experiments');
  }

  // ---- overrides because JSONB fields need manual handling ----

  async findById(id: string): Promise<ABExperiment | undefined> {
    const result = await this.db.query(
      'SELECT * FROM ab_experiments WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async create(data: ABExperiment): Promise<ABExperiment> {
    const result = await this.db.query(
      `INSERT INTO ab_experiments (
        id, tenant_id, name, description, hypothesis, status, variants,
        metrics, start_date, end_date, created_by, created_at, updated_at, results
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        data.id,
        data.tenantId,
        data.name,
        data.description ?? null,
        data.hypothesis ?? null,
        data.status,
        JSON.stringify(data.variants),
        JSON.stringify(data.metrics),
        data.startDate ?? null,
        data.endDate ?? null,
        data.createdBy,
        data.createdAt,
        data.updatedAt,
        data.results ? JSON.stringify(data.results) : null,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into ab_experiments returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateById(id: string, data: Partial<Omit<ABExperiment, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ABExperiment | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.hypothesis !== undefined) {
      setClauses.push(`hypothesis = $${paramIndex++}`);
      values.push(data.hypothesis);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.variants !== undefined) {
      setClauses.push(`variants = $${paramIndex++}`);
      values.push(JSON.stringify(data.variants));
    }
    if (data.metrics !== undefined) {
      setClauses.push(`metrics = $${paramIndex++}`);
      values.push(JSON.stringify(data.metrics));
    }
    if (data.startDate !== undefined) {
      setClauses.push(`start_date = $${paramIndex++}`);
      values.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      setClauses.push(`end_date = $${paramIndex++}`);
      values.push(data.endDate);
    }
    if (data.results !== undefined) {
      setClauses.push(`results = $${paramIndex++}`);
      values.push(JSON.stringify(data.results));
    }

    if (setClauses.length === 0) {
      return this.findById(id).then(r => r ?? null);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE ab_experiments SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.db.query(query, values);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM ab_experiments WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findByTenant(tenantId: string, status?: string, limit = 100, offset = 0): Promise<ABExperiment[]> {
    let query = 'SELECT * FROM ab_experiments WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + paramIndex + ' OFFSET $' + paramIndex + 1;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  async countByTenant(tenantId: string, status?: string): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM ab_experiments WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  // ---- row → entity conversion ----

  protected mapRowToEntity(row: any): ABExperiment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || undefined,
      hypothesis: row.hypothesis || undefined,
      status: row.status as ExperimentStatus,
      variants: typeof row.variants === 'string' ? JSON.parse(row.variants) : (row.variants ?? []),
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : (row.metrics ?? []),
      startDate: row.start_date || undefined,
      endDate: row.end_date || undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      results: row.results ? (typeof row.results === 'string' ? JSON.parse(row.results) : row.results) : undefined,
    };
  }
}
