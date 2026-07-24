/**
 * SlaService - SLA Policy Management and Tracking Service
 *
 * Provides SLA policy CRUD operations and SLA tracking/t Visualization
 * for tickets.
 */

import { createLogger } from '../../utils/logger';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { SlaRepository, SLAPolicyEntity, TicketSLAEntity } from '../../repositories/SlaRepository';
import {
  SLATarget,
  CreateSLAPolicyInput,
  UpdateSLAPolicyInput,
  TicketSLA,
  TicketSLAStatus,
  SLAViolation,
  SLAComplianceReport,
  TicketPriority,
} from './types';

const logger = createLogger('sla-service');

export class SlaServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'SlaServiceError'; }
}

export class SlaService {
  private repository: SlaRepository;

  constructor(repository: SlaRepository) {
    this.repository = repository;
  }

  // ==================== Entity Mapping Helpers ====================

  private toSLATarget(entity: SLAPolicyEntity): SLATarget {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      priority: entity.priority as TicketPriority,
      targetResponseTimeMs: entity.targetResponseTimeMs,
      targetResolutionTimeMs: entity.targetResolutionTimeMs,
      enabled: entity.enabled,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private toTicketSLA(entity: TicketSLAEntity): TicketSLA {
    return {
      id: entity.id,
      ticketId: entity.ticketId,
      slaTargetId: entity.slaTargetId,
      targetResolutionTimeMs: entity.targetResolutionTimeMs,
      actualResolutionTimeMs: entity.actualResolutionTimeMs,
      breached: entity.breached,
      breachedAt: entity.breachedAt,
      resolvedAt: entity.resolvedAt,
      firstResponseAt: entity.firstResponseAt,
      responseBreached: entity.responseBreached,
    };
  }

  // ==================== SLA Policy Management ====================

  /**
   * Create a new SLA policy
   */
  async createSlaPolicy(input: CreateSLAPolicyInput): Promise<SLATarget> {
    const tenantId = input.tenantId || getCurrentTenantId();

    const policyInput: CreateSLAPolicyInput = {
      ...input,
      tenantId,
      createdBy: input.createdBy,
    };

    const policy = await this.repository.createPolicy(policyInput);
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, policyId: policy.id, name: policy.name },
      '[SlaService] SLA policy created'
    );
    return this.toSLATarget(policy);
  }

  /**
   * Get SLA policy by ID
   */
  async getSlaPolicy(tenantId: string, policyId: string): Promise<SLATarget | null> {
    const policy = await this.repository.findPolicyById(policyId);
    return policy ? this.toSLATarget(policy) : null;
  }

  /**
   * List SLA policies for a tenant
   */
  async listSlaPolicies(tenantId: string, options?: { enabled?: boolean; priority?: TicketPriority }): Promise<SLATarget[]> {
    const policies = await this.repository.findAllPolicies(tenantId, options);
    return policies.map(p => this.toSLATarget(p));
  }

  /**
   * Update an SLA policy
   */
  async updateSlaPolicy(tenantId: string, policyId: string, updates: UpdateSLAPolicyInput): Promise<SLATarget> {
    const policy = await this.repository.updatePolicy(policyId, updates, tenantId);
    if (!policy) {
      throw new SlaServiceError(`SLA policy not found: ${policyId}`, 'NOT_FOUND');
    }
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, policyId },
      '[SlaService] SLA policy updated'
    );
    return this.toSLATarget(policy);
  }

  /**
   * Delete an SLA policy
   */
  async deleteSlaPolicy(tenantId: string, policyId: string): Promise<void> {
    const deleted = await this.repository.deletePolicy(policyId, tenantId);
    if (!deleted) {
      throw new SlaServiceError(`SLA policy not found: ${policyId}`, 'NOT_FOUND');
    }
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, policyId },
      '[SlaService] SLA policy deleted'
    );
  }

  // ==================== SLA Tracking ====================

  /**
   * Track SLA for a ticket - creates SLA tracking record if not exists
   */
  async trackSla(tenantId: string, ticketId: string, priority: TicketPriority, targetResolutionTimeMs: number): Promise<TicketSLA> {
    const existing = await this.repository.getTicketSLA(ticketId, tenantId);
    if (existing) {
      return existing;
    }
    return this.repository.createTicketSLA(ticketId, priority, targetResolutionTimeMs, tenantId);
  }

  /**
   * Get SLA status for a ticket (real-time visualization data)
   */
  async getSlaStatus(tenantId: string, ticketId: string): Promise<TicketSLAStatus | null> {
    return this.repository.getTicketSLAStatus(ticketId, tenantId);
  }

  /**
   * Get breached SLAs within a timeframe
   */
  async getBreachedSLAs(tenantId: string, timeframe: { start: Date; end: Date }): Promise<SLAViolation[]> {
    return this.repository.getSLAViolations(tenantId, timeframe.start, timeframe.end);
  }

  /**
   * Get SLA compliance report for a policy
   */
  async getSlaCompliance(tenantId: string, policyId: string, period: { start: Date; end: Date }): Promise<SLAComplianceReport> {
    // Get the policy details
    const policy = await this.repository.findPolicyById(policyId);
    if (!policy) {
      throw new SlaServiceError(`SLA policy not found: ${policyId}`, 'NOT_FOUND');
    }

    const stats = await this.repository.getSLAComplianceStats(tenantId, period.start, period.end);

    return {
      complianceRate: stats.rate,
      totalTickets: stats.total,
      compliantTickets: stats.compliant,
      breachedTickets: stats.breached,
      byPriority: {} as any,
      byCategory: {},
      periodStart: period.start,
      periodEnd: period.end,
    };
  }

  /**
   * Get overall SLA compliance for a tenant
   */
  async getOverallCompliance(tenantId: string, period: { start: Date; end: Date }): Promise<SLAComplianceReport> {
    const stats = await this.repository.getSLAComplianceStats(tenantId, period.start, period.end);

    return {
      complianceRate: stats.rate,
      totalTickets: stats.total,
      compliantTickets: stats.compliant,
      breachedTickets: stats.breached,
      byPriority: {} as any,
      byCategory: {},
      periodStart: period.start,
      periodEnd: period.end,
    };
  }

  /**
   * Update SLA tracking when ticket is resolved
   */
  async recordResolution(tenantId: string, ticketId: string, resolvedAt: Date): Promise<void> {
    await this.repository.updateTicketSLA(ticketId, { resolvedAt }, tenantId);
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, ticketId },
      '[SlaService] SLA resolution recorded'
    );
  }

  /**
   * Update SLA tracking when first response is made
   */
  async recordFirstResponse(tenantId: string, ticketId: string, firstResponseAt: Date): Promise<void> {
    await this.repository.updateTicketSLA(ticketId, { firstResponseAt }, tenantId);
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, ticketId },
      '[SlaService] SLA first response recorded'
    );
  }
}
