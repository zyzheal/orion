/**
 * Approval Service - Multi-level approval workflow
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

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

    request.approvals.push(userId);
    request.updatedAt = new Date();

    if (request.approvals.length >= request.requiredApprovals) {
      request.status = ApprovalStatus.APPROVED;
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

    request.rejections.push(userId);
    request.status = ApprovalStatus.REJECTED;
    request.updatedAt = new Date();
    return request;
  }

  /**
   * Get approval request
   */
  getApproval(id: string): ApprovalRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * List pending approvals
   */
  listPending(): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter(r => r.status === ApprovalStatus.PENDING);
  }
}
