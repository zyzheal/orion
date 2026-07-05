/**
 * ConfigApprovalService - Configuration Change Approval Workflow
 *
 * Manages approval workflows for configuration changes.
 * Supports multi-level approval, auto-apply on approval, and audit trail.
 *
 * Persistence: PostgreSQL via ConfigApprovalRepository
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from './ConfigService';
import {
  ConfigChangeRequest,
  CreateChangeRequestInput,
  ApproveChangeInput,
  ApprovalRecord,
  ConfigEnvironment,
  IEventPublisher,
  ConfigEvents,
} from './types';
import { ConfigApprovalRepository } from '../../repositories/ConfigApprovalRepository';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('LConfig-LApproval-LService');

export interface ConfigApprovalServiceConfig {
  configService: ConfigService;
  repository: ConfigApprovalRepository;
  eventPublisher?: IEventPublisher;
  /** Auto-apply approved changes (default: true) */
  autoApply?: boolean;
}

export class ConfigApprovalService {
  private repository: ConfigApprovalRepository;
  private configService: ConfigService;
  private eventPublisher: IEventPublisher | null;
  private autoApply: boolean;

  constructor(config: ConfigApprovalServiceConfig) {
    if (!config.repository) throw new OrionError('ConfigApprovalRepository is required', ErrorCode.INTERNAL_ERROR);
    this.repository = config.repository;
    this.configService = config.configService;
    this.eventPublisher = config.eventPublisher || null;
    this.autoApply = config.autoApply !== false;
  }

  setEventPublisher(publisher: IEventPublisher): void {
    this.eventPublisher = publisher;
  }

  setAutoApply(enabled: boolean): void {
    this.autoApply = enabled;
  }

  async createChangeRequest(input: CreateChangeRequestInput): Promise<ConfigChangeRequest> {
    const config = await this.configService.getConfigById(input.configId);
    if (!config) {
      throw new OrionError(`Config '${input.configId}' not found`, ErrorCode.NOT_FOUND);
    }

    const now = new Date();
    const id = uuidv4();

    const rawValue = config.value as any;
    const actualValue = rawValue?.value !== undefined ? rawValue.value : rawValue;

    const created = await this.repository.create({
      id,
      configId: input.configId,
      configKey: config.key,
      environment: (config.environment as ConfigEnvironment) || 'dev',
      oldValue: typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue),
      newValue: input.newValue,
      reason: input.reason,
      requester: input.requester,
      requiredApprovals: input.requiredApprovals || 1,
    });

