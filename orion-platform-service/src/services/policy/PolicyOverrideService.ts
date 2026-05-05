/**
 * PolicyOverrideService - Policy override persistence for gate bypass
 *
 * Handles creation, retrieval, revocation, and cleanup of policy overrides.
 * Allows temporary bypass of quality gates with audit trail.
 * Uses Map-based in-memory storage.
 */

export interface PolicyOverrideInput {
  policyId: string;
  pipelineId?: string;
  runId?: string;
  reason: string;
  approvedBy: string;
  expiresAt?: Date;
}

export interface PolicyOverride {
  id: string;
  tenantId: string;
  policyId: string;
  pipelineId?: string;
  runId?: string;
  reason: string;
  approvedBy: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
}

export interface UpdateOverrideInput {
  reason?: string;
  expiresAt?: Date;
}

export class PolicyOverrideServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PolicyOverrideServiceError';
  }
}

export class PolicyOverrideService {
  private overrides: Map<string, PolicyOverride> = new Map();
  private counter = 0;

  // ==================== Create Override ====================

  /**
   * Create a new policy override
   */
  async createOverride(tenantId: string, input: PolicyOverrideInput): Promise<PolicyOverride> {
    if (!tenantId) {
      throw new PolicyOverrideServiceError('Tenant ID required', 'INVALID_INPUT');
    }
    if (!input.policyId || !input.reason || !input.approvedBy) {
      throw new PolicyOverrideServiceError(
        'policyId, reason, and approvedBy are required',
        'INVALID_INPUT'
      );
    }

    const now = new Date();
    const override: PolicyOverride = {
      id: this.generateId('override'),
      tenantId,
      policyId: input.policyId,
      pipelineId: input.pipelineId,
      runId: input.runId,
      reason: input.reason,
      approvedBy: input.approvedBy,
      status: 'active',
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    this.overrides.set(override.id, override);
    return override;
  }

  // ==================== Get Overrides ====================

  /**
   * Get active overrides for a tenant
   */
  async getActiveOverrides(tenantId: string): Promise<PolicyOverride[]> {
    const results: PolicyOverride[] = [];
    for (const override of this.overrides.values()) {
      if (override.tenantId === tenantId && override.status === 'active') {
        // Check if expired
        if (override.expiresAt && override.expiresAt < new Date()) {
          override.status = 'expired';
          override.updatedAt = new Date();
          this.overrides.set(override.id, override);
          continue;
        }
        results.push(override);
      }
    }
    return results;
  }

  /**
   * Get all overrides for a tenant (including revoked/expired)
   */
  async getAllOverrides(tenantId: string): Promise<PolicyOverride[]> {
    const results: PolicyOverride[] = [];
    for (const override of this.overrides.values()) {
      if (override.tenantId === tenantId) {
        results.push(override);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a single override by ID
   */
  async getOverrideById(overrideId: string): Promise<PolicyOverride | null> {
    return this.overrides.get(overrideId) ?? null;
  }

  /**
   * Check if a policy is currently overridden for a tenant
   */
  async isOverridden(tenantId: string, policyId: string): Promise<boolean> {
    for (const override of this.overrides.values()) {
      if (
        override.tenantId === tenantId &&
        override.policyId === policyId &&
        override.status === 'active'
      ) {
        if (override.expiresAt && override.expiresAt < new Date()) {
          override.status = 'expired';
          override.updatedAt = new Date();
          this.overrides.set(override.id, override);
          continue;
        }
        return true;
      }
    }
    return false;
  }

  // ==================== Revoke Override ====================

  /**
   * Revoke an active override
   */
  async revokeOverride(overrideId: string, revokedBy: string): Promise<PolicyOverride> {
    const override = this.overrides.get(overrideId);
    if (!override) {
      throw new PolicyOverrideServiceError(
        `Override not found: ${overrideId}`,
        'OVERRIDE_NOT_FOUND'
      );
    }

    if (override.status !== 'active') {
      throw new PolicyOverrideServiceError(
        `Override is already ${override.status}`,
        'OVERRIDE_NOT_ACTIVE'
      );
    }

    override.status = 'revoked';
    override.revokedBy = revokedBy;
    override.revokedAt = new Date();
    override.updatedAt = new Date();
    this.overrides.set(overrideId, override);
    return override;
  }

  // ==================== Update Override ====================

  /**
   * Update an active override's reason or expiration
   */
  async updateOverride(overrideId: string, input: UpdateOverrideInput): Promise<PolicyOverride> {
    const override = this.overrides.get(overrideId);
    if (!override) {
      throw new PolicyOverrideServiceError(
        `Override not found: ${overrideId}`,
        'OVERRIDE_NOT_FOUND'
      );
    }

    if (override.status !== 'active') {
      throw new PolicyOverrideServiceError(
        `Cannot update override that is ${override.status}`,
        'OVERRIDE_NOT_ACTIVE'
      );
    }

    if (!input.reason && input.expiresAt === undefined) {
      throw new PolicyOverrideServiceError(
        'At least one of reason or expiresAt is required',
        'INVALID_INPUT'
      );
    }

    if (input.reason !== undefined) {
      override.reason = input.reason;
    }
    if (input.expiresAt !== undefined) {
      override.expiresAt = input.expiresAt;
    }
    override.updatedAt = new Date();
    this.overrides.set(overrideId, override);
    return override;
  }

  // ==================== Cleanup ====================

  /**
   * Clean up expired overrides
   * Returns the count of overrides that were marked as expired
   */
  async cleanupExpiredOverrides(): Promise<number> {
    let count = 0;
    const now = new Date();

    for (const [id, override] of this.overrides.entries()) {
      if (override.status === 'active' && override.expiresAt && override.expiresAt < now) {
        override.status = 'expired';
        override.updatedAt = now;
        this.overrides.set(id, override);
        count += 1;
      }
    }

    return count;
  }

  // ==================== Internal Helpers ====================

  private generateId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${Date.now()}-${this.counter}`;
  }
}
