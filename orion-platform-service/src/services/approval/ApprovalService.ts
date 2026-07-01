/**
 * Approval Service - Multi-level approval workflow
 *
 * P0-7 Fix: Migrated from Map-based primary storage to ApprovalRepository-based storage.
 * Map is no longer used - all data is persisted to PostgreSQL.
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { ApprovalRepository, ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';
import { OrionError, ErrorCode } from '../../errors';

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
  private repository: ApprovalRepository;
  private db: { transaction?: <T>(fn: (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) => Promise<T>) => Promise<T> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>; transaction?: <T>(fn: (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) => Promise<T>) => Promise<T> }) {
    this.db = db;
    this.repository = new ApprovalRepository(db);
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
      tenantId: metadata?.tenantId ?? 'default',
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

    return this.entityToRequest(entity, approverIds);
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

  // ==================== Helper Methods ====================

  private entityToRequest(
    entity: ApprovalEntity,
    approverIds: string[],
    steps?: ApprovalStepEntity[],
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
    };
  }

  private entityToRequestWithSteps(
    entity: ApprovalEntity,
    steps: ApprovalStepEntity[],
  ): ApprovalRequest {
    const approverIds = steps.map(s => s.approverId ?? '');
    return this.entityToRequest(entity, approverIds, steps);
  }
}
