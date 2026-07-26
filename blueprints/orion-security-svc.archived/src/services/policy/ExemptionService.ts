/**
 * ExemptionService - Policy Exemption Management
 *
 * Handles submission, review, approval, and revocation of policy exemptions.
 */

import { DatabasePool } from '../../utils/database';

export interface ExemptionRequest {
  violationId: string;
  policyId?: string;
  runId?: string;
  reason: string;
  category: string;
  requestedBy: string;
  expiresAt?: Date;
}

export interface ExemptionReview {
  action: 'approve' | 'reject';
  comment?: string;
  reviewer: string;
}

export interface Exemption {
  id: string;
  violationId: string;
  policyId: string;
  runId?: string;
  reason: string;
  category: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';
  requestedAt: Date;
  expiresAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  comment?: string;
}

export class ExemptionService {
  constructor(private db: DatabasePool) {}

  async submitExemption(req: ExemptionRequest): Promise<Exemption> {
    if (!req.reason || !req.category || !req.requestedBy) {
      throw Object.assign(new Error('reason, category, and requestedBy are required'), { code: 'INVALID_INPUT' });
    }

    const result = await this.db.query(
      `INSERT INTO policy_exemptions (id, violation_id, policy_id, run_id, reason, category, requested_by, status, requested_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), $8)
       RETURNING *`,
      [
        generateId(),
        req.violationId,
        req.policyId || null,
        req.runId || null,
        req.reason,
        req.category,
        req.requestedBy,
        req.expiresAt || null,
      ]
    );

    return mapRowToExemption(result.rows[0]);
  }

  async getExemptions(filters?: {
    status?: string;
    policyId?: string;
    requestedBy?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ exemptions: Exemption[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) { conditions.push(`status = $${paramIndex}`); params.push(filters.status); paramIndex++; }
    if (filters?.policyId) { conditions.push(`policy_id = $${paramIndex}`); params.push(filters.policyId); paramIndex++; }
    if (filters?.requestedBy) { conditions.push(`requested_by = $${paramIndex}`); params.push(filters.requestedBy); paramIndex++; }
    if (filters?.category) { conditions.push(`category = $${paramIndex}`); params.push(filters.category); paramIndex++; }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const [countResult, dataResult] = await Promise.all([
      this.db.query(`SELECT COUNT(*) FROM policy_exemptions ${whereClause}`, params),
      this.db.query(
        `SELECT * FROM policy_exemptions ${whereClause} ORDER BY requested_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
    ]);

    return {
      exemptions: dataResult.rows.map(mapRowToExemption),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async getExemptionById(id: string): Promise<Exemption> {
    const result = await this.db.query('SELECT * FROM policy_exemptions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw Object.assign(new Error('Exemption not found'), { code: 'NOT_FOUND' });
    }
    return mapRowToExemption(result.rows[0]);
  }

  async reviewExemption(id: string, review: ExemptionReview): Promise<Exemption> {
    const existing = await this.getExemptionById(id);
    if (existing.status !== 'pending') {
      throw Object.assign(new Error('Exemption is not in pending state'), { code: 'INVALID_STATE' });
    }

    const result = await this.db.query(
      `UPDATE policy_exemptions SET status = $1, reviewed_by = $2, reviewed_at = NOW(), comment = $3
       WHERE id = $4 RETURNING *`,
      [review.action === 'approve' ? 'approved' : 'rejected', review.reviewer, review.comment || null, id]
    );

    return mapRowToExemption(result.rows[0]);
  }

  async revokeExemption(id: string): Promise<Exemption> {
    const existing = await this.getExemptionById(id);
    if (existing.status === 'revoked') {
      throw Object.assign(new Error('Exemption is already revoked'), { code: 'INVALID_STATE' });
    }

    const result = await this.db.query(
      `UPDATE policy_exemptions SET status = 'revoked', reviewed_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    return mapRowToExemption(result.rows[0]);
  }
}

function generateId(): string {
  return `exm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapRowToExemption(row: any): Exemption {
  return {
    id: row.id,
    violationId: row.violation_id,
    policyId: row.policy_id,
    runId: row.run_id,
    reason: row.reason,
    category: row.category,
    requestedBy: row.requested_by,
    status: row.status,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    comment: row.comment,
  };
}
