/**
 * Change Management Service
 *
 * ITIL Change Management: lifecycle management, RFC creation,
 * CAB meeting management, timeline events, and risk assessment.
 */

import { createLogger } from '../utils/logger';
import {
  ChangeRequestRepository,
  CABMeetingRepository,
  ChangeTimelineRepository,
  RFCRepository,
  ChangeRequestEntity,
  CABMeetingEntity,
  ChangeTimelineEntity,
  RFCEntity,
  ChangeRequestFilters,
  CABMeetingFilters,
  CABDecision,
  ChangeStats,
} from './ChangeRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Valid status transitions for change request lifecycle
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  rejected: ['draft'], // Can resubmit after rejection
  in_progress: ['completed', 'cancelled'],
  completed: ['closed'],
  cancelled: ['draft'], // Can reopen cancelled changes
  closed: [],
};

// Risk level computation matrix: type + impact -> risk level
const RISK_MATRIX: Record<string, Record<string, string>> = {
  emergency: { high: 'high', medium: 'high', low: 'medium' },
  normal: { high: 'high', medium: 'medium', low: 'low' },
  standard: { high: 'medium', medium: 'low', low: 'low' },
};

export interface CreateChangeRequestInput {
  title: string;
  description?: string;
  type?: string;
  category?: string;
  priority?: string;
  riskLevel?: string;
  impactDescription?: string;
  rollbackPlan?: string;
  implementationPlan?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  requesterId?: string;
  assignedTo?: string;
  relatedIncidents?: string[];
  relatedProblems?: string[];
  affectedServices?: string[];
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface UpdateChangeRequestInput {
  title?: string;
  description?: string;
  type?: string;
  category?: string;
  priority?: string;
  riskLevel?: string;
  impactDescription?: string;
  rollbackPlan?: string;
  implementationPlan?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  assignedTo?: string;
  relatedIncidents?: string[];
  relatedProblems?: string[];
  affectedServices?: string[];
  metadata?: Record<string, any>;
}

export interface CreateRFCInput {
  changeRequestId: string;
  rfcNumber: string;
  justification?: string;
  riskAssessment?: string;
  testPlan?: string;
  communicationPlan?: string;
  backoutPlan?: string;
  cabMeetingId?: string;
  createdBy?: string;
}

export interface UpdateRFCInput {
  justification?: string;
  riskAssessment?: string;
  testPlan?: string;
  communicationPlan?: string;
  backoutPlan?: string;
  cabMeetingId?: string;
}

export interface CreateCABMeetingInput {
  title: string;
  description?: string;
  scheduledAt: string;
  location?: string;
  attendees?: string[];
  createdBy?: string;
}

export interface UpdateCABMeetingInput {
  title?: string;
  description?: string;
  scheduledAt?: string;
  location?: string;
  attendees?: string[];
  status?: string;
  minutes?: string;
}

export class ChangeService {
  private changeRepo: ChangeRequestRepository | null = null;
  private cabRepo: CABMeetingRepository | null = null;
  private timelineRepo: ChangeTimelineRepository | null = null;
  private rfcRepo: RFCRepository | null = null;
  private db: any;

  constructor(db?: any) {
    this.db = db;
  }

  init(): void {
    if (this.db) {
      this.changeRepo = new ChangeRequestRepository(this.db);
      this.cabRepo = new CABMeetingRepository(this.db);
      this.timelineRepo = new ChangeTimelineRepository(this.db);
      this.rfcRepo = new RFCRepository(this.db);
      logger.info('[ChangeService] Initialized with database connection');
    } else {
      logger.warn('[ChangeService] No database connection provided, running in degraded mode');
    }
  }

  // ==================== Change Request CRUD ====================

