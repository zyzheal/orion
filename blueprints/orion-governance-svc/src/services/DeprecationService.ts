import { Pool, type QueryResultRow } from 'pg';
import type {
  Deprecation,
  CreateDeprecationInput,
  PaginationParams,
  PaginatedResult,
  DeprecationStatus,
} from '../types/governance.js';

export class DeprecationService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(input: CreateDeprecationInput): Promise<Deprecation> {
    const result = await this.pool.query(
      `INSERT INTO deprecations
        (contract_id, version, reason, replacement_version, sunset_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.contractId,
        input.version,
        input.reason,
        input.replacementVersion || null,
        new Date(input.sunsetDate),
      ],
    );
    return this.rowToDeprecation(result.rows[0]);
  }

  async findById(id: string): Promise<Deprecation | null> {
    const result = await this.pool.query('SELECT * FROM deprecations WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToDeprecation(result.rows[0]) : null;
  }

  async findAll(params: PaginationParams, filters?: { contractId?: string; status?: DeprecationStatus }): Promise<PaginatedResult<Deprecation>> {
    const offset = (params.page - 1) * params.limit;
    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (filters?.contractId) {
      whereClauses.push(`contract_id = $${paramIndex}`);
      queryParams.push(filters.contractId);
      paramIndex++;
    }
    if (filters?.status) {
      whereClauses.push(`status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM deprecations ${whereSql}`,
      queryParams,
    );
    const total = Number.parseInt(countResult.rows[0].total, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM deprecations ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, offset],
    );

    return {
      data: dataResult.rows.map((row) => this.rowToDeprecation(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async updateStatus(id: string, status: DeprecationStatus): Promise<Deprecation | null> {
    const result = await this.pool.query(
      'UPDATE deprecations SET status = $1, notification_sent = CASE WHEN $1 = \'notified\' THEN true ELSE notification_sent END, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id],
    );
    return result.rows.length > 0 ? this.rowToDeprecation(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM deprecations WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private rowToDeprecation(row: QueryResultRow): Deprecation {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      contractId: r.contract_id as string,
      version: r.version as string,
      reason: r.reason as string,
      replacementVersion: (r.replacement_version as string) ?? undefined,
      sunsetDate: (r.sunset_date as Date).toISOString(),
      notificationSent: r.notification_sent as boolean,
      status: r.status as DeprecationStatus,
      createdAt: (r.created_at as Date).toISOString(),
      updatedAt: (r.updated_at as Date).toISOString(),
    };
  }
}
