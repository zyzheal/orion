import pino from 'pino';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import {
  NotificationPolicyRepository,
  NotificationPolicyEntity,
  NotificationWorkflowRepository,
  NotificationWorkflowEntity,
  PolicyCondition,
  WorkflowStep,
} from './NotificationPolicyRepository';

const logger = pino({ name: 'NotificationPolicyService' });

export interface CreatePolicyInput {
  name: string;
  description?: string;
  conditions: PolicyCondition[];
  channels: string[];
  recipients: string[];
  throttleMinutes?: number;
  enabled?: boolean;
}

export interface UpdatePolicyInput {
  name?: string;
  description?: string;
  conditions?: PolicyCondition[];
  channels?: string[];
  recipients?: string[];
  throttleMinutes?: number;
  enabled?: boolean;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  policyId: string;
  steps: WorkflowStep[];
  enabled?: boolean;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  steps?: WorkflowStep[];
  enabled?: boolean;
}

// ============================================================
// Service
// ============================================================

/**
 * NotificationPolicyService - Manages notification policies and workflows
 *
 * Persistence: PostgreSQL via NotificationPolicyRepository and NotificationWorkflowRepository.
 * The database is the single source of truth.
 */
export class NotificationPolicyService {
  constructor(
    private readonly policyRepo: NotificationPolicyRepository,
    private readonly workflowRepo: NotificationWorkflowRepository,
  ) {}

  // ==================== Policy CRUD ====================

  async createPolicy(input: CreatePolicyInput): Promise<NotificationPolicyEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, name: input.name }, 'Creating notification policy');

    const policy = await this.policyRepo.create({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      conditions: JSON.stringify(input.conditions),
      channels: JSON.stringify(input.channels),
      recipients: JSON.stringify(input.recipients),
      throttleMinutes: input.throttleMinutes ?? 0,
      enabled: input.enabled ?? true,
    });

    logger.info({ policyId: policy.id }, 'Notification policy created');
    return policy;
  }

  async getPolicy(id: string): Promise<NotificationPolicyEntity> {
    const policy = await this.policyRepo.findById(id);
    if (!policy) {
      throw new OrionError(`Notification policy not found: ${id}`, 'NOT_FOUND');
    }
    return policy;
  }

  async listPolicies(): Promise<NotificationPolicyEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.policyRepo.findByTenant(tenantId);
    return result.entities;
  }

  async updatePolicy(id: string, input: UpdatePolicyInput): Promise<NotificationPolicyEntity> {
    const existing = await this.policyRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Notification policy not found: ${id}`, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.conditions !== undefined) updateData.conditions = JSON.stringify(input.conditions);
    if (input.channels !== undefined) updateData.channels = JSON.stringify(input.channels);
    if (input.recipients !== undefined) updateData.recipients = JSON.stringify(input.recipients);
    if (input.throttleMinutes !== undefined) updateData.throttleMinutes = input.throttleMinutes;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const updated = await this.policyRepo.update(id, updateData);
    logger.info({ policyId: id }, 'Notification policy updated');
    return updated;
  }

  async deletePolicy(id: string): Promise<void> {
    const existing = await this.policyRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Notification policy not found: ${id}`, 'NOT_FOUND');
    }
    // Delete associated workflows first
    const workflows = await this.workflowRepo.findByPolicyId(id);
    for (const workflow of workflows) {
      await this.workflowRepo.delete(workflow.id);
    }
    await this.policyRepo.delete(id);
    logger.info({ policyId: id }, 'Notification policy deleted');
  }

  // ==================== Policy Evaluation ====================

  async evaluatePolicies(event: Record<string, unknown>): Promise<NotificationPolicyEntity[]> {
    const tenantId = getCurrentTenantId();
    const policies = await this.policyRepo.findEnabled(tenantId);
    return this.filterMatchedPolicies(policies, event);
  }

  private filterMatchedPolicies(
    policies: NotificationPolicyEntity[],
    event: Record<string, unknown>,
  ): NotificationPolicyEntity[] {
    const matched: NotificationPolicyEntity[] = [];
    for (const policy of policies) {
      if (this.matchesConditions(event, policy.conditions)) {
        matched.push(policy);
      }
    }
    return matched;
  }

  private matchesConditions(event: Record<string, unknown>, conditions: PolicyCondition[]): boolean {
    if (conditions.length === 0) return true;

    for (const condition of conditions) {
      const fieldValue = this.getNestedValue(event, condition.field);
      if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(
    fieldValue: unknown,
    operator: PolicyCondition['operator'],
    conditionValue: unknown,
  ): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === conditionValue;
      case 'neq':
        return fieldValue !== conditionValue;
      case 'contains':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' && fieldValue.includes(conditionValue);
      case 'gt':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue > conditionValue;
      case 'lt':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue < conditionValue;
      case 'gte':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue >= conditionValue;
      case 'lte':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue <= conditionValue;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'regex':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' && new RegExp(conditionValue).test(fieldValue);
      default:
        return false;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  // ==================== Workflow CRUD ====================

  async createWorkflow(input: CreateWorkflowInput): Promise<NotificationWorkflowEntity> {
    const tenantId = getCurrentTenantId();

    // Validate policy exists
    const policy = await this.policyRepo.findById(input.policyId);
    if (!policy) {
      throw new OrionError(`Notification policy not found: ${input.policyId}`, 'NOT_FOUND');
    }

    logger.info({ tenantId, name: input.name, policyId: input.policyId }, 'Creating notification workflow');

    const workflow = await this.workflowRepo.create({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      policyId: input.policyId,
      steps: JSON.stringify(input.steps),
      enabled: input.enabled ?? true,
      createdBy: null,
    });

    logger.info({ workflowId: workflow.id }, 'Notification workflow created');
    return workflow;
  }

  async getWorkflow(id: string): Promise<NotificationWorkflowEntity> {
    const workflow = await this.workflowRepo.findById(id);
    if (!workflow) {
      throw new OrionError(`Notification workflow not found: ${id}`, 'NOT_FOUND');
    }
    return workflow;
  }

  async listWorkflows(policyId?: string): Promise<NotificationWorkflowEntity[]> {
    if (policyId) {
      return this.workflowRepo.findByPolicyId(policyId);
    }
    const tenantId = getCurrentTenantId();
    const result = await this.workflowRepo.findByTenant(tenantId);
    return result.entities;
  }

  async updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<NotificationWorkflowEntity> {
    const existing = await this.workflowRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Notification workflow not found: ${id}`, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.steps !== undefined) updateData.steps = JSON.stringify(input.steps);
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const updated = await this.workflowRepo.update(id, updateData);
    logger.info({ workflowId: id }, 'Notification workflow updated');
    return updated;
  }

  async deleteWorkflow(id: string): Promise<void> {
    const existing = await this.workflowRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Notification workflow not found: ${id}`, 'NOT_FOUND');
    }
    await this.workflowRepo.delete(id);
    logger.info({ workflowId: id }, 'Notification workflow deleted');
  }
}