  async createChangeRequest(input: CreateChangeRequestInput, tenantId: string): Promise<ChangeRequestEntity> {
    if (!this.changeRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    if (!input.title) throw new OrionError('Title is required', ErrorCode.VALIDATION_ERROR);

    const changeType = input.type || 'standard';
    const riskLevel = input.riskLevel || this.computeRiskLevel(changeType, input.impactDescription || 'low');

    const changeRequest = await this.changeRepo.create({
      tenantId,
      title: input.title,
      description: input.description || null,
      type: changeType,
      category: input.category || null,
      priority: input.priority || 'medium',
      riskLevel,
      status: 'draft',
      impactDescription: input.impactDescription || null,
      rollbackPlan: input.rollbackPlan || null,
      implementationPlan: input.implementationPlan || null,
      scheduledStart: input.scheduledStart || null,
      scheduledEnd: input.scheduledEnd || null,
      requesterId: input.requesterId || null,
      assignedTo: input.assignedTo || null,
      relatedIncidents: input.relatedIncidents || [],
      relatedProblems: input.relatedProblems || [],
      affectedServices: input.affectedServices || [],
      metadata: input.metadata || {},
      createdBy: input.createdBy || null,
    });

    // Auto-create timeline event
    await this.addTimelineEvent(
      changeRequest.id,
      'status_change',
      `Change request created with status: draft`,
      tenantId,
      input.createdBy || 'system',
    );

    logger.info({ changeRequestId: changeRequest.id, tenantId }, '[ChangeService] Change request created');
    return changeRequest;
  }

  async getChangeRequest(id: string, tenantId: string): Promise<ChangeRequestEntity> {
    if (!this.changeRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const change = await this.changeRepo.findByIdAndTenant(id, tenantId);
    if (!change) throw new OrionError(`Change request not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);
    return change;
  }

  async listChangeRequests(tenantId: string, filters: ChangeRequestFilters = {}): Promise<{ data: ChangeRequestEntity[]; total: number }> {
    if (!this.changeRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const result = await this.changeRepo.findByTenant(tenantId, filters);
    return { data: result.entities, total: result.total };
  }

  async updateChangeRequest(id: string, input: UpdateChangeRequestInput, tenantId: string): Promise<ChangeRequestEntity> {
    if (!this.changeRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.changeRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`Change request not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    const updates: Record<string, any> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.type !== undefined) updates.type = input.type;
    if (input.category !== undefined) updates.category = input.category;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.riskLevel !== undefined) updates.riskLevel = input.riskLevel;
    if (input.impactDescription !== undefined) updates.impactDescription = input.impactDescription;
    if (input.rollbackPlan !== undefined) updates.rollbackPlan = input.rollbackPlan;
    if (input.implementationPlan !== undefined) updates.implementationPlan = input.implementationPlan;
    if (input.scheduledStart !== undefined) updates.scheduledStart = input.scheduledStart;
    if (input.scheduledEnd !== undefined) updates.scheduledEnd = input.scheduledEnd;
    if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;
    if (input.relatedIncidents !== undefined) updates.relatedIncidents = input.relatedIncidents;
    if (input.relatedProblems !== undefined) updates.relatedProblems = input.relatedProblems;
    if (input.affectedServices !== undefined) updates.affectedServices = input.affectedServices;
    if (input.metadata !== undefined) updates.metadata = input.metadata;

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const updated = await this.changeRepo.update(id, updates);
    logger.info({ changeRequestId: id, tenantId }, '[ChangeService] Change request updated');
    return updated;
  }

  async deleteChangeRequest(id: string, tenantId: string): Promise<boolean> {
    if (!this.changeRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.changeRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`Change request not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    // Only allow deletion of draft or cancelled changes
    if (!['draft', 'cancelled'].includes(existing.status)) {
      throw new OrionError(
        `Cannot delete change request in status: ${existing.status}. Only draft or cancelled changes can be deleted.`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    await this.changeRepo.delete(id);
    logger.info({ changeRequestId: id, tenantId }, '[ChangeService] Change request deleted');
    return true;
  }

  // ==================== Status Lifecycle ====================

  async updateStatus(id: string, status: string, tenantId: string, userId: string, reason?: string): Promise<ChangeRequestEntity> {
    if (!this.changeRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.changeRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`Change request not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
    if (!allowedTransitions.includes(status)) {
      throw new OrionError(
        `Invalid status transition: ${existing.status} -> ${status}. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    // Build extra fields based on status transition
    const extraFields: Record<string, any> = {};

    if (status === 'approved') {
      extraFields.approvedBy = userId;
      extraFields.approvedAt = new Date().toISOString();
    } else if (status === 'rejected') {
      extraFields.rejectedBy = userId;
      extraFields.rejectedAt = new Date().toISOString();
      if (reason) extraFields.rejectionReason = reason;
    } else if (status === 'in_progress') {
      extraFields.actualStart = new Date().toISOString();
    } else if (status === 'completed') {
      extraFields.actualEnd = new Date().toISOString();
    }

    const updated = await this.changeRepo.updateStatus(id, status, tenantId, extraFields);
    if (!updated) throw new OrionError('Failed to update change request status', ErrorCode.OPERATION_FAILED);

    // Auto-create timeline event
    const description = reason
      ? `Status changed from ${existing.status} to ${status}: ${reason}`
      : `Status changed from ${existing.status} to ${status}`;
    await this.addTimelineEvent(id, 'status_change', description, tenantId, userId);

    logger.info({ changeRequestId: id, from: existing.status, to: status, tenantId }, '[ChangeService] Change request status updated');
    return updated;
  }

  // ==================== Timeline Events ====================

  async getTimeline(changeRequestId: string, tenantId: string, options: { limit?: number; offset?: number } = {}): Promise<ChangeTimelineEntity[]> {
    if (!this.timelineRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    return this.timelineRepo.findByChangeId(changeRequestId, options.limit, options.offset);
  }

  async addTimelineEvent(
    changeRequestId: string,
    eventType: string,
    description: string,
    tenantId: string,
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<ChangeTimelineEntity> {
    if (!this.timelineRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const event = await this.timelineRepo.create({
      tenantId,
      changeRequestId,
      eventType,
      description,
      createdBy: userId,
      metadata: metadata || {},
    });

    return event;
  }

  // ==================== RFC Management ====================

  async createRFC(input: CreateRFCInput, tenantId: string): Promise<RFCEntity> {
    if (!this.rfcRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    if (!this.changeRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    if (!input.changeRequestId || !input.rfcNumber) {
      throw new OrionError('changeRequestId and rfcNumber are required', ErrorCode.VALIDATION_ERROR);
    }

    // Verify the change request exists
    const changeRequest = await this.changeRepo.findByIdAndTenant(input.changeRequestId, tenantId);
    if (!changeRequest) throw new OrionError(`Change request not found: ${input.changeRequestId}`, ErrorCode.RESOURCE_NOT_FOUND);

    const rfc = await this.rfcRepo.create({
      tenantId,
      changeRequestId: input.changeRequestId,
      rfcNumber: input.rfcNumber,
      justification: input.justification || null,
      riskAssessment: input.riskAssessment || null,
      testPlan: input.testPlan || null,
      communicationPlan: input.communicationPlan || null,
      backoutPlan: input.backoutPlan || null,
      cabMeetingId: input.cabMeetingId || null,
      status: 'draft',
      createdBy: input.createdBy || null,
    });

    // Add timeline event
    await this.addTimelineEvent(
      input.changeRequestId,
      'comment',
      `RFC ${input.rfcNumber} created`,
      tenantId,
      input.createdBy || 'system',
    );

    logger.info({ rfcId: rfc.id, changeRequestId: input.changeRequestId, tenantId }, '[ChangeService] RFC created');
    return rfc;
  }

  async getRFC(id: string, tenantId: string): Promise<RFCEntity> {
    if (!this.rfcRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const rfc = await this.rfcRepo.findByIdAndTenant(id, tenantId);
    if (!rfc) throw new OrionError(`RFC not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);
    return rfc;
  }

  async listRFCsByChange(changeRequestId: string): Promise<RFCEntity[]> {
    if (!this.rfcRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    return this.rfcRepo.findByChangeId(changeRequestId);
  }

  async listRFCs(tenantId: string, limit = 20, offset = 0): Promise<{ data: RFCEntity[]; total: number }> {
    if (!this.rfcRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const result = await this.rfcRepo.findByTenant(tenantId, limit, offset);
    return { data: result.entities, total: result.total };
  }

  async updateRFC(id: string, input: UpdateRFCInput, tenantId: string): Promise<RFCEntity> {
    if (!this.rfcRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.rfcRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`RFC not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    const updates: Record<string, any> = {};
    if (input.justification !== undefined) updates.justification = input.justification;
    if (input.riskAssessment !== undefined) updates.riskAssessment = input.riskAssessment;
    if (input.testPlan !== undefined) updates.testPlan = input.testPlan;
    if (input.communicationPlan !== undefined) updates.communicationPlan = input.communicationPlan;
    if (input.backoutPlan !== undefined) updates.backoutPlan = input.backoutPlan;
    if (input.cabMeetingId !== undefined) updates.cabMeetingId = input.cabMeetingId;

    if (Object.keys(updates).length === 0) return existing;

    const updated = await this.rfcRepo.update(id, updates);
    logger.info({ rfcId: id, tenantId }, '[ChangeService] RFC updated');
    return updated;
  }

  async updateRFCStatus(id: string, status: string, tenantId: string, userId: string): Promise<RFCEntity> {
    if (!this.rfcRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.rfcRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`RFC not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    const updated = await this.rfcRepo.updateStatus(id, status, tenantId);
    if (!updated) throw new OrionError('Failed to update RFC status', ErrorCode.OPERATION_FAILED);

    // Add timeline event to the parent change request
    await this.addTimelineEvent(
      existing.changeRequestId,
      status === 'approved' ? 'approval' : status === 'rejected' ? 'rejection' : 'status_change',
      `RFC ${existing.rfcNumber} status changed to ${status}`,
      tenantId,
      userId,
    );

    logger.info({ rfcId: id, status, tenantId }, '[ChangeService] RFC status updated');
    return updated;
  }

  // ==================== CAB Meeting Management ====================

  async createCABMeeting(input: CreateCABMeetingInput, tenantId: string): Promise<CABMeetingEntity> {
    if (!this.cabRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    if (!input.title || !input.scheduledAt) {
      throw new OrionError('title and scheduledAt are required', ErrorCode.VALIDATION_ERROR);
    }

    const meeting = await this.cabRepo.create({
      tenantId,
      title: input.title,
      description: input.description || null,
      scheduledAt: input.scheduledAt,
      location: input.location || null,
      attendees: input.attendees || [],
      status: 'scheduled',
      decisions: [],
      createdBy: input.createdBy || null,
    });

    logger.info({ meetingId: meeting.id, tenantId }, '[ChangeService] CAB meeting created');
    return meeting;
  }

  async getCABMeeting(id: string, tenantId: string): Promise<CABMeetingEntity> {
    if (!this.cabRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const meeting = await this.cabRepo.findByIdAndTenant(id, tenantId);
    if (!meeting) throw new OrionError(`CAB meeting not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);
    return meeting;
  }

  async listCABMeetings(tenantId: string, filters: CABMeetingFilters = {}): Promise<{ data: CABMeetingEntity[]; total: number }> {
    if (!this.cabRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const result = await this.cabRepo.findByTenant(tenantId, filters);
    return { data: result.entities, total: result.total };
  }

  async updateCABMeeting(id: string, input: UpdateCABMeetingInput, tenantId: string): Promise<CABMeetingEntity> {
    if (!this.cabRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.cabRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`CAB meeting not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    const updates: Record<string, any> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.scheduledAt !== undefined) updates.scheduledAt = input.scheduledAt;
    if (input.location !== undefined) updates.location = input.location;
    if (input.attendees !== undefined) updates.attendees = input.attendees;
    if (input.status !== undefined) updates.status = input.status;
    if (input.minutes !== undefined) updates.minutes = input.minutes;

    if (Object.keys(updates).length === 0) return existing;

    const updated = await this.cabRepo.update(id, updates);
    logger.info({ meetingId: id, tenantId }, '[ChangeService] CAB meeting updated');
    return updated;
  }

  async addCABDecision(meetingId: string, decision: CABDecision, tenantId: string): Promise<CABMeetingEntity> {
    if (!this.cabRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.cabRepo.findByIdAndTenant(meetingId, tenantId);
    if (!existing) throw new OrionError(`CAB meeting not found: ${meetingId}`, ErrorCode.RESOURCE_NOT_FOUND);

    const updated = await this.cabRepo.addDecision(meetingId, decision, tenantId);
    if (!updated) throw new OrionError('Failed to add CAB decision', ErrorCode.OPERATION_FAILED);

    // Add timeline event to the related change request
    if (decision.changeRequestId) {
      await this.addTimelineEvent(
        decision.changeRequestId,
        decision.decision === 'approved' ? 'approval' : decision.decision === 'rejected' ? 'rejection' : 'comment',
        `CAB decision: ${decision.decision}${decision.notes ? ` - ${decision.notes}` : ''}`,
        tenantId,
        'cab',
      );
    }

    logger.info({ meetingId, decision: decision.decision, tenantId }, '[ChangeService] CAB decision added');
    return updated;
  }

  // ==================== Statistics ====================

  async getStats(tenantId: string): Promise<ChangeStats> {
    if (!this.changeRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    return this.changeRepo.getStats(tenantId);
  }

  // ==================== Risk Assessment ====================

  /**
   * Compute risk level from change type and impact description.
   * Uses a simple matrix: type (emergency/normal/standard) x impact (high/medium/low).
   */
  computeRiskLevel(type: string, impact: string): string {
    const typeKey = type in RISK_MATRIX ? type : 'standard';
    const impactKey = impact.toLowerCase();
    const validImpacts = ['high', 'medium', 'low'];
    const impactNormalized = validImpacts.includes(impactKey) ? impactKey : 'low';

    return RISK_MATRIX[typeKey][impactNormalized];
  }
}
