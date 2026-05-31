import { BaseRepository } from '../db/base-repository';

export interface ComplianceEvidenceEntity {
  id: string;
  tenantId: string;
  policyId: string;
  controlId: string;
  evidenceType: string;
  description: string | null;
  source: string | null;
  collectedAt: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ComplianceEvidenceRepository extends BaseRepository<ComplianceEvidenceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'compliance_evidence');
  }

  async findByPolicyId(policyId: string): Promise<ComplianceEvidenceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_evidence WHERE policy_id = $1 ORDER BY collected_at DESC`,
      [policyId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<ComplianceEvidenceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_evidence WHERE tenant_id = $1 ORDER BY collected_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ComplianceEvidenceEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      policyId: row.policy_id,
      controlId: row.control_id,
      evidenceType: row.evidence_type,
      description: row.description,
      source: row.source,
      collectedAt: row.collected_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
