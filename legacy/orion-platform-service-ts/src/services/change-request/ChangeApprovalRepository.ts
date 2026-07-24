/**
 * ChangeApprovalRepository - Multi-level approval chain data access layer
 *
 * Manages approval records for RFC change requests.
 */

import { BaseRepository } from '../../db/base-repository';

export interface ChangeApprovalEntity {
  id: string;
  tenantId: string;
  changeRequestId: string;
  approverRole: string; // supervisor/manager/cto
  approverId: string | null;
  approvalOrder: number;
  status: string; // pending/approved/rejected
  comment: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export class ChangeApprovalRepository extends BaseRepository<ChangeApprovalEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'change_approval');
  }

  async listByChange(changeRequestId: string): Promise<ChangeApprovalEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_approval WHERE change_request_id = $1 ORDER BY approval_order ASC`,
      [changeRequestId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async getNextPending(changeRequestId: string): Promise<ChangeApprovalEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM change_approval WHERE change_request_id = $1 AND status = 'pending' ORDER BY approval_order ASC LIMIT 1`,
      [changeRequestId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async approve(id: string, approverId: string, comment?: string): Promise<ChangeApprovalEntity | undefined> {
    const result = await this.db.query(
      `UPDATE change_approval SET status = 'approved', approver_id = $1, comment = $2, decided_at = NOW() WHERE id = $3 RETURNING *`,
      [approverId, comment ?? null, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async reject(id: string, approverId: string, comment?: string): Promise<ChangeApprovalEntity | undefined> {
    const result = await this.db.query(
      `UPDATE change_approval SET status = 'rejected', approver_id = $1, comment = $2, decided_at = NOW() WHERE id = $3 RETURNING *`,
      [approverId, comment ?? null, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async countByStatus(changeRequestId: string, status: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM change_approval WHERE change_request_id = $1 AND status = $2`,
      [changeRequestId, status],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async areAllApproved(changeRequestId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'approved') as approved FROM change_approval WHERE change_request_id = $1`,
      [changeRequestId],
    );
    const total = parseInt(result.rows[0].total, 10);
    const approved = parseInt(result.rows[0].approved, 10);
    return total > 0 && total === approved;
  }

  protected mapRowToEntity(row: any): ChangeApprovalEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      changeRequestId: row.change_request_id,
      approverRole: row.approver_role,
      approverId: row.approver_id ?? null,
      approvalOrder: row.approval_order,
      status: row.status ?? 'pending',
      comment: row.comment ?? null,
      decidedAt: row.decided_at ?? null,
      createdAt: row.created_at,
    };
  }
}
