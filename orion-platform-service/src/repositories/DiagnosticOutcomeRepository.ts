/**
 * DiagnosticOutcomeRepository
 * Data access layer for diagnostic outcomes (knowledge base learning).
 * Replaces in-memory Map<string, DiagnosticOutcome> in DiagnosticKnowledgeBase.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

export interface DiagnosticOutcomeEntity {
  id: string;
  tenantId: string;
  sessionId: string;
  patternId: string;
  confirmed: boolean;
  actualRootCause?: string;
  fixTimeMs?: number;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class DiagnosticOutcomeRepository extends BaseRepository<DiagnosticOutcomeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'diagnostic_outcomes');
  }

  async create(data: any): Promise<DiagnosticOutcomeEntity> {
    const columns = ['id', 'tenant_id', 'session_id', 'pattern_id', 'confirmed'];
    const values: any[] = [
      data.id,
      data.tenantId || 'default',
      data.sessionId,
      data.patternId,
      data.confirmed || false,
    ];

    if (data.actualRootCause !== undefined) {
      columns.push('actual_root_cause');
      values.push(data.actualRootCause);
    }
    if (data.fixTimeMs !== undefined) {
      columns.push('fix_time_ms');
      values.push(data.fixTimeMs);
    }
    if (data.recordedAt) {
      columns.push('recorded_at');
      values.push(data.recordedAt);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findBySessionId(sessionId: string): Promise<DiagnosticOutcomeEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE session_id = $1`,
      [sessionId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByPatternId(patternId: string): Promise<DiagnosticOutcomeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE pattern_id = $1 ORDER BY recorded_at DESC`,
      [patternId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, limit: number = 100): Promise<DiagnosticOutcomeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY recorded_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): DiagnosticOutcomeEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sessionId: row.session_id,
      patternId: row.pattern_id,
      confirmed: row.confirmed,
      actualRootCause: row.actual_root_cause,
      fixTimeMs: row.fix_time_ms ? parseInt(row.fix_time_ms, 10) : undefined,
      recordedAt: new Date(row.recorded_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
