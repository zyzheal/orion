/**
 * ConfigApprovalService - Configuration Change Approval Workflow
 *
 * Manages approval workflows for configuration changes.
 * Supports multi-level approval, auto-apply on approval, and audit trail.
 *
 * Features:
 *   - Create change requests for config modifications
 *   - Multi-level approval (configurable number of approvers)
 *   - Approval/rejection with comments
 *   - Auto-apply approved changes to configuration
 *   - Full audit trail for all config changes
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from './ConfigService';
import {
  ConfigChangeRequest,
  CreateChangeRequestInput,
  ApproveChangeInput,
  ApprovalRecord,
  ConfigItem,
  ConfigEnvironment,
  IEventPublisher,
  ConfigEvents,
} from './types';
import { ConfigApprovalRepository } from '../../repositories/ConfigApprovalRepository';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ name: 'LConfig-LApproval-LService' });

export interface ConfigApprovalServiceConfig {
  configService: ConfigService;
  eventPublisher?: IEventPublisher;
  /** Auto-apply approved changes (default: true) */
  autoApply?: boolean;
  /** Optional PostgreSQL repository for persistence */
  repository?: ConfigApprovalRepository;
}

export class ConfigApprovalService {
  private changeRequests: Map<string, ConfigChangeRequest>;
  private configService: ConfigService;
  private eventPublisher: IEventPublisher | null;
  private autoApply: boolean;
  private repository?: ConfigApprovalRepository;

  constructor(config: ConfigApprovalServiceConfig) {
    this.changeRequests = new Map();
    this.configService = config.configService;
    this.eventPublisher = config.eventPublisher || null;
    this.autoApply = config.autoApply !== false;
    this.repository = config.repository;
  }

  setEventPublisher(publisher: IEventPublisher): void {
    this.eventPublisher = publisher;
  }

  setAutoApply(enabled: boolean): void {
    this.autoApply = enabled;
  }

