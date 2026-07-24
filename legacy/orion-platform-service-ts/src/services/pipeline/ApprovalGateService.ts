/**
 * ApprovalGateService - Pipeline 审批门禁服务
 *
 * 管理 Pipeline Run 中每个 Stage 的审批门禁。
 * 当 Pipeline 配置了审批阶段时，执行到该阶段会暂停，等待人工审批。
 */
import { ApprovalGateRepository, ApprovalGateEntity } from '../../repositories/ApprovalGateRepository';
import { OrionError, ErrorCode } from '../../errors';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

// ==================== Types ====================

export interface ApprovalGate {
  id: string;
  tenantId: string;
  runId: string;
  stageId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  comment?: string;
  approverIds: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalGateCreateInput {
  runId: string;
  stageId: string;
  requestedBy: string;
  approverIds: string[];
  metadata?: Record<string, unknown>;
}

export interface ApprovalGateStatus {
  gate: ApprovalGate;
  canProceed: boolean;
  message: string;
}

export interface ApprovalGateStatus {
  gate: ApprovalGate;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  canProceed: boolean;
  message: string;
}

export interface ApprovalGateRequestInput {
  runId: string;
  stageId: string;
  stageName?: string;
  approvers: string[];
  reason?: string;
  tenantId?: string;
}

export class ApprovalGateService {
  private repository: ApprovalGateRepository;

  constructor(repository: ApprovalGateRepository) {
    if (!repository) throw new OrionError('ApprovalGateRepository is required', ErrorCode.INTERNAL_ERROR);
    this.repository = repository;
  }

  /**
   * 创建审批请求（Pipeline Engine 调用）
   */
  async requestApproval(input: ApprovalGateRequestInput): Promise<ApprovalGate> {
    return this.createGate(input.tenantId || getCurrentTenantId(), {
      runId: input.runId,
      stageId: input.stageId,
      requestedBy: input.approvers[0] || 'system',
      approverIds: input.approvers,
      metadata: { stageName: input.stageName, reason: input.reason },
    });
  }

  /**
   * 创建审批门禁
   */
  async createGate(tenantId: string, input: ApprovalGateCreateInput): Promise<ApprovalGate> {
    const entity = await this.repository.create({
      tenantId,
      runId: input.runId,
      stageId: input.stageId,
      requestedBy: input.requestedBy,
      approverIds: input.approverIds,
      metadata: input.metadata,
    });
    return this.mapEntityToGate(entity);
  }

  /**
   * 根据 Run ID 获取所有审批门禁
   */
  async getByRun(runId: string): Promise<ApprovalGate[]> {
    const entities = await this.repository.findByRunId(runId);
    return entities.map(e => this.mapEntityToGate(e));
  }

  /**
   * 获取特定 Stage 的审批状态
   */
  async getStatus(runId: string, stageId: string): Promise<ApprovalGateStatus | undefined> {
    const entity = await this.repository.findByRunAndStage(runId, stageId);
    if (!entity) return undefined;

    const gate = this.mapEntityToGate(entity);

    return {
      gate,
      status: gate.status,
      canProceed: gate.status === 'approved',
      message:
        gate.status === 'approved'
          ? 'Approved, stage can proceed'
          : gate.status === 'rejected'
          ? `Rejected: ${gate.comment || 'No comment'}`
          : `Pending approval from: ${gate.approverIds.join(', ')}`,
    };
  }

  /**
   * 审批通过
   */
  async approve(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<ApprovalGate> {
    const entity = await this.repository.findByRunAndStage(runId, stageId);
    if (!entity) {
      throw new OrionError('No pending approval request found for this stage', ErrorCode.OPERATION_FAILED);
    }
    if (entity.status !== 'pending') {
      throw new OrionError(`Approval is ${entity.status}, not pending`, 'OPERATION_FAILED')
    }
    if (!entity.approverIds.includes(userId)) {
      throw new OrionError('Not authorized to approve', ErrorCode.OPERATION_FAILED);
    }

    const now = new Date();
    const updated = await this.repository.update(entity.id, {
      status: 'approved',
      reviewedBy: userId,
      reviewedAt: now,
      comment: comment || undefined,
    });

    if (!updated) {
      throw new OrionError('Failed to update approval gate', ErrorCode.OPERATION_FAILED);
    }

    return this.mapEntityToGate(updated);
  }

  /**
   * 审批拒绝
   */
  async reject(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<ApprovalGate> {
    const entity = await this.repository.findByRunAndStage(runId, stageId);
    if (!entity) {
      throw new OrionError('No pending approval request found for this stage', ErrorCode.OPERATION_FAILED);
    }
    if (entity.status !== 'pending') {
      throw new OrionError(`Approval is ${entity.status}, not pending`, 'OPERATION_FAILED')
    }
    if (!entity.approverIds.includes(userId)) {
      throw new OrionError('Not authorized to reject', ErrorCode.VALIDATION_ERROR);
    }

    const now = new Date();
    const updated = await this.repository.update(entity.id, {
      status: 'rejected',
      reviewedBy: userId,
      reviewedAt: now,
      comment: comment || undefined,
    });

    if (!updated) {
      throw new OrionError('Failed to update approval gate', ErrorCode.OPERATION_FAILED);
    }

    return this.mapEntityToGate(updated);
  }

  /**
   * 取消审批门禁
   */
  async cancelGate(runId: string, stageId: string): Promise<void> {
    const entity = await this.repository.findByRunAndStage(runId, stageId);
    if (!entity) return;

    await this.repository.update(entity.id, {
      status: 'cancelled',
    });
  }

  /**
   * 检查 Stage 是否需要审批门禁
   */
  async isApprovalRequired(runId: string, stageId: string): Promise<boolean> {
    return this.repository.isApprovalRequired(runId, stageId);
  }

  /**
   * 获取待审批列表（按审批人）
   */
  async getPendingByApprover(approverId: string, tenantId: string): Promise<ApprovalGate[]> {
    const entities = await this.repository.findPendingByApprover(approverId, tenantId);
    return entities.map(e => this.mapEntityToGate(e));
  }

  /**
   * Map entity to ApprovalGate
   */
  private mapEntityToGate(entity: ApprovalGateEntity): ApprovalGate {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      runId: entity.runId,
      stageId: entity.stageId,
      status: entity.status,
      requestedBy: entity.requestedBy,
      requestedAt: entity.requestedAt,
      reviewedBy: entity.reviewedBy,
      reviewedAt: entity.reviewedAt,
      comment: entity.comment,
      approverIds: entity.approverIds,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export default ApprovalGateService;
