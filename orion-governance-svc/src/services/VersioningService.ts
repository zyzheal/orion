import { Pool, type QueryResultRow } from 'pg';
import type {
  ApiVersion,
  CreateVersionInput,
  PaginationParams,
  PaginatedResult,
  VersionStatus,
} from '../types/governance.js';

export class VersioningService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(input: CreateVersionInput): Promise<ApiVersion> {
    const result = await this.pool.query(
      `INSERT INTO api_versions
        (contract_id, version, changelog, breaking_changes, migration_guide)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.contractId,
        input.version,
        input.changelog,
        input.breakingChanges,
        input.migrationGuide || null,
      ],
    );
    return this.rowToVersion(result.rows[0]);
  }

  async findById(id: string): Promise<ApiVersion | null> {
    const result = await this.pool.query('SELECT * FROM api_versions WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToVersion(result.rows[0]) : null;
  }

  async findByContractId(contractId: string): Promise<ApiVersion[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_versions WHERE contract_id = $1 ORDER BY created_at DESC',
      [contractId],
    );
    return result.rows.map((row) => this.rowToVersion(row));
  }

  async findAll(params: PaginationParams, filters?: { contractId?: string; status?: VersionStatus }): Promise<PaginatedResult<ApiVersion>> {
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
      `SELECT COUNT(*) as total FROM api_versions ${whereSql}`,
      queryParams,
    );
    const total = Number.parseInt(countResult.rows[0].total, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM api_versions ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, offset],
    );

    return {
      data: dataResult.rows.map((row) => this.rowToVersion(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async update(id: string, updates: { status?: VersionStatus; changelog?: string; migrationGuide?: string }): Promise<ApiVersion | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await this.pool.query(
      `UPDATE api_versions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToVersion(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM api_versions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private rowToVersion(row: QueryResultRow): ApiVersion {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      contractId: r.contract_id as string,
      version: r.version as string,
      changelog: r.changelog as string,
      status: r.status as VersionStatus,
      breakingChanges: r.breaking_changes as boolean,
      migrationGuide: (r.migration_guide as string) ?? undefined,
      createdAt: (r.created_at as Date).toISOString(),
      updatedAt: (r.updated_at as Date).toISOString(),
    };
  }
}
