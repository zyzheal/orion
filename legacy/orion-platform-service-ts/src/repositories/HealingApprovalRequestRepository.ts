import { BaseRepository } from '../db/base-repository';

export interface HealingApprovalRequestEntity {
  id: string;
  incidentId: string;
  title: string | null;
  description: string | null;
  riskLevel: string | null;
  recommendedActions: any[];
  status: string;
  requestedBy: string | null;
  requestedAt: Date;
  expiresAt: Date | null;
  approvedBy: string | null;
  approvalReason: string | null;
  respondedAt: Date | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class HealingApprovalRequestRepository extends BaseRepository<HealingApprovalRequestEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'healing_approval_requests');
  }

  async findByStatus(status: string, limit: number = 100): Promise<HealingApprovalRequestEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM healing_approval_requests WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
      [status, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByIncident(incidentId: string): Promise<HealingApprovalRequestEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM healing_approval_requests WHERE incident_id = $1 ORDER BY created_at DESC`,
      [incidentId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, approvedBy?: string, reason?: string): Promise<HealingApprovalRequestEntity> {
    const result = await this.db.query(
      `UPDATE healing_approval_requests SET status = $1, approved_by = $2, approval_reason = $3, responded_at = NOW(), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [status, approvedBy || null, reason || null, id],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): HealingApprovalRequestEntity {
    return {
      id: row.id,
      incidentId: row.incident_id,
      title: row.title,
      description: row.description,
      riskLevel: row.risk_level,
      recommendedActions: typeof row.recommended_actions === 'string' ? JSON.parse(row.recommended_actions) : (row.recommended_actions || []),
      status: row.status,
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      expiresAt: row.expires_at,
      approvedBy: row.approved_by,
      approvalReason: row.approval_reason,
      respondedAt: row.responded_at,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
