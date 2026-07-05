import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

export interface ComplianceViolationEntity {
  id: string;
  tenantId: string;
  framework: 'SOC2' | 'ISO27001';
  controlId: string;
  controlName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'remediating' | 'resolved' | 'accepted';
  description: string;
  evidence: Record<string, any>;
  remediation: string | null;
  remediationAction: Record<string, any>;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ComplianceViolationRepository extends BaseRepository<ComplianceViolationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'compliance_violations');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<ComplianceViolationEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findByFramework(tenantId: string, framework: string): Promise<ComplianceViolationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_violations WHERE tenant_id = $1 AND framework = $2 ORDER BY created_at DESC`,
      [tenantId, framework],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByControlId(tenantId: string, controlId: string): Promise<ComplianceViolationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_violations WHERE tenant_id = $1 AND control_id = $2 ORDER BY created_at DESC`,
      [tenantId, controlId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findOpenByTenant(tenantId: string): Promise<ComplianceViolationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_violations WHERE tenant_id = $1 AND status = 'open' ORDER BY severity DESC, created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: ComplianceViolationEntity['status'], resolvedBy?: string): Promise<ComplianceViolationEntity | undefined> {
    const resolvedAt = (status === 'resolved' || status === 'accepted') ? new Date() : null;
    const result = await this.db.query(
      `UPDATE compliance_violations SET status = $1, resolved_at = $2, resolved_by = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
      [status, resolvedAt, resolvedBy || null, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateRemediation(id: string, remediation: string, action: Record<string, any>): Promise<ComplianceViolationEntity | undefined> {
    const result = await this.db.query(
      `UPDATE compliance_violations SET remediation = $1, remediation_action = $2, status = 'remediating', updated_at = NOW() WHERE id = $3 RETURNING *`,
      [remediation, JSON.stringify(action), id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ComplianceViolationEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      framework: row.framework,
      controlId: row.control_id,
      controlName: row.control_name,
      severity: row.severity,
      status: row.status,
      description: row.description,
      evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : (row.evidence ?? {}),
      remediation: row.remediation ?? null,
      remediationAction: typeof row.remediation_action === 'string' ? JSON.parse(row.remediation_action) : (row.remediation_action ?? {}),
      resolvedAt: row.resolved_at ?? null,
      resolvedBy: row.resolved_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
