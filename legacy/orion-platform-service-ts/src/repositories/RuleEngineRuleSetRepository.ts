/**
 * RuleEngine RuleSet Repository
 *
 * PostgreSQL persistence for AI Rule Engine rule sets per scenario.
 */
import { BaseRepository } from '../db/base-repository';

export interface RuleEngineRuleSetEntity {
  id: string;
  scenario: string;
  name: string;
  description: string | null;
  rules_json: unknown[];
  default_action: Record<string, unknown> | null;
  enabled: boolean;
  tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class RuleEngineRuleSetRepository extends BaseRepository<RuleEngineRuleSetEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_rule_engine_rule_sets');
  }

  async findByScenario(scenario: string): Promise<RuleEngineRuleSetEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_rule_engine_rule_sets WHERE scenario = $1 LIMIT 1`,
      [scenario],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async listAll(): Promise<RuleEngineRuleSetEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_rule_engine_rule_sets ORDER BY scenario`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByScenario(data: {
    id: string;
    scenario: string;
    name: string;
    description?: string;
    rulesJson: unknown[];
    defaultAction?: Record<string, unknown>;
    enabled: boolean;
    tenantId?: string;
  }): Promise<RuleEngineRuleSetEntity> {
    const result = await this.db.query(
      `INSERT INTO ai_rule_engine_rule_sets (id, scenario, name, description, rules_json, default_action, enabled, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (scenario) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         rules_json = EXCLUDED.rules_json,
         default_action = EXCLUDED.default_action,
         enabled = EXCLUDED.enabled,
         updated_at = NOW()
       RETURNING *`,
      [
        data.id,
        data.scenario,
        data.name,
        data.description || null,
        JSON.stringify(data.rulesJson),
        data.defaultAction ? JSON.stringify(data.defaultAction) : null,
        data.enabled,
        data.tenantId || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): RuleEngineRuleSetEntity {
    return {
      id: row.id,
      scenario: row.scenario,
      name: row.name,
      description: row.description,
      rules_json: typeof row.rules_json === 'string' ? JSON.parse(row.rules_json) : (row.rules_json ?? []),
      default_action: typeof row.default_action === 'string' ? JSON.parse(row.default_action) : row.default_action,
      enabled: row.enabled === true || row.enabled === 'true',
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
