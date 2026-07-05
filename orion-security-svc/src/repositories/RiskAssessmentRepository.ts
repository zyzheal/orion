/**
 * Risk Assessment Repository - PostgreSQL data access layer
 */

import type { RiskAssessmentEntity } from '../types/security';

interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

export type { RiskAssessmentEntity };

export class RiskAssessmentRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<RiskAssessmentEntity | undefined> {
    const result = await this.db.query('SELECT * FROM risk_assessments WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async findByTarget(targetType: string, targetId: string): Promise<RiskAssessmentEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM risk_assessments WHERE resource_type = $1 AND resource_id = $2 ORDER BY assessed_at DESC',
      [targetType, targetId]
    );
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findByTenant(tenantId: string, options?: { limit?: number }): Promise<RiskAssessmentEntity[]> {
    const limit = options?.limit || 20;
    const result = await this.db.query(
      'SELECT * FROM risk_assessments WHERE tenant_id = $1 ORDER BY assessed_at DESC LIMIT $2',
      [tenantId, limit]
    );
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findAll(options?: { limit?: number }): Promise<{ entities: RiskAssessmentEntity[]; total: number }> {
    const limit = options?.limit || 20;
    const countResult = await this.db.query('SELECT COUNT(*) FROM risk_assessments');
    const total = parseInt(countResult.rows[0]?.count || '0', 10);
    const dataResult = await this.db.query(
      'SELECT * FROM risk_assessments ORDER BY assessed_at DESC LIMIT $1',
      [limit]
    );
    return {
      entities: dataResult.rows.map((row: any) => this.mapRow(row)),
      total,
    };
  }

  async create(data: Omit<RiskAssessmentEntity, 'id'> & { id?: string }): Promise<RiskAssessmentEntity> {
    const id = data.id || `risk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const result = await this.db.query(
      `INSERT INTO risk_assessments (id, tenant_id, resource_type, resource_id, risk_score, risk_level, factors, assessed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, data.tenantId, data.targetType, data.targetId, data.score || 0, data.riskLevel || 'minimal', data.findings ? JSON.stringify(data.findings) : null, data.createdAt || new Date()]
    );
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: any): RiskAssessmentEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.resource_name || row.resource_type,
      type: row.resource_type,
      targetType: row.resource_type,
      targetId: row.resource_id,
      score: row.risk_score || undefined,
      riskLevel: row.risk_level || undefined,
      findings: row.factors ? (typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors) : undefined,
      status: row.status || 'active',
      createdAt: row.assessed_at,
    };
  }
}
