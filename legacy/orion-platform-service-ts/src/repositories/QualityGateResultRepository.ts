/**
 * QualityGateResultRepository - 质量门禁评估结果的持久化存储
 *
 * 负责质量门禁评估结果（QualityGateResult）的存储和查询：
 * - 按 Run ID 查询
 * - 按 Stage 名称查询
 * - 存储评估结果
 *
 * GAP-CN-04: 代码质量门禁
 */
import { BaseRepository } from '../db/base-repository';
import { QualityGateResult } from '../models/QualityGate';

// ============================================================================
// Repository
// ============================================================================

export class QualityGateResultRepository extends BaseRepository<QualityGateResult> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'quality_gate_results');
  }

  /**
   * 按 Run ID 查询所有评估结果
   */
  async findByRunId(runId: string): Promise<QualityGateResult[]> {
    const result = await this.db.query(
      `SELECT * FROM quality_gate_results WHERE run_id = $1 ORDER BY evaluated_at ASC`,
      [runId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 按 Run ID 和 Stage 名称查询评估结果
   */
  async findByStageName(runId: string, stageName: string): Promise<QualityGateResult[]> {
    const result = await this.db.query(
      `SELECT * FROM quality_gate_results WHERE run_id = $1 AND stage_name = $2 ORDER BY evaluated_at ASC`,
      [runId, stageName]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 创建评估结果
   */
  async createResult(input: {
    id: string;
    gateId: string;
    gateName: string;
    runId: string;
    stageName: string;
    metrics: Record<string, number>;
    passed: boolean;
    blockedRules: Array<{
      rule: { metric: string; operator: string; threshold: number; severity: string };
      actualValue: number;
      reason: string;
    }>;
    warnedRules: Array<{
      rule: { metric: string; operator: string; threshold: number; severity: string };
      actualValue: number;
      reason: string;
    }>;
    evaluatedAt: Date;
  }): Promise<QualityGateResult> {
    const result = await this.db.query(
      `INSERT INTO quality_gate_results
       (id, gate_id, gate_name, run_id, stage_name, metrics, passed, blocked_rules, warned_rules, evaluated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        input.id,
        input.gateId,
        input.gateName,
        input.runId,
        input.stageName,
        JSON.stringify(input.metrics),
        input.passed,
        JSON.stringify(input.blockedRules),
        JSON.stringify(input.warnedRules),
        input.evaluatedAt,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): QualityGateResult {
    let metrics: Record<string, number> = {};
    try {
      metrics = typeof row.metrics === 'string' ? JSON.parse(row.metrics) : (row.metrics || {});
    } catch {
      metrics = {};
    }

    let blockedRules: QualityGateResult['blockedRules'] = [];
    try {
      blockedRules = typeof row.blocked_rules === 'string' ? JSON.parse(row.blocked_rules) : (row.blocked_rules || []);
    } catch {
      blockedRules = [];
    }

    let warnedRules: QualityGateResult['warnedRules'] = [];
    try {
      warnedRules = typeof row.warned_rules === 'string' ? JSON.parse(row.warned_rules) : (row.warned_rules || []);
    } catch {
      warnedRules = [];
    }

    return {
      id: row.id,
      gateId: row.gate_id,
      gateName: row.gate_name,
      runId: row.run_id,
      stageName: row.stage_name,
      metrics,
      passed: row.passed ?? false,
      blockedRules,
      warnedRules,
      evaluatedAt: row.evaluated_at,
    };
  }
}
