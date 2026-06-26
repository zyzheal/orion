/**
 * ChangeRequestService - RFC Approval Chain business logic
 *
 * Orchestrates change request lifecycle: CRUD, multi-level approval,
 * and execution step management.
 */

import pino from 'pino';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import { ChangeRequestRepository, ChangeRequestEntity, ChangeRequestFilters } from './ChangeRequestRepository';
import { ChangeApprovalRepository, ChangeApprovalEntity } from './ChangeApprovalRepository';
import { ChangeExecutionRepository, ChangeExecutionEntity } from './ChangeExecutionRepository';

const logger = pino({ name: 'ChangeRequestService' });

// Approval chain configuration by risk level
const APPROVAL_CHAIN: Record<string, { role: string; order: number }[]> = {
  low: [{ role: 'supervisor', order: 1 }],
  medium: [
    { role: 'supervisor', order: 1 },
    { role: 'manager', order: 2 },
  ],
  high: [
    { role: 'supervisor', order: 1 },
    { role: 'manager', order: 2 },
    { role: 'cto', order: 3 },
  ],
  critical: [
    { role: 'supervisor', order: 1 },
    { role: 'manager', order: 2 },
    { role: 'cto', order: 3 },
  ],
};

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['implementing', 'cancelled'],
  rejected: ['draft', 'cancelled'],
  implementing: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['draft'],
};

export interface CreateChangeRequestInput {
  title: string;
  description?: string;
  changeType: string; // standard/normal/emergency
  riskLevel?: string;
  impactScope?: string;
  rollbackPlan?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  createdBy?: string;
}

export interface UpdateChangeRequestInput {
  title?: string;
  description?: string;
  changeType?: string;
  riskLevel?: string;
  impactScope?: string;
  rollbackPlan?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
}

export interface CreateExecutionStepInput {
  stepOrder: number;
  stepName: string;
  stepType?: string;
}

export class ChangeRequestService {
  constructor(
    private readonly requestRepo: ChangeRequestRepository,
    private readonly approvalRepo: ChangeApprovalRepository,
    private readonly executionRepo: ChangeExecutionRepository,
  ) {}

  // ==================== Change Request CRUD ====================

  async listRequests(filters?: ChangeRequestFilters): Promise<ChangeRequestEntity[]> {
    const tenantId = getCurrentTenantId();
    if (filters && (filters.status || filters.changeType || filters.riskLevel)) {
      const result = await this.requestRepo.findWithFilters(tenantId, filters);
      return result.entities;
    }
    const result = await this.requestRepo.findByTenant(tenantId);
    return result.entities;
  }

  async getRequest(id: string): Promise<ChangeRequestEntity> {
    const request = await this.requestRepo.findById(id);
    if (!request) {
      throw new OrionError(`Change request not found: ${id}`, 'NOT_FOUND');
    }
    return request;
  }

