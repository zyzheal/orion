import { BaseRepository } from '../db/base-repository';

export interface PolicyEvaluationEntity {
  id: string;
  policyId: string | null;
  runId: string;
  inputContext: Record<string, any>;
  result: Record<string, any>;
  evaluatedAt: Date;
  evaluationMs: number | null;
}

export interface PolicyEvaluationCreateInput {
  id?: string;
  policyId?: string | null;
  runId: string;
  inputContext: Record<string, any>;
  result: Record<string, any>;
  evaluationMs?: number | null;
}

export class PolicyEvaluationRepository extends BaseRepository<PolicyEvaluationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'policy_evaluations');
  }

  async findByRunId(runId: string): Promise<PolicyEvaluationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM policy_evaluations WHERE run_id = $1 ORDER BY evaluated_at DESC`,
      [runId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPolicyId(policyId: string, options?: { limit?: number; offset?: number }): Promise<PolicyEvaluationEntity[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM policy_evaluations WHERE policy_id = $1 ORDER BY evaluated_at DESC LIMIT $2 OFFSET $3`,
      [policyId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): PolicyEvaluationEntity {
    return {
      id: row.id,
      policyId: row.policy_id,
      runId: row.run_id,
      inputContext: row.input_context ?? {},
      result: row.result ?? {},
      evaluatedAt: row.evaluated_at,
      evaluationMs: row.evaluation_ms,
    };
  }
}