/**
 * SLAService - SLA Management business logic
 *
 * Provides:
 * - CRUD for SLA definitions
 * - Start/stop/pause tracking for entities (incident, request, change)
 * - Breach detection: scan active trackings, detect breaches, create breach events
 * - Breach history and statistics
 * - Compliance percentage calculation
 */

import { createLogger } from '../utils/logger';
import {
  SLADefinitionRepository,
  SLATrackingRepository,
  SLABreachEventRepository,
  SLADefinitionEntity,
  SLATrackingEntity,
  SLABreachEventEntity,
  CreateSLADefinitionInput,
  UpdateSLADefinitionInput,
  CreateSLATrackingInput,
} from './SLARepository';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ name: 'SLAService' });

// ==================== Valid Values ====================

const VALID_SLA_TYPES = ['response', 'resolution', 'availability'];
const VALID_TARGET_UNITS = ['minutes', 'hours', 'percent'];
const VALID_SLA_STATUSES = ['active', 'inactive', 'archived'];
const VALID_TRACKING_STATUSES = ['tracking', 'met', 'breached', 'paused'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const VALID_ENTITY_TYPES = ['incident', 'request', 'change'];

// ==================== Input Interfaces ====================

export interface CreateDefinitionInput {
  name: string;
  description?: string;
  type?: string;
  targetValue: number;
  targetUnit?: string;
  businessHoursOnly?: boolean;
  priority?: string;
  category?: string;
  escalationRules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
  createdBy?: string;
}

export interface UpdateDefinitionInput {
  name?: string;
  description?: string;
  type?: string;
  targetValue?: number;
  targetUnit?: string;
  businessHoursOnly?: boolean;
  priority?: string;
  category?: string;
  escalationRules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
}

export interface StartTrackingInput {
  slaDefinitionId: string;
  entityType: string;
  entityId: string;
  targetTime: Date;
  notes?: string;
}

export interface SLAStats {
  definitions: {
    total: number;
    active: number;
    byType: Record<string, number>;
  };
  tracking: {
    total: number;
    active: number;
    met: number;
    breached: number;
    paused: number;
    breachRate: number;
  };
  compliance: number; // percentage
}

// ==================== SLAService ====================

export class SLAService {
  private definitionRepo: SLADefinitionRepository;
  private trackingRepo: SLATrackingRepository;
  private breachEventRepo: SLABreachEventRepository;

  constructor(db: DatabasePool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.definitionRepo = new SLADefinitionRepository(db);
    this.trackingRepo = new SLATrackingRepository(db);
    this.breachEventRepo = new SLABreachEventRepository(db);
  }

  // ==================== SLA Definition CRUD ====================

  /**
   * Create a new SLA definition
   */
  async createDefinition(input: CreateDefinitionInput, tenantId: string): Promise<SLADefinitionEntity> {
    if (!input.name || !input.name.trim()) {
      throw new OrionError('SLA definition name is required', ErrorCode.VALIDATION_ERROR);
    }

    if (input.targetValue === undefined || input.targetValue === null || input.targetValue <= 0) {
      throw new OrionError('Target value must be a positive number', ErrorCode.VALIDATION_ERROR);
    }

    if (input.type && !VALID_SLA_TYPES.includes(input.type)) {
      throw new OrionError(
        `Invalid SLA type: ${input.type}. Must be one of: ${VALID_SLA_TYPES.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (input.targetUnit && !VALID_TARGET_UNITS.includes(input.targetUnit)) {
      throw new OrionError(
        `Invalid target unit: ${input.targetUnit}. Must be one of: ${VALID_TARGET_UNITS.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (input.status && !VALID_SLA_STATUSES.includes(input.status)) {
      throw new OrionError(
        `Invalid status: ${input.status}. Must be one of: ${VALID_SLA_STATUSES.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (input.priority && !VALID_PRIORITIES.includes(input.priority)) {
      throw new OrionError(
        `Invalid priority: ${input.priority}. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const entity = await this.definitionRepo.createDefinition({
      tenantId,
      name: input.name.trim(),
      description: input.description,
      type: input.type,
      targetValue: input.targetValue,
      targetUnit: input.targetUnit,
      businessHoursOnly: input.businessHoursOnly,
      priority: input.priority,
      category: input.category,
      escalationRules: input.escalationRules,
      metadata: input.metadata,
      status: input.status,
      createdBy: input.createdBy,
    });

    logger.info({ definitionId: entity.id, tenantId, name: entity.name }, 'SLA definition created');
    return entity;
  }

  /**
   * Get an SLA definition by ID
   */
  async getDefinition(id: string, tenantId: string): Promise<SLADefinitionEntity> {
    const entity = await this.definitionRepo.findById(id);
    if (!entity || entity.tenant_id !== tenantId) {
      throw new OrionError('SLA definition not found', ErrorCode.NOT_FOUND);
    }
    return entity;
  }

  /**
   * List SLA definitions for a tenant
   */
  async listDefinitions(
    tenantId: string,
    filters?: { type?: string; status?: string; category?: string; limit?: number; offset?: number },
  ): Promise<{ definitions: SLADefinitionEntity[]; total: number }> {
    const result = await this.definitionRepo.findByTenant(tenantId, filters);
    return { definitions: result.entities, total: result.total };
  }

  /**
   * Update an SLA definition
   */
  async updateDefinition(id: string, input: UpdateDefinitionInput, tenantId: string): Promise<SLADefinitionEntity> {
    const existing = await this.definitionRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('SLA definition not found', ErrorCode.NOT_FOUND);
    }

    if (input.type && !VALID_SLA_TYPES.includes(input.type)) {
      throw new OrionError(`Invalid SLA type: ${input.type}`, ErrorCode.VALIDATION_ERROR);
    }

    if (input.targetUnit && !VALID_TARGET_UNITS.includes(input.targetUnit)) {
      throw new OrionError(`Invalid target unit: ${input.targetUnit}`, ErrorCode.VALIDATION_ERROR);
    }

    if (input.status && !VALID_SLA_STATUSES.includes(input.status)) {
      throw new OrionError(`Invalid status: ${input.status}`, ErrorCode.VALIDATION_ERROR);
    }

    if (input.priority && !VALID_PRIORITIES.includes(input.priority)) {
      throw new OrionError(`Invalid priority: ${input.priority}`, ErrorCode.VALIDATION_ERROR);
    }

    if (input.targetValue !== undefined && input.targetValue <= 0) {
      throw new OrionError('Target value must be a positive number', ErrorCode.VALIDATION_ERROR);
    }

    const updated = await this.definitionRepo.updateDefinition(id, input);
    if (!updated) {
      throw new OrionError('Failed to update SLA definition', ErrorCode.OPERATION_FAILED);
    }

    logger.info({ definitionId: id, tenantId }, 'SLA definition updated');
    return updated;
  }

  /**
   * Delete an SLA definition
   */
  async deleteDefinition(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.definitionRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('SLA definition not found', ErrorCode.NOT_FOUND);
    }

    const deleted = await this.definitionRepo.delete(id);
    logger.info({ definitionId: id, tenantId }, 'SLA definition deleted');
    return deleted;
  }

  // ==================== SLA Tracking ====================

  /**
   * Start tracking an entity against an SLA definition
   */
  async startTracking(input: StartTrackingInput, tenantId: string): Promise<SLATrackingEntity> {
    if (!VALID_ENTITY_TYPES.includes(input.entityType)) {
      throw new OrionError(
        `Invalid entity type: ${input.entityType}. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Verify SLA definition exists and is active
    const definition = await this.definitionRepo.findById(input.slaDefinitionId);
    if (!definition || definition.tenant_id !== tenantId) {
      throw new OrionError('SLA definition not found', ErrorCode.NOT_FOUND);
    }
    if (definition.status !== 'active') {
      throw new OrionError('Cannot start tracking with an inactive SLA definition', ErrorCode.STATE_CONFLICT);
    }

    const entity = await this.trackingRepo.createTracking({
      tenantId,
      slaDefinitionId: input.slaDefinitionId,
      entityType: input.entityType,
      entityId: input.entityId,
      targetTime: input.targetTime,
      notes: input.notes,
    });

    logger.info(
      { trackingId: entity.id, entityType: input.entityType, entityId: input.entityId, tenantId },
      'SLA tracking started',
    );
    return entity;
  }

  /**
   * Get a tracking record by ID
   */
  async getTracking(id: string, tenantId: string): Promise<SLATrackingEntity> {
    const entity = await this.trackingRepo.findById(id);
    if (!entity || entity.tenant_id !== tenantId) {
      throw new OrionError('SLA tracking record not found', ErrorCode.NOT_FOUND);
    }
    return entity;
  }

  /**
   * List tracking records
   */
  async listTracking(
    tenantId: string,
    filters?: { status?: string; entityType?: string; entityId?: string; limit?: number; offset?: number },
  ): Promise<{ trackings: SLATrackingEntity[]; total: number }> {
    const result = await this.trackingRepo.findByTenant(tenantId, filters);
    return { trackings: result.entities, total: result.total };
  }

  /**
   * Mark tracking as met
   */
  async markMet(id: string, tenantId: string): Promise<SLATrackingEntity> {
    const existing = await this.trackingRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('SLA tracking record not found', ErrorCode.NOT_FOUND);
    }

    if (existing.status !== 'tracking' && existing.status !== 'paused') {
      throw new OrionError(
        `Cannot mark as met: current status is '${existing.status}'`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const updated = await this.trackingRepo.updateStatus(id, 'met', tenantId);
    if (!updated) {
      throw new OrionError('Failed to update tracking status', ErrorCode.OPERATION_FAILED);
    }

    logger.info({ trackingId: id, tenantId }, 'SLA tracking marked as met');
    return updated;
  }

  /**
   * Mark tracking as breached and create breach event
   */
  async markBreached(id: string, tenantId: string, details?: Record<string, unknown>): Promise<SLATrackingEntity> {
    const existing = await this.trackingRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('SLA tracking record not found', ErrorCode.NOT_FOUND);
    }

    if (existing.status === 'met' || existing.status === 'breached') {
      throw new OrionError(
        `Cannot mark as breached: current status is '${existing.status}'`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const updated = await this.trackingRepo.updateStatus(id, 'breached', tenantId);
    if (!updated) {
      throw new OrionError('Failed to update tracking status', ErrorCode.OPERATION_FAILED);
    }

    // Create breach event
    await this.breachEventRepo.createEvent({
      tenantId,
      slaTrackingId: id,
      eventType: 'breach',
      details: {
        ...details,
        entity_type: existing.entity_type,
        entity_id: existing.entity_id,
        target_time: existing.target_time,
      },
    });

    logger.warn({ trackingId: id, entityType: existing.entity_type, entityId: existing.entity_id, tenantId }, 'SLA breached');
    return updated;
  }

  /**
   * Pause tracking (e.g., waiting for customer response)
   */
  async pauseTracking(id: string, tenantId: string, reason?: string): Promise<SLATrackingEntity> {
    const existing = await this.trackingRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('SLA tracking record not found', ErrorCode.NOT_FOUND);
    }

    if (existing.status !== 'tracking') {
      throw new OrionError(
        `Cannot pause: current status is '${existing.status}'`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const updated = await this.trackingRepo.updateStatus(id, 'paused', tenantId);
    if (!updated) {
      throw new OrionError('Failed to pause tracking', ErrorCode.OPERATION_FAILED);
    }

    logger.info({ trackingId: id, tenantId, reason }, 'SLA tracking paused');
    return updated;
  }

  /**
   * Resume tracking from paused state
   */
  async resumeTracking(id: string, tenantId: string): Promise<SLATrackingEntity> {
    const existing = await this.trackingRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('SLA tracking record not found', ErrorCode.NOT_FOUND);
    }

    if (existing.status !== 'paused') {
      throw new OrionError(
        `Cannot resume: current status is '${existing.status}'`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const updated = await this.trackingRepo.updateStatus(id, 'tracking', tenantId);
    if (!updated) {
      throw new OrionError('Failed to resume tracking', ErrorCode.OPERATION_FAILED);
    }

    logger.info({ trackingId: id, tenantId }, 'SLA tracking resumed');
    return updated;
  }

  // ==================== Breach Detection ====================

  /**
   * Scan active trackings and detect breaches (target_time < now)
   * Creates breach events and updates tracking status.
   */
  async detectBreaches(tenantId: string): Promise<{ detected: number; breaches: SLATrackingEntity[] }> {
    const overdue = await this.trackingRepo.findActiveBreaches(tenantId);

    const breaches: SLATrackingEntity[] = [];
    for (const tracking of overdue) {
      const updated = await this.trackingRepo.updateStatus(tracking.id, 'breached', tenantId);
      if (updated) {
        await this.breachEventRepo.createEvent({
          tenantId,
          slaTrackingId: tracking.id,
          eventType: 'breach',
          details: {
            entity_type: tracking.entity_type,
            entity_id: tracking.entity_id,
            target_time: tracking.target_time,
            detected_at: new Date().toISOString(),
          },
        });
        breaches.push(updated);
      }
    }

    if (breaches.length > 0) {
      logger.warn({ tenantId, count: breaches.length }, 'SLA breaches detected');
    }

    return { detected: breaches.length, breaches };
  }

  // ==================== Breach History ====================

  /**
   * Get breach events for a specific tracking record
   */
  async getBreachEvents(trackingId: string): Promise<SLABreachEventEntity[]> {
    return this.breachEventRepo.findByTrackingId(trackingId);
  }

  /**
   * List all breach events for a tenant
   */
  async listBreachEvents(
    tenantId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ events: SLABreachEventEntity[]; total: number }> {
    const result = await this.breachEventRepo.findByTenant(tenantId, options);
    return { events: result.entities, total: result.total };
  }

  // ==================== Statistics ====================

  /**
   * Get comprehensive SLA statistics
   */
  async getStats(tenantId: string): Promise<SLAStats> {
    const definitionStats = await this.definitionRepo.getStats(tenantId);
    const trackingStats = await this.trackingRepo.getStats(tenantId);

    // Calculate compliance: (met / (met + breached)) * 100
    const met = trackingStats.byStatus['met'] || 0;
    const breached = trackingStats.byStatus['breached'] || 0;
    const totalCompleted = met + breached;
    const compliance = totalCompleted > 0 ? parseFloat(((met / totalCompleted) * 100).toFixed(2)) : 100;

    return {
      definitions: {
        total: definitionStats.total,
        active: definitionStats.byStatus['active'] || 0,
        byType: definitionStats.byType,
      },
      tracking: {
        total: trackingStats.total,
        active: trackingStats.byStatus['tracking'] || 0,
        met,
        breached,
        paused: trackingStats.byStatus['paused'] || 0,
        breachRate: trackingStats.breachRate,
      },
      compliance,
    };
  }
}
