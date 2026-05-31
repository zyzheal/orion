/**
 * DiagnosticReportRepository
 * Data access layer for diagnostic reports.
 * Replaces in-memory Map<string, DiagnosticReport> in DiagnosticAgentService.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';
import { DiagnosticReport, Finding, RootCause, RecommendedAction, TimelineEntry } from '../services/diagnostic/types';

export interface DiagnosticReportEntity {
  id: string;
  tenantId: string;
  sessionId: string;
  summary: string;
  findings: Finding[];
  rootCause: RootCause | null;
  recommendations: RecommendedAction[];
  timeline: TimelineEntry[];
  estimatedFixTimeMs?: number;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class DiagnosticReportRepository extends BaseRepository<DiagnosticReportEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'diagnostic_reports');
  }

  async create(data: any): Promise<DiagnosticReportEntity> {
    const columns = ['id', 'tenant_id', 'session_id', 'summary', 'findings', 'recommendations', 'timeline', 'generated_at'];
    const values: any[] = [
      data.id,
      data.tenantId || 'default',
      data.sessionId,
      data.summary || '',
      JSON.stringify(data.findings || []),
      JSON.stringify(data.recommendations || []),
      JSON.stringify(data.timeline || []),
      data.generatedAt || new Date(),
    ];

    if (data.rootCause !== undefined && data.rootCause !== null) {
      columns.push('root_cause');
      values.push(JSON.stringify(data.rootCause));
    }
    if (data.estimatedFixTimeMs !== undefined) {
      columns.push('estimated_fix_time_ms');
      values.push(data.estimatedFixTimeMs);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findBySessionId(sessionId: string): Promise<DiagnosticReportEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE session_id = $1`,
      [sessionId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, limit: number = 50): Promise<DiagnosticReportEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY generated_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): DiagnosticReportEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sessionId: row.session_id,
      summary: row.summary,
      findings: (row.findings || []) as Finding[],
      rootCause: row.root_cause ? (typeof row.root_cause === 'string' ? JSON.parse(row.root_cause) : row.root_cause) as RootCause : null,
      recommendations: (row.recommendations || []) as RecommendedAction[],
      timeline: (row.timeline || []) as TimelineEntry[],
      estimatedFixTimeMs: row.estimated_fix_time_ms ? parseInt(row.estimated_fix_time_ms, 10) : undefined,
      generatedAt: new Date(row.generated_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
