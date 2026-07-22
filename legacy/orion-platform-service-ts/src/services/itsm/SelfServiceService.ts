/**
 * SelfServiceService - ITSM Self-Service Portal orchestration service
 *
 * Task 4.41: ITSM Self-Service portal
 *
 * Orchestrates between ServiceCatalogService, ApprovalService, and SLAService
 * to provide a complete service catalog → request → approval → fulfillment flow.
 *
 * Features:
 * - Service catalog browsing
 * - Service request creation with SLA tracking
 * - Approval workflow integration (auto-create approval when request is submitted)
 * - Request status tracking (pending → approved → in_progress → fulfilled)
 * - Attachment support (basic metadata tracking)
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { ServiceCatalogService } from '../service-catalog/ServiceCatalogService';
import { ApprovalService } from '../approval/ApprovalService';
import { SLAService } from '../sla/SLAService';
import { DatabasePool } from '../database';

const logger = createLogger('SelfServiceService');

// ==================== Types ====================

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: string;
  owner?: string;
  supportTeam?: string;
  slaTier?: string;
  availabilityTarget?: number;
  responseTimeTarget?: number;
  relatedSystems?: string[];
  metadata?: Record<string, unknown>;
  requiresApproval: boolean;
  defaultApproverIds?: string[];
}

export interface ServiceRequestDetail {
  id: string;
  tenantId: string;
  serviceId: string;
  serviceName?: string;
  requesterId: string;
  title: string;
  description?: string;
  priority?: string;
  status: string;
  assignedTo?: string;
  approvedBy?: string;
  approvedAt?: Date;
  fulfilledAt?: Date;
  slaBreach: boolean;
  approvalId?: string;
  approvalStatus?: string;
  slaTracking?: {
    id: string;
    status: string;
    targetTime: Date;
    createdAt: Date;
  };
  attachments: AttachmentInfo[];
  timeline: CatalogTimelineEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AttachmentInfo {
  id: string;
  requestId: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  storageKey?: string;
  description?: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface CatalogTimelineEvent {
  id: string;
  requestId: string;
  eventType: string;
  description?: string;
  createdBy?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface CreateServiceRequestInput {
  serviceId: string;
  title: string;
  description?: string;
  priority?: string;
  assignedTo?: string;
}

// ==================== SelfServiceService ====================

export class SelfServiceService {
  private catalogService: ServiceCatalogService;
  private approvalService: ApprovalService;
  private slaService: SLAService;

  constructor(
    db: DatabasePool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.catalogService = new ServiceCatalogService(db);
    this.approvalService = new ApprovalService(db);
    this.slaService = new SLAService(db);
  }

  // ==================== Service Catalog ====================

  /**
   * List available services for the tenant.
   * Enriches each service with `requiresApproval` flag based on metadata/slaTier.
   */
  async getServiceCatalog(tenantId: string, options?: { category?: string; limit?: number; offset?: number }): Promise<{ services: ServiceCatalogItem[]; total: number }> {
    const result = await this.catalogService.listServices(tenantId, options);

    const services: ServiceCatalogItem[] = result.services.map((svc) => {
      const metadata = (svc.metadata as Record<string, unknown>) || {};
      const requiresApproval = metadata.requiresApproval === true ||
        ['gold', 'silver'].includes(svc.sla_tier || '') ||
        svc.category === 'infrastructure';

      return {
        id: svc.id,
        name: svc.name,
        description: svc.description ?? undefined,
        category: svc.category ?? undefined,
        status: svc.status,
        owner: svc.owner ?? undefined,
        supportTeam: svc.support_team ?? undefined,
        slaTier: svc.sla_tier ?? undefined,
        availabilityTarget: svc.availability_target ?? undefined,
        responseTimeTarget: svc.response_time_target ?? undefined,
        relatedSystems: svc.related_systems,
        metadata: svc.metadata,
        requiresApproval,
        defaultApproverIds: Array.isArray(metadata.defaultApproverIds)
          ? metadata.defaultApproverIds as string[]
          : undefined,
      };
    });

    return { services, total: result.total };
  }

  /**
   * Get a single service detail from the catalog.
   */
  async getServiceDetail(serviceId: string, tenantId: string): Promise<ServiceCatalogItem> {
    const svc = await this.catalogService.getService(serviceId, tenantId);
    const metadata = (svc.metadata as Record<string, unknown>) || {};
    const requiresApproval = metadata.requiresApproval === true ||
      ['gold', 'silver'].includes(svc.sla_tier || '');

    return {
      id: svc.id,
      name: svc.name,
      description: svc.description ?? undefined,
      category: svc.category ?? undefined,
      status: svc.status,
      owner: svc.owner ?? undefined,
      supportTeam: svc.support_team ?? undefined,
      slaTier: svc.sla_tier ?? undefined,
      availabilityTarget: svc.availability_target ?? undefined,
      responseTimeTarget: svc.response_time_target ?? undefined,
      relatedSystems: svc.related_systems,
      metadata: svc.metadata,
      requiresApproval,
      defaultApproverIds: Array.isArray(metadata.defaultApproverIds)
        ? metadata.defaultApproverIds as string[]
        : undefined,
    };
  }

  // ==================== Service Requests ====================

  /**
   * Create a service request.
   *
   * Flow:
   * 1. Validate service exists and is active (delegated to ServiceCatalogService)
   * 2. Create the request in `catalog_requests` with status 'pending'
   * 3. If the service requires approval, auto-create an ApprovalService approval
   * 4. Start SLA tracking if the service has an SLA tier
   *
   * Returns the created request enriched with approval and SLA info.
   */
  async createServiceRequest(tenantId: string, userId: string, input: CreateServiceRequestInput): Promise<ServiceRequestDetail> {
    // 1. Validate service
    const service = await this.catalogService.getService(input.serviceId, tenantId);

    // 2. Create request via ServiceCatalogService
    const request = await this.catalogService.createRequest(
      {
        serviceId: input.serviceId,
        requesterId: userId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        assignedTo: input.assignedTo,
      },
      tenantId,
    );

    let approvalId: string | undefined;
    let approvalStatus: string | undefined;
    let slaTrackingId: string | undefined;

    // 3. Auto-create approval if required
    const metadata = (service.metadata as Record<string, unknown>) || {};
    const requiresApproval = metadata.requiresApproval === true ||
      ['gold', 'silver'].includes(service.sla_tier || '');

    if (requiresApproval) {
      const defaultApproverIds = Array.isArray(metadata.defaultApproverIds)
        ? metadata.defaultApproverIds as string[]
        : [];

      if (defaultApproverIds.length > 0) {
        try {
          const approval = await this.approvalService.createApproval(
            `Service Request: ${input.title}`,
            userId,
            defaultApproverIds,
            1,
            input.description || `Service request for ${service.name}`,
            {
              tenantId,
              resourceType: 'service_request',
              resourceId: request.id,
              serviceId: input.serviceId,
              serviceName: service.name,
            },
          );
          approvalId = approval.id;
          approvalStatus = approval.status;
          logger.info({ requestId: request.id, approvalId: approval.id }, 'Approval auto-created for service request');
        } catch (err) {
          logger.warn({ err, requestId: request.id }, 'Failed to create approval for service request');
        }
      }
    }

    let targetTime = new Date();

    // 4. Start SLA tracking if service has response time target
    if (service.response_time_target && service.response_time_target > 0) {
      targetTime.setMinutes(targetTime.getMinutes() + service.response_time_target);

      try {
        const slaDef = await this.slaService.listDefinitions(tenantId, {
          type: 'response',
          category: service.category,
          status: 'active',
          limit: 1,
        });

        const slaDefinitionId = slaDef.definitions.length > 0
          ? slaDef.definitions[0].id
          : undefined;

        if (slaDefinitionId) {
          const tracking = await this.slaService.startTracking(
            {
              slaDefinitionId,
              entityType: 'request',
              entityId: request.id,
              targetTime,
            },
            tenantId,
          );
          slaTrackingId = tracking.id;
          logger.info({ requestId: request.id, trackingId: tracking.id }, 'SLA tracking started for service request');
        }
      } catch (err) {
        logger.warn({ err, requestId: request.id }, 'Failed to start SLA tracking for service request');
      }
    }

    return this.buildRequestDetail(
      request,
      service.name,
      approvalId,
      approvalStatus,
      undefined, // slaTrackingId (redundant, kept for backward compat during transition)
      slaTrackingId ? { id: slaTrackingId, status: 'tracking', targetTime, createdAt: new Date() } : undefined,
      [],
      [],
    );
  }

  /**
   * List service requests for a tenant, filtered by requester/service/status.
   */
  async getServiceRequests(tenantId: string, options?: { requesterId?: string; serviceId?: string; status?: string; limit?: number; offset?: number }): Promise<ServiceRequestDetail[]> {
    const result = await this.catalogService.listRequests(tenantId, options);

    const details: ServiceRequestDetail[] = [];
    for (const req of result.requests) {
      const serviceName = await this.getServiceName(req.service_id);
      const detail = this.buildRequestDetail(req, serviceName, undefined, undefined, undefined, undefined, [], []);
      details.push(detail);
    }
    return details;
  }

  /**
   * Get a single service request detail with SLA info and timeline.
   */
  async getServiceRequestDetail(id: string, tenantId: string): Promise<ServiceRequestDetail> {
    const request = await this.catalogService.getRequest(id, tenantId);
    const serviceName = await this.getServiceName(request.service_id);

    // Load timeline
    let timeline: CatalogTimelineEvent[] = [];
    try {
      const timelineRepo = (this.catalogService as any).timelineRepo;
      if (timelineRepo) {
        timeline = await timelineRepo.findByRequestId(id);
      }
    } catch {
      // timeline not available
    }

    // Load attachments
    const attachments = await this.getAttachments(id);

    // Look up approval via resourceId
    let approvalId: string | undefined;
    let approvalStatus: string | undefined;
    try {
      const pendingApprovals = await this.approvalService.listPending(tenantId);
      const matching = pendingApprovals.find(
        (a) => (a.metadata as any)?.resourceId === id,
      );
      if (matching) {
        approvalId = matching.id;
        approvalStatus = matching.status;
      }
    } catch {
      // approval lookup is best-effort
    }

    // Look up SLA tracking
    let slaTracking: ServiceRequestDetail['slaTracking'];
    try {
      const trackingResult = await this.slaService.listTracking(tenantId, {
        entityType: 'request',
        entityId: id,
        limit: 1,
      });
      if (trackingResult.trackings.length > 0) {
        const t = trackingResult.trackings[0];
        slaTracking = {
          id: t.id,
          status: t.status,
          targetTime: t.target_time,
          createdAt: t.created_at,
        };
      }
    } catch {
      // SLA lookup is best-effort
    }

    return this.buildRequestDetail(
      request,
      serviceName,
      approvalId,
      approvalStatus,
      undefined,
      slaTracking,
      attachments,
      timeline,
    );
  }

  // ==================== Approval Workflow ====================

  /**
   * Approve a service request.
   * Looks up the linked approval and delegates to ApprovalService.approve.
   */
  async approveRequest(requestId: string, approverId: string, comment?: string, tenantId?: string): Promise<ServiceRequestDetail> {
    const approval = await this.findApprovalForRequest(requestId, tenantId);
    if (!approval) {
      throw new OrionError('No pending approval found for this request', ErrorCode.NOT_FOUND);
    }

    const approved = await this.approvalService.approve(approval.id, approverId);

    // If approval is fully approved, transition request to 'approved'
    if (approved.status === 'approved') {
      try {
        await this.catalogService.transitionStatus(
          requestId,
          { status: 'approved', userId: approverId, comment: comment || 'Request approved' },
          tenantId || approval.metadata?.tenantId,
        );
      } catch (err) {
        logger.warn({ err, requestId }, 'Failed to transition request status after approval');
      }
    }

    // Record step comment if provided
    if (comment) {
      try {
        const steps = await (this.approvalService as any).repository.findStepsByApproval(approval.id);
        const myStep = steps.find((s: any) => s.approverId === approverId);
        if (myStep) {
          await (this.approvalService as any).repository.updateStepStatus(myStep.id, 'approved', comment, new Date());
        }
      } catch {
        // comment recording is best-effort
      }
    }

    return this.getServiceRequestDetail(requestId, tenantId || approval.metadata?.tenantId);
  }

  /**
   * Reject a service request.
   * Looks up the linked approval and delegates to ApprovalService.reject.
   */
  async rejectRequest(requestId: string, approverId: string, comment?: string, tenantId?: string): Promise<ServiceRequestDetail> {
    const approval = await this.findApprovalForRequest(requestId, tenantId);
    if (!approval) {
      throw new OrionError('No pending approval found for this request', ErrorCode.NOT_FOUND);
    }

    const rejected = await this.approvalService.reject(approval.id, approverId);

    // Transition request to 'rejected'
    try {
      await this.catalogService.transitionStatus(
        requestId,
        { status: 'rejected', userId: approverId, comment: comment || 'Request rejected' },
        tenantId || approval.metadata?.tenantId,
      );
    } catch (err) {
      logger.warn({ err, requestId }, 'Failed to transition request status after rejection');
    }

    // Record step comment if provided
    if (comment) {
      try {
        const steps = await (this.approvalService as any).repository.findStepsByApproval(approval.id);
        const myStep = steps.find((s: any) => s.approverId === approverId);
        if (myStep) {
          await (this.approvalService as any).repository.updateStepStatus(myStep.id, 'rejected', comment, new Date());
        }
      } catch {
        // comment recording is best-effort
      }
    }

    return this.getServiceRequestDetail(requestId, tenantId || approval.metadata?.tenantId);
  }

  // ==================== Attachments ====================

  /**
   * Add an attachment to a service request.
   * Stores metadata in memory (keyed by requestId) for this implementation.
   * In production, this would persist to a dedicated attachments table.
   */
  async addAttachment(requestId: string, attachment: Omit<AttachmentInfo, 'id' | 'requestId' | 'createdAt'>): Promise<AttachmentInfo> {
    // Verify request exists
    const request = await this.catalogService.getRequest(requestId, this.getTenantId());

    if (!['pending', 'approved', 'in_progress'].includes(request.status)) {
      throw new OrionError(
        `Cannot add attachments to request in '${request.status}' status`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const info: AttachmentInfo = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      requestId,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      storageKey: attachment.storageKey,
      description: attachment.description,
      uploadedBy: attachment.uploadedBy,
      createdAt: new Date(),
    };

    // Store attachment metadata on the request entity via metadata field
    const existingMeta = (request as any).metadata || {};
    const attachments = Array.isArray(existingMeta.attachments) ? existingMeta.attachments : [];
    attachments.push(info);
    existingMeta.attachments = attachments;

    await this.catalogService.updateRequest(requestId, { metadata: existingMeta } as any, request.tenant_id);

    logger.info({ requestId, attachmentId: info.id, fileName: info.fileName }, 'Attachment added to service request');
    return info;
  }

  /**
   * List attachments for a service request.
   */
  async getAttachments(requestId: string): Promise<AttachmentInfo[]> {
    const request = await this.catalogService.getRequest(requestId, this.getTenantId());
    const meta = (request as any).metadata || {};
    const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
    return attachments;
  }

  // ==================== Helpers ====================

  private async findApprovalForRequest(
    requestId: string,
    tenantId?: string,
  ): Promise<{ id: string; status: string; metadata?: Record<string, any> } | null> {
    const effectiveTenantId = tenantId || this.getTenantId();

    // Search pending approvals for this tenant
    const pendingApprovals = await this.approvalService.listPending(effectiveTenantId);
    const matching = pendingApprovals.find(
      (a) => (a.metadata as any)?.resourceId === requestId,
    );

    if (matching) {
      return { id: matching.id, status: matching.status, metadata: matching.metadata as Record<string, any> };
    }

    // Also search all approvals (including approved/rejected)
    try {
      const allApprovals = await (this.approvalService as any).repository.findAll({ limit: 100 });
      const found = allApprovals.entities.find(
        (e: any) => (e.metadata as any)?.resourceId === requestId,
      );
      if (found) {
        return { id: found.id, status: found.status, metadata: found.metadata as Record<string, any> };
      }
    } catch {
      // best-effort
    }

    return null;
  }

  private async getServiceName(serviceId: string): Promise<string | undefined> {
    try {
      // tenantId is resolved at runtime via getTenantId()
      const svc = await this.catalogService.getService(serviceId, this.getTenantId());
      return svc.name;
    } catch {
      return undefined;
    }
  }

  private getTenantId(): string {
    // Falls back to reading from the async local storage; matches the pattern
    // used throughout the codebase (see getCurrentTenantId).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getCurrentTenantId } = require('../../db/tenant-context-storage');
    return getCurrentTenantId();
  }

  private buildRequestDetail(
    request: any,
    serviceName?: string,
    approvalId?: string,
    approvalStatus?: string,
    slaTrackingId?: string,
    slaTracking?: ServiceRequestDetail['slaTracking'],
    attachments: AttachmentInfo[] = [],
    timeline: CatalogTimelineEvent[] = [],
  ): ServiceRequestDetail {
    return {
      id: request.id,
      tenantId: request.tenant_id,
      serviceId: request.service_id,
      serviceName,
      requesterId: request.requester_id,
      title: request.title,
      description: request.description,
      priority: request.priority,
      status: request.status,
      assignedTo: request.assigned_to,
      approvedBy: request.approved_by,
      approvedAt: request.approved_at,
      fulfilledAt: request.fulfilled_at,
      slaBreach: request.sla_breach,
      approvalId,
      approvalStatus,
      slaTracking,
      attachments,
      timeline,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    };
  }
}
