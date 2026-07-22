import { BaseRepository } from '../db/base-repository';

export interface RiskAssessmentEntity {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  targetType: string;
  targetId: string;
  score: number | null;
  riskLevel: string | null;
  findings: Record<string, any>[];
  status: string;
  createdAt: Date;
}

export interface RiskAssessmentCreateInput {
  tenantId: string;
  name: string;
  type: string;
  targetType: string;
  targetId: string;
  score?: number;
  riskLevel?: string;
  findings?: Record<string, any>[];
  status?: string;
}

export class RiskAssessmentRepository extends BaseRepository<RiskAssessmentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'risk_assessments');
  }

  async findByTenant(tenantId: string, options?: { limit?: number; offset?: number }): Promise<RiskAssessmentEntity[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM risk_assessments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTarget(targetType: string, targetId: string): Promise<RiskAssessmentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM risk_assessments WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC`,
      [targetType, targetId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTargetType(targetType: string): Promise<RiskAssessmentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM risk_assessments WHERE target_type = $1 ORDER BY created_at DESC`,
      [targetType],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTargetId(targetId: string): Promise<RiskAssessmentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM risk_assessments WHERE target_id = $1 ORDER BY created_at DESC`,
      [targetId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRiskLevel(riskLevel: string, tenantId?: string): Promise<RiskAssessmentEntity[]> {
    let query = `SELECT * FROM risk_assessments WHERE risk_level = $1`;
    const params: any[] = [riskLevel];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): RiskAssessmentEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type,
      targetType: row.target_type,
      targetId: row.target_id,
      score: row.score,
      riskLevel: row.risk_level,
      findings: row.findings ?? [],
      status: row.status,
      createdAt: row.created_at,
    };
  }
}