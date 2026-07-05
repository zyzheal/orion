/**
 * DecisionExplanation Repository
 *
 * PostgreSQL persistence for AI decision explanation history.
 */
import { BaseRepository } from '../db/base-repository';

export interface DecisionExplanationEntity {
  id: string;
  decision_id: string;
  decision_type: string;
  decision: string;
  confidence: number;
  confidence_level: string;
  overall_reason: string | null;
  feature_importance: unknown[];
  matched_rules: unknown[];
  contributing_factors: string[];
  mitigating_factors: string[];
  recommendations: string[];
  metadata_json: Record<string, unknown> | null;
  tenant_id?: string | null;
  created_at: Date;
}

export class DecisionExplanationRepository extends BaseRepository<DecisionExplanationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_decision_explanations');
  }

  async findByDecisionId(decisionId: string): Promise<DecisionExplanationEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_decision_explanations WHERE decision_id = $1 LIMIT 1`,
      [decisionId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByType(decisionType: string, limit: number = 50): Promise<DecisionExplanationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_decision_explanations WHERE decision_type = $1 ORDER BY created_at DESC LIMIT $2`,
      [decisionType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRecent(limit: number = 50, decisionType?: string): Promise<DecisionExplanationEntity[]> {
    let query = `SELECT * FROM ai_decision_explanations`;
    const params: unknown[] = [];

    if (decisionType) {
      query += ` WHERE decision_type = $1`;
      params.push(decisionType);
      query += ` ORDER BY created_at DESC LIMIT $2`;
      params.push(limit);
    } else {
      query += ` ORDER BY created_at DESC LIMIT $1`;
      params.push(limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): DecisionExplanationEntity {
    return {
      id: row.id,
      decision_id: row.decision_id,
      decision_type: row.decision_type,
      decision: row.decision,
      confidence: parseFloat(row.confidence),
      confidence_level: row.confidence_level,
      overall_reason: row.overall_reason,
      feature_importance: typeof row.feature_importance === 'string' ? JSON.parse(row.feature_importance) : (row.feature_importance ?? []),
      matched_rules: typeof row.matched_rules === 'string' ? JSON.parse(row.matched_rules) : (row.matched_rules ?? []),
      contributing_factors: typeof row.contributing_factors === 'string' ? JSON.parse(row.contributing_factors) : (row.contributing_factors ?? []),
      mitigating_factors: typeof row.mitigating_factors === 'string' ? JSON.parse(row.mitigating_factors) : (row.mitigating_factors ?? []),
      recommendations: typeof row.recommendations === 'string' ? JSON.parse(row.recommendations) : (row.recommendations ?? []),
      metadata_json: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : row.metadata_json,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
    };
  }
}
