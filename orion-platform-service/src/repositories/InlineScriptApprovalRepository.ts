/**
 * InlineScriptApprovalRepository
 * 内联脚本审批数据访问层
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

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
   * Find approval by approval_id (unique business key) with tenant isolation
   */
  async findByApprovalId(approvalId: string, tenantId: string): Promise<InlineScriptApprovalEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM inline_script_approvals WHERE approval_id = $1 AND tenant_id = $2`,
      [approvalId, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Atomically increment approvals and update status. Prevents race conditions
   * from concurrent approval decisions.
   */
  async incrementApprovals(
    approvalId: string,
    tenantId: string,
  ): Promise<{ status: string; currentApprovals: number; requiredApprovals: number }> {
    const result = await this.db.query(
      `UPDATE inline_script_approvals
       SET current_approvals = current_approvals + 1,
           status = CASE WHEN current_approvals + 1 >= required_approvals THEN 'approved' ELSE status END,
           updated_at = NOW()
       WHERE approval_id = $1 AND tenant_id = $2 AND status = 'pending'
       RETURNING status, current_approvals, required_approvals`,
      [approvalId, tenantId]
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Approval not found or no longer pending: ${approvalId}`);
    }
    return {
      status: result.rows[0].status,
      currentApprovals: result.rows[0].current_approvals,
      requiredApprovals: result.rows[0].required_approvals,
    };
  }

  /**
   * Atomically update usage count for single_use approvals
   */
  async updateUsageCount(
    approvalId: string,
    tenantId: string,
    newCount: number,
  ): Promise<void> {
    await this.db.query(
      `UPDATE inline_script_approvals
       SET used_count = $1, updated_at = NOW()
       WHERE approval_id = $2 AND tenant_id = $3`,
      [newCount, approvalId, tenantId]
    );
  }

  /**
   * Update approval status with tenant isolation
   */
  async updateStatus(
    approvalId: string,
    tenantId: string,
    status: string,
    currentApprovals?: number,
  ): Promise<InlineScriptApprovalEntity> {
    const result = await this.db.query(
      `UPDATE inline_script_approvals
       SET status = $1, current_approvals = COALESCE($2, current_approvals), updated_at = NOW()
       WHERE approval_id = $3 AND tenant_id = $4
       RETURNING *`,
      [status, currentApprovals, approvalId, tenantId],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Approval with approval_id ${approvalId} not found for tenant`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create a new approval record
   */
  async createApproval(data: {
    approvalId: string;
    tenantId: string;
    userId: string;
    scriptCodeHash: string;
    scriptLanguage: string;
    permissions: Record<string, any>;
    reason: string;
    expirationType: string;
    expiresAt: Date;
  }): Promise<InlineScriptApprovalEntity> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const result = await this.db.query(
      `INSERT INTO inline_script_approvals
        (id, approval_id, tenant_id, user_id, script_code_hash, script_language, permissions, reason,
         status, required_approvals, current_approvals, expiration_type, expires_at, used_count, max_uses, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
       RETURNING *`,
      [
        id,
        data.approvalId,
        data.tenantId,
        data.userId,
        data.scriptCodeHash,
        data.scriptLanguage,
        JSON.stringify(data.permissions),
        data.reason,
        'pending',
        2,
        0,
        data.expirationType,
        data.expiresAt,
        0,
        1,
      ]
    );
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
