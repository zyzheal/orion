import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

export interface ComplianceRemediationActionEntity {
  id: string;
  tenantId: string;
  violationId: string;
  actionType: 'automated' | 'manual' | 'partial';
  actionTaken: string;
  result: Record<string, any>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  performedBy: string | null;
  performedAt: Date;
  completedAt: Date | null;
}

export class ComplianceRemediationActionRepository extends BaseRepository<ComplianceRemediationActionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'compliance_remediation_actions');
  }

  async findByViolationId(violationId: string): Promise<ComplianceRemediationActionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_remediation_actions WHERE violation_id = $1 ORDER BY performed_at DESC`,
      [violationId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<ComplianceRemediationActionEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async updateStatus(id: string, status: ComplianceRemediationActionEntity['status'], completedAt?: Date): Promise<ComplianceRemediationActionEntity | undefined> {
    const result = await this.db.query(
      `UPDATE compliance_remediation_actions SET status = $1, completed_at = $2 WHERE id = $3 RETURNING *`,
      [status, completedAt ?? null, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ComplianceRemediationActionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      violationId: row.violation_id,
      actionType: row.action_type,
      actionTaken: row.action_taken,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : (row.result ?? {}),
      status: row.status,
      performedBy: row.performed_by ?? null,
      performedAt: row.performed_at,
      completedAt: row.completed_at ?? null,
    };
  }
}
