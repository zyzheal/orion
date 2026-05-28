/**
 * HealingAuditRepository
 *
 * PostgreSQL repository for self-healing audit log entries.
 * I1 Fix: Persists audit entries to PostgreSQL instead of in-memory only.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

export interface HealingAuditEntity {
  id: string;
  incidentId: string;
  actionType: string;
  target: string;
  environment: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approvers: string[];
  executor: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'blocked';
  reason?: string;
  result?: string;
  createdAt: Date;
}

export class HealingAuditRepository extends BaseRepository<HealingAuditEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'self_healing_audit_log');
  }

  async insert(data: {
    incident_id: string;
    action_type: string;
    target: string;
    environment: string;
    risk_level: string;
    approvers?: string[];
    executor?: string;
    status: string;
    reason?: string;
    result?: string;
  }): Promise<HealingAuditEntity> {
    const result = await this.db.query(
      `INSERT INTO self_healing_audit_log (
        incident_id, action_type, target, environment, risk_level,
        approvers, executor, status, reason, result
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.incident_id,
        data.action_type,
        data.target,
        data.environment,
        data.risk_level,
        JSON.stringify(data.approvers || []),
        data.executor || 'system',
        data.status,
        data.reason || null,
        data.result || null,
      ],
    );
    if (result.rows.length === 0) throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT returned no rows');
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByIncident(incidentId: string, limit: number = 50): Promise<HealingAuditEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM self_healing_audit_log
       WHERE incident_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [incidentId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string, limit: number = 50): Promise<HealingAuditEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM self_healing_audit_log
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [status, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEnvironment(environment: string, limit: number = 50): Promise<HealingAuditEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM self_healing_audit_log
       WHERE environment = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [environment, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByStatus(): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT status, COUNT(*) as count
       FROM self_healing_audit_log
       GROUP BY status`,
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }
    return counts;
  }

  async countByRiskLevel(): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT risk_level, COUNT(*) as count
       FROM self_healing_audit_log
       GROUP BY risk_level`,
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.risk_level] = parseInt(row.count, 10);
    }
    return counts;
  }

  async countByEnvironment(): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT environment, COUNT(*) as count
       FROM self_healing_audit_log
       GROUP BY environment`,
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.environment] = parseInt(row.count, 10);
    }
    return counts;
  }

  async totalCount(): Promise<number> {
    const result = await this.db.query(`SELECT COUNT(*) as count FROM self_healing_audit_log`);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): HealingAuditEntity {
    return {
      id: row.id,
      incidentId: row.incident_id,
      actionType: row.action_type,
      target: row.target,
      environment: row.environment,
      riskLevel: row.risk_level,
      approvers: row.approvers || [],
      executor: row.executor ?? 'system',
      status: row.status,
      reason: row.reason,
      result: row.result,
      createdAt: row.created_at,
    };
  }
}
