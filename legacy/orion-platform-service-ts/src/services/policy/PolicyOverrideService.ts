/**
 * PolicyOverrideService - Policy Override Management
 *
 * Provides operations for creating, retrieving, listing, and deleting
 * policy overrides in the system.
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { PolicyOverrideRepository, PolicyOverrideEntity, CreatePolicyOverrideInput } from '../../repositories/PolicyOverrideRepository';
import { DatabasePool } from '../database';

const logger = createLogger('PolicyOverrideService');

// ==================== Input Interfaces ====================

export interface CreateOverrideInput {
  tenantId: string;
  policyId: string;
  pipelineId?: string;
  runId?: string;
  violationId?: string;
  reason: string;
  approvedBy: string;
  expiresAt?: Date;
  scope?: string;
}

export interface UpdateOverrideInput {
  reason?: string;
  expiresAt?: Date;
  status?: 'active' | 'revoked' | 'expired';
}

export interface ListOverridesFilter {
  tenantId: string;
  policyId?: string;
  pipelineId?: string;
  runId?: string;
  status?: 'active' | 'revoked' | 'expired';
  scope?: string;
}

// ==================== PolicyOverrideService ====================

export class PolicyOverrideService {
  private overrideRepo: PolicyOverrideRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.overrideRepo = new PolicyOverrideRepository(db);
    }
  }

  /**
   * Set repository after construction (for lazy initialization)
   */
  setRepository(overrideRepo: PolicyOverrideRepository): void {
    this.overrideRepo = overrideRepo;
  }

  // ==================== Override CRUD ====================

  /**
   * Create a new policy override
   */
  async createOverride(input: CreateOverrideInput): Promise<PolicyOverrideEntity> {
    const now = new Date();

    if (!this.overrideRepo) {
      throw new OrionError('PolicyOverrideRepository not initialized. Ensure database is configured.', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const createInput: CreatePolicyOverrideInput = {
      id: this.generateId(),
      tenantId: input.tenantId,
      policyId: input.policyId,
      pipelineId: input.pipelineId,
      runId: input.runId,
      violationId: input.violationId,
      reason: input.reason,
      approvedBy: input.approvedBy,
      approvedAt: now,
      status: 'active',
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
      revokedAt: undefined,
      revokedBy: undefined,
      scope: input.scope,
    };

    const entity = await this.overrideRepo.createOverride(createInput);
    logger.info({ overrideId: entity.id, tenantId: input.tenantId, policyId: input.policyId }, '[PolicyOverride] Override created');
    return entity;
  }

  /**
   * Get override by ID
   */
  async getOverride(id: string): Promise<PolicyOverrideEntity | null> {
    if (!this.overrideRepo) {
      throw new OrionError('PolicyOverrideRepository not initialized. Ensure database is configured.', ErrorCode.SERVICE_UNAVAILABLE);
    }
    const override = await this.overrideRepo.findById(id);
    return override ?? null;
  }

  /**
   * Get active override for tenant+policy combination
   */
  async getActiveOverride(tenantId: string, policyId: string): Promise<PolicyOverrideEntity | null> {
    if (!this.overrideRepo) {
      throw new OrionError('PolicyOverrideRepository not initialized. Ensure database is configured.', ErrorCode.SERVICE_UNAVAILABLE);
    }
    const override = await this.overrideRepo.findActiveByTenantAndPolicy(tenantId, policyId);
    return override ?? null;
  }

  /**
   * List overrides with filtering
   */
  async listOverrides(filter: ListOverridesFilter): Promise<{
    overrides: PolicyOverrideEntity[];
    total: number;
  }> {
    if (!this.overrideRepo) {
      throw new OrionError('PolicyOverrideRepository not initialized. Ensure database is configured.', ErrorCode.SERVICE_UNAVAILABLE);
    }

    let overrides: PolicyOverrideEntity[];
    let total = 0;

    if (filter.status === 'active') {
      overrides = await this.overrideRepo.findActiveByTenant(filter.tenantId);
      total = overrides.length;
    } else if (filter.policyId) {
      // Find specific policy override
      const result = await this.overrideRepo.findByTenant(filter.tenantId);
      overrides = result.entities.filter(o => o.policyId === filter.policyId);
      total = overrides.length;
    } else {
      const result = await this.overrideRepo.findByTenant(filter.tenantId);
      overrides = result.entities;
      total = result.total;
    }

    // Apply additional filters
    overrides = overrides.filter(o => {
      if (filter.status && o.status !== filter.status) return false;
      if (filter.pipelineId && o.pipelineId !== filter.pipelineId) return false;
      if (filter.runId && o.runId !== filter.runId) return false;
      if (filter.scope && o.scope !== filter.scope) return false;
      return true;
    });

    return { overrides, total };
  }

  /**
   * Update a policy override
   */
  async updateOverride(id: string, updates: UpdateOverrideInput): Promise<PolicyOverrideEntity | null> {
    if (!this.overrideRepo) {
      throw new OrionError('PolicyOverrideRepository not initialized. Ensure database is configured.', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const existing = await this.overrideRepo.findById(id);
    if (!existing) {
      return null;
    }

    const updated = await this.overrideRepo.updateOverride(id, {
      reason: updates.reason,
      expiresAt: updates.expiresAt,
      status: updates.status,
      updatedAt: new Date(),
    });

    if (updated) {
      logger.info({ overrideId: id, updates }, '[PolicyOverride] Override updated');
    }

    return updated ?? null;
  }

  /**
   * Delete a policy override
   */
  async deleteOverride(id: string): Promise<boolean> {
    if (!this.overrideRepo) {
      throw new OrionError('PolicyOverrideRepository not initialized. Ensure database is configured.', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const deleted = await this.overrideRepo.delete(id);
    if (deleted) {
      logger.info({ overrideId: id }, '[PolicyOverride] Override deleted');
    }
    return deleted;
  }

  // ==================== Revoke Override ====================

  /**
   * Revoke an active override
   */
  async revokeOverride(id: string, revokedBy: string): Promise<PolicyOverrideEntity | null> {
    if (!this.overrideRepo) {
      throw new OrionError('PolicyOverrideRepository not initialized. Ensure database is configured.', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const existing = await this.overrideRepo.findById(id);
    if (!existing) {
      return null;
    }

    const updated = await this.overrideRepo.updateOverride(id, {
      status: 'revoked',
      revokedAt: new Date(),
      revokedBy,
      updatedAt: new Date(),
    });

    if (updated) {
      logger.info({ overrideId: id, revokedBy }, '[PolicyOverride] Override revoked');
    }

    return updated ?? null;
  }

  // ==================== Expiration Management ====================

  /**
   * Mark expired overrides
   */
  async markExpiredOverrides(): Promise<number> {
    if (!this.overrideRepo) {
      throw new OrionError('PolicyOverrideRepository not initialized. Ensure database is configured.', ErrorCode.SERVICE_UNAVAILABLE);
    }

    return this.overrideRepo.markExpired(new Date());
  }

  /**
   * Get active overrides for a tenant
   */
  async getActiveOverrides(tenantId: string): Promise<PolicyOverrideEntity[]> {
    if (!this.overrideRepo) {
      throw new OrionError('PolicyOverrideRepository not initialized. Ensure database is configured.', ErrorCode.SERVICE_UNAVAILABLE);
    }
    return this.overrideRepo.findActiveByTenant(tenantId);
  }

  // ==================== Utility Methods ====================

  private generateId(): string {
    return `override-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default PolicyOverrideService;