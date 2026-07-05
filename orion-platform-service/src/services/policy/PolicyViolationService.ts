/**
 * PolicyViolationService - Policy Violation Management
 *
 * Provides operations for recording, retrieving, listing, and analyzing
 * policy violations in the system.
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { PolicyViolationRepository, PolicyViolationEntity, PolicyViolationCreateInput } from '../../repositories/PolicyViolationRepository';
import { DatabasePool } from '../database';

const logger = createLogger('PolicyViolationService');

// ==================== Input Interfaces ====================

export interface RecordViolationInput {
  evaluationId?: string;
  policyId?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  resourceType?: string;
  resourceId?: string;
}

export interface UpdateViolationInput {
  status?: 'open' | 'acknowledged' | 'resolved' | 'waived';
}

export interface ListViolationsFilter {
  status?: string;
  severity?: string;
  policyId?: string;
  resourceType?: string;
  resourceId?: string;
  limit?: number;
  offset?: number;
}

export interface ViolationStats {
  total: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byPolicy: Record<string, number>;
  recentTrend: Array<{ date: string; count: number }>;
}

// ==================== PolicyViolationService ====================

export class PolicyViolationService {
  private violationRepo: PolicyViolationRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.violationRepo = new PolicyViolationRepository(db);
    }
  }

  /**
   * Set repository after construction (for lazy initialization)
   */
  setRepository(violationRepo: PolicyViolationRepository): void {
    this.violationRepo = violationRepo;
  }

  // ==================== Violation CRUD ====================

  /**
   * Record a new policy violation
   */
  async recordViolation(input: RecordViolationInput): Promise<PolicyViolationEntity> {
    if (!this.violationRepo) {
      const now = new Date();
      return {
        id: this.generateId(),
        evaluation_id: input.evaluationId ?? null,
        policy_id: input.policyId ?? null,
        severity: input.severity,
        message: input.message,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        status: 'open',
        created_at: now,
      } as PolicyViolationEntity;
    }

    const createInput: PolicyViolationCreateInput = {
      evaluationId: input.evaluationId,
      policyId: input.policyId,
      severity: input.severity,
      message: input.message,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    };

    const entity = await this.violationRepo.create(createInput);
    logger.info({ violationId: entity.id, severity: input.severity, policyId: input.policyId }, '[PolicyViolation] Violation recorded');
    return entity;
  }

  /**
   * Record multiple violations at once
   */
  async recordViolations(inputs: RecordViolationInput[]): Promise<PolicyViolationEntity[]> {
    const violations: PolicyViolationEntity[] = [];

    for (const input of inputs) {
      const violation = await this.recordViolation(input);
      violations.push(violation);
    }

    logger.info({ count: violations.length }, '[PolicyViolation] Multiple violations recorded');
    return violations;
  }

  /**
   * Get violation by ID
   */
  async getViolation(id: string): Promise<PolicyViolationEntity | null> {
    if (!this.violationRepo) {
      return null;
    }

    const violation = await this.violationRepo.findById(id);
    return violation ?? null;
  }

  /**
   * List violations with filtering
   */
  async listViolations(filter: ListViolationsFilter = {}): Promise<{
    violations: PolicyViolationEntity[];
    total: number;
  }> {
    if (!this.violationRepo) {
      return { violations: [], total: 0 };
    }

    const result = await this.violationRepo.findAllWithOptions({
      status: filter.status,
      severity: filter.severity,
      policyId: filter.policyId,
      limit: filter.limit ?? 100,
      offset: filter.offset ?? 0,
    });

    // Apply additional filters
    let violations = result.entities;

    if (filter.resourceType) {
      violations = violations.filter(v => v.resource_type === filter.resourceType);
    }
    if (filter.resourceId) {
      violations = violations.filter(v => v.resource_id === filter.resourceId);
    }

    return {
      violations,
      total: result.total,
    };
  }

  /**
   * Update a violation
   */
  async updateViolation(id: string, updates: UpdateViolationInput): Promise<PolicyViolationEntity | null> {
    if (!this.violationRepo) {
      return null;
    }

    const existing = await this.violationRepo.findById(id);
    if (!existing) {
      return null;
    }

    if (updates.status) {
      const updated = await this.violationRepo.updateStatus(id, updates.status);
      if (updated) {
        logger.info({ violationId: id, status: updates.status }, '[PolicyViolation] Violation updated');
      }
      return updated ?? null;
    }

    return existing;
  }

  /**
   * Delete a violation
   */
  async deleteViolation(id: string): Promise<boolean> {
    if (!this.violationRepo) {
      return false;
    }

    // Find and delete
    const violation = await this.violationRepo.findById(id);
    if (!violation) {
      return false;
    }

    // Use update to mark as deleted or implement actual delete
    await this.violationRepo.updateStatus(id, 'resolved');
    logger.info({ violationId: id }, '[PolicyViolation] Violation resolved');
    return true;
  }

  // ==================== Statistics ====================

  /**
   * Get violation statistics
   */
  async getViolationStats(options: {
    policyId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<ViolationStats> {
    if (!this.violationRepo) {
      return {
        total: 0,
        bySeverity: {},
        byStatus: {},
        byPolicy: {},
        recentTrend: [],
      };
    }

    // Get all violations with optional filtering
    const result = await this.violationRepo.findAllWithOptions({
      policyId: options.policyId,
      limit: 1000,
      offset: 0,
    });

    const violations = result.entities;

    // Calculate by severity
    const bySeverity: Record<string, number> = {};
    for (const v of violations) {
      bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
    }

    // Calculate by status
    const byStatus: Record<string, number> = {};
    for (const v of violations) {
      byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    }

    // Calculate by policy
    const byPolicy: Record<string, number> = {};
    for (const v of violations) {
      if (v.policy_id) {
        byPolicy[v.policy_id] = (byPolicy[v.policy_id] || 0) + 1;
      }
    }

    // Calculate recent trend (last 7 days)
    const recentTrend: Array<{ date: string; count: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const count = violations.filter(v => {
        const vDate = new Date(v.created_at).toISOString().split('T')[0];
        return vDate === dateStr;
      }).length;

      recentTrend.push({ date: dateStr, count });
    }

    return {
      total: violations.length,
      bySeverity,
      byStatus,
      byPolicy,
      recentTrend,
    };
  }

  /**
   * Get open violations count
   */
  async getOpenViolationsCount(policyId?: string): Promise<number> {
    if (!this.violationRepo) {
      return 0;
    }

    const result = await this.violationRepo.findAllWithOptions({
      status: 'open',
      policyId,
      limit: 1000,
      offset: 0,
    });

    return result.total;
  }

  /**
   * Get critical and high severity violations
   */
  async getCriticalViolations(policyId?: string): Promise<PolicyViolationEntity[]> {
    if (!this.violationRepo) {
      return [];
    }

    const result = await this.violationRepo.findAllWithOptions({
      policyId,
      limit: 100,
      offset: 0,
    });

    return result.entities.filter(v =>
      v.severity === 'critical' || v.severity === 'high'
    );
  }

  // ==================== Bulk Operations ====================

  /**
   * Acknowledge multiple violations
   */
  async acknowledgeViolations(ids: string[]): Promise<number> {
    let count = 0;

    for (const id of ids) {
      const updated = await this.updateViolation(id, { status: 'acknowledged' });
      if (updated) count++;
    }

    logger.info({ acknowledged: count, total: ids.length }, '[PolicyViolation] Bulk acknowledged');
    return count;
  }

  /**
   * Resolve multiple violations
   */
  async resolveViolations(ids: string[]): Promise<number> {
    let count = 0;

    for (const id of ids) {
      const updated = await this.updateViolation(id, { status: 'resolved' });
      if (updated) count++;
    }

    logger.info({ resolved: count, total: ids.length }, '[PolicyViolation] Bulk resolved');
    return count;
  }

  // ==================== Utility Methods ====================

  private generateId(): string {
    return `violation-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default PolicyViolationService;