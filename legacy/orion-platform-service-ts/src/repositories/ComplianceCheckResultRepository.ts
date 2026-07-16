import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

export interface ComplianceCheckResultEntity {
  id: string;
  tenantId: string;
  framework: 'SOC2' | 'ISO27001';
  controlId: string;
  controlName: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence: Record<string, any>;
  remediation: string | null;
  checkType: string;
  checkedAt: Date;
}

export class ComplianceCheckResultRepository extends BaseRepository<ComplianceCheckResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'compliance_check_results');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<ComplianceCheckResultEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findByFramework(tenantId: string, framework: string): Promise<ComplianceCheckResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_check_results WHERE tenant_id = $1 AND framework = $2 ORDER BY checked_at DESC`,
      [tenantId, framework],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findLatestByFramework(tenantId: string, framework: string): Promise<ComplianceCheckResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_check_results WHERE tenant_id = $1 AND framework = $2 ORDER BY checked_at DESC LIMIT 20`,
      [tenantId, framework],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ComplianceCheckResultEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      framework: row.framework,
      controlId: row.control_id,
      controlName: row.control_name,
      status: row.status,
      severity: row.severity,
      description: row.description,
      evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : (row.evidence ?? {}),
      remediation: row.remediation ?? null,
      checkType: row.check_type,
      checkedAt: row.checked_at,
    };
  }
}
