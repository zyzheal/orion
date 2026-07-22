import { DatabasePool } from '../database';
/**
 * ApprovalRepository - Database layer for Approval operations
 */

export interface Approval {
  id: string;
  tenant_id: string;
  type: string;
  target_id: string;
  status: string;
  requested_by: string;
  approved_by: string | null;
  created_at: Date;
}

export class ApprovalRepository {
  constructor(private pool: DatabasePool) {}

  async create(tenantId: string, type: string, targetId: string, requestedBy: string): Promise<Approval> {
    const result = await this.pool.query(
      'INSERT INTO approvals (tenant_id, type, target_id, status, requested_by) VALUES ($1, $2, $3, \'pending\', $4) RETURNING *',
      [tenantId, type, targetId, requestedBy]
    );
    return result.rows[0];
  }

  async findAll(tenantId: string, status?: string): Promise<Approval[]> {
    let query = 'SELECT * FROM approvals WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    if (status) { params.push(status); query += ' AND status = $2'; }
    return (await this.pool.query(query + ' ORDER BY created_at DESC', params)).rows;
  }

  async approve(id: string, approvedBy: string): Promise<Approval | null> {
    return (await this.pool.query(
      "UPDATE approvals SET status = 'approved', approved_by = $1 WHERE id = $2 RETURNING *",
      [approvedBy, id]
    )).rows[0] || null;
  }

  async reject(id: string, approvedBy: string): Promise<Approval | null> {
    return (await this.pool.query(
      "UPDATE approvals SET status = 'rejected', approved_by = $1 WHERE id = $2 RETURNING *",
      [approvedBy, id]
    )).rows[0] || null;
  }
}