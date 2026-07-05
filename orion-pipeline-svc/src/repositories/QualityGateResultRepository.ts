/**
 * QualityGateResultRepository — 质量门禁评估结果持久化 (GAP-CN-04)
 *
 * 负责 quality_gate_results 表的 CRUD 操作，
 * 支持按 run_id 和 stage_name 查询质量门禁评估结果。
 */

import { Pool } from 'pg';
import { QualityGateResult } from '../models/QualityGate';

export { QualityGateResult } from '../models/QualityGate';

/**
 * PostgreSQL QualityGateResultRepository 实现
 */
export class PostgresQualityGateResultRepository {
  constructor(private pool: Pool) {}

  /**
   * 创建质量门禁评估结果 (alias for create, used by services)
   */
  async createResult(input: {
    id?: string;
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
    evaluatedAt?: Date;
  }): Promise<QualityGateResult> {
    return this.create(input);
  }

  /**
   * 按 Run ID 和 Stage 名称查找评估结果 (alias for findByRunIdAndStage, used by services)
   */
  async findByStageName(runId: string, stageName: string): Promise<QualityGateResult[]> {
    return this.findByRunIdAndStage(runId, stageName);
  }

  /**
   * 创建质量门禁评估结果
   */
  async create(input: {
    id?: string;
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
    evaluatedAt?: Date;
  }): Promise<QualityGateResult> {
    const id = input.id || crypto.randomUUID();
    const evaluatedAt = input.evaluatedAt || new Date();

    const query = `
      INSERT INTO quality_gate_results (
        id, gate_id, gate_name, run_id, stage_name,
        metrics, passed, blocked_rules, warned_rules, evaluated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      input.gateId,
      input.gateName,
      input.runId,
      input.stageName,
      JSON.stringify(input.metrics),
      input.passed,
      JSON.stringify(input.blockedRules),
      JSON.stringify(input.warnedRules),
      evaluatedAt,
    ]);

    if (result.rows.length === 0) {
      throw new Error('INSERT into quality_gate_results returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 按 ID 查找评估结果
   */
  async findById(id: string): Promise<QualityGateResult | null> {
    const query = 'SELECT * FROM quality_gate_results WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * 按 Run ID 查找所有评估结果
   */
  async findByRunId(runId: string): Promise<QualityGateResult[]> {
    const query = `
      SELECT * FROM quality_gate_results
      WHERE run_id = $1
      ORDER BY evaluated_at ASC
    `;
    const result = await this.pool.query(query, [runId]);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 按 Run ID 和 Stage 名称查找评估结果
   */
  async findByRunIdAndStage(runId: string, stageName: string): Promise<QualityGateResult[]> {
    const query = `
      SELECT * FROM quality_gate_results
      WHERE run_id = $1 AND stage_name = $2
      ORDER BY evaluated_at ASC
    `;
    const result = await this.pool.query(query, [runId, stageName]);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 查询所有未通过的评估结果
   */
  async findFailed(runId: string): Promise<QualityGateResult[]> {
    const query = `
      SELECT * FROM quality_gate_results
      WHERE run_id = $1 AND passed = false
      ORDER BY evaluated_at ASC
    `;
    const result = await this.pool.query(query, [runId]);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 更新评估结果（通常不需要更新，但保留此方法）
   */
  async update(id: string, input: Partial<QualityGateResult>): Promise<QualityGateResult | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.gateId !== undefined) {
      fields.push(`gate_id = $${paramIndex}`);
      values.push(input.gateId);
      paramIndex++;
    }
    if (input.gateName !== undefined) {
      fields.push(`gate_name = $${paramIndex}`);
      values.push(input.gateName);
      paramIndex++;
    }
    if (input.stageName !== undefined) {
      fields.push(`stage_name = $${paramIndex}`);
      values.push(input.stageName);
      paramIndex++;
    }
    if (input.metrics !== undefined) {
      fields.push(`metrics = $${paramIndex}`);
      values.push(JSON.stringify(input.metrics));
      paramIndex++;
    }
    if (input.passed !== undefined) {
      fields.push(`passed = $${paramIndex}`);
      values.push(input.passed);
      paramIndex++;
    }
    if (input.blockedRules !== undefined) {
      fields.push(`blocked_rules = $${paramIndex}`);
      values.push(JSON.stringify(input.blockedRules));
      paramIndex++;
    }
    if (input.warnedRules !== undefined) {
      fields.push(`warned_rules = $${paramIndex}`);
      values.push(JSON.stringify(input.warnedRules));
      paramIndex++;
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE quality_gate_results
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * 删除评估结果
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM quality_gate_results WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 将数据库行映射为 QualityGateResult 实体
   */
  private mapRowToEntity(row: any): QualityGateResult {
    let metrics: Record<string, number> = {};
    try {
      metrics = typeof row.metrics === 'string'
        ? JSON.parse(row.metrics)
        : (row.metrics || {});
    } catch {
      metrics = {};
    }

    let blockedRules: QualityGateResult['blockedRules'] = [];
    try {
      blockedRules = typeof row.blocked_rules === 'string'
        ? JSON.parse(row.blocked_rules)
        : (row.blocked_rules || []);
    } catch {
      blockedRules = [];
    }

    let warnedRules: QualityGateResult['warnedRules'] = [];
    try {
      warnedRules = typeof row.warned_rules === 'string'
        ? JSON.parse(row.warned_rules)
        : (row.warned_rules || []);
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
      evaluatedAt: row.evaluated_at instanceof Date ? row.evaluated_at : new Date(row.evaluated_at),
    };
  }
}

// Backward-compatible export alias
export const QualityGateResultRepository = PostgresQualityGateResultRepository;
export type QualityGateResultRepository = PostgresQualityGateResultRepository;
