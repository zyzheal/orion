/**
 * Approval Service - Multi-level approval workflow
 *
 * P0-7 Fix: Migrated from Map-based primary storage to ApprovalRepository-based storage.
 * Map is no longer used - all data is persisted to PostgreSQL.
 */
import { createLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { ApprovalRepository, ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';
import { OrionError, ErrorCode } from '../../errors';
import { KnowledgeIntegrationService, ApprovalKnowledgeContext, KnowledgeRecommendation } from '../knowledge/KnowledgeIntegrationService';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

const logger = createLogger('approval');

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export interface ApprovalStatistics {
  totalApprovals: number;
  approvedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  pendingCount: number;
  approvalRate: number;
  averageDurationMs: number;
  byStatus: Record<string, number>;
}

export interface ApprovalTrendDataPoint {
  period: string;
  created: number;
  approved: number;
  rejected: number;
  cancelled: number;
  pending: number;
}

export interface ApprovalTrendReport {
  dataPoints: ApprovalTrendDataPoint[];
  totalCreated: number;
  totalProcessed: number;
  trend: 'increasing' | 'decreasing' | 'stable';
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
  knowledgeRecommendations?: KnowledgeRecommendation[];
}

export class ApprovalService {
  private repository: ApprovalRepository;
  private db: { transaction?: <T>(fn: (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) => Promise<T>) => Promise<T> };
  private knowledgeIntegration?: KnowledgeIntegrationService;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>; transaction?: <T>(fn: (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) => Promise<T>) => Promise<T> }, knowledgeIntegration?: KnowledgeIntegrationService) {
    this.db = db;
    this.repository = new ApprovalRepository(db);
    this.knowledgeIntegration = knowledgeIntegration;
  }

  private async withTransaction<T>(fn: (repo: ApprovalRepository) => Promise<T>): Promise<T> {
    if (this.db.transaction) {
      return this.db.transaction(async (client) => {
        const txRepo = new ApprovalRepository(client);
        return fn(txRepo);
      });
    }
    return fn(this.repository);
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
    const id = `approval_${uuidv4()}`;
    const now = new Date();

    const entity = await this.repository.create({
      tenantId: metadata?.tenantId ?? getCurrentTenantId(),
      definitionId: null,
      resourceType: metadata?.resourceType ?? 'generic',
      resourceId: metadata?.resourceId ?? id,
      title,
      status: 'pending',
      requestedBy: requesterId,
      currentStep: 0,
      totalSteps: approverIds.length,
      requiredApprovals: requiredApprovals,
      result: null,
      completedAt: null,
      createdAt: now,
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

    logger.info({ approvalId: entity.id }, 'Approval request created');

    // 查询知识库推荐（审批建议）
    let knowledgeRecommendations: KnowledgeRecommendation[] | undefined;
    if (this.knowledgeIntegration) {
      try {
        knowledgeRecommendations = await this.knowledgeIntegration.getApprovalRecommendations(
          metadata?.tenantId || getCurrentTenantId(),
          {
            title,
            description,
            resourceType: metadata?.resourceType,
            environment: metadata?.environment?.toString(),
            riskLevel: metadata?.riskLevel?.toString(),
          },
          5
        );
        logger.info({ approvalId: entity.id, recCount: knowledgeRecommendations.length }, 'Knowledge recommendations fetched for approval');
      } catch (err) {
        logger.warn({ err, approvalId: entity.id }, 'Failed to fetch knowledge recommendations for approval');
      }
    }

    return this.entityToRequest(entity, approverIds, undefined, knowledgeRecommendations);
  }

  /**
   * Approve
   * P1 Fix: Write operations (updateStepStatus, advanceStep, updateStatus) are wrapped in a transaction
   * to ensure atomicity — if advanceStep fails after updateStepStatus succeeds, the approval won't be left in an inconsistent state.
   */
  async approve(approvalId: string, userId: string): Promise<ApprovalRequest> {
    // Pre-read: entity and steps (read-only, can happen outside transaction)
    const entity = await this.repository.findById(approvalId);
    if (!entity) throw new OrionError(`Approval not found: ${approvalId}`, ErrorCode.NOT_FOUND);
    if (entity.status !== 'pending') throw new OrionError('Approval not pending', ErrorCode.OPERATION_FAILED);

    const steps = await this.repository.findStepsByApproval(approvalId);
    const matchingStep = steps.find(s => s.approverId === userId);
    if (!matchingStep) throw new OrionError('Not authorized to approve', ErrorCode.OPERATION_FAILED);
    if (matchingStep.status === 'approved') {
      // Already approved, return current state
      return this.entityToRequestWithSteps(entity, steps);
    }

    // Atomic write: updateStepStatus → advanceStep → (optional) updateStatus → final read
    return this.withTransaction(async (txRepo: ApprovalRepository) => {
      await txRepo.updateStepStatus(matchingStep.id, 'approved', undefined, new Date());
      await txRepo.advanceStep(approvalId);

      const updatedSteps = await txRepo.findStepsByApproval(approvalId);
      const approvedCount = updatedSteps.filter(s => s.status === 'approved').length;

      if (approvedCount >= entity.requiredApprovals) {
        await txRepo.updateStatus(approvalId, 'approved');
      }

      const updatedEntity = await txRepo.findById(approvalId);
      return this.entityToRequestWithSteps(updatedEntity!, updatedSteps);
    });
  }

  /**
   * Reject
   * P1 Fix: Write operations wrapped in transaction for atomicity.
   */
  async reject(approvalId: string, userId: string): Promise<ApprovalRequest> {
    // Pre-read: entity and steps (read-only)
    const entity = await this.repository.findById(approvalId);
    if (!entity) throw new OrionError(`Approval not found: ${approvalId}`, ErrorCode.NOT_FOUND);
    if (entity.status !== 'pending') throw new OrionError('Approval not pending', ErrorCode.OPERATION_FAILED);

    const steps = await this.repository.findStepsByApproval(approvalId);
    const matchingStep = steps.find(s => s.approverId === userId);
    if (!matchingStep) throw new OrionError('Not authorized to reject', ErrorCode.VALIDATION_ERROR);

    // Atomic write: updateStepStatus → updateStatus → final reads
    return this.withTransaction(async (txRepo: ApprovalRepository) => {
      await txRepo.updateStepStatus(matchingStep.id, 'rejected', undefined, new Date());
      await txRepo.updateStatus(approvalId, 'rejected');

      const updatedSteps = await txRepo.findStepsByApproval(approvalId);
      const updatedEntity = await txRepo.findById(approvalId);
      return this.entityToRequestWithSteps(updatedEntity!, updatedSteps);
    });
  }

  /**
   * Get approval request
   */
  async getApproval(id: string): Promise<ApprovalRequest | undefined> {
    const entity = await this.repository.findById(id);
    if (!entity) return undefined;

    const steps = await this.repository.findStepsByApproval(id);
    const approverIds = steps.map(s => s.approverId ?? '');
    return this.entityToRequest(entity, approverIds, steps);
  }

  /**
   * List pending approvals
   */
  async listPending(tenantId?: string): Promise<ApprovalRequest[]> {
    if (!tenantId) {
      // Without tenant, return all pending
      const entities = await this.repository.findAll({ limit: 100 });
      const result: ApprovalRequest[] = [];
      for (const entity of entities.entities) {
        if (entity.status === 'pending') {
          const steps = await this.repository.findStepsByApproval(entity.id);
          result.push(this.entityToRequestWithSteps(entity, steps));
        }
      }
      return result;
    }

    const entities = await this.repository.findPendingByTenant(tenantId);
    const result: ApprovalRequest[] = [];
    for (const entity of entities) {
      const steps = await this.repository.findStepsByApproval(entity.id);
      result.push(this.entityToRequestWithSteps(entity, steps));
    }
    return result;
  }

  // ==================== New Features: Withdraw, Cancel, Statistics, Trend, Delegate ====================

  /**
   * Withdraw an approval step (approver takes back their approval/rejection)
   */
  async withdrawApproval(approvalId: string, userId: string, reason?: string): Promise<ApprovalRequest> {
    const entity = await this.repository.findById(approvalId);
    if (!entity) throw new OrionError(`Approval not found: ${approvalId}`, ErrorCode.NOT_FOUND);
    if (entity.status !== 'pending') throw new OrionError('Cannot withdraw from a completed approval', ErrorCode.OPERATION_FAILED);

    const steps = await this.repository.findStepsByApproval(approvalId);
    const matchingStep = steps.find(s => s.approverId === userId && s.status !== 'pending');
    if (!matchingStep) throw new OrionError('No actionable approval found for this user', ErrorCode.OPERATION_FAILED);

    return this.withTransaction(async (txRepo: ApprovalRepository) => {
      await txRepo.updateStepStatus(matchingStep.id, 'pending', reason, new Date());
      const updatedSteps = await txRepo.findStepsByApproval(approvalId);
      const updatedEntity = await txRepo.findById(approvalId);
      return this.entityToRequestWithSteps(updatedEntity!, updatedSteps);
    });
  }

  /**
   * Cancel an approval request (requester cancels the entire request)
   */
  async cancelApproval(approvalId: string, userId: string, reason?: string): Promise<ApprovalRequest> {
    const entity = await this.repository.findById(approvalId);
    if (!entity) throw new OrionError(`Approval not found: ${approvalId}`, ErrorCode.NOT_FOUND);
    if (entity.status !== 'pending') throw new OrionError('Cannot cancel a completed approval', ErrorCode.OPERATION_FAILED);
    if (entity.requestedBy !== userId) {
      throw new OrionError('Only the requester can cancel this approval', ErrorCode.OPERATION_FAILED);
    }

    return this.withTransaction(async (txRepo: ApprovalRepository) => {
      await txRepo.updateStatus(approvalId, 'cancelled', new Date());
      const updatedSteps = await txRepo.findStepsByApproval(approvalId);
      const updatedEntity = await txRepo.findById(approvalId);
      return this.entityToRequestWithSteps(updatedEntity!, updatedSteps);
    });
  }

  /**
   * Delegate an approval step to another user
   */
  async delegateApproval(approvalId: string, fromUserId: string, toUserId: string, reason?: string): Promise<ApprovalRequest> {
    const entity = await this.repository.findById(approvalId);
    if (!entity) throw new OrionError(`Approval not found: ${approvalId}`, ErrorCode.NOT_FOUND);
    if (entity.status !== 'pending') throw new OrionError('Cannot delegate for a completed approval', ErrorCode.OPERATION_FAILED);

    const steps = await this.repository.findStepsByApproval(approvalId);
    const matchingStep = steps.find(s => s.approverId === fromUserId && s.status === 'pending');
    if (!matchingStep) throw new OrionError('No pending approval step found for this user', ErrorCode.OPERATION_FAILED);

    return this.withTransaction(async (txRepo: ApprovalRepository) => {
      await txRepo.updateStepApprover(matchingStep.id, toUserId, reason);
      const updatedSteps = await txRepo.findStepsByApproval(approvalId);
      const updatedEntity = await txRepo.findById(approvalId);
      return this.entityToRequestWithSteps(updatedEntity!, updatedSteps);
    });
  }

  /**
   * Reassign an approval step to another user (requester or system admin action)
   * @param fromUserId - user performing the reassignment (must be requester)
   * @param fromApproverId - specific approver whose step is being reassigned (defaults to fromUserId)
   */
  async reassignApproval(approvalId: string, fromUserId: string, toUserId: string, reason?: string, fromApproverId?: string): Promise<ApprovalRequest> {
    const entity = await this.repository.findById(approvalId);
    if (!entity) throw new OrionError(`Approval not found: ${approvalId}`, ErrorCode.NOT_FOUND);
    if (entity.status !== 'pending') throw new OrionError('Cannot reassign for a completed approval', ErrorCode.OPERATION_FAILED);

    // Only requester or system admin can reassign
    if (entity.requestedBy !== fromUserId) {
      throw new OrionError('Only the requester can reassign this approval', ErrorCode.OPERATION_FAILED);
    }

    const steps = await this.repository.findStepsByApproval(approvalId);
    if (steps.length === 0) throw new OrionError('No approval steps found', ErrorCode.OPERATION_FAILED);

    // Use fromApproverId if provided (requester reassigning a specific approver),
    // otherwise fall back to fromUserId (backward compatibility when requester is also an approver)
    const sourceApproverId = fromApproverId ?? fromUserId;

    return this.withTransaction(async (txRepo: ApprovalRepository) => {
      // Reassign all pending steps from sourceApproverId to toUserId
      for (const step of steps) {
        if (step.approverId === sourceApproverId && step.status === 'pending') {
          await txRepo.updateStepApprover(step.id, toUserId, reason);
        }
      }
      const updatedSteps = await txRepo.findStepsByApproval(approvalId);
      const updatedEntity = await txRepo.findById(approvalId);
      return this.entityToRequestWithSteps(updatedEntity!, updatedSteps);
    });
  }

  /**
   * Get approval statistics for a tenant over a period
   */
  async getApprovalStatistics(tenantId: string, periodStart: Date, periodEnd: Date): Promise<ApprovalStatistics> {
    const result = await this.repository.findStatisticsByTenant(tenantId, periodStart, periodEnd);
    const total = result.totalApprovals;
    const approved = result.approvedCount;
    const rejected = result.rejectedCount;
    const cancelled = result.cancelledCount;
    const pending = result.pendingCount;

    return {
      totalApprovals: total,
      approvedCount: approved,
      rejectedCount: rejected,
      cancelledCount: cancelled,
      pendingCount: pending,
      approvalRate: total > 0 ? (approved / total) * 100 : 0,
      averageDurationMs: result.averageDurationMs,
      byStatus: {
        pending,
        approved,
        rejected,
        cancelled,
      },
    };
  }

  /**
   * Get approval trend for a tenant over a period (daily granularity)
   */
  async getApprovalTrend(tenantId: string, periodStart: Date, periodEnd: Date): Promise<ApprovalTrendReport> {
    const rows = await this.repository.findTrendByTenant(tenantId, periodStart, periodEnd);
    const dataPoints: ApprovalTrendDataPoint[] = rows.map(row => ({
      period: row.period,
      created: parseInt(row.created, 10),
      approved: parseInt(row.approved, 10),
      rejected: parseInt(row.rejected, 10),
      cancelled: parseInt(row.cancelled, 10),
      pending: parseInt(row.pending, 10),
    }));

    const totalCreated = dataPoints.reduce((sum, dp) => sum + dp.created, 0);
    const totalProcessed = dataPoints.reduce((sum, dp) => sum + dp.approved + dp.rejected + dp.cancelled, 0);

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (dataPoints.length >= 2) {
      const recent = dataPoints.slice(-3).reduce((s, dp) => s + dp.created, 0) / Math.max(dataPoints.length, 1);
      const earlier = dataPoints.slice(0, -3).reduce((s, dp) => s + dp.created, 0) / Math.max(dataPoints.length - 3, 1);
      if (recent > earlier * 1.1) trend = 'increasing';
      else if (recent < earlier * 0.9) trend = 'decreasing';
    }

    return { dataPoints, totalCreated, totalProcessed, trend };
  }

  // ==================== Helper Methods ====================

  private entityToRequest(
    entity: ApprovalEntity,
    approverIds: string[],
    steps?: ApprovalStepEntity[],
    knowledgeRecommendations?: KnowledgeRecommendation[],
  ): ApprovalRequest {
    const approvals = steps?.filter(s => s.status === 'approved').map(s => s.approverId ?? '') ?? [];
    const rejections = steps?.filter(s => s.status === 'rejected').map(s => s.approverId ?? '') ?? [];

    return {
      id: entity.id,
      title: entity.title || `Approval for ${entity.resourceType}`,
      requesterId: entity.requestedBy ?? '',
      approverIds,
      status: entity.status as ApprovalStatus,
      approvals,
      rejections,
      requiredApprovals: entity.requiredApprovals,
      createdAt: entity.createdAt,
      updatedAt: entity.completedAt ?? entity.createdAt,
      metadata: entity.metadata as Record<string, any> | undefined,
      knowledgeRecommendations,
    };
  }

  private entityToRequestWithSteps(
    entity: ApprovalEntity,
    steps: ApprovalStepEntity[],
    knowledgeRecommendations?: KnowledgeRecommendation[],
  ): ApprovalRequest {
    return this.entityToRequest(entity, steps.map(s => s.approverId ?? ''), steps, knowledgeRecommendations);
  }
}