  /**
   * Create a new configuration change request
   */
  async createChangeRequest(
    input: CreateChangeRequestInput
  ): Promise<ConfigChangeRequest> {
    const config = await this.configService.getConfigById(input.configId);
    if (!config) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Config '${input.configId}' not found`);
    }

    const now = new Date();
    const id = uuidv4();

    // Extract actual value (may be nested due to repository storage format)
    const rawValue = config.value as any;
    const actualValue = rawValue?.value !== undefined ? rawValue.value : rawValue;

    const changeRequest: ConfigChangeRequest = {
      id,
      configId: input.configId,
      configKey: config.key,
      environment: (config.environment as ConfigEnvironment) || 'dev',
      oldValue: typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue),
      newValue: input.newValue,
      reason: input.reason,
      requester: input.requester,
      status: 'pending',
      approvals: [],
      requiredApprovals: input.requiredApprovals || 1,
      createdAt: now,
      updatedAt: now,
    };

    // Persist to PostgreSQL if repository is available, otherwise use in-memory fallback
    if (this.repository) {
      try {
        await this.repository.create({
          id: changeRequest.id,
          configId: changeRequest.configId,
          configKey: changeRequest.configKey,
          environment: changeRequest.environment,
          oldValue: changeRequest.oldValue,
          newValue: changeRequest.newValue,
          reason: changeRequest.reason,
          requester: changeRequest.requester,
          requiredApprovals: changeRequest.requiredApprovals,
        });
      } catch (err) {
        logger.error('[ConfigApprovalService] Failed to persist change request to DB, falling back to memory:', err);
        this.changeRequests.set(id, changeRequest);
      }
    } else {
      this.changeRequests.set(id, changeRequest);
    }

    return { ...changeRequest };
  }

  /**
   * Approve a change request
   */
  async approveChange(
    changeRequestId: string,
    input: ApproveChangeInput
  ): Promise<ConfigChangeRequest> {
    const changeRequest = this.changeRequests.get(changeRequestId);
    if (!changeRequest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Change request '${changeRequestId}' not found`);
    }

    if (changeRequest.status !== 'pending') {
      throw new Error(
        `Change request '${changeRequestId}' is not in pending state (current: ${changeRequest.status})`
      );
    }

    // Check if this approver has already approved
    const existingApproval = changeRequest.approvals.find(
      (a) => a.approver === input.approver
    );
    if (existingApproval) {
      throw new Error(
        `Approver '${input.approver}' has already voted on this change request`
      );
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
    changeRequest.updatedAt = now;

    // Check if all required approvals have been met
    const approvedCount = changeRequest.approvals.filter(
      (a) => a.status === 'approved'
    ).length;

    if (approvedCount >= changeRequest.requiredApprovals) {
      changeRequest.status = 'approved';
      changeRequest.approvedBy = input.approver;
      changeRequest.approvedAt = now;

      await this.publishEvent(ConfigEvents.CONFIG_APPROVED, {
        changeRequestId,
        configId: changeRequest.configId,
        configKey: changeRequest.configKey,
        approvedBy: input.approver,
      });

      // Auto-apply the change
      if (this.autoApply) {
        await this.applyChange(changeRequest);
      }
    }

    return { ...changeRequest };
  }

  /**
   * Reject a change request
   */
  async rejectChange(
    changeRequestId: string,
    input: ApproveChangeInput
  ): Promise<ConfigChangeRequest> {
    const changeRequest = this.changeRequests.get(changeRequestId);
    if (!changeRequest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Change request '${changeRequestId}' not found`);
    }

    if (changeRequest.status !== 'pending') {
      throw new Error(
        `Change request '${changeRequestId}' is not in pending state (current: ${changeRequest.status})`
      );
    }

    // Check if this approver has already voted
    const existingApproval = changeRequest.approvals.find(
      (a) => a.approver === input.approver
    );
    if (existingApproval) {
      throw new Error(
        `Approver '${input.approver}' has already voted on this change request`
      );
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
    changeRequest.status = 'rejected';
    changeRequest.updatedAt = now;

    await this.publishEvent(ConfigEvents.CONFIG_REJECTED, {
      changeRequestId,
      configId: changeRequest.configId,
      configKey: changeRequest.configKey,
      rejectedBy: input.approver,
      comment: input.comment,
    });

    return { ...changeRequest };
  }

  /**
   * Get a change request by ID
   */
  async getChangeRequest(
    changeRequestId: string
  ): Promise<ConfigChangeRequest | null> {
    const changeRequest = this.changeRequests.get(changeRequestId);
    return changeRequest ? { ...changeRequest } : null;
  }

  /**
   * List change requests with optional filters
   */
  async listChangeRequests(options?: {
    status?: string;
    configId?: string;
    requester?: string;
    environment?: string;
  }): Promise<ConfigChangeRequest[]> {
    let results = Array.from(this.changeRequests.values());

    if (options?.status) {
      results = results.filter((cr) => cr.status === options.status);
    }
    if (options?.configId) {
      results = results.filter((cr) => cr.configId === options.configId);
    }
    if (options?.requester) {
      results = results.filter((cr) => cr.requester === options.requester);
    }
    if (options?.environment) {
      results = results.filter(
        (cr) => cr.environment === options.environment
      );
    }

    return results.map((cr) => ({ ...cr }));
  }

  /**
   * List pending change requests awaiting approval
   */
  async listPendingApprovals(): Promise<ConfigChangeRequest[]> {
    return this.listChangeRequests({ status: 'pending' });
  }

  /**
   * Cancel a pending change request
   */
  async cancelChangeRequest(changeRequestId: string): Promise<ConfigChangeRequest> {
    const changeRequest = this.changeRequests.get(changeRequestId);
    if (!changeRequest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Change request '${changeRequestId}' not found`);
    }

    if (changeRequest.status !== 'pending') {
      throw new Error(
        `Only pending change requests can be cancelled (current: ${changeRequest.status})`
      );
    }

    changeRequest.status = 'rejected';
    changeRequest.updatedAt = new Date();

    return { ...changeRequest };
  }

  /**
   * Get audit trail for a specific config
   */
  async getAuditTrail(configId: string): Promise<ConfigChangeRequest[]> {
    return Array.from(this.changeRequests.values())
      .filter((cr) => cr.configId === configId)
      .map((cr) => ({ ...cr }));
  }

  // ==================== Internal Methods ====================

  private async applyChange(changeRequest: ConfigChangeRequest): Promise<void> {
    try {
      await this.configService.updateConfig(
        changeRequest.configId,
        { value: changeRequest.newValue, updatedBy: `approval:${changeRequest.id}` },
      );

      changeRequest.status = 'applied';
      changeRequest.appliedAt = new Date();
      changeRequest.appliedBy = 'system-auto-apply';
      changeRequest.updatedAt = new Date();

      this.changeRequests.set(changeRequest.id, changeRequest);
    } catch (error: any) {
      // Failed to apply - log but don't reject the approval
      changeRequest.status = 'approved'; // Keep as approved even if auto-apply failed
      changeRequest.updatedAt = new Date();
      this.changeRequests.set(changeRequest.id, changeRequest);
      throw new Error(
        `Change request approved but auto-apply failed: ${error.message}`
      );
    }
  }

  private async publishEvent(type: string, data: any): Promise<void> {
    if (!this.eventPublisher) return;
    try {
      await this.eventPublisher.publish(type, data, {
        source: 'config-approval-service',
      });
    } catch {
      // Best-effort event publishing
    }
  }
}
