import { BaseRepository } from '../db/base-repository';

export interface KnowledgeBasePatternEntity {
  id: string;
  name: string;
  category: string;
  symptoms: string[];
  rootCauses: string[];
  indicators: any[];
  remediationSteps: any[];
  successRate: number;
  avgRecoveryTime: number;
  riskLevel: string;
  affectedComponents: string[];
  relatedPatterns: string[] | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class KnowledgeBasePatternRepository extends BaseRepository<KnowledgeBasePatternEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'knowledge_base_patterns');
  }

  async findByCategory(category: string, tenantId?: string): Promise<KnowledgeBasePatternEntity[]> {
    let query = `SELECT * FROM knowledge_base_patterns WHERE category = $1`;
    const params: any[] = [category];
    if (tenantId) {
      query += ` AND (tenant_id = $2 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    query += ` ORDER BY success_rate DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findBySymptoms(symptoms: string[], tenantId?: string): Promise<KnowledgeBasePatternEntity[]> {
    // Use JSONB containment to find patterns whose symptoms array contains any of the given symptoms
    let query = `SELECT * FROM knowledge_base_patterns WHERE symptoms::jsonb ?| $1`;
    const params: any[] = [symptoms];
    if (tenantId) {
      query += ` AND (tenant_id = $2 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    query += ` ORDER BY success_rate DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByAffectedComponent(component: string, tenantId?: string): Promise<KnowledgeBasePatternEntity[]> {
    let query = `SELECT * FROM knowledge_base_patterns WHERE affected_components::jsonb ? $1`;
    const params: any[] = [component];
    if (tenantId) {
      query += ` AND (tenant_id = $2 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    query += ` ORDER BY success_rate DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateSuccessRate(id: string, successRate: number, avgRecoveryTime: number): Promise<void> {
    await this.db.query(
      `UPDATE knowledge_base_patterns SET success_rate = $1, avg_recovery_time = $2, updated_at = NOW() WHERE id = $3`,
      [successRate, avgRecoveryTime, id],
    );
  }

  async countByCategory(tenantId?: string): Promise<Record<string, number>> {
    let query = `SELECT category, COUNT(*) as count FROM knowledge_base_patterns`;
    const params: any[] = [];
    if (tenantId) {
      query += ` WHERE (tenant_id = $1 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    query += ` GROUP BY category`;
    const result = await this.db.query(query, params);
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.category] = parseInt(row.count, 10);
    }
    return counts;
  }

  async totalSuccessRate(tenantId?: string): Promise<{ avgSuccessRate: number; avgRecoveryTime: number }> {
    let query = `SELECT AVG(success_rate) as avg_success_rate, AVG(avg_recovery_time) as avg_recovery_time FROM knowledge_base_patterns`;
    const params: any[] = [];
    if (tenantId) {
      query += ` WHERE (tenant_id = $1 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return {
      avgSuccessRate: parseFloat(result.rows[0].avg_success_rate) || 0,
      avgRecoveryTime: parseFloat(result.rows[0].avg_recovery_time) || 0,
    };
  }

  protected mapRowToEntity(row: any): KnowledgeBasePatternEntity {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      symptoms: typeof row.symptoms === 'string' ? JSON.parse(row.symptoms) : (row.symptoms || []),
      rootCauses: typeof row.root_causes === 'string' ? JSON.parse(row.root_causes) : (row.root_causes || []),
      indicators: typeof row.indicators === 'string' ? JSON.parse(row.indicators) : (row.indicators || []),
      remediationSteps: typeof row.remediation_steps === 'string' ? JSON.parse(row.remediation_steps) : (row.remediation_steps || []),
      successRate: parseFloat(row.success_rate) || 0,
      avgRecoveryTime: parseFloat(row.avg_recovery_time) || 0,
      riskLevel: row.risk_level,
      affectedComponents: typeof row.affected_components === 'string' ? JSON.parse(row.affected_components) : (row.affected_components || []),
      relatedPatterns: typeof row.related_patterns === 'string' ? JSON.parse(row.related_patterns) : row.related_patterns,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
