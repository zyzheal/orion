import type {
  SelfHealingPolicy,
  SelfHealingRun,
  CreatePolicyInput,
  ExecutionStatus,
} from '../types/monitor.js';

/**
 * In-memory store (stub — replace with database in production).
 */
const policies: Map<string, SelfHealingPolicy> = new Map();
const runs: Map<string, SelfHealingRun> = new Map();

export class SelfHealingService {
  /**
   * Create a self-healing policy.
   */
  async createPolicy(
    tenantId: string,
    projectId: string,
    createdBy: string,
    input: CreatePolicyInput,
  ): Promise<SelfHealingPolicy> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const policy: SelfHealingPolicy = {
      id,
      tenantId,
      projectId,
      name: input.name,
      description: input.description ?? '',
      ruleId: input.ruleId,
      actionType: input.actionType,
      actionConfig: input.actionConfig,
      cooldownSeconds: input.cooldownSeconds ?? 300,
      maxRetries: input.maxRetries ?? 3,
      enabled: true,
      approvalRequired: input.approvalRequired ?? false,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    policies.set(id, policy);
    return policy;
  }

  /**
   * List self-healing policies.
   */
  async listPolicies(
    tenantId: string,
    projectId?: string,
  ): Promise<SelfHealingPolicy[]> {
    return Array.from(policies.values()).filter(
      (p) =>
        p.tenantId === tenantId &&
        (projectId === undefined || p.projectId === projectId),
    );
  }

  /**
   * Trigger self-healing execution (called by alert system).
   */
  async triggerHealing(
    tenantId: string,
    policyId: string,
    alertId: string,
  ): Promise<SelfHealingRun | undefined> {
    const policy = policies.get(policyId);
    if (!policy || policy.tenantId !== tenantId || !policy.enabled) {
      return undefined;
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const run: SelfHealingRun = {
      id,
      tenantId: policy.tenantId,
      projectId: policy.projectId,
      policyId,
      policyName: policy.name,
      alertId,
      actionType: policy.actionType,
      status: 'pending',
      attempts: 0,
      input: policy.actionConfig,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
    };

    runs.set(id, run);

    // TODO: Execute the action asynchronously via worker queue
    // TODO: Integrate with orion-platform-core for infra operations

    return run;
  }

  /**
   * List healing execution runs.
   */
  async listRuns(
    tenantId: string,
    filters?: {
      projectId?: string;
      policyId?: string;
      status?: ExecutionStatus;
    },
  ): Promise<SelfHealingRun[]> {
    return Array.from(runs.values()).filter((r) => {
      if (r.tenantId !== tenantId) return false;
      if (filters?.projectId && r.projectId !== filters.projectId) return false;
      if (filters?.policyId && r.policyId !== filters.policyId) return false;
      if (filters?.status && r.status !== filters.status) return false;
      return true;
    });
  }

  /**
   * Update run status (called by execution worker).
   */
  async updateRun(
    tenantId: string,
    runId: string,
    update: {
      status: ExecutionStatus;
      attempts?: number;
      output?: Record<string, unknown>;
      error?: string;
    },
  ): Promise<SelfHealingRun | undefined> {
    const run = runs.get(runId);
    if (run?.tenantId !== tenantId) return undefined;

    Object.assign(run, update, {
      updatedAt: new Date().toISOString(),
      completedAt:
        update.status === 'succeeded' || update.status === 'failed'
          ? new Date().toISOString()
          : run.completedAt,
    });

    runs.set(runId, run);
    return run;
  }
}