    logger.info({ changeRequestId: id }, 'Change request created');
    return created;
  }

  async approveChange(changeRequestId: string, input: ApproveChangeInput): Promise<ConfigChangeRequest> {
    const changeRequest = await this.repository.findById(changeRequestId);
    if (!changeRequest) {
      throw new OrionError(`Change request '${changeRequestId}' not found`, ErrorCode.NOT_FOUND);
    }

    if (changeRequest.status !== 'pending') {
      throw new OrionError(`Change request '${changeRequestId}' is not in pending state (current: ${changeRequest.status})`, 'OPERATION_FAILED');
    }

    const existingApproval = changeRequest.approvals.find((a) => a.approver === input.approver);
    if (existingApproval) {
      throw new OrionError(`Approver '${input.approver}' has already voted on this change request`, 'OPERATION_FAILED');
    }

    const now = new Date();
    const approval: ApprovalRecord = {
      id: uuidv4(),
      changeRequestId,
      approver: input.approver,
      status: 'approved',
      comment: input.comment,
      approvedAt: now,
    };

    changeRequest.approvals.push(approval);

    const approvedCount = changeRequest.approvals.filter((a) => a.status === 'approved').length;

    if (approvedCount >= changeRequest.requiredApprovals) {
      await this.publishEvent(ConfigEvents.CONFIG_APPROVED, {
        changeRequestId,
        configId: changeRequest.configId,
        configKey: changeRequest.configKey,
        approvedBy: input.approver,
      });

      if (this.autoApply) {
        try {
          await this.configService.updateConfig(
            changeRequest.configId,
            { value: changeRequest.newValue, updatedBy: `approval:${changeRequest.id}` },
          );
          const updated = await this.repository.update(changeRequestId, {
            status: 'applied',
            approvals: changeRequest.approvals,
            appliedAt: new Date(),
            appliedBy: 'system-auto-apply',
            approvedAt: now,
            approvedBy: input.approver,
          });
          logger.info({ changeRequestId }, 'Change auto-applied');
          return updated!;
        } catch (error: any) {
          logger.error({ changeRequestId, error: error.message }, 'Auto-apply failed');
          throw new OrionError(`Change request approved but auto-apply failed: ${error.message}`, 'OPERATION_FAILED');
        }
      }

      const updated = await this.repository.update(changeRequestId, {
        status: 'approved',
        approvals: changeRequest.approvals,
        approvedAt: now,
        approvedBy: input.approver,
      });
      return updated!;
    }

    // Not enough approvals yet, just save the approval record
    const updated = await this.repository.update(changeRequestId, {
      approvals: changeRequest.approvals,
    });
    return updated!;
  }

  async rejectChange(changeRequestId: string, input: ApproveChangeInput): Promise<ConfigChangeRequest> {
    const changeRequest = await this.repository.findById(changeRequestId);
    if (!changeRequest) {
      throw new OrionError(`Change request '${changeRequestId}' not found`, ErrorCode.NOT_FOUND);
    }

    if (changeRequest.status !== 'pending') {
      throw new OrionError(`Change request '${changeRequestId}' is not in pending state (current: ${changeRequest.status})`, 'OPERATION_FAILED');
    }

    const existingApproval = changeRequest.approvals.find((a) => a.approver === input.approver);
    if (existingApproval) {
      throw new OrionError(`Approver '${input.approver}' has already voted on this change request`, 'OPERATION_FAILED');
    }

    const now = new Date();
    const approval: ApprovalRecord = {
      id: uuidv4(),
      changeRequestId,
      approver: input.approver,
      status: 'rejected',
      comment: input.comment,
      approvedAt: now,
    };

    changeRequest.approvals.push(approval);

    await this.repository.update(changeRequestId, {
      status: 'rejected',
      approvals: changeRequest.approvals,
    });

    await this.publishEvent(ConfigEvents.CONFIG_REJECTED, {
      changeRequestId,
      configId: changeRequest.configId,
      configKey: changeRequest.configKey,
      rejectedBy: input.approver,
      comment: input.comment,
    });

    const updated = await this.repository.findById(changeRequestId);
    return updated!;
  }

  async getChangeRequest(changeRequestId: string): Promise<ConfigChangeRequest | null> {
    return this.repository.findById(changeRequestId);
  }

  async listChangeRequests(options?: {
    status?: string;
    configId?: string;
    requester?: string;
    environment?: string;
  }): Promise<ConfigChangeRequest[]> {
    return this.repository.findMany(options);
  }

  async listPendingApprovals(): Promise<ConfigChangeRequest[]> {
    return this.listChangeRequests({ status: 'pending' });
  }

  async cancelChangeRequest(changeRequestId: string): Promise<ConfigChangeRequest> {
    const changeRequest = await this.repository.findById(changeRequestId);
    if (!changeRequest) {
      throw new OrionError(`Change request '${changeRequestId}' not found`, ErrorCode.NOT_FOUND);
    }

    if (changeRequest.status !== 'pending') {
      throw new OrionError(`Only pending change requests can be cancelled (current: ${changeRequest.status})`, 'OPERATION_FAILED');
    }

    const updated = await this.repository.update(changeRequestId, { status: 'rejected' });
    return updated!;
  }

  async getAuditTrail(configId: string): Promise<ConfigChangeRequest[]> {
    return this.repository.findByConfig(configId);
  }

  private async publishEvent(type: string, data: any): Promise<void> {
    if (!this.eventPublisher) return;
    try {
      await this.eventPublisher.publish(type, data, { source: 'config-approval-service' });
    } catch {
      // Best-effort event publishing
    }
  }
}
