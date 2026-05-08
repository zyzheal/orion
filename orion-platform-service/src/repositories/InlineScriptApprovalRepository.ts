/**
 * InlineScriptApprovalRepository
 * 内联脚本审批数据访问层
 */

import { BaseRepository } from '../db/base-repository';

export interface InlineScriptApprovalEntity {
  id: string;
  approval_id: string;
  tenant_id: string;
  user_id: string;
  script_code_hash: string;
  script_language: string;
  permissions: Record<string, unknown>;
  reason: string;
  status: string;
  required_approvals: number;
  current_approvals: number;
  expiration_type: string;
  expires_at: Date | null;
  used_count: number;
  max_uses: number;
  created_at: Date;
  updated_at: Date;
}

export class InlineScriptApprovalRepository extends BaseRepository<InlineScriptApprovalEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'inline_script_approvals');
  }

  /**
   * Find approval by approval_id (unique business key)
   */
  async findByApprovalId(approvalId: string): Promise<InlineScriptApprovalEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM inline_script_approvals WHERE approval_id = $1`,
      [approvalId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update approval status
   */
  async updateStatus(
    approvalId: string,
    status: string,
    currentApprovals?: number,
  ): Promise<InlineScriptApprovalEntity> {
    const result = await this.db.query(
      `UPDATE inline_script_approvals
       SET status = $1, current_approvals = COALESCE($2, current_approvals), updated_at = NOW()
       WHERE approval_id = $3
       RETURNING *`,
      [status, currentApprovals, approvalId],
    );
    if (result.rows.length === 0) {
      throw new Error(`Approval with approval_id ${approvalId} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find approvals by tenant
   */
  async findByTenantId(tenantId: string): Promise<InlineScriptApprovalEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM inline_script_approvals WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find expired approvals with given status
   */
  async findExpired(status: string): Promise<InlineScriptApprovalEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM inline_script_approvals WHERE status = $1 AND expires_at < NOW()`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): InlineScriptApprovalEntity {
    return {
      id: row.id,
      approval_id: row.approval_id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      script_code_hash: row.script_code_hash,
      script_language: row.script_language,
      permissions: row.permissions ?? {},
      reason: row.reason,
      status: row.status,
      required_approvals: row.required_approvals ?? 2,
      current_approvals: row.current_approvals ?? 0,
      expiration_type: row.expiration_type ?? 'single_use',
      expires_at: row.expires_at ?? null,
      used_count: row.used_count ?? 0,
      max_uses: row.max_uses ?? 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
