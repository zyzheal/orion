/**
 * KnownIssueRepository
 * Data access layer for known issues (migration from in-memory Map to PostgreSQL).
 * Supports CRUD, fingerprint-based deduplication, tenant isolation, and resolution tracking.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

/**
 * KnownIssue entity mapped from known_issues table.
 * Entity layer uses camelCase for all properties; BaseRepository handles snake_case conversion.
 */
export interface KnownIssueEntity {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  fingerprint: string;
  labelSelectors?: Record<string, string>;
  ticketId: string | null;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
}

export class KnownIssueRepository extends BaseRepository<KnownIssueEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'known_issues');
  }

  /**
   * Create a new known issue record.
   * Overrides BaseRepository.create to handle labelSelectors → JSONB serialization.
   */
  async create(data: Omit<KnownIssueEntity, 'id' | 'resolvedAt' | 'createdAt'> & Partial<Pick<KnownIssueEntity, 'id'>>): Promise<KnownIssueEntity> {
    const columns = ['tenant_id', 'title', 'description', 'fingerprint', 'label_selectors', 'ticket_id', 'resolved'];
    const values = [
      data.tenantId,
      data.title,
      data.description ?? null,
      data.fingerprint,
      data.labelSelectors ?? null,
      data.ticketId ?? null,
      false,
    ];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO known_issues (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('INSERT into known_issues returned no rows', 'OPERATION_FAILED');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update a known issue by ID.
   * Overrides BaseRepository.update to support partial update (only non-undefined fields).
   */
  async update(id: string, data: Partial<Omit<KnownIssueEntity, 'id' | 'createdAt'>>): Promise<KnownIssueEntity | null> {
    const rawColumns = Object.keys(data).filter(k => data[k as keyof KnownIssueEntity] !== undefined);

    if (rawColumns.length === 0) {
      throw new OrionError('Update requires at least one column', ErrorCode.VALIDATION_ERROR);
    }

    // Validate column names through camelToSnake conversion
    const snakeColumns = rawColumns.map(k => {
      const snake = k
        .replace(/([a-z])(\d)/g, '$1_$2')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/(\d)([A-Z])/g, '$1_$2')
        .toLowerCase();
      return { key: snake, original: k };
    });

    for (const col of snakeColumns) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col.key)) {
        throw new OrionError(`Invalid column name: ${col.key}`, 'VALIDATION_ERROR');
      }
    }

    const values = rawColumns.map(k => data[k as keyof KnownIssueEntity]);
    // Handle labelSelectors → JSONB
    const labelIdx = rawColumns.findIndex(k => k === 'labelSelectors');
    if (labelIdx >= 0) {
      values[labelIdx] = JSON.stringify(values[labelIdx]);
    }

    const setClauses = snakeColumns.map(({ key }, i) => `${key} = $${i + 1}`);
    const query = `UPDATE known_issues SET ${setClauses.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    const result = await this.db.query(query, [...values, id]);

    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantId(tenantId: string): Promise<KnownIssueEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM known_issues WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findOpen(tenantId?: string): Promise<KnownIssueEntity[]> {
    if (tenantId) {
      const result = await this.db.query(
        `SELECT * FROM known_issues WHERE tenant_id = $1 AND resolved = false ORDER BY created_at DESC`,
        [tenantId],
      );
      return result.rows.map(row => this.mapRowToEntity(row));
    }

    const result = await this.db.query(
      `SELECT * FROM known_issues WHERE resolved = false ORDER BY created_at DESC`,
      [],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByFingerprint(fingerprint: string): Promise<KnownIssueEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM known_issues WHERE fingerprint = $1`,
      [fingerprint],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async resolve(id: string, resolvedAt?: Date): Promise<KnownIssueEntity | null> {
    const time = resolvedAt ?? new Date();
    const result = await this.db.query(
      `UPDATE known_issues SET resolved = true, resolved_at = $1 WHERE id = $2 RETURNING *`,
      [time, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Parse a database row into a KnownIssueEntity.
   * Converts snake_case columns to camelCase properties, parses JSONB, and handles date strings.
   */
  protected mapRowToEntity(row: any): KnownIssueEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description ?? null,
      fingerprint: row.fingerprint,
      labelSelectors: typeof row.label_selectors === 'string'
        ? JSON.parse(row.label_selectors)
        : row.label_selectors ?? undefined,
      ticketId: row.ticket_id ?? null,
      resolved: row.resolved ?? false,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
