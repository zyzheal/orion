/**
 * ApprovalGateService - Pipeline 人工审批网关
 *
 * 负责：
 * - 在 stage 执行前请求审批
 * - 审批通过/拒绝后恢复/终止 pipeline 执行
 * - 管理审批状态、审批人、审批原因
 *
 * 审批流程：
 * 1. PipelineEngine 检查 stage 是否需要审批 (approval: true)
 * 2. 调用 requestApproval 暂停 pipeline
 * 3. 等待用户调用 approve 或 reject
 * 4. PipelineEngine 根据结果继续或终止
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalRequest {
  id: string;
  runId: string;
  stageId: string;
  stageName: string;
  approvers: string[]; // user IDs who can approve
  reason: string;
  status: ApprovalStatus;
  createdAt: Date;
  respondedAt?: Date;
  respondedBy?: string;
  responseComment?: string;
  tenantId?: string;
}

export interface ApprovalRequestInput {
  runId: string;
  stageId: string;
  stageName: string;
  approvers: string[];
  reason?: string;
  tenantId?: string;
}

export class ApprovalGateServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ApprovalGateServiceError';
  }
}

export class ApprovalGateService {
  // 内存存储审批请求：runId:stageId -> ApprovalRequest
  private requests = new Map<string, ApprovalRequest>();
  private counter = 0;

  /**
   * 请求审批
   */
  async requestApproval(input: ApprovalRequestInput): Promise<ApprovalRequest> {
    if (!input.runId || !input.stageId || !input.approvers || input.approvers.length === 0) {
      throw new ApprovalGateServiceError(
        'Missing required fields: runId, stageId, approvers',
        'INVALID_INPUT'
      );
    }

    const key = this.makeKey(input.runId, input.stageId);

    // 如果已有 pending 的审批，返回已有的
    const existing = this.requests.get(key);
    if (existing && existing.status === 'pending') {
      return existing;
    }

    const request: ApprovalRequest = {
      id: this.generateId(),
      runId: input.runId,
      stageId: input.stageId,
      stageName: input.stageName,
      approvers: input.approvers,
      reason: input.reason || 'Approval required before proceeding',
      status: 'pending',
      createdAt: new Date(),
      tenantId: input.tenantId,
    };

    this.requests.set(key, request);

    logger.info(
      { runId: input.runId, stageName: input.stageName, approvers: input.approvers },
      'Approval requested'
    );

    return request;
  }

  /**
   * 审批通过
   */
  async approve(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<ApprovalRequest> {
    const request = this.getPendingRequest(runId, stageId);

    // 验证审批人
    if (!request.approvers.includes(userId)) {
      throw new ApprovalGateServiceError(
        `User '${userId}' is not authorized to approve this request`,
        'UNAUTHORIZED_APPROVER'
      );
    }

    request.status = 'approved';
    request.respondedAt = new Date();
    request.respondedBy = userId;
    request.responseComment = comment;

    logger.info(
      { runId, stageId, userId },
      'Approval granted'
    );

    return request;
  }

  /**
   * 审批拒绝
   */
  async reject(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<ApprovalRequest> {
    const request = this.getPendingRequest(runId, stageId);

    // 验证审批人
    if (!request.approvers.includes(userId)) {
      throw new ApprovalGateServiceError(
        `User '${userId}' is not authorized to reject this request`,
        'UNAUTHORIZED_APPROVER'
      );
    }

    request.status = 'rejected';
    request.respondedAt = new Date();
    request.respondedBy = userId;
    request.responseComment = comment;

    logger.info(
      { runId, stageId, userId },
      'Approval rejected'
    );

    return request;
  }

  /**
   * 取消审批请求
   */
  async cancel(runId: string, stageId: string): Promise<ApprovalRequest | null> {
    const key = this.makeKey(runId, stageId);
    const request = this.requests.get(key);
    if (!request) return null;

    request.status = 'cancelled';
    request.respondedAt = new Date();

    logger.info({ runId, stageId }, 'Approval request cancelled');
    return request;
  }

  /**
   * 获取审批状态
   */
  getStatus(runId: string, stageId: string): ApprovalRequest | null {
    const key = this.makeKey(runId, stageId);
    return this.requests.get(key) ?? null;
  }

  /**
   * 获取某个 run 的所有审批请求
   */
  getByRun(runId: string): ApprovalRequest[] {
    const results: ApprovalRequest[] = [];
    for (const request of this.requests.values()) {
      if (request.runId === runId) {
        results.push(request);
      }
    }
    return results;
  }

  /**
   * 检查是否需要审批（快速检查）
   */
  isApprovalPending(runId: string, stageId: string): boolean {
    const request = this.getStatus(runId, stageId);
    return request !== null && request.status === 'pending';
  }

  /**
   * 检查是否已批准
   */
  isApproved(runId: string, stageId: string): boolean {
    const request = this.getStatus(runId, stageId);
    return request !== null && request.status === 'approved';
  }

  /**
   * 检查是否已拒绝
   */
  isRejected(runId: string, stageId: string): boolean {
    const request = this.getStatus(runId, stageId);
    return request !== null && request.status === 'rejected';
  }

  /**
   * 清理某个 run 的所有审批记录
   */
  cleanupRun(runId: string): void {
    const toDelete: string[] = [];
    for (const [key, request] of this.requests.entries()) {
      if (request.runId === runId) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      this.requests.delete(key);
    }
  }

  // ==================== Internal Helpers ====================

  private makeKey(runId: string, stageId: string): string {
    return `${runId}:${stageId}`;
  }

  private getPendingRequest(runId: string, stageId: string): ApprovalRequest {
    const request = this.getStatus(runId, stageId);
    if (!request) {
      throw new ApprovalGateServiceError(
        `No pending approval request for run '${runId}', stage '${stageId}'`,
        'NO_PENDING_APPROVAL'
      );
    }
    if (request.status !== 'pending') {
      throw new ApprovalGateServiceError(
        `Approval request is already ${request.status}`,
        'APPROVAL_ALREADY_RESPONDED'
      );
    }
    return request;
  }

  private generateId(): string {
    this.counter += 1;
    return `approval-${Date.now()}-${this.counter}`;
  }
}
