/**
 * PolicyViolationRepository - PostgreSQL persistence for Policy Violations
 *
 * Replaces the in-memory Map() storage for policy_violations.
 * Extends BaseRepository for common CRUD operations.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface PolicyViolationEntity {
  id: string;
  evaluation_id: string | null;
  policy_id: string | null;
  severity: string;
  message: string;
  resource_type: string | null;
  resource_id: string | null;
  status: string;
  created_at: Date;
}

export interface PolicyViolationCreateInput {
  id?: string;
  evaluationId?: string | null;
  policyId?: string | null;
  severity: string;
  message: string;
  resourceType?: string | null;
  resourceId?: string | null;
}

export class PolicyViolationRepository extends BaseRepository<PolicyViolationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'policy_violations');
  }

  /**
   * Create a new policy violation
   */
  async create(input: PolicyViolationCreateInput): Promise<PolicyViolationEntity> {
    const result = await this.db.query(
      `INSERT INTO policy_violations (id, evaluation_id, policy_id, severity, message, resource_type, resource_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.id || this.generateId(),
        input.evaluationId || null,
        input.policyId || null,
        input.severity,
        input.message,
        input.resourceType || null,
        input.resourceId || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find violations by status
   */
  async findByStatus(status: string): Promise<PolicyViolationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM policy_violations WHERE status = $1 ORDER BY created_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find violations by policy ID
   */
  async findByPolicyId(policyId: string): Promise<PolicyViolationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM policy_violations WHERE policy_id = $1 ORDER BY created_at DESC`,
      [policyId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find violation by ID
   */
  async findById(id: string): Promise<PolicyViolationEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM policy_violations WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update violation status
   */
  async updateStatus(id: string, status: string): Promise<PolicyViolationEntity | undefined> {
    const result = await this.db.query(
      `UPDATE policy_violations SET status = $2 WHERE id = $1 RETURNING *`,
      [id, status],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all violations with filtering
   */
  async findAllWithOptions(options: {
    status?: string;
    severity?: string;
    policyId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<FindAllResult<PolicyViolationEntity>> {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    let query = 'SELECT * FROM policy_violations WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }
    if (options.severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(options.severity);
      paramIndex++;
    }
    if (options.policyId) {
      query += ` AND policy_id = $${paramIndex}`;
      params.push(options.policyId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: result.rows.length,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  protected mapRowToEntity(row: any): PolicyViolationEntity {
    return {
      id: row.id,
      evaluation_id: row.evaluation_id,
      policy_id: row.policy_id,
      severity: row.severity,
      message: row.message,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      status: row.status ?? 'open',
      created_at: row.created_at,
    };
  }
}
