import type {
  SelfHealingPolicy,
  SelfHealingRun,
  CreatePolicyInput,
  ExecutionStatus,
} from '../types/monitor.js';
import { SelfHealingRepository } from '../repositories/SelfHealingRepository.js';

export class SelfHealingService {
  constructor(private repo: SelfHealingRepository) {}

  async createPolicy(
    tenantId: string,
    projectId: string,
    createdBy: string,
    input: CreatePolicyInput,
  ): Promise<SelfHealingPolicy> {
    return this.repo.createPolicy(tenantId, projectId, createdBy, {
      name: input.name,
      description: input.description ?? '',
      ruleId: input.ruleId,
      actionType: input.actionType,
      actionConfig: input.actionConfig,
      cooldownSeconds: input.cooldownSeconds ?? 300,
      maxRetries: input.maxRetries ?? 3,
      approvalRequired: input.approvalRequired ?? false,
    });
  }

  async listPolicies(tenantId: string, projectId?: string): Promise<SelfHealingPolicy[]> {
    return this.repo.findPolicies(tenantId, projectId);
  }

  async triggerHealing(
    tenantId: string,
    policyId: string,
    alertId: string,
  ): Promise<SelfHealingRun | undefined> {
    const policy = await this.repo.findPolicyById(policyId);
    if (!policy || policy.tenantId !== tenantId || !policy.enabled) return undefined;

    return this.repo.createRun(policy.tenantId, policy.projectId, {
      policyId,
      policyName: policy.name,
      alertId,
      actionType: policy.actionType,
      status: 'pending',
      attempts: 0,
      input: policy.actionConfig,
      startedAt: new Date().toISOString(),
    });
  }

  async listRuns(
    tenantId: string,
    filters?: { projectId?: string; policyId?: string; status?: ExecutionStatus },
  ): Promise<SelfHealingRun[]> {
    return this.repo.findRuns(tenantId, filters);
  }

  async updateRun(
    tenantId: string,
    runId: string,
    update: { status: ExecutionStatus; attempts?: number; output?: Record<string, unknown>; error?: string },
  ): Promise<SelfHealingRun | undefined> {
    const runs = await this.repo.findRuns(tenantId);
    const run = runs.find(r => r.id === runId);
    if (!run) return undefined;
    return (await this.repo.updateRun(runId, update)) ?? undefined;
  }
}
