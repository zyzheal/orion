/**
 * RuleEngine Audit Log Repository
 *
 * PostgreSQL persistence for AI Rule Engine audit log entries.
 */
import { BaseRepository } from '../db/base-repository';

export interface RuleEngineAuditLogEntity {
  id: string;
  scenario: string;
  rule_id: string | null;
  input_json: Record<string, unknown>;
  result_json: Record<string, unknown>;
  event_time: Date;
  tenant_id: string | null;
  created_at: Date;
}

export class RuleEngineAuditLogRepository extends BaseRepository<RuleEngineAuditLogEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_rule_engine_audit_log');
  }

  async findByScenario(scenario: string, limit: number = 100): Promise<RuleEngineAuditLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_rule_engine_audit_log WHERE scenario = $1 ORDER BY event_time DESC LIMIT $2`,
      [scenario, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRuleId(ruleId: string, limit: number = 50): Promise<RuleEngineAuditLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_rule_engine_audit_log WHERE rule_id = $1 ORDER BY event_time DESC LIMIT $2`,
      [ruleId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByScenario(scenario: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM ai_rule_engine_audit_log WHERE scenario = $1`,
      [scenario],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async pruneOldRecords(keepCount: number): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ai_rule_engine_audit_log WHERE id IN (
        SELECT id FROM ai_rule_engine_audit_log
        ORDER BY event_time DESC
        OFFSET $1
      )`,
      [keepCount],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): RuleEngineAuditLogEntity {
    return {
      id: row.id,
      scenario: row.scenario,
      rule_id: row.rule_id,
      input_json: typeof row.input_json === 'string' ? JSON.parse(row.input_json) : (row.input_json ?? {}),
      result_json: typeof row.result_json === 'string' ? JSON.parse(row.result_json) : (row.result_json ?? {}),
      event_time: row.event_time,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
    };
  }
}
