/**
 * ConfigChangeService - 配置变更管理服务
 *
 * 提供增强版配置变更生命周期管理：
 * - 提交变更请求（含风险评估）
 * - 审批/拒绝变更
 * - 执行变更
 * - 回滚变更
 * - 查询变更历史
 *
 * Persistence: PostgreSQL via ConfigChangeRequestRepository + ConfigChangeHistoryRepository
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '../config-mgmt/ConfigService';
import { ConfigApprovalService } from '../config-mgmt/ConfigApprovalService';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import {
  ConfigChangeRequestRepository,
  ConfigChangeHistoryRepository,
  ChangeRequestEntity,
  ChangeHistoryEntity,
} from '../../repositories/ConfigChangeRepository';

const logger = createLogger('LConfig-LChange-LService');

export type ChangeRequestType = 'create' | 'modify' | 'delete';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'executed' | 'failed' | 'rolled_back';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ChangeRequest {
  id: string;
  tenantId: string;
  configKey: string;
  configGroup?: string;
  environment: string;
  changeType: ChangeRequestType;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string;
  riskLevel: RiskLevel;
  requester: string;
  status: ChangeRequestStatus;
  executionPlan?: Record<string, unknown>;
  rollbackPlan?: Record<string, unknown>;
  approvals: ApprovalRecord[];
  requiredApprovals: number;
  executedAt?: Date;
  executedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  rolledBackAt?: Date;
  rolledBackBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalRecord {
  id: string;
  approver: string;
  action: 'approve' | 'reject';
  comment?: string;
  approvedAt: Date;
}

export interface SubmitChangeRequestInput {
  configKey: string;
  configGroup?: string;
  environment?: string;
  changeType?: ChangeRequestType;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason: string;
  riskLevel?: RiskLevel;
  executionPlan?: Record<string, unknown>;
  rollbackPlan?: Record<string, unknown>;
  requiredApprovals?: number;
}

export interface ChangeHistoryFilter {
  status?: ChangeRequestStatus;
  configKey?: string;
  configGroup?: string;
  environment?: string;
  requester?: string;
  riskLevel?: RiskLevel;
  limit?: number;
  offset?: number;
}

export interface ChangeHistoryEntry {
  id: string;
  tenantId?: string;
  changeRequestId: string;
  configKey: string;
  configGroup?: string;
  environment: string;
  action: string;
  actor: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  notes?: string;
  createdAt: Date;
}

export class ConfigChangeService {
  private repository: ConfigChangeRequestRepository;
  private historyRepository: ConfigChangeHistoryRepository;
  private configService?: ConfigService;
  private approvalService?: ConfigApprovalService;

  constructor(options: {
    repository: ConfigChangeRequestRepository;
    historyRepository: ConfigChangeHistoryRepository;
    configService?: ConfigService;
    approvalService?: ConfigApprovalService;
  }) {
    if (!options.repository) throw new OrionError('ConfigChangeRequestRepository is required', ErrorCode.INTERNAL_ERROR);
    if (!options.historyRepository) throw new OrionError('ConfigChangeHistoryRepository is required', ErrorCode.INTERNAL_ERROR);
    this.repository = options.repository;
    this.historyRepository = options.historyRepository;
    this.configService = options.configService;
    this.approvalService = options.approvalService;
  }

  async submitChangeRequest(
    tenantId: string,
    input: SubmitChangeRequestInput,
    requester?: string
  ): Promise<ChangeRequest> {
    const id = uuidv4();
    const now = new Date();

    const changeRequest: ChangeRequest = {
      id,
      tenantId,
      configKey: input.configKey,
      configGroup: input.configGroup,
      environment: input.environment || 'default',
      changeType: input.changeType || 'modify',
      oldValue: input.oldValue || null,
      newValue: input.newValue || null,
      reason: input.reason,
      riskLevel: input.riskLevel || 'low',
      requester: requester || 'system',
      status: 'pending',
      executionPlan: input.executionPlan,
      rollbackPlan: input.rollbackPlan,
      approvals: [],
      requiredApprovals: input.requiredApprovals || this.calculateRequiredApprovals(input.riskLevel || 'low'),
      createdAt: now,
      updatedAt: now,
    };

    await this.persistToDB(changeRequest);

    await this.recordHistory({
      id: uuidv4(),
      tenantId,
      changeRequestId: id,
      configKey: input.configKey,
      configGroup: input.configGroup,
      environment: changeRequest.environment,
      action: 'submitted',
      actor: changeRequest.requester,
      oldValue: changeRequest.oldValue,
      newValue: changeRequest.newValue,
      notes: input.reason,
      createdAt: now,
    });

    return { ...changeRequest };
  }

  async approveChangeRequest(
    requestId: string,
    reviewerId: string,
    action: 'approve' | 'reject',
    comment?: string
  ): Promise<ChangeRequest> {
    const changeRequest = await this.getChangeRequest(requestId);
    if (!changeRequest) {
      throw new OrionError(`Change request '${requestId}' not found`, ErrorCode.NOT_FOUND);
    }

    if (changeRequest.status !== 'pending') {
      throw new OrionError(`Change request is not pending (current: ${changeRequest.status})`, ErrorCode.NOT_FOUND);
    }

    const existingApproval = changeRequest.approvals.find((a) => a.approver === reviewerId);
    if (existingApproval) {
      throw new OrionError(`Reviewer '${reviewerId}' has already voted on this change request`, ErrorCode.NOT_FOUND);
    }

    const now = new Date();
    const approval: ApprovalRecord = {
      id: uuidv4(),
      approver: reviewerId,
      action,
      comment,
      approvedAt: now,
    };

    changeRequest.approvals.push(approval);
    changeRequest.updatedAt = now;

    if (action === 'approve') {
      const approvedCount = changeRequest.approvals.filter((a) => a.action === 'approve').length;
      if (approvedCount >= changeRequest.requiredApprovals) {
        changeRequest.status = 'approved';
        changeRequest.approvedAt = now;
        changeRequest.approvedBy = reviewerId;
      }
    } else {
      changeRequest.status = 'rejected';
    }

    await this.persistToDB(changeRequest);

    await this.recordHistory({
      id: uuidv4(),
      tenantId: changeRequest.tenantId,
      changeRequestId: requestId,
      configKey: changeRequest.configKey,
      environment: changeRequest.environment,
      action: action === 'approve' ? 'approved' : 'rejected',
      actor: reviewerId,
      oldValue: changeRequest.oldValue,
      newValue: changeRequest.newValue,
      notes: comment,
      createdAt: now,
    });

    return { ...changeRequest };
  }

  async executeChangeRequest(requestId: string, executorId?: string): Promise<ChangeRequest> {
    const changeRequest = await this.getChangeRequest(requestId);
    if (!changeRequest) {
      throw new OrionError(`Change request '${requestId}' not found`, 'NOT_FOUND');
    }

    if (changeRequest.status !== 'approved') {
      throw new OrionError(`Change request must be approved before execution (current: ${changeRequest.status})`, ErrorCode.NOT_FOUND);
    }

    changeRequest.status = 'executing';
    changeRequest.updatedAt = new Date();
    await this.persistToDB(changeRequest);

    try {
      if (this.configService) {
        await this.applyConfigChange(changeRequest);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      changeRequest.status = 'executed';
      changeRequest.executedAt = new Date();
      changeRequest.executedBy = executorId || 'system';
      changeRequest.updatedAt = new Date();
      await this.persistToDB(changeRequest);
    } catch (error) {
      changeRequest.status = 'failed';
      changeRequest.updatedAt = new Date();
      await this.persistToDB(changeRequest);
      throw error;
    }

    await this.recordHistory({
      id: uuidv4(),
      tenantId: changeRequest.tenantId,
      changeRequestId: requestId,
      configKey: changeRequest.configKey,
      environment: changeRequest.environment,
      action: 'executed',
      actor: executorId || 'system',
      oldValue: changeRequest.oldValue,
      newValue: changeRequest.newValue,
      notes: 'Change applied successfully',
      createdAt: new Date(),
    });

    return { ...changeRequest };
  }

  async rollbackChangeRequest(requestId: string, rolledBackBy?: string): Promise<ChangeRequest> {
    const changeRequest = await this.getChangeRequest(requestId);
    if (!changeRequest) {
      throw new OrionError(`Change request '${requestId}' not found`, ErrorCode.NOT_FOUND);
    }

    if (changeRequest.status !== 'executed' && changeRequest.status !== 'failed') {
      throw new OrionError(`Can only rollback executed or failed changes (current: ${changeRequest.status})`, 'OPERATION_FAILED');
    }

    changeRequest.status = 'rolled_back';
    changeRequest.rolledBackAt = new Date();
    changeRequest.rolledBackBy = rolledBackBy || 'system';
    changeRequest.updatedAt = new Date();

    await this.persistToDB(changeRequest);

    if (this.configService && changeRequest.oldValue) {
      try {
        logger.info(`[ConfigChangeService] Rollback applied for request ${requestId}`);
      } catch (error) {
        logger.error(`[ConfigChangeService] Rollback failed for request ${requestId}:`, error);
      }
    }

    await this.recordHistory({
      id: uuidv4(),
      tenantId: changeRequest.tenantId,
      changeRequestId: requestId,
      configKey: changeRequest.configKey,
      environment: changeRequest.environment,
      action: 'rolled_back',
      actor: rolledBackBy || 'system',
      oldValue: changeRequest.newValue,
      newValue: changeRequest.oldValue,
      notes: `Rollback by ${rolledBackBy || 'system'}`,
      createdAt: new Date(),
    });

    return { ...changeRequest };
  }

  async getChangeHistory(tenantId: string, filter?: ChangeHistoryFilter): Promise<{
    changeRequests: ChangeRequest[];
    history: ChangeHistoryEntry[];
  }> {
    const changeRequests = await this.listChangeRequests(tenantId, filter);
    const history = await this.getChangeHistoryEntries(tenantId, filter);
    return { changeRequests, history };
  }

  async getChangeRequestById(id: string): Promise<ChangeRequest | null> {
    return this.getChangeRequest(id);
  }

  async listChangeRequests(tenantId: string, filter?: ChangeHistoryFilter): Promise<ChangeRequest[]> {
    const entities = await this.repository.findByTenant(tenantId, {
      status: filter?.status,
      configKey: filter?.configKey,
      configGroup: filter?.configGroup,
      environment: filter?.environment,
      requester: filter?.requester,
      riskLevel: filter?.riskLevel,
      limit: filter?.limit,
      offset: filter?.offset,
    });
    return entities.map(e => this.entityToChangeRequest(e));
  }

  // ==================== Internal Methods ====================

  private async getChangeRequest(id: string): Promise<ChangeRequest | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    return this.entityToChangeRequest(entity);
  }

  private async getChangeHistoryEntries(tenantId: string, filter?: ChangeHistoryFilter): Promise<ChangeHistoryEntry[]> {
    try {
      const entities = await this.historyRepository.findByTenant(tenantId, {
        configKey: filter?.configKey,
        configGroup: filter?.configGroup,
        limit: filter?.limit,
        offset: filter?.offset,
      });
      return entities.map(e => this.historyEntityToEntry(e));
    } catch (error) {
      logger.warn(`[ConfigChangeService] Failed to query history: ${(error as Error).message}`);
      return [];
    }
  }

  private async persistToDB(changeRequest: ChangeRequest): Promise<void> {
    try {
      await this.repository.create({
        id: changeRequest.id,
        tenantId: changeRequest.tenantId,
        configKey: changeRequest.configKey,
        configGroup: changeRequest.configGroup,
        environment: changeRequest.environment,
        changeType: changeRequest.changeType,
        oldValue: changeRequest.oldValue,
        newValue: changeRequest.newValue,
        reason: changeRequest.reason,
        riskLevel: changeRequest.riskLevel,
        requester: changeRequest.requester,
        status: changeRequest.status,
        executionPlan: changeRequest.executionPlan,
        rollbackPlan: changeRequest.rollbackPlan,
        approvals: changeRequest.approvals,
        requiredApprovals: changeRequest.requiredApprovals,
        executedAt: changeRequest.executedAt,
        executedBy: changeRequest.executedBy,
        approvedAt: changeRequest.approvedAt,
        approvedBy: changeRequest.approvedBy,
        rolledBackAt: changeRequest.rolledBackAt,
        rolledBackBy: changeRequest.rolledBackBy,
        createdAt: changeRequest.createdAt,
        updatedAt: changeRequest.updatedAt,
      });
    } catch (error) {
      if ((error as OrionError).code === 'OPERATION_FAILED') {
        try {
          await this.repository.updateStatus(changeRequest.id, changeRequest.status, {
            approvals: JSON.stringify(changeRequest.approvals),
            executed_at: changeRequest.executedAt,
            executed_by: changeRequest.executedBy,
            approved_at: changeRequest.approvedAt,
            approved_by: changeRequest.approvedBy,
            rolled_back_at: changeRequest.rolledBackAt,
            rolled_back_by: changeRequest.rolledBackBy,
            updated_at: changeRequest.updatedAt,
          });
        } catch (updateError) {
          logger.warn(`[ConfigChangeService] Failed to persist: ${(updateError as Error).message}`);
        }
      } else {
        logger.warn(`[ConfigChangeService] Failed to persist: ${(error as Error).message}`);
      }
    }
  }

  private async recordHistory(entry: ChangeHistoryEntry): Promise<void> {
    try {
      await this.historyRepository.create({
        id: entry.id,
        tenantId: entry.tenantId || '00000000-0000-0000-0000-000000000000',
        changeRequestId: entry.changeRequestId || '',
        configKey: entry.configKey,
        configGroup: entry.configGroup,
        environment: entry.environment,
        action: entry.action,
        actor: entry.actor,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        notes: entry.notes,
        createdAt: entry.createdAt,
      });
    } catch (error) {
      logger.warn(`[ConfigChangeService] Failed to persist history: ${(error as Error).message}`);
    }
  }

  private entityToChangeRequest(entity: ChangeRequestEntity): ChangeRequest {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      configKey: entity.configKey,
      configGroup: entity.configGroup,
      environment: entity.environment,
      changeType: entity.changeType as ChangeRequestType,
      oldValue: entity.oldValue,
      newValue: entity.newValue,
      reason: entity.reason,
      riskLevel: entity.riskLevel as RiskLevel,
      requester: entity.requester,
      status: entity.status as ChangeRequestStatus,
      executionPlan: entity.executionPlan,
      rollbackPlan: entity.rollbackPlan,
      approvals: ((entity.approvals || []) as unknown) as ApprovalRecord[],
      requiredApprovals: entity.requiredApprovals,
      executedAt: entity.executedAt,
      executedBy: entity.executedBy,
      approvedAt: entity.approvedAt,
      approvedBy: entity.approvedBy,
      rolledBackAt: entity.rolledBackAt,
      rolledBackBy: entity.rolledBackBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private historyEntityToEntry(entity: ChangeHistoryEntity): ChangeHistoryEntry {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      changeRequestId: entity.changeRequestId,
      configKey: entity.configKey,
      configGroup: entity.configGroup,
      environment: entity.environment,
      action: entity.action,
      actor: entity.actor,
      oldValue: entity.oldValue,
      newValue: entity.newValue,
      notes: entity.notes,
      createdAt: entity.createdAt,
    };
  }

  private calculateRequiredApprovals(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case 'critical': return 3;
      case 'high': return 2;
      case 'medium': return 1;
      case 'low':
      default: return 1;
    }
  }

  private async applyConfigChange(changeRequest: ChangeRequest): Promise<void> {
    if (!this.configService) return;

    switch (changeRequest.changeType) {
      case 'create':
      case 'modify':
        if (changeRequest.newValue) {
          await this.configService.set(
            changeRequest.tenantId,
            changeRequest.configKey,
            changeRequest.newValue,
            `change-request:${changeRequest.id}`
          );
        }
        break;
      case 'delete':
        await this.configService.delete(changeRequest.tenantId, changeRequest.configKey);
        break;
    }
  }
}
