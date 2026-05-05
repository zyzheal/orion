/**
 * PolicyOverrideRepository - PostgreSQL persistence for Policy Overrides
 *
 * Replaces the in-memory Map() storage for policy_overrides.
 * Extends BaseRepository for common CRUD operations.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

export interface PolicyOverrideEntity {
  id: string;
  policyId: string | null;
  violationId: string | null;
  reason: string;
  approvedBy: string | null;
  approvedAt: Date;
  expiresAt: Date;
  scope: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyOverrideCreateInput {
  id?: string;
  policyId?: string | null;
  violationId?: string | null;
  reason: string;
  approvedBy?: string | null;
  approvedAt?: Date;
  expiresAt: Date;
  scope?: string;
}

export class PolicyOverrideRepository extends BaseRepository<PolicyOverrideEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'policy_overrides');
  }

  /**
   * Create a new policy override
   */
  async create(input: PolicyOverrideCreateInput): Promise<PolicyOverrideEntity> {
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO policy_overrides (id, policy_id, violation_id, reason, approved_by, approved_at, expires_at, scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        input.id || this.generateId(),
        input.policyId || null,
        input.violationId || null,
        input.reason,
        input.approvedBy || null,
        input.approvedAt || now,
        input.expiresAt,
        input.scope || 'global',
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find active overrides (not yet expired) for a given policy
   */
  async findActiveByPolicyId(policyId: string): Promise<PolicyOverrideEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM policy_overrides WHERE policy_id = $1 AND expires_at > NOW() ORDER BY approved_at DESC`,
      [policyId],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Find active overrides for a given violation
   */
  async findActiveByViolationId(violationId: string): Promise<PolicyOverrideEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM policy_overrides WHERE violation_id = $1 AND expires_at > NOW() ORDER BY approved_at DESC`,
      [violationId],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Find all overrides with pagination and filtering
   */
  async findAllWithOptions(options: {
    policyId?: string;
    violationId?: string;
    expired?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<FindAllResult<PolicyOverrideEntity>> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    let query = 'SELECT * FROM policy_overrides WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options.policyId) {
      query += ` AND policy_id = $${paramIndex}`;
      params.push(options.policyId);
      paramIndex++;
    }
    if (options.violationId) {
      query += ` AND violation_id = $${paramIndex}`;
      params.push(options.violationId);
      paramIndex++;
    }
    if (options.expired === true) {
      query += ` AND expires_at <= NOW()`;
    } else if (options.expired === false) {
      query += ` AND expires_at > NOW()`;
    }

    query += ` ORDER BY approved_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    const countQuery = `SELECT COUNT(*) as count FROM policy_overrides WHERE 1=1` +
      query.slice(query.indexOf('WHERE 1=1'), query.indexOf(' ORDER BY'));
    const countResult = await this.db.query(countQuery, params.slice(0, -2));

    return {
      entities: result.rows.map((row: any) => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Clean up expired overrides (delete rows past expiration)
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM policy_overrides WHERE expires_at <= NOW()`,
    );
    return result.rowCount ?? 0;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  protected mapRowToEntity(row: any): PolicyOverrideEntity {
    return {
      id: row.id,
      policyId: row.policy_id,
      violationId: row.violation_id,
      reason: row.reason,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      expiresAt: row.expires_at,
      scope: row.scope,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
