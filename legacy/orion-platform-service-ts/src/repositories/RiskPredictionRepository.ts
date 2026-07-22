/**
 * RiskPredictionRepository - Database layer for risk prediction cache persistence
 */

import { BaseRepository } from '../db/base-repository';

export interface RiskPredictionEntity {
  id: string;
  tenantId: string | null;
  targetType: string | null;
  targetId: string | null;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  confidence: number | null;
  modelVersion: string;
  features: Record<string, number>;
  shapValues: Array<{ feature: string; value: number; contribution: number; direction: string }> | null;
  topRiskFactors: string[] | null;
  createdAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface CreatePredictionInput {
  id: string;
  tenantId?: string;
  targetType?: string;
  targetId?: string;
  riskScore: number;
  riskLevel: RiskPredictionEntity['riskLevel'];
  confidence?: number;
  modelVersion: string;
  features: Record<string, number>;
  shapValues?: Array<{ feature: string; value: number; contribution: number; direction: string }>;
  topRiskFactors?: string[];
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export class RiskPredictionRepository extends BaseRepository<RiskPredictionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'risk_predictions');
  }

  /**
   * Find prediction by target (PR, commit, deployment)
   */
  async findByTarget(targetType: string, targetId: string): Promise<RiskPredictionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM risk_predictions
       WHERE target_type = $1 AND target_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [targetType, targetId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find predictions by tenant
   */
  async findByTenant(
    tenantId: string,
    options?: { limit?: number; riskLevel?: string }
  ): Promise<RiskPredictionEntity[]> {
    const limit = options?.limit ?? 20;
    let query = `SELECT * FROM risk_predictions WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (options?.riskLevel) {
      query += ` AND risk_level = $2`;
      params.push(options.riskLevel);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find high/critical risk predictions
   */
  async findHighRisk(limit: number = 10): Promise<RiskPredictionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM risk_predictions
       WHERE risk_level IN ('critical', 'high')
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY risk_score DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Clear expired predictions
   */
  async clearExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM risk_predictions WHERE expires_at IS NOT NULL AND expires_at < NOW()`
    );
    return result.rowCount ?? 0;
  }

  /**
   * Get prediction statistics
   */
  async getStats(): Promise<{
    totalPredictions: number;
    avgScore: number;
    byLevel: Record<string, number>;
  }> {
    const result = await this.db.query(`
      SELECT
        COUNT(*) as total,
        AVG(risk_score) as avg_score,
        COUNT(*) FILTER (WHERE risk_level = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE risk_level = 'high') as high_count,
        COUNT(*) FILTER (WHERE risk_level = 'medium') as medium_count,
        COUNT(*) FILTER (WHERE risk_level = 'low') as low_count
      FROM risk_predictions
      WHERE expires_at IS NULL OR expires_at > NOW()
    `);

    const row = result.rows[0];
    return {
      totalPredictions: parseInt(row.total, 10) || 0,
      avgScore: parseFloat(row.avg_score) || 0,
      byLevel: {
        critical: parseInt(row.critical_count, 10) || 0,
        high: parseInt(row.high_count, 10) || 0,
        medium: parseInt(row.medium_count, 10) || 0,
        low: parseInt(row.low_count, 10) || 0,
      },
    };
  }

  protected mapRowToEntity(row: any): RiskPredictionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      targetType: row.target_type,
      targetId: row.target_id,
      riskScore: parseFloat(row.risk_score),
      riskLevel: row.risk_level,
      confidence: row.confidence != null ? parseFloat(row.confidence) : null,
      modelVersion: row.model_version,
      features: row.features ?? {},
      shapValues: row.shap_values ?? null,
      topRiskFactors: row.top_risk_factors ?? null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      metadata: row.metadata ?? {},
    };
  }
}

export default RiskPredictionRepository;