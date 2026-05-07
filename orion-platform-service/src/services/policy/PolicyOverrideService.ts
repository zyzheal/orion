/**
 * PolicyOverrideService - Policy override persistence for gate bypass
 *
 * Handles creation, retrieval, revocation, and cleanup of policy overrides.
 * Allows temporary bypass of quality gates with audit trail.
 * Uses PostgreSQL Repository pattern for persistence.
 */

import { PolicyOverrideRepository, CreatePolicyOverrideInput } from '../../repositories/PolicyOverrideRepository';

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
  private repository: PolicyOverrideRepository;
  private idCounter = 0;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repository = new PolicyOverrideRepository(db);
    } else {
      // Fallback for environments without direct db access (tests may inject differently)
      this.repository = null as unknown as PolicyOverrideRepository;
    }
  }

  /**
   * Inject a custom repository (useful for testing with mock repos)
   */
  setRepository(repo: PolicyOverrideRepository): void {
    this.repository = repo;
  }

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
    const dbInput: CreatePolicyOverrideInput = {
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

    const entity = await this.repository.createOverride(dbInput);
    return this.entityToDomain(entity);
  }

  // ==================== Get Overrides ====================

  /**
   * Get active overrides for a tenant
   */
  async getActiveOverrides(tenantId: string): Promise<PolicyOverride[]> {
    // First, batch-update all expired active overrides to 'expired' status
    const now = new Date();
    await this.repository.markExpired(now);

    // Then fetch the still-active (non-expired) overrides
    const entities = await this.repository.findActiveByTenant(tenantId);
    return entities.map(e => this.entityToDomain(e));
  }

  /**
   * Get all overrides for a tenant (including revoked/expired)
   */
  async getAllOverrides(tenantId: string): Promise<PolicyOverride[]> {
    const result = await this.repository.findByTenant(tenantId);
    return result.entities.map(e => this.entityToDomain(e));
  }

  /**
   * Get a single override by ID
   */
  async getOverrideById(overrideId: string): Promise<PolicyOverride | null> {
    const entity = await this.repository.findById(overrideId);
    if (!entity) return null;
    return this.entityToDomain(entity);
  }

  /**
   * Check if a policy is currently overridden for a tenant
   */
  async isOverridden(tenantId: string, policyId: string): Promise<boolean> {
    const entity = await this.repository.findActiveByTenantAndPolicy(tenantId, policyId);
    if (!entity) return false;

    // Check if expired
    if (entity.expiresAt && entity.expiresAt < new Date()) {
      await this.repository.updateOverride(entity.id, { status: 'expired', updatedAt: new Date() });
      return false;
    }
    return true;
  }

  // ==================== Revoke Override ====================

  /**
   * Revoke an active override
   */
  async revokeOverride(overrideId: string, revokedBy: string): Promise<PolicyOverride> {
    const override = await this.repository.findById(overrideId);
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

    const now = new Date();
    const updated = await this.repository.updateOverride(overrideId, {
      status: 'revoked',
      revokedBy,
      revokedAt: now,
      updatedAt: now,
    });
    if (!updated) {
      throw new PolicyOverrideServiceError('Failed to update override', 'UPDATE_FAILED');
    }
    return this.entityToDomain(updated);
  }

  // ==================== Update Override ====================

  /**
   * Update an active override's reason or expiration
   */
  async updateOverride(overrideId: string, input: UpdateOverrideInput): Promise<PolicyOverride> {
    const override = await this.repository.findById(overrideId);
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

    const updates: { reason?: string; expiresAt?: Date; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (input.reason !== undefined) updates.reason = input.reason;
    if (input.expiresAt !== undefined) updates.expiresAt = input.expiresAt;

    const updated = await this.repository.updateOverride(overrideId, updates);
    if (!updated) {
      throw new PolicyOverrideServiceError('Failed to update override', 'UPDATE_FAILED');
    }
    return this.entityToDomain(updated);
  }

  // ==================== Cleanup ====================

  /**
   * Clean up expired overrides
   * Returns the count of overrides that were marked as expired
   */
  async cleanupExpiredOverrides(): Promise<number> {
    return this.repository.markExpired(new Date());
  }

  // ==================== Internal Helpers ====================

  private generateId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}-${Date.now()}-${this.idCounter}`;
  }

  private entityToDomain(entity: any): PolicyOverride {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      policyId: entity.policyId,
      pipelineId: entity.pipelineId,
      runId: entity.runId,
      reason: entity.reason,
      approvedBy: entity.approvedBy,
      status: entity.status,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      revokedAt: entity.revokedAt,
      revokedBy: entity.revokedBy,
    };
  }
}
