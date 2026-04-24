/**
 * Approval Service - Multi-level approval workflow
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { ApprovalRepository, ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description?: string;
  requesterId: string;
  approverIds: string[];
  status: ApprovalStatus;
  approvals: string[];
  rejections: string[];
  requiredApprovals: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export class ApprovalService {
  private requests: Map<string, ApprovalRequest> = new Map();
  private repository?: ApprovalRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repository = new ApprovalRepository(db);
    }
  }

  /**
   * Create approval request
   */
  async createApproval(
    title: string,
    requesterId: string,
    approverIds: string[],
    requiredApprovals: number = 1,
    description?: string,
    metadata?: Record<string, any>,
  ): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: `approval_${uuidv4()}`,
      title,
      description,
      requesterId,
      approverIds,
      status: ApprovalStatus.PENDING,
      approvals: [],
      rejections: [],
      requiredApprovals,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };
    this.requests.set(request.id, request);

    // Store in repository if available
    if (this.repository) {
      const entity = await this.repository.create({
        tenantId: metadata?.tenantId ?? 'default',
        definitionId: null,
        resourceType: metadata?.resourceType ?? 'generic',
        resourceId: metadata?.resourceId ?? request.id,
        status: 'pending',
        requestedBy: requesterId,
        currentStep: 0,
        totalSteps: approverIds.length,
        result: null,
        completedAt: null,
        createdAt: new Date(),
      });

      // Create approval steps for each approver
      for (let i = 0; i < approverIds.length; i++) {
        await this.repository.createStep({
          approvalId: entity.id,
          stepIndex: i,
          approverId: approverIds[i],
          status: 'pending',
          comment: null,
          actedAt: null,
        });
      }
    }

    logger.info({ approvalId: request.id }, 'Approval request created');
    return request;
  }

  /**
   * Approve
   */
  async approve(approvalId: string, userId: string): Promise<ApprovalRequest> {
    const request = this.requests.get(approvalId);
    if (!request) throw new Error(`Approval not found: ${approvalId}`);
    if (request.status !== ApprovalStatus.PENDING) throw new Error('Approval not pending');
    if (!request.approverIds.includes(userId)) throw new Error('Not authorized to approve');

    // Deduplicate approvals
    if (!request.approvals.includes(userId)) {
      request.approvals.push(userId);
    }
    request.updatedAt = new Date();

    if (request.approvals.length >= request.requiredApprovals) {
      request.status = ApprovalStatus.APPROVED;
    }

    // Update repository if available
    if (this.repository) {
      const approverIndex = request.approverIds.indexOf(userId);
      const steps = await this.repository.findStepsByApproval(approvalId);
      if (steps.length > approverIndex) {
        await this.repository.updateStepStatus(steps[approverIndex].id, 'approved', undefined, new Date());
      }
      await this.repository.advanceStep(approvalId);
      if (request.status === ApprovalStatus.APPROVED) {
        await this.repository.updateStatus(approvalId, 'approved');
      }
    }

    return request;
  }

  /**
   * Reject
   */
  async reject(approvalId: string, userId: string): Promise<ApprovalRequest> {
    const request = this.requests.get(approvalId);
    if (!request) throw new Error(`Approval not found: ${approvalId}`);
    if (request.status !== ApprovalStatus.PENDING) throw new Error('Approval not pending');
    if (!request.approverIds.includes(userId)) throw new Error('Not authorized to reject');

    // Deduplicate rejections
    if (!request.rejections.includes(userId)) {
      request.rejections.push(userId);
    }
    request.status = ApprovalStatus.REJECTED;
    request.updatedAt = new Date();

    // Update repository if available
    if (this.repository) {
      const approverIndex = request.approverIds.indexOf(userId);
      const steps = await this.repository.findStepsByApproval(approvalId);
      if (steps.length > approverIndex) {
        await this.repository.updateStepStatus(steps[approverIndex].id, 'rejected', undefined, new Date());
      }
      await this.repository.updateStatus(approvalId, 'rejected');
    }

    return request;
  }

  /**
   * Get approval request
   */
  async getApproval(id: string): Promise<ApprovalRequest | undefined> {
    // First check in-memory cache
    const cached = this.requests.get(id);
    if (cached) return cached;

    // Try to load from repository
    if (this.repository) {
      const entity = await this.repository.findById(id);
      if (entity) {
        const steps = await this.repository.findStepsByApproval(id);
        const request: ApprovalRequest = {
          id: entity.id,
          title: `Approval for ${entity.resourceType}`,
          requesterId: entity.requestedBy ?? '',
          approverIds: steps.map(s => s.approverId ?? ''),
          status: entity.status as ApprovalStatus,
          approvals: steps.filter(s => s.status === 'approved').map(s => s.approverId ?? ''),
          rejections: steps.filter(s => s.status === 'rejected').map(s => s.approverId ?? ''),
          requiredApprovals: entity.totalSteps,
          createdAt: entity.createdAt,
          updatedAt: entity.completedAt ?? entity.createdAt,
        };
        this.requests.set(id, request);
        return request;
      }
    }
    return undefined;
  }

  /**
   * List pending approvals
   */
  async listPending(tenantId?: string): Promise<ApprovalRequest[]> {
    const cachedPending = Array.from(this.requests.values()).filter(r => r.status === ApprovalStatus.PENDING);

    // Also fetch from repository if available
    if (this.repository && tenantId) {
      const entities = await this.repository.findPendingByTenant(tenantId);
      for (const entity of entities) {
        if (!this.requests.has(entity.id)) {
          const steps = await this.repository.findStepsByApproval(entity.id);
          const request: ApprovalRequest = {
            id: entity.id,
            title: `Approval for ${entity.resourceType}`,
            requesterId: entity.requestedBy ?? '',
            approverIds: steps.map(s => s.approverId ?? ''),
            status: entity.status as ApprovalStatus,
            approvals: steps.filter(s => s.status === 'approved').map(s => s.approverId ?? ''),
            rejections: steps.filter(s => s.status === 'rejected').map(s => s.approverId ?? ''),
            requiredApprovals: entity.totalSteps,
            createdAt: entity.createdAt,
            updatedAt: entity.completedAt ?? entity.createdAt,
          };
          this.requests.set(entity.id, request);
        }
      }
    }

    return Array.from(this.requests.values()).filter(r => r.status === ApprovalStatus.PENDING);
  }
}
