/**
 * DiagnosticRepository - Database layer for Diagnostic operations
 *
 * Aligned with migration 040_create_diagnostic_tables.sql schema.
 * Maps between DB rows and domain DiagnosticSession from types.ts.
 */

import { DiagnosticSession, Symptom, Finding, RootCause } from './types';
import { DatabasePool } from '../database';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface DiagnosticRule {
  id: string;
  name: string;
  category: string;
  description: string;
  script: string;
  enabled: boolean;
}

export class DiagnosticRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * Create a new diagnostic session in PostgreSQL.
   * Accepts domain DiagnosticSession and maps to DB schema.
   */
  async createSession(session: DiagnosticSession): Promise<void> {
    await this.pool.query(
      `INSERT INTO diagnostic_sessions (id, tenant_id, title, status, triggered_by, target_type, target_id, symptoms, findings, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        session.id,
        session.tenantId || getCurrentTenantId(),
        `${session.triggerType}: ${session.triggerId}`,
        session.status,
        null, // triggered_by (optional FK)
        session.triggerType,
        session.triggerId,
        JSON.stringify(session.symptoms || []),
        JSON.stringify(session.findings || []),
        session.createdAt || new Date(),
      ]
    );
  }

  /**
   * Update session with completed status and root cause analysis.
   */
  async completeSession(id: string, rootCause: RootCause | null, confidence: number, findings: Finding[]): Promise<void> {
    await this.pool.query(
      `UPDATE diagnostic_sessions
       SET status = 'completed', findings = $1, completed_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(findings), id]
    );
  }

  /**
   * Get a session by ID, mapping DB row to domain DiagnosticSession.
   */
  async getSession(id: string): Promise<DiagnosticSession | null> {
    const row = (await this.pool.query('SELECT * FROM diagnostic_sessions WHERE id = $1', [id])).rows[0];
    if (!row) return null;
    return this.mapRowToSession(row);
  }

  /**
   * Get sessions for a tenant, mapped to domain DiagnosticSession.
   */
  async getSessions(tenantId: string, limit: number = 20): Promise<DiagnosticSession[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM diagnostic_sessions WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2',
      [tenantId, limit]
    )).rows;
    return rows.map(row => this.mapRowToSession(row));
  }

  async findRules(category?: string): Promise<DiagnosticRule[]> {
    let query = 'SELECT * FROM diagnostic_rules';
    const params: any[] = [];
    if (category) { params.push(category); query += ' WHERE category = $1'; }
    return (await this.pool.query(query, params)).rows;
  }

  /**
   * Map a DB row to domain DiagnosticSession.
   */
  private mapRowToSession(row: any): DiagnosticSession {
    return {
      id: row.id,
      triggerType: row.target_type || 'manual',
      triggerId: row.target_id || row.id,
      symptoms: (row.symptoms || []) as Symptom[],
      findings: (row.findings || []) as Finding[],
      rootCause: null, // Stored separately or derived
      confidence: 0,
      status: row.status || 'running',
      createdAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      tenantId: row.tenant_id,
      metadata: { title: row.title, triggered_by: row.triggered_by },
    };
  }
}
