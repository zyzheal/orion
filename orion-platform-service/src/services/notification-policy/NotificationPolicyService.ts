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
// In-memory fallback storage
// ============================================================

class InMemoryPolicyStore {
  private policies = new Map<string, NotificationPolicyEntity>();

  save(policy: NotificationPolicyEntity): void {
    this.policies.set(policy.id, policy);
  }

  findById(id: string): NotificationPolicyEntity | undefined {
    return this.policies.get(id);
  }

  findByTenant(tenantId: string): NotificationPolicyEntity[] {
    return Array.from(this.policies.values())
      .filter(p => p.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  findEnabled(tenantId: string): NotificationPolicyEntity[] {
    return this.findByTenant(tenantId).filter(p => p.enabled);
  }

  delete(id: string): boolean {
    return this.policies.delete(id);
  }
}

class InMemoryWorkflowStore {
  private workflows = new Map<string, NotificationWorkflowEntity>();

  save(workflow: NotificationWorkflowEntity): void {
    this.workflows.set(workflow.id, workflow);
  }

  findById(id: string): NotificationWorkflowEntity | undefined {
    return this.workflows.get(id);
  }

  findByPolicyId(policyId: string): NotificationWorkflowEntity[] {
    return Array.from(this.workflows.values())
      .filter(w => w.policyId === policyId)
      .sort((a, b) => (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)).getTime()
        - (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)).getTime());
  }

  findByTenant(tenantId: string): NotificationWorkflowEntity[] {
    return Array.from(this.workflows.values())
      .filter(w => w.tenantId === tenantId)
      .sort((a, b) => (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)).getTime()
        - (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)).getTime());
  }

  delete(id: string): boolean {
    return this.workflows.delete(id);
  }
}

// ============================================================
// Service
// ============================================================

/**
 * NotificationPolicyService - Manages notification policies and workflows
 *
 * DB-fallback strategy: when the PostgreSQL repository throws,
 * automatically falls back to in-memory storage for that operation.
 * This ensures availability during DB outages.
 */
export class NotificationPolicyService {
  private policyMemory = new InMemoryPolicyStore();
  private workflowMemory = new InMemoryWorkflowStore();
  private dbHealthy = true;
  private dbFailureCount = 0;
  private readonly DB_RETRY_THRESHOLD = 5;

  constructor(
    private readonly policyRepo: NotificationPolicyRepository,
    private readonly workflowRepo: NotificationWorkflowRepository,
  ) {}

  // ---- DB health tracking ----

  private recordDbSuccess(): void {
    this.dbHealthy = true;
    this.dbFailureCount = 0;
  }

  private recordDbFailure(): void {
    this.dbFailureCount++;
    if (this.dbFailureCount >= this.DB_RETRY_THRESHOLD) {
      this.dbHealthy = false;
    }
  }

  // ==================== Policy CRUD ====================

