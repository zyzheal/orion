/**
 * ExemptionService - 质量门禁豁免机制
 *
 * Manages the full lifecycle of policy violation exemptions:
 * submit → review (approve/reject) → revoke → expire cleanup.
 *
 * Uses PostgreSQL directly via query() for policy_exemptions table.
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';

export type ExemptionCategory = 'business-urgency' | 'tech-debt' | 'false-positive' | 'temporary';
export type ExemptionStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
export type ExemptionAction = 'approve' | 'reject';

export interface ApprovalChainEntry {
  approver: string;
  action: string;
  comment?: string;
  reviewedAt: Date;
}

export interface Exemption {
  id: string;
  violationId: string;
  policyId: string;
  runId: string;
  reason: string;
  category: ExemptionCategory;
  requestedBy: string;
  status: ExemptionStatus;
  expiresAt: Date;
  approvalChain: ApprovalChainEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExemptionCreateInput {
  violationId: string;
  policyId: string;
  runId: string;
  reason: string;
  category: ExemptionCategory;
  requestedBy: string;
  expiresAt?: Date;
}

export interface ExemptionFilter {
  status?: ExemptionStatus;
  policyId?: string;
  requestedBy?: string;
  category?: ExemptionCategory;
  limit?: number;
  offset?: number;
}

export interface ExemptionReviewInput {
  action: ExemptionAction;
  comment?: string;
  reviewer: string;
}

export class ExemptionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExemptionServiceError';
  }
}

export class ExemptionService {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  /**
   * Submit a new exemption request
   */
  async submitExemption(input: ExemptionCreateInput): Promise<Exemption> {
    if (!input.violationId || !input.reason || !input.category || !input.requestedBy) {
      throw new ExemptionServiceError('violationId, reason, category, and requestedBy are required');
    }

    const id = uuidv4();
    const now = new Date();
    const expiresAt = input.expiresAt || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days default

    await this.db.query(
      `INSERT INTO policy_exemptions (
        id, violation_id, policy_id, run_id, reason, category,
        requested_by, status, expires_at, approval_chain, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        input.violationId,
        input.policyId,
        input.runId,
        input.reason,
        input.category,
        input.requestedBy,
        'pending',
        expiresAt,
        JSON.stringify([]),
        now,
        now,
      ],
    );

    return this.getExemptionById(id);
  }

  /**
   * Get exemptions with optional filtering
   */
  async getExemptions(filter: ExemptionFilter = {}): Promise<{ exemptions: Exemption[]; total: number }> {
    let query = 'SELECT * FROM policy_exemptions WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filter.status);
      paramIndex++;
    }
    if (filter.policyId) {
      query += ` AND policy_id = $${paramIndex}`;
      params.push(filter.policyId);
      paramIndex++;
    }
    if (filter.requestedBy) {
      query += ` AND requested_by = $${paramIndex}`;
      params.push(filter.requestedBy);
      paramIndex++;
    }
    if (filter.category) {
      query += ` AND category = $${paramIndex}`;
      params.push(filter.category);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const exemptions = result.rows.map((row: any) => this.mapRowToExemption(row));

    // Count total
    const countQuery = `SELECT COUNT(*) as count FROM policy_exemptions WHERE 1=1` +
      query.slice(query.indexOf('WHERE 1=1'), query.indexOf(' ORDER BY'));
    const countResult = await this.db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].count, 10);

    return { exemptions, total };
  }

  /**
   * Get exemption by ID
   */
  async getExemptionById(id: string): Promise<Exemption> {
    const result = await this.db.query(
      `SELECT * FROM policy_exemptions WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new ExemptionServiceError(`Exemption not found: ${id}`);
    }
    return this.mapRowToExemption(result.rows[0]);
  }

  /**
   * Review an exemption (approve or reject)
   */
  async reviewExemption(id: string, input: ExemptionReviewInput): Promise<Exemption> {
    if (!input.action || !input.reviewer) {
      throw new ExemptionServiceError('action and reviewer are required');
    }
    if (input.action !== 'approve' && input.action !== 'reject') {
      throw new ExemptionServiceError('action must be approve or reject');
    }

    const existing = await this.getExemptionById(id);
    if (existing.status !== 'pending') {
      throw new ExemptionServiceError(`Exemption ${id} is not pending (current: ${existing.status})`);
    }

    const entry: ApprovalChainEntry = {
      approver: input.reviewer,
      action: input.action,
      comment: input.comment,
      reviewedAt: new Date(),
    };

    const newChain = [...existing.approvalChain, entry];
    const newStatus: ExemptionStatus = input.action === 'approve' ? 'approved' : 'rejected';

    await this.db.query(
      `UPDATE policy_exemptions SET status = $1, approval_chain = $2, updated_at = NOW() WHERE id = $3`,
      [newStatus, JSON.stringify(newChain), id],
    );

    return this.getExemptionById(id);
  }

  /**
   * Revoke an approved exemption
   */
  async revokeExemption(id: string): Promise<Exemption> {
    const existing = await this.getExemptionById(id);
    if (existing.status !== 'approved') {
      throw new ExemptionServiceError(`Only approved exemptions can be revoked (current: ${existing.status})`);
    }

    await this.db.query(
      `UPDATE policy_exemptions SET status = 'revoked', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return this.getExemptionById(id);
  }

  /**
   * Auto-expire exemptions past their expiration date
   */
  async expireExemptions(): Promise<number> {
    const result = await this.db.query(
      `UPDATE policy_exemptions
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'approved' AND expires_at <= NOW()`,
    );
    return result.rowCount ?? 0;
  }

  /**
   * Check if a violation has an active exemption
   */
  async hasActiveExemption(violationId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM policy_exemptions
       WHERE violation_id = $1 AND status = 'approved' AND expires_at > NOW()`,
      [violationId],
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }

  private mapRowToExemption(row: any): Exemption {
    let approvalChain: ApprovalChainEntry[] = [];
    if (row.approval_chain) {
      const raw = typeof row.approval_chain === 'string' ? JSON.parse(row.approval_chain) : row.approval_chain;
      approvalChain = raw.map((entry: any) => ({
        approver: entry.approver,
        action: entry.action,
        comment: entry.comment,
        reviewedAt: new Date(entry.reviewedAt),
      }));
    }

    return {
      id: row.id,
      violationId: row.violation_id,
      policyId: row.policy_id,
      runId: row.run_id,
      reason: row.reason,
      category: row.category,
      requestedBy: row.requested_by,
      status: row.status,
      expiresAt: row.expires_at,
      approvalChain,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
