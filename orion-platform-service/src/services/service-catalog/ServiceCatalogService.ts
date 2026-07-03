/**
 * ServiceCatalogService - ITSM Service Catalog business logic
 *
 * Provides service lifecycle management (active/inactive/retired),
 * request lifecycle (pending -> approved -> in_progress -> fulfilled),
 * SLA tracking and breach detection, timeline events, and statistics.
 */

import { createLogger } from '../utils/logger';
import {
  ServiceCatalogRepository,
  CatalogServiceEntity,
  CatalogServiceCreateInput,
  CatalogServiceUpdateInput,
} from '../../repositories/ServiceCatalogRepository';
import {
  ServiceRequestRepository,
  CatalogTimelineRepository,
  CatalogRequestEntity,
  CatalogRequestCreateInput,
  CatalogRequestUpdateInput,
  CatalogTimelineEntity,
} from '../../repositories/ServiceRequestRepository';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Valid Status Transitions ====================

const SERVICE_STATUS_TRANSITIONS: Record<string, string[]> = {
  active: ['inactive', 'retired'],
  inactive: ['active', 'retired'],
  retired: [],
};

const REQUEST_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['fulfilled', 'cancelled'],
  fulfilled: [],
  rejected: [],
  cancelled: [],
};

// ==================== Input Interfaces ====================

export interface CreateServiceInput {
  name: string;
  description?: string;
  category?: string;
  status?: string;
  owner?: string;
  supportTeam?: string;
  slaTier?: string;
  availabilityTarget?: number;
  responseTimeTarget?: number;
  relatedSystems?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  category?: string;
  status?: string;
  owner?: string;
  supportTeam?: string;
  slaTier?: string;
  availabilityTarget?: number;
  responseTimeTarget?: number;
  relatedSystems?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateRequestInput {
  serviceId: string;
  requesterId: string;
  title: string;
  description?: string;
  priority?: string;
  assignedTo?: string;
}

export interface UpdateRequestInput {
  title?: string;
  description?: string;
  priority?: string;
  assignedTo?: string;
}

export interface StatusTransitionInput {
  status: string;
  userId: string;
  comment?: string;
}

// ==================== ServiceCatalogService ====================

export class ServiceCatalogService {
  private serviceRepo: ServiceCatalogRepository;
  private requestRepo: ServiceRequestRepository;
  private timelineRepo: CatalogTimelineRepository;

  constructor(db: DatabasePool | { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.serviceRepo = new ServiceCatalogRepository(db);
    this.requestRepo = new ServiceRequestRepository(db);
    this.timelineRepo = new CatalogTimelineRepository(db);
  }

  // ==================== Service CRUD ====================

  /**
   * Create a new catalog service
   */
  async createService(input: CreateServiceInput, tenantId: string): Promise<CatalogServiceEntity> {
    if (!input.name || !input.name.trim()) {
      throw new OrionError('Service name is required', ErrorCode.VALIDATION_ERROR);
    }

    const validSlaTiers = ['gold', 'silver', 'bronze'];
    if (input.slaTier && !validSlaTiers.includes(input.slaTier)) {
      throw new OrionError(`Invalid SLA tier: ${input.slaTier}. Must be one of: ${validSlaTiers.join(', ')}`, ErrorCode.VALIDATION_ERROR);
    }

    const validStatuses = ['active', 'inactive', 'retired'];
    if (input.status && !validStatuses.includes(input.status)) {
      throw new OrionError(`Invalid status: ${input.status}. Must be one of: ${validStatuses.join(', ')}`, ErrorCode.VALIDATION_ERROR);
    }

    const entity = await this.serviceRepo.createService({
      tenantId,
      name: input.name.trim(),
      description: input.description,
      category: input.category,
      status: input.status,
      owner: input.owner,
      supportTeam: input.supportTeam,
      slaTier: input.slaTier,
      availabilityTarget: input.availabilityTarget,
      responseTimeTarget: input.responseTimeTarget,
      relatedSystems: input.relatedSystems,
      metadata: input.metadata,
      createdBy: input.createdBy,
    });

    logger.info({ serviceId: entity.id, tenantId, name: entity.name }, 'Catalog service created');
    return entity;
  }

  /**
   * Get a catalog service by ID
   */
  async getService(id: string, tenantId: string): Promise<CatalogServiceEntity> {
    const entity = await this.serviceRepo.findById(id);
    if (!entity || entity.tenant_id !== tenantId) {
      throw new OrionError('Catalog service not found', ErrorCode.NOT_FOUND);
    }
    return entity;
  }

  /**
   * List catalog services for a tenant
   */
  async listServices(tenantId: string, options?: { category?: string; status?: string; limit?: number; offset?: number }): Promise<{ services: CatalogServiceEntity[]; total: number }> {
    if (options?.category) {
      const services = await this.serviceRepo.findByCategory(tenantId, options.category);
      return { services, total: services.length };
    }

    if (options?.status) {
      const services = await this.serviceRepo.findByStatus(tenantId, options.status);
      return { services, total: services.length };
    }

    const result = await this.serviceRepo.findByTenant(tenantId, {
      limit: options?.limit,
      offset: options?.offset,
    });
    return { services: result.entities, total: result.total };
  }

  /**
   * Update a catalog service
   */
  async updateService(id: string, input: UpdateServiceInput, tenantId: string): Promise<CatalogServiceEntity> {
    const existing = await this.serviceRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('Catalog service not found', ErrorCode.NOT_FOUND);
    }

    // Validate status transition if status is being changed
    if (input.status && input.status !== existing.status) {
      const allowed = SERVICE_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(input.status)) {
        throw new OrionError(
          `Cannot transition service from '${existing.status}' to '${input.status}'. Allowed: ${allowed.join(', ') || 'none'}`,
          ErrorCode.STATE_CONFLICT,
        );
      }
    }

