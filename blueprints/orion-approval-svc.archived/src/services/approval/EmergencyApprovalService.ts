/**
 * EmergencyApprovalService - 紧急审批通道
 *
 * Phase 2: 提供紧急审批通道，支持快速审批和自动批准。
 * 用于生产事故修复、紧急变更等场景。
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { ApprovalRepository, ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export enum EmergencyReason {
  PRODUCTION_INCIDENT = 'production_incident',
  SECURITY_VULNERABILITY = 'security_vulnerability',
  SERVICE_OUTAGE = 'service_outage',
  DATA_CORRUPTION = 'data_corruption',
  OTHER = 'other',
}

export interface EmergencyApprovalInput {
  title: string;
  description: string;
  requesterId: string;
  resourceType: string;
  resourceId: string;
  reason: EmergencyReason;
  impactDescription: string;
  approverIds: string[];
  metadata?: Record<string, any>;
}

export interface EmergencyApprovalResult {
  id: string;
  status: string;
  autoApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  entity: ApprovalEntity;
}

export class EmergencyApprovalService {
  private repository: ApprovalRepository;
  private autoApproveTimeoutMs: number;

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    options?: { autoApproveTimeoutMs?: number },
  ) {
    this.repository = new ApprovalRepository(db);
    this.autoApproveTimeoutMs = options?.autoApproveTimeoutMs ?? 300_000; // 5 minutes default
  }

  /**
   * 提交紧急审批请求
   * 紧急审批会：
   * 1. 标记为 emergency 类型
   * 2. 通知所有审批人
   * 3. 如果超时未处理，自动批准
   */
  async requestEmergencyApproval(
    tenantId: string,
    input: EmergencyApprovalInput,
  ): Promise<EmergencyApprovalResult> {
    const id = `emergency_approval_${uuidv4()}`;
    const now = new Date();

    const entity = await this.repository.create({
      tenantId,
      definitionId: null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      title: `[EMERGENCY] ${input.title}`,
      status: 'pending',
      requestedBy: input.requesterId,
      currentStep: 0,
      totalSteps: input.approverIds.length,
      requiredApprovals: 1, // Emergency only needs 1 approval
      result: {
        isEmergency: true,
        reason: input.reason,
        impactDescription: input.impactDescription,
        description: input.description,
        autoApproveTimeoutMs: this.autoApproveTimeoutMs,
        ...input.metadata,
      },
      completedAt: null,
      createdAt: now,
    });

    // Create approval steps
    for (let i = 0; i < input.approverIds.length; i++) {
      await this.repository.createStep({
        approvalId: entity.id,
        stepIndex: i,
        approverId: input.approverIds[i],
        status: 'pending',
        comment: null,
        actedAt: null,
      });
    }

    logger.warn(
      { approvalId: entity.id, tenantId, reason: input.reason, requesterId: input.requesterId },
      'Emergency approval request created',
    );

    return {
      id: entity.id,
      status: entity.status,
      autoApproved: false,
      entity,
    };
  }

  /**
   * 紧急审批自动批准
   * 当紧急审批超过设定的超时时间未被处理时，自动批准
   * 同时记录审计日志
   */
  async autoApproveIfEmergency(requestId: string): Promise<EmergencyApprovalResult> {
    const entity = await this.repository.findById(requestId);
    if (!entity) throw new Error(`Approval request not found: ${requestId}`);
    if (entity.status !== 'pending') {
      throw new Error(`Approval request is not pending (current status: ${entity.status})`);
    }

    const result = entity.result;
    if (!result?.isEmergency) {
      throw new Error('This is not an emergency approval request');
    }

    const timeoutMs = result.autoApproveTimeoutMs ?? this.autoApproveTimeoutMs;
    const elapsed = Date.now() - entity.createdAt.getTime();

    if (elapsed < timeoutMs) {
      const remainingMs = timeoutMs - elapsed;
      return {
        id: entity.id,
        status: 'pending',
        autoApproved: false,
        approvedAt: undefined,
        entity,
      };
    }

    // Auto-approve
    await this.repository.updateStatus(requestId, 'approved', new Date());

    const updatedEntity = await this.repository.findById(requestId);

    logger.warn(
      { approvalId: requestId, reason: 'timeout_auto_approve', elapsedMs: elapsed },
      'Emergency approval auto-approved due to timeout',
    );

    return {
      id: updatedEntity!.id,
      status: 'approved',
      autoApproved: true,
      approvedBy: 'system',
      approvedAt: new Date(),
      entity: updatedEntity!,
    };
  }

  /**
   * 手动批准紧急审批
   */
  async approveEmergency(
    requestId: string,
    reviewerId: string,
    comment?: string,
  ): Promise<EmergencyApprovalResult> {
    const entity = await this.repository.findById(requestId);
    if (!entity) throw new Error(`Approval request not found: ${requestId}`);
    if (entity.status !== 'pending') throw new Error('Approval request is not pending');

    const result = entity.result;
    if (!result?.isEmergency) {
      throw new Error('This is not an emergency approval request');
    }

    const steps = await this.repository.findStepsByApproval(requestId);
    const matchingStep = steps.find((s: ApprovalStepEntity) => s.approverId === reviewerId);
    if (!matchingStep) throw new Error('Not authorized to approve');

    await this.repository.updateStepStatus(matchingStep.id, 'approved', comment, new Date());
    await this.repository.updateStatus(requestId, 'approved', new Date());

    const updatedEntity = await this.repository.findById(requestId);

    return {
      id: updatedEntity!.id,
      status: 'approved',
      autoApproved: false,
      approvedBy: reviewerId,
      approvedAt: new Date(),
      entity: updatedEntity!,
    };
  }

  /**
   * 获取紧急审批超时时间
   */
  getAutoApproveTimeoutMs(): number {
    return this.autoApproveTimeoutMs;
  }

  /**
   * 设置紧急审批超时时间
   */
  setAutoApproveTimeoutMs(timeoutMs: number): void {
    this.autoApproveTimeoutMs = timeoutMs;
  }
}