  async createRequest(input: CreateChangeRequestInput): Promise<ChangeRequestEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, title: input.title, changeType: input.changeType }, 'Creating change request');

    const request = await this.requestRepo.create({
      tenantId,
      title: input.title,
      description: input.description ?? null,
      changeType: input.changeType,
      riskLevel: input.riskLevel ?? 'low',
      impactScope: input.impactScope ?? null,
      rollbackPlan: input.rollbackPlan ?? null,
      scheduledStart: input.scheduledStart ?? null,
      scheduledEnd: input.scheduledEnd ?? null,
      status: 'draft',
      createdBy: input.createdBy ?? null,
    });

    logger.info({ requestId: request.id }, 'Change request created');
    return request;
  }

  async updateRequest(id: string, input: UpdateChangeRequestInput): Promise<ChangeRequestEntity> {
    const existing = await this.getRequest(id);
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new OrionError('Only draft or rejected change requests can be updated', 'STATE_CONFLICT');
    }

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.changeType !== undefined) updateData.changeType = input.changeType;
    if (input.riskLevel !== undefined) updateData.riskLevel = input.riskLevel;
    if (input.impactScope !== undefined) updateData.impactScope = input.impactScope;
    if (input.rollbackPlan !== undefined) updateData.rollbackPlan = input.rollbackPlan;
    if (input.scheduledStart !== undefined) updateData.scheduledStart = input.scheduledStart;
    if (input.scheduledEnd !== undefined) updateData.scheduledEnd = input.scheduledEnd;

    const updated = await this.requestRepo.update(id, updateData);
    logger.info({ requestId: id }, 'Change request updated');
    return updated;
  }

  async deleteRequest(id: string): Promise<void> {
    const existing = await this.getRequest(id);
    if (existing.status !== 'draft' && existing.status !== 'cancelled') {
      throw new OrionError('Only draft or cancelled change requests can be deleted', 'STATE_CONFLICT');
    }
    await this.requestRepo.delete(id);
    logger.info({ requestId: id }, 'Change request deleted');
  }

  // ==================== Approval Chain ====================

  async submitForApproval(id: string): Promise<ChangeRequestEntity> {
    const existing = await this.getRequest(id);
    if (existing.status !== 'draft') {
      throw new OrionError('Only draft change requests can be submitted for approval', 'STATE_CONFLICT');
    }

    // Duplicate submission check — prevent creating duplicate approval chains
    const existingApprovals = await this.approvalRepo.listByChange(id);
    if (existingApprovals.length > 0) {
      throw new OrionError('Approval chain already exists for this change request', 'BIZ.RESOURCE.CONFLICT');
    }

    const tenantId = getCurrentTenantId();
    const chain = APPROVAL_CHAIN[existing.riskLevel] || APPROVAL_CHAIN.low;

    // Use transaction to ensure atomicity of approval chain creation + status update
    const db = this.requestRepo.getDb() as any;
    if (db.transaction) {
      await db.transaction(async (client: any) => {
        for (const step of chain) {
          await client.query(
            `INSERT INTO change_approval (tenant_id, change_request_id, approver_role, approver_id, approval_order, status, comment, decided_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [tenantId, id, step.role, null, step.order, 'pending', null, null],
          );
        }
        await client.query(
          `UPDATE change_request SET status = 'pending_approval', updated_at = NOW() WHERE id = $1`,
          [id],
        );
      });
    } else {
      for (const step of chain) {
        await this.approvalRepo.create({
          tenantId,
          changeRequestId: id,
          approverRole: step.role,
          approverId: null,
          approvalOrder: step.order,
          status: 'pending',
          comment: null,
          decidedAt: null,
        });
      }
      await this.requestRepo.update(id, { status: 'pending_approval' });
    }

    const updated = await this.getRequest(id);
    logger.info({ requestId: id, approvalSteps: chain.length }, 'Change request submitted for approval');
    return updated;
  }

  async approveRequest(changeId: string, approvalId: string, approverId: string, comment?: string): Promise<ChangeApprovalEntity> {
    const request = await this.getRequest(changeId);
    if (request.status !== 'pending_approval') {
      throw new OrionError('Change request is not in pending_approval status', 'STATE_CONFLICT');
    }

    const approval = await this.approvalRepo.findById(approvalId);
    if (!approval || approval.changeRequestId !== changeId) {
      throw new OrionError(`Approval record not found: ${approvalId}`, 'NOT_FOUND');
    }
    if (approval.status !== 'pending') {
      throw new OrionError('This approval step has already been decided', 'STATE_CONFLICT');
    }

    // Verify approval order — must be the next pending step
    const nextPending = await this.approvalRepo.getNextPending(changeId);
    if (!nextPending || nextPending.id !== approvalId) {
      throw new OrionError('Approval steps must be completed in order', 'STATE_CONFLICT');
    }

    const updated = await this.approvalRepo.approve(approvalId, approverId, comment);
    if (!updated) {
      throw new OrionError('Failed to update approval', 'OPERATION_FAILED');
    }

    // Check if all approvals are complete
    const allApproved = await this.approvalRepo.areAllApproved(changeId);
    if (allApproved) {
      await this.requestRepo.update(changeId, { status: 'approved' });
      logger.info({ requestId: changeId }, 'Change request fully approved');
    }

    logger.info({ requestId: changeId, approvalId, approverId }, 'Approval step completed');
    return updated;
  }

  async rejectRequest(changeId: string, approvalId: string, approverId: string, comment?: string): Promise<ChangeApprovalEntity> {
    const request = await this.getRequest(changeId);
    if (request.status !== 'pending_approval') {
      throw new OrionError('Change request is not in pending_approval status', 'STATE_CONFLICT');
    }

    const approval = await this.approvalRepo.findById(approvalId);
    if (!approval || approval.changeRequestId !== changeId) {
      throw new OrionError(`Approval record not found: ${approvalId}`, 'NOT_FOUND');
    }
    if (approval.status !== 'pending') {
      throw new OrionError('This approval step has already been decided', 'STATE_CONFLICT');
    }

    const updated = await this.approvalRepo.reject(approvalId, approverId, comment);
    if (!updated) {
      throw new OrionError('Failed to update approval', 'OPERATION_FAILED');
    }

    // Rejection rejects the entire request
    await this.requestRepo.update(changeId, { status: 'rejected' });
    logger.info({ requestId: changeId, approvalId, approverId }, 'Change request rejected');
    return updated;
  }

  async getApprovalChain(changeRequestId: string): Promise<ChangeApprovalEntity[]> {
    await this.getRequest(changeRequestId); // Verify exists
    return this.approvalRepo.listByChange(changeRequestId);
  }

  // ==================== Execution Management ====================

  async startExecution(changeRequestId: string, steps: CreateExecutionStepInput[]): Promise<ChangeExecutionEntity[]> {
    const request = await this.getRequest(changeRequestId);
    if (request.status !== 'approved') {
      throw new OrionError('Only approved change requests can start execution', 'STATE_CONFLICT');
    }

    const tenantId = getCurrentTenantId();

    // Use transaction to ensure atomicity of step creation + status update
    const db = this.requestRepo.getDb() as any;
    if (db.transaction) {
      return db.transaction(async (client: any) => {
        const createdSteps: ChangeExecutionEntity[] = [];
        for (const step of steps) {
          const result = await client.query(
            `INSERT INTO change_execution (tenant_id, change_request_id, step_order, step_name, step_type, status, started_at, completed_at, output, error, executed_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [tenantId, changeRequestId, step.stepOrder, step.stepName, step.stepType ?? 'manual', 'pending', null, null, null, null, null],
          );
          createdSteps.push(result.rows[0] as ChangeExecutionEntity);
        }
        await client.query(
          `UPDATE change_request SET status = 'implementing', updated_at = NOW() WHERE id = $1`,
          [changeRequestId],
        );
        logger.info({ requestId: changeRequestId, stepCount: steps.length }, 'Execution started');
        return createdSteps;
      });
    }

    // Fallback without transaction
    const createdSteps: ChangeExecutionEntity[] = [];
    for (const step of steps) {
      const execStep = await this.executionRepo.create({
        tenantId,
        changeRequestId,
        stepOrder: step.stepOrder,
        stepName: step.stepName,
        stepType: step.stepType ?? 'manual',
        status: 'pending',
        startedAt: null,
        completedAt: null,
        output: null,
        error: null,
        executedBy: null,
      });
      createdSteps.push(execStep);
    }
    await this.requestRepo.update(changeRequestId, { status: 'implementing' });
    logger.info({ requestId: changeRequestId, stepCount: steps.length }, 'Execution started');
    return createdSteps;
  }

  async updateExecutionStep(stepId: string, data: { status?: string; output?: string; error?: string; executedBy?: string }): Promise<ChangeExecutionEntity> {
    const step = await this.executionRepo.findById(stepId);
    if (!step) {
      throw new OrionError(`Execution step not found: ${stepId}`, 'NOT_FOUND');
    }

    let updated: ChangeExecutionEntity | undefined;

    if (data.status === 'running') {
      updated = await this.executionRepo.startStep(stepId, data.executedBy);
    } else if (data.status === 'completed') {
      updated = await this.executionRepo.completeStep(stepId, data.output);
    } else if (data.status === 'failed') {
      updated = await this.executionRepo.failStep(stepId, data.error ?? 'Unknown error');
    } else {
      updated = await this.executionRepo.updateStatus(stepId, data.status ?? step.status, data.output, data.error);
    }

    if (!updated) {
      throw new OrionError('Failed to update execution step', 'OPERATION_FAILED');
    }

    logger.info({ stepId, status: updated.status }, 'Execution step updated');
    return updated;
  }

  async getExecutionProgress(changeRequestId: string): Promise<{ steps: ChangeExecutionEntity[]; progress: { total: number; completed: number; failed: number; pending: number; running: number } }> {
    await this.getRequest(changeRequestId); // Verify exists
    const steps = await this.executionRepo.listByChange(changeRequestId);
    const progress = await this.executionRepo.getProgress(changeRequestId);
    return { steps, progress };
  }
}