    const validSlaTiers = ['gold', 'silver', 'bronze'];
    if (input.slaTier && !validSlaTiers.includes(input.slaTier)) {
      throw new OrionError(`Invalid SLA tier: ${input.slaTier}`, ErrorCode.VALIDATION_ERROR);
    }

    const updated = await this.serviceRepo.updateService(id, input);
    if (!updated) {
      throw new OrionError('Failed to update catalog service', ErrorCode.OPERATION_FAILED);
    }

    logger.info({ serviceId: id, tenantId }, 'Catalog service updated');
    return updated;
  }

  /**
   * Delete a catalog service
   */
  async deleteService(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.serviceRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('Catalog service not found', ErrorCode.NOT_FOUND);
    }

    if (existing.status === 'active') {
      throw new OrionError('Cannot delete an active service. Deactivate it first.', ErrorCode.STATE_CONFLICT);
    }

    const deleted = await this.serviceRepo.delete(id);
    logger.info({ serviceId: id, tenantId }, 'Catalog service deleted');
    return deleted;
  }

  // ==================== Request Lifecycle ====================

  /**
   * Submit a new service request
   */
  async createRequest(input: CreateRequestInput, tenantId: string): Promise<CatalogRequestEntity> {
    if (!input.title || !input.title.trim()) {
      throw new OrionError('Request title is required', ErrorCode.VALIDATION_ERROR);
    }
    if (!input.serviceId) {
      throw new OrionError('Service ID is required', ErrorCode.VALIDATION_ERROR);
    }
    if (!input.requesterId) {
      throw new OrionError('Requester ID is required', ErrorCode.VALIDATION_ERROR);
    }

    // Validate service exists and is active
    const service = await this.serviceRepo.findById(input.serviceId);
    if (!service || service.tenant_id !== tenantId) {
      throw new OrionError('Catalog service not found', ErrorCode.NOT_FOUND);
    }
    if (service.status !== 'active') {
      throw new OrionError('Cannot request a non-active service', ErrorCode.STATE_CONFLICT);
    }

    const validPriorities = ['critical', 'high', 'medium', 'low'];
    if (input.priority && !validPriorities.includes(input.priority)) {
      throw new OrionError(`Invalid priority: ${input.priority}`, ErrorCode.VALIDATION_ERROR);
    }

    const entity = await this.requestRepo.createRequest({
      tenantId,
      serviceId: input.serviceId,
      requesterId: input.requesterId,
      title: input.title.trim(),
      description: input.description,
      priority: input.priority,
      assignedTo: input.assignedTo,
    });

    // Create timeline event
    await this.timelineRepo.createEvent({
      requestId: entity.id,
      tenantId,
      eventType: 'created',
      description: `Service request created: ${entity.title}`,
      createdBy: input.requesterId,
      metadata: { priority: entity.priority, serviceId: input.serviceId },
    });

    logger.info({ requestId: entity.id, serviceId: input.serviceId, tenantId }, 'Service request created');
    return entity;
  }

  /**
   * Get a service request by ID
   */
  async getRequest(id: string, tenantId: string): Promise<CatalogRequestEntity> {
    const entity = await this.requestRepo.findById(id);
    if (!entity || entity.tenant_id !== tenantId) {
      throw new OrionError('Service request not found', ErrorCode.NOT_FOUND);
    }
    return entity;
  }

  /**
   * List service requests for a tenant
   */
  async listRequests(tenantId: string, options?: { serviceId?: string; requesterId?: string; status?: string; limit?: number; offset?: number }): Promise<{ requests: CatalogRequestEntity[]; total: number }> {
    if (options?.serviceId) {
      const result = await this.requestRepo.findByService(options.serviceId, {
        limit: options?.limit,
        offset: options?.offset,
      });
      return { requests: result.entities, total: result.total };
    }

    if (options?.requesterId) {
      const requests = await this.requestRepo.findByRequester(tenantId, options.requesterId);
      return { requests, total: requests.length };
    }

    if (options?.status) {
      const requests = await this.requestRepo.findByStatus(tenantId, options.status);
      return { requests, total: requests.length };
    }

    const result = await this.requestRepo.findByTenant(tenantId, {
      limit: options?.limit,
      offset: options?.offset,
    });
    return { requests: result.entities, total: result.total };
  }

  /**
   * Update a service request
   */
  async updateRequest(id: string, input: UpdateRequestInput, tenantId: string): Promise<CatalogRequestEntity> {
    const existing = await this.requestRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('Service request not found', ErrorCode.NOT_FOUND);
    }

    // Only allow updates on pending/in_progress requests
    if (!['pending', 'in_progress'].includes(existing.status)) {
      throw new OrionError(`Cannot update request in '${existing.status}' status`, ErrorCode.STATE_CONFLICT);
    }

    const updated = await this.requestRepo.updateRequest(id, input);
    if (!updated) {
      throw new OrionError('Failed to update service request', ErrorCode.OPERATION_FAILED);
    }

    logger.info({ requestId: id, tenantId }, 'Service request updated');
    return updated;
  }

  /**
   * Transition request status with validation and timeline tracking
   */
  async transitionStatus(id: string, input: StatusTransitionInput, tenantId: string): Promise<CatalogRequestEntity> {
    const existing = await this.requestRepo.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new OrionError('Service request not found', ErrorCode.NOT_FOUND);
    }

    const allowed = REQUEST_STATUS_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(input.status)) {
      throw new OrionError(
        `Cannot transition request from '${existing.status}' to '${input.status}'. Allowed: ${allowed.join(', ') || 'none'}`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const updateData: CatalogRequestUpdateInput = { status: input.status };

    // Set additional fields based on target status
    if (input.status === 'approved') {
      updateData.approvedBy = input.userId;
      updateData.approvedAt = new Date();
    } else if (input.status === 'fulfilled') {
      updateData.fulfilledAt = new Date();
    }

    const updated = await this.requestRepo.updateRequest(id, updateData);
    if (!updated) {
      throw new OrionError('Failed to transition request status', ErrorCode.OPERATION_FAILED);
    }

    // Create timeline event
    await this.timelineRepo.createEvent({
      requestId: id,
      tenantId,
      eventType: `status_${input.status}`,
      description: input.comment || `Status changed to '${input.status}'`,
      createdBy: input.userId,
      metadata: { previousStatus: existing.status, newStatus: input.status },
    });

    logger.info({ requestId: id, from: existing.status, to: input.status, tenantId }, 'Request status transitioned');
    return updated;
  }

  // ==================== Timeline ====================

  /**
   * Get timeline events for a request
   */
  async getTimeline(requestId: string, tenantId: string): Promise<CatalogTimelineEntity[]> {
    // Verify request exists and belongs to tenant
    const request = await this.requestRepo.findById(requestId);
    if (!request || request.tenant_id !== tenantId) {
      throw new OrionError('Service request not found', ErrorCode.NOT_FOUND);
    }

    return this.timelineRepo.findByRequestId(requestId);
  }

  // ==================== SLA Management ====================

  /**
   * Detect and mark SLA breaches
   */
  async detectSlaBreaches(tenantId: string): Promise<{ breached: number; breaches: CatalogRequestEntity[] }> {
    const breachedCount = await this.requestRepo.detectSlaBreaches(tenantId);
    const breaches = await this.requestRepo.findSlaBreaches(tenantId);

    if (breachedCount > 0) {
      logger.warn({ tenantId, count: breachedCount }, 'SLA breaches detected');
    }

    return { breached: breachedCount, breaches };
  }

  /**
   * Get SLA breach requests
   */
  async getSlaBreaches(tenantId: string): Promise<CatalogRequestEntity[]> {
    return this.requestRepo.findSlaBreaches(tenantId);
  }

  // ==================== Statistics ====================

  /**
   * Get catalog statistics
   */
  async getStats(tenantId: string): Promise<{
    services: { total: number; active: number; inactive: number; retired: number };
    requests: Record<string, number>;
    slaBreaches: number;
  }> {
    const serviceResult = await this.serviceRepo.findByTenant(tenantId, { limit: 1000 });
    const services = serviceResult.entities;

    const serviceStats = {
      total: services.length,
      active: services.filter(s => s.status === 'active').length,
      inactive: services.filter(s => s.status === 'inactive').length,
      retired: services.filter(s => s.status === 'retired').length,
    };

    const requestStats = await this.requestRepo.getStats(tenantId);
    const slaBreaches = await this.requestRepo.findSlaBreaches(tenantId);

    return {
      services: serviceStats,
      requests: requestStats,
      slaBreaches: slaBreaches.length,
    };
  }
}
