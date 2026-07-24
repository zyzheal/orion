/**
 * PolicyOverrideRepository - PostgreSQL persistence for Policy Override Service
 *
 * Replaces the in-memory Map() storage for the PolicyOverrideService.
 * Supports tenant-isolated policy overrides with lifecycle management
 * (active -> revoked/expired) and audit trail.
 *
 * Uses separate table (policy_overrides_v2) from the policy engine's
 * policy_overrides table since the service model differs significantly.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface PolicyOverrideEntity {
  id: string;
  tenantId: string;
  policyId: string;
  pipelineId?: string;
  runId?: string;
  violationId?: string;
  reason: string;
  approvedBy: string;
  approvedAt?: Date;
  status: 'active' | 'revoked' | 'expired';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
  scope?: string;
}

export interface CreatePolicyOverrideInput {
  id: string;
  tenantId: string;
  policyId: string;
  pipelineId?: string;
  runId?: string;
  violationId?: string;
  reason: string;
  approvedBy: string;
  approvedAt?: Date;
  status: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
  scope?: string;
}

export class PolicyOverrideRepository extends BaseRepository<PolicyOverrideEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'policy_overrides_v2');
  }

  /**
   * Find all active overrides for a tenant
   */
  async findActiveByTenant(tenantId: string): Promise<PolicyOverrideEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM policy_overrides_v2 WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all overrides for a tenant (including revoked/expired)
   */
  async findByTenant(tenantId: string): Promise<FindAllResult<PolicyOverrideEntity>> {
    const result = await this.db.query(
      `SELECT * FROM policy_overrides_v2 WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    const entities = result.rows.map(row => this.mapRowToEntity(row));
    return { entities, total: entities.length };
  }

  /**
   * Find active override for a specific tenant+policy combination
   */
  async findActiveByTenantAndPolicy(tenantId: string, policyId: string): Promise<PolicyOverrideEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM policy_overrides_v2 WHERE tenant_id = $1 AND policy_id = $2 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [tenantId, policyId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create a new override with full input object
   */
  async createOverride(input: CreatePolicyOverrideInput): Promise<PolicyOverrideEntity> {
    const result = await this.db.query(
      `INSERT INTO policy_overrides_v2 (id, tenant_id, policy_id, pipeline_id, run_id, violation_id, reason, approved_by, approved_at, status, expires_at, created_at, updated_at, revoked_at, revoked_by, scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [input.id, input.tenantId, input.policyId, input.pipelineId || null, input.runId || null, input.violationId || null, input.reason, input.approvedBy, input.approvedAt || null, input.status, input.expiresAt || null, input.createdAt, input.updatedAt, input.revokedAt || null, input.revokedBy || null, input.scope || null],
    );
    if (result.rows.length === 0) {
      // Fallback for mock/test environments where RETURNING * may not work
      return {
        id: input.id,
        tenantId: input.tenantId,
        policyId: input.policyId,
        pipelineId: input.pipelineId,
        runId: input.runId,
        violationId: input.violationId,
        reason: input.reason,
        approvedBy: input.approvedBy,
        approvedAt: input.approvedAt,
        status: input.status as 'active' | 'revoked' | 'expired',
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        revokedAt: input.revokedAt,
        revokedBy: input.revokedBy,
        scope: input.scope,
      };
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update override fields (custom method for partial updates)
   */
  async updateOverride(id: string, updates: {
    reason?: string;
    expiresAt?: Date;
    status?: string;
    revokedAt?: Date;
    revokedBy?: string;
    updatedAt?: Date;
  }): Promise<PolicyOverrideEntity | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      reason: 'reason',
      expiresAt: 'expires_at',
      status: 'status',
      revokedAt: 'revoked_at',
      revokedBy: 'revoked_by',
      updatedAt: 'updated_at',
    };

    for (const [field, dbField] of Object.entries(fieldMap)) {
      if (updates[field as keyof typeof updates] !== undefined) {
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(updates[field as keyof typeof updates]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      const found = await this.findById(id);
      return found ?? undefined;
    }

    values.push(id);
    const result = await this.db.query(
      `UPDATE policy_overrides_v2 SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Mark expired overrides (where expires_at < now and status = 'active')
   * Returns the count of overrides that were marked as expired
   */
  async markExpired(now: Date): Promise<number> {
    const result = await this.db.query(
      `UPDATE policy_overrides_v2 SET status = 'expired', updated_at = $1 WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < $1`,
      [now],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): PolicyOverrideEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      policyId: row.policy_id,
      pipelineId: row.pipeline_id,
      runId: row.run_id,
      violationId: row.violation_id,
      reason: row.reason,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      status: row.status ?? 'active',
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revokedAt: row.revoked_at,
      revokedBy: row.revoked_by,
      scope: row.scope,
    };
  }
}