  async createPolicy(input: CreatePolicyInput): Promise<NotificationPolicyEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, name: input.name }, 'Creating notification policy');

    try {
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

      this.recordDbSuccess();
      logger.info({ policyId: policy.id }, 'Notification policy created');
      return policy;
    } catch (err: unknown) {
      this.recordDbFailure();
      logger.warn({ err: (err as Error).message }, 'DB create failed, falling back to memory');
      const fallback = this.createPolicyInMemory(tenantId, input);
      return fallback;
    }
  }

  private createPolicyInMemory(tenantId: string, input: CreatePolicyInput): NotificationPolicyEntity {
    const policy: NotificationPolicyEntity = {
      id: crypto.randomUUID?.() ?? `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tenantId,
      name: input.name,
      description: input.description ?? null,
      conditions: input.conditions,
      channels: input.channels,
      recipients: input.recipients,
      throttleMinutes: input.throttleMinutes ?? 0,
      enabled: input.enabled ?? true,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.policyMemory.save(policy);
    return policy;
  }

  async getPolicy(id: string): Promise<NotificationPolicyEntity> {
    try {
      const policy = await this.policyRepo.findById(id);
      if (!policy) {
        // Check memory as fallback
        const memPolicy = this.policyMemory.findById(id);
        if (memPolicy) return memPolicy;
        throw new OrionError(`Notification policy not found: ${id}`, 'NOT_FOUND');
      }
      return policy;
    } catch (err: unknown) {
      // If DB query itself threw (not just "not found"), fall back to memory
      const code = (err as any)?.code;
      if (code === 'NOT_FOUND') throw err;

      logger.warn({ err: (err as Error).message }, 'DB getPolicy failed, checking memory');
      const policy = this.policyMemory.findById(id);
      if (policy) return policy;
      throw err;
    }
  }

  async listPolicies(): Promise<NotificationPolicyEntity[]> {
    try {
      const tenantId = getCurrentTenantId();
      const result = await this.policyRepo.findByTenant(tenantId);
      this.recordDbSuccess();
      return result.entities;
    } catch (err: unknown) {
      this.recordDbFailure();
      logger.warn({ err: (err as Error).message }, 'DB listPolicies failed, falling back to memory');
      const tenantId = getCurrentTenantId();
      return this.policyMemory.findByTenant(tenantId);
    }
  }

  async updatePolicy(id: string, input: UpdatePolicyInput): Promise<NotificationPolicyEntity> {
    try {
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
      this.recordDbSuccess();
      logger.info({ policyId: id }, 'Notification policy updated');
      return updated;
    } catch (err: unknown) {
      const code = (err as any)?.code;
      if (code === 'NOT_FOUND') throw err;

      this.recordDbFailure();
      logger.warn({ err: (err as Error).message }, 'DB updatePolicy failed, falling back to memory');

      // Memory update fallback
      const existing = this.policyMemory.findById(id);
      if (!existing) throw new OrionError(`Notification policy not found: ${id}`, 'NOT_FOUND');

      const updated: NotificationPolicyEntity = {
        ...existing,
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        conditions: input.conditions ?? existing.conditions,
        channels: input.channels ?? existing.channels,
        recipients: input.recipients ?? existing.recipients,
        throttleMinutes: input.throttleMinutes ?? existing.throttleMinutes,
        enabled: input.enabled !== undefined ? input.enabled : existing.enabled,
        updatedAt: new Date(),
      };
      this.policyMemory.save(updated);
      return updated;
    }
  }

  async deletePolicy(id: string): Promise<void> {
    try {
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
      this.recordDbSuccess();
      logger.info({ policyId: id }, 'Notification policy deleted');
    } catch (err: unknown) {
      this.recordDbFailure();
      logger.warn({ err: (err as Error).message }, 'DB deletePolicy failed, falling back to memory');

      const existing = this.policyMemory.findById(id);
      if (!existing) throw new OrionError(`Notification policy not found: ${id}`, 'NOT_FOUND');
      this.policyMemory.delete(id);
      this.workflowMemory.findByPolicyId(id).forEach(w => this.workflowMemory.delete(w.id));
      logger.info({ policyId: id }, 'Notification policy deleted (memory)');
    }
  }

  // ==================== Policy Evaluation ====================

  /**
   * Evaluate all enabled policies against an event and return matching policies
   */
  async evaluatePolicies(event: Record<string, unknown>): Promise<NotificationPolicyEntity[]> {
    const tenantId = getCurrentTenantId();
    try {
      const policies = await this.policyRepo.findEnabled(tenantId);
      return this.filterMatchedPolicies(policies, event);
    } catch (err: unknown) {
      this.recordDbFailure();
      logger.warn({ err: (err as Error).message }, 'DB evaluatePolicies failed, falling back to memory');
      const policies = this.policyMemory.findEnabled(tenantId);
      return this.filterMatchedPolicies(policies, event);
    }
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

    try {
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

      this.recordDbSuccess();
      logger.info({ workflowId: workflow.id }, 'Notification workflow created');
      return workflow;
    } catch (err: unknown) {
      const code = (err as any)?.code;
      if (code === 'NOT_FOUND') throw err;

      this.recordDbFailure();
      logger.warn({ err: (err as Error).message }, 'DB createWorkflow failed, falling back to memory');

      // Validate policy exists in memory
      const policy = this.policyMemory.findById(input.policyId);
      if (!policy) {
        throw new OrionError(`Notification policy not found: ${input.policyId}`, 'NOT_FOUND');
      }

      const fallback = this.createWorkflowInMemory(tenantId, input);
      return fallback;
    }
  }

  private createWorkflowInMemory(tenantId: string, input: CreateWorkflowInput): NotificationWorkflowEntity {
    const workflow: NotificationWorkflowEntity = {
      id: crypto.randomUUID?.() ?? `mem-wf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tenantId,
      name: input.name,
      description: input.description ?? null,
      policyId: input.policyId,
      steps: input.steps,
      enabled: input.enabled ?? true,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workflowMemory.save(workflow);
    return workflow;
  }

  async getWorkflow(id: string): Promise<NotificationWorkflowEntity> {
    try {
      const workflow = await this.workflowRepo.findById(id);
      if (!workflow) {
        const memWorkflow = this.workflowMemory.findById(id);
        if (memWorkflow) return memWorkflow;
        throw new OrionError(`Notification workflow not found: ${id}`, 'NOT_FOUND');
      }
      return workflow;
    } catch (err: unknown) {
      const code = (err as any)?.code;
      if (code === 'NOT_FOUND') throw err;

      logger.warn({ err: (err as Error).message }, 'DB getWorkflow failed, checking memory');
      const workflow = this.workflowMemory.findById(id);
      if (workflow) return workflow;
      throw err;
    }
  }

  async listWorkflows(policyId?: string): Promise<NotificationWorkflowEntity[]> {
    try {
      if (policyId) {
        const workflows = await this.workflowRepo.findByPolicyId(policyId);
        this.recordDbSuccess();
        return workflows;
      }
      const tenantId = getCurrentTenantId();
      const result = await this.workflowRepo.findByTenant(tenantId);
      this.recordDbSuccess();
      return result.entities;
    } catch (err: unknown) {
      this.recordDbFailure();
      logger.warn({ err: (err as Error).message }, 'DB listWorkflows failed, falling back to memory');

      if (policyId) {
        return this.workflowMemory.findByPolicyId(policyId);
      }
      const tenantId = getCurrentTenantId();
      return this.workflowMemory.findByTenant(tenantId);
    }
  }

  async updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<NotificationWorkflowEntity> {
    try {
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
      this.recordDbSuccess();
      logger.info({ workflowId: id }, 'Notification workflow updated');
      return updated;
    } catch (err: unknown) {
      const code = (err as any)?.code;
      if (code === 'NOT_FOUND') throw err;

      this.recordDbFailure();
      logger.warn({ err: (err as Error).message }, 'DB updateWorkflow failed, falling back to memory');

      const existing = this.workflowMemory.findById(id);
      if (!existing) throw new OrionError(`Notification workflow not found: ${id}`, 'NOT_FOUND');

      const updated: NotificationWorkflowEntity = {
        ...existing,
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        steps: input.steps ?? existing.steps,
        enabled: input.enabled !== undefined ? input.enabled : existing.enabled,
        updatedAt: new Date(),
      };
      this.workflowMemory.save(updated);
      return updated;
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    try {
      const existing = await this.workflowRepo.findById(id);
      if (!existing) {
        throw new OrionError(`Notification workflow not found: ${id}`, 'NOT_FOUND');
      }
      await this.workflowRepo.delete(id);
      this.recordDbSuccess();
      logger.info({ workflowId: id }, 'Notification workflow deleted');
    } catch (err: unknown) {
      this.recordDbFailure();
      logger.warn({ err: (err as Error).message }, 'DB deleteWorkflow failed, falling back to memory');

      const existing = this.workflowMemory.findById(id);
      if (!existing) throw new OrionError(`Notification workflow not found: ${id}`, 'NOT_FOUND');
      this.workflowMemory.delete(id);
      logger.info({ workflowId: id }, 'Notification workflow deleted (memory)');
    }
  }
}
