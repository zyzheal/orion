import { BaseRepository } from '../db/base-repository';

export interface RiskAssessmentRecordEntity {
  id: string;
  assessmentType: string | null;
  target: string | null;
  riskScore: number | null;
  riskLevel: string | null;
  factors: Record<string, any>;
  recommendations: any[];
  status: string;
  tenantId: string | null;
  createdAt: Date;
}

export class RiskAssessmentRecordRepository extends BaseRepository<RiskAssessmentRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'risk_assessment_records');
  }

  async findByTarget(target: string, limit: number = 20): Promise<RiskAssessmentRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM risk_assessment_records WHERE target = $1 ORDER BY created_at DESC LIMIT $2`,
      [target, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): RiskAssessmentRecordEntity {
    return {
      id: row.id,
      assessmentType: row.assessment_type,
      target: row.target,
      riskScore: row.risk_score !== null ? Number(row.risk_score) : null,
      riskLevel: row.risk_level,
      factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : (row.factors || {}),
      recommendations: typeof row.recommendations === 'string' ? JSON.parse(row.recommendations) : (row.recommendations || []),
      status: row.status,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
