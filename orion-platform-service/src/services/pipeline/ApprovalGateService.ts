/**
 * ApprovalGateService - Pipeline 审批门禁服务
 *
 * 管理 Pipeline Run 中每个 Stage 的审批门禁。
 * 当 Pipeline 配置了审批阶段时，执行到该阶段会暂停，等待人工审批。
 */
import { Pool } from 'pg';
import { ApprovalGateRepository, ApprovalGateEntity } from '../../repositories/ApprovalGateRepository';
import { OrionError, ErrorCode } from '../../errors';

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
  private pool: Pool | null;
  private repository: ApprovalGateRepository | null = null;

  constructor(options?: { db?: Pool; repository?: ApprovalGateRepository }) {
    this.pool = options?.db ?? null;
    if (options?.repository) {
      this.repository = options.repository;
    } else if (this.pool) {
      this.repository = new ApprovalGateRepository(this.pool);
    }
  }

  /**
   * 创建审批请求（Pipeline Engine 调用）
   */
  async requestApproval(input: ApprovalGateRequestInput): Promise<ApprovalGate> {
    return this.createGate(input.tenantId || 'default', {
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
    if (this.repository) {
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

    // Fallback to in-memory if no repository
    const now = new Date();
    const gate: ApprovalGate = {
      id: `gate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      tenantId,
      runId: input.runId,
      stageId: input.stageId,
      status: 'pending',
      requestedBy: input.requestedBy,
      requestedAt: now,
      approverIds: input.approverIds,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    if (this.pool) {
      await this.pool.query(
        `INSERT INTO approval_gates (id, tenant_id, run_id, stage_id, status, requested_by, approver_ids, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          gate.id,
          gate.tenantId,
          gate.runId,
          gate.stageId,
          gate.status,
          gate.requestedBy,
          JSON.stringify(gate.approverIds),
          gate.metadata ? JSON.stringify(gate.metadata) : null,
          gate.createdAt,
          gate.updatedAt,
        ]
      );
    }

    return gate;
  }

  /**
   * 根据 Run ID 获取所有审批门禁
   */
  async getByRun(runId: string): Promise<ApprovalGate[]> {
    if (this.repository) {
      const entities = await this.repository.findByRunId(runId);
      return entities.map(e => this.mapEntityToGate(e));
    }
    return [];
  }

  /**
   * 获取特定 Stage 的审批状态
   */
  async getStatus(runId: string, stageId: string): Promise<ApprovalGateStatus | undefined> {
    let gate: ApprovalGate | undefined;

    if (this.repository) {
      const entity = await this.repository.findByRunAndStage(runId, stageId);
      if (entity) {
        gate = this.mapEntityToGate(entity);
      }
    }

    if (!gate) return undefined;

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
    if (this.repository) {
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

    // Fallback to in-memory (should not reach here in normal operation)
    throw new OrionError('Repository required for approval operation', ErrorCode.VALIDATION_ERROR);
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
    if (this.repository) {
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

    // Fallback to in-memory (should not reach here in normal operation)
    throw new OrionError('Repository required for reject operation', ErrorCode.VALIDATION_ERROR);
  }

  /**
   * 取消审批门禁
   */
  async cancelGate(runId: string, stageId: string): Promise<void> {
    if (this.repository) {
      const entity = await this.repository.findByRunAndStage(runId, stageId);
      if (!entity) return;

      await this.repository.update(entity.id, {
        status: 'cancelled',
      });
      return;
    }

    // Fallback to in-memory
    if (this.pool) {
      const result = await this.pool.query(
        `UPDATE approval_gates SET status = 'cancelled', updated_at = $1 WHERE run_id = $2 AND stage_id = $3`,
        [new Date(), runId, stageId]
      );
    }
  }

  /**
   * 检查 Stage 是否需要审批门禁
   */
  async isApprovalRequired(runId: string, stageId: string): Promise<boolean> {
    if (this.repository) {
      return this.repository.isApprovalRequired(runId, stageId);
    }
    return false;
  }

  /**
   * 获取待审批列表（按审批人）
   */
  async getPendingByApprover(approverId: string, tenantId: string): Promise<ApprovalGate[]> {
    if (this.repository) {
      const entities = await this.repository.findPendingByApprover(approverId, tenantId);
      return entities.map(e => this.mapEntityToGate(e));
    }
    return [];
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
