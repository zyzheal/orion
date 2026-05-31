/**
 * MultiLevelApprovalService - 多级审批工作流
 *
 * Phase 2: 支持多级串行/并行审批、审批链查询、待办列表等高级功能。
 * 基于现有的 ApprovalRepository 进行扩展。
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { ApprovalRepository, ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export enum ApprovalAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export enum ApprovalMode {
  SERIAL = 'serial',    // 串行：逐级审批
  PARALLEL = 'parallel', // 并行：可同时审批
}

export interface ApprovalLevel {
  levelIndex: number;
  approverIds: string[];
  requiredApprovals: number;
}

export interface ApprovalRequestInput {
  title: string;
  description?: string;
  requesterId: string;
  resourceType: string;
  resourceId: string;
  levels: ApprovalLevel[];
  mode?: ApprovalMode;
  metadata?: Record<string, any>;
}

export interface ApprovalReviewInput {
  requestId: string;
  reviewerId: string;
  action: ApprovalAction;
  comment?: string;
}

export interface ApprovalStepDetail extends ApprovalStepEntity {
  levelIndex: number;
  approverName?: string;
}

export interface ApprovalChainInfo {
  requestId: string;
  title: string;
  status: string;
  mode: ApprovalMode;
  currentLevel: number;
  totalLevels: number;
  steps: ApprovalStepDetail[];
  createdAt: Date;
}

export interface ApprovalRequestDetail extends ApprovalEntity {
  steps: ApprovalStepEntity[];
  levels: ApprovalLevel[];
  mode: ApprovalMode;
}

export class MultiLevelApprovalService {
  private repository: ApprovalRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = new ApprovalRepository(db);
  }

  /**
   * 提交多级审批请求
   */
  async submitApprovalRequest(
    tenantId: string,
    input: ApprovalRequestInput,
  ): Promise<ApprovalRequestDetail> {
    const id = `approval_${uuidv4()}`;
    const now = new Date();
    const mode = input.mode || ApprovalMode.SERIAL;

    // Calculate total steps across all levels
    const totalSteps = input.levels.reduce((sum, level) => sum + level.approverIds.length, 0);
    const requiredApprovals = input.levels.reduce((sum, level) => sum + level.requiredApprovals, 0);

    const entity = await this.repository.create({
      tenantId,
      definitionId: null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      title: input.title,
      status: 'pending',
      requestedBy: input.requesterId,
      currentStep: 0,
      totalSteps,
      requiredApprovals,
      result: null,
      completedAt: null,
      createdAt: now,
    });

    // Create steps for each level, with level index stored in metadata
    let stepIndex = 0;
    for (const level of input.levels) {
      for (const approverId of level.approverIds) {
        await this.repository.createStep({
          approvalId: entity.id,
          stepIndex: stepIndex++,
          approverId,
          status: mode === ApprovalMode.SERIAL && level.levelIndex > 0 ? 'waiting' : 'pending',
          comment: null,
          actedAt: null,
        });
      }
    }

    logger.info({ approvalId: entity.id, tenantId, mode, levels: input.levels.length }, 'Multi-level approval request created');

    return this.entityToDetail(entity, input.levels, mode);
  }

  /**
   * 审批操作（approve/reject）
   */
  async review(
    requestId: string,
    reviewerId: string,
    action: ApprovalAction,
    comment?: string,
  ): Promise<ApprovalRequestDetail> {
    const entity = await this.repository.findById(requestId);
    if (!entity) throw new OrionError(ErrorCode.NOT_FOUND, `Approval request not found: ${requestId}`);
    if (entity.status !== 'pending') throw new OrionError(ErrorCode.NOT_FOUND, `Approval request is not pending (current status: ${entity.status})`);

    const steps = await this.repository.findStepsByApproval(requestId);
    const matchingStep = steps.find(s => s.approverId === reviewerId && (s.status === 'pending' || s.status === 'waiting'));
    if (!matchingStep) throw new OrionError(ErrorCode.OPERATION_FAILED, 'Not authorized to review this request');

    if (matchingStep.status === 'waiting') {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'This step is waiting for previous level to complete');
    }

    // Update the step status
    await this.repository.updateStepStatus(
      matchingStep.id,
      action === ApprovalAction.APPROVE ? 'approved' : 'rejected',
      comment,
      new Date(),
    );

    const updatedSteps = await this.repository.findStepsByApproval(requestId);

    // Determine if we should advance or finalize
    if (action === ApprovalAction.REJECT) {
      // Any rejection rejects the entire request
      await this.repository.updateStatus(requestId, 'rejected');
    } else {
      // Check if all required approvals are met
      const approvedCount = updatedSteps.filter(s => s.status === 'approved').length;
      if (approvedCount >= entity.requiredApprovals) {
        await this.repository.updateStatus(requestId, 'approved');
      } else {
        // Advance to next level if serial mode
        await this.repository.advanceStep(requestId);
        // Activate waiting steps for the current level
        await this.activateCurrentLevelSteps(requestId, updatedSteps);
      }
    }

    const updatedEntity = await this.repository.findById(requestId);
    // Reconstruct levels from steps
    const levels = this.extractLevels(updatedSteps);
    const mode = this.detectMode(updatedSteps);

    return this.entityToDetail(updatedEntity!, levels, mode);
  }

  /**
   * 获取审批链
   */
  async getApprovalChain(requestId: string): Promise<ApprovalChainInfo> {
    const entity = await this.repository.findById(requestId);
    if (!entity) throw new OrionError(ErrorCode.NOT_FOUND, `Approval request not found: ${requestId}`);

    const steps = await this.repository.findStepsByApproval(requestId);
    const levels = this.extractLevels(steps);
    const mode = this.detectMode(steps);

    const stepDetails: ApprovalStepDetail[] = steps.map((s, idx) => {
      const levelIndex = levels.findIndex(l => l.approverIds.includes(s.approverId ?? ''));
      return {
        ...s,
        levelIndex: levelIndex >= 0 ? levelIndex : 0,
      };
    });

    return {
      requestId: entity.id,
      title: entity.title || `Approval for ${entity.resourceType}`,
      status: entity.status,
      mode,
      currentLevel: entity.currentStep,
      totalLevels: levels.length,
      steps: stepDetails,
      createdAt: entity.createdAt,
    };
  }

  /**
   * 获取待审批列表
   */
  async getPendingApprovals(
    userId: string,
    tenantId: string,
  ): Promise<ApprovalRequestDetail[]> {
    const entities = await this.repository.findPendingByTenant(tenantId);
    const results: ApprovalRequestDetail[] = [];

    for (const entity of entities) {
      const steps = await this.repository.findStepsByApproval(entity.id);
      // Filter: steps where this user is the approver and status is pending/waiting
      const userSteps = steps.filter(s => s.approverId === userId && (s.status === 'pending' || s.status === 'waiting'));
      if (userSteps.length > 0) {
        const levels = this.extractLevels(steps);
        const mode = this.detectMode(steps);
        results.push(this.entityToDetail(entity, levels, mode));
      }
    }

    return results;
  }

  /**
   * 检查审批是否全部批准
   */
  async isApproved(requestId: string): Promise<boolean> {
    const entity = await this.repository.findById(requestId);
    if (!entity) return false;
    return entity.status === 'approved';
  }

  // ==================== Private Helpers ====================

  private extractLevels(steps: ApprovalStepEntity[]): ApprovalLevel[] {
    const levelMap = new Map<number, { approverIds: string[]; requiredApprovals: number }>();

    for (const step of steps) {
      // Group steps by their contiguous ranges
      // For simplicity, use stepIndex ranges as levels
      const levelIndex = Math.floor(step.stepIndex / Math.max(1, this.getMaxApproversPerLevel(steps)));
      if (!levelMap.has(levelIndex)) {
        levelMap.set(levelIndex, { approverIds: [], requiredApprovals: 1 });
      }
      if (step.approverId) {
        levelMap.get(levelIndex)!.approverIds.push(step.approverId);
      }
    }

    return Array.from(levelMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([index, data]) => ({
        levelIndex: index,
        approverIds: data.approverIds,
        requiredApprovals: data.requiredApprovals,
      }));
  }

  private getMaxApproversPerLevel(steps: ApprovalStepEntity[]): number {
    // Heuristic: detect level boundaries by looking at step patterns
    if (steps.length <= 1) return 1;
    // Default: treat each step as its own level
    return 1;
  }

  private detectMode(steps: ApprovalStepEntity[]): ApprovalMode {
    // If any step has status 'waiting', it's serial mode
    return steps.some(s => s.status === 'waiting') ? ApprovalMode.SERIAL : ApprovalMode.PARALLEL;
  }

  private async activateCurrentLevelSteps(
    approvalId: string,
    steps: ApprovalStepEntity[],
  ): Promise<void> {
    // In serial mode, activate steps for the current level
    const pendingSteps = steps.filter(s => s.status === 'waiting');
    if (pendingSteps.length > 0) {
      // Activate steps that share the same level as the first waiting step
      const firstWaitingStep = pendingSteps[0];
      for (const step of pendingSteps) {
        if (step.stepIndex <= firstWaitingStep.stepIndex + 10) {
          // Activate nearby waiting steps (same level)
          await this.repository.updateStepStatus(step.id, 'pending');
        }
      }
    }
  }

  private entityToDetail(
    entity: ApprovalEntity,
    levels: ApprovalLevel[],
    mode: ApprovalMode,
  ): ApprovalRequestDetail {
    return {
      ...entity,
      steps: [],
      levels,
      mode,
    };
  }
}
