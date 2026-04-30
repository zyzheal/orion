import { BaseRepository } from '../db/base-repository';

export interface ApprovalEntity {
  id: string;
  tenantId: string;
  definitionId: string | null;
  resourceType: string;
  resourceId: string;
  title: string | null;
  status: string;
  requestedBy: string | null;
  currentStep: number;
  totalSteps: number;
  requiredApprovals: number;
  result: Record<string, any> | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ApprovalStepEntity {
  id: string;
  approvalId: string;
  stepIndex: number;
  approverId: string | null;
  status: string;
  comment: string | null;
  actedAt: Date | null;
}

export class ApprovalRepository extends BaseRepository<ApprovalEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'approvals');
  }

  async findByTenant(tenantId: string, options?: { status?: string; limit?: number }): Promise<ApprovalEntity[]> {
    let query = `SELECT * FROM approvals WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    if (options?.status) {
      query += ` AND status = $2`;
      params.push(options.status);
    }
    query += ` ORDER BY created_at DESC`;
    if (options?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByResource(resourceType: string, resourceId: string): Promise<ApprovalEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM approvals WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at DESC`,
      [resourceType, resourceId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findPendingByTenant(tenantId: string): Promise<ApprovalEntity[]> {
    return this.findByTenant(tenantId, { status: 'pending' });
  }

  async updateStatus(id: string, status: string, completedAt?: Date): Promise<ApprovalEntity | null> {
    const result = await this.db.query(
      `UPDATE approvals SET status = $1, completed_at = $2, current_step = CASE WHEN $1 = 'approved' THEN total_steps ELSE current_step END WHERE id = $3 RETURNING *`,
      [status, completedAt ?? (status === 'approved' || status === 'rejected' ? new Date() : null), id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async advanceStep(id: string): Promise<ApprovalEntity | null> {
    const result = await this.db.query(
      `UPDATE approvals SET current_step = current_step + 1 WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  // Approval Steps methods
  async createStep(step: Omit<ApprovalStepEntity, 'id'>): Promise<ApprovalStepEntity> {
    const result = await this.db.query(
      `INSERT INTO approval_steps (approval_id, step_index, approver_id, status) VALUES ($1, $2, $3, $4) RETURNING *`,
      [step.approvalId, step.stepIndex, step.approverId, step.status ?? 'pending'],
    );
    return this.mapStepRowToEntity(result.rows[0]);
  }

  async findStepsByApproval(approvalId: string): Promise<ApprovalStepEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM approval_steps WHERE approval_id = $1 ORDER BY step_index`,
      [approvalId],
    );
    return result.rows.map(row => this.mapStepRowToEntity(row));
  }

  async updateStepStatus(stepId: string, status: string, comment?: string, actedAt?: Date): Promise<ApprovalStepEntity | null> {
    const result = await this.db.query(
      `UPDATE approval_steps SET status = $1, comment = $2, acted_at = $3 WHERE id = $4 RETURNING *`,
      [status, comment ?? null, actedAt ?? (status !== 'pending' ? new Date() : null), stepId],
    );
    if (result.rows.length === 0) return null;
    return this.mapStepRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ApprovalEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      definitionId: row.definition_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      title: row.title,
      status: row.status ?? 'pending',
      requestedBy: row.requested_by,
      currentStep: row.current_step ?? 0,
      totalSteps: row.total_steps ?? 1,
      requiredApprovals: row.required_approvals ?? 1,
      result: row.result,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }

  protected mapStepRowToEntity(row: any): ApprovalStepEntity {
    return {
      id: row.id,
      approvalId: row.approval_id,
      stepIndex: row.step_index,
      approverId: row.approver_id,
      status: row.status ?? 'pending',
      comment: row.comment,
      actedAt: row.acted_at,
    };
  }
}