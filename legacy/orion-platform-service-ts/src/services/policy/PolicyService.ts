/**
 * PolicyService - Policy management and evaluation service
 *
 * Provides CRUD operations for policy definitions and policy evaluation
 * against pipeline runs and other resources.
 */

import { createLogger } from '../../utils/logger';
import {
  PolicyDefinitionRepository,
  PolicyDefinitionEntity,
  PolicyDefinitionCreateInput,
  PolicyDefinitionUpdateInput,
  PolicyBundleRepository,
  PolicyBundleEntity,
} from '../../repositories/PolicyDefinitionRepository';
import { PolicyEvaluationRepository, PolicyEvaluationEntity } from '../../repositories/PolicyEvaluationRepository';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

const logger = createLogger('PolicyService');

// ==================== Input Interfaces ====================

export interface CreatePolicyInput {
  name: string;
  description?: string;
  category: 'security' | 'cost' | 'quality' | 'governance';
  regoPath: string;
  gateId?: string;
  severity?: 'block' | 'warning' | 'info';
  metadata?: Record<string, unknown>;
}

export interface UpdatePolicyInput {
  description?: string;
  category?: 'security' | 'cost' | 'quality' | 'governance';
  regoPath?: string;
  gateId?: string;
  severity?: 'block' | 'warning' | 'info';
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PolicyEvaluationContext {
  runId: string;
  pipelineId?: string;
  pipelineName?: string;
  triggerBy?: string;
  branch?: string;
  resources?: Array<{
    type: string;
    id: string;
    name: string;
    metadata?: Record<string, unknown>;
  }>;
  input?: Record<string, unknown>;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  violations: Array<{
    policyId: string;
    policyName: string;
    severity: string;
    message: string;
    resource?: { type: string; id: string };
  }>;
  evaluationMs: number;
}

// ==================== PolicyService ====================

export class PolicyService {
  private policyRepo: PolicyDefinitionRepository | null = null;
  private bundleRepo: PolicyBundleRepository | null = null;
  private evaluationRepo: PolicyEvaluationRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.setRepositories(
        new PolicyDefinitionRepository(db),
        new PolicyBundleRepository(db),
        new PolicyEvaluationRepository(db),
      );
    }
  }

  /**
   * Set repositories after construction (for lazy initialization)
   */
  setRepositories(
    policyRepo: PolicyDefinitionRepository,
    bundleRepo: PolicyBundleRepository,
    evaluationRepo: PolicyEvaluationRepository,
  ): void {
    this.policyRepo = policyRepo;
    this.bundleRepo = bundleRepo;
    this.evaluationRepo = evaluationRepo;
  }

  // ==================== Policy CRUD ====================

  /**
   * Create a new policy definition
   */
  async createPolicy(config: CreatePolicyInput): Promise<PolicyDefinitionEntity> {
    if (!this.policyRepo) {
      // Mock mode: return a synthetic entity
      return {
        id: this.generateId(),
        tenantId: 'default',
        name: config.name,
        description: config.description ?? null,
        category: config.category ?? 'general',
        regoPath: config.regoPath ?? '',
        gateId: config.gateId ?? null,
        severity: config.severity ?? 'warning',
        enabled: true,
        metadata: config.metadata ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PolicyDefinitionEntity;
    }

    const entity = await this.policyRepo.createPolicy({
      name: config.name,
      description: config.description,
      category: config.category,
      regoPath: config.regoPath,
      gateId: config.gateId,
      severity: config.severity,
      metadata: config.metadata,
    });

    logger.info({ policyId: entity.id, name: entity.name, category: entity.category }, '[PolicyService] Policy created');
    return entity;
  }

  /**
   * Get policy by ID
   */
  async getPolicy(id: string): Promise<PolicyDefinitionEntity | null> {
    if (!this.policyRepo) {
      return null;
    }

    const policy = await this.policyRepo.findById(id);
    return policy ?? null;
  }

  /**
   * List policies for a tenant
   */
  async listPolicies(tenantId: string, options?: {
    category?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ policies: PolicyDefinitionEntity[]; total: number }> {
    if (!this.policyRepo) {
      return { policies: [], total: 0 };
    }

    if (options?.category) {
      const policies = await this.policyRepo.findByCategory(options.category, {
        limit: options.limit,
        offset: options.offset,
      });
      return { policies, total: policies.length };
    }

    if (options?.enabled) {
      const policies = await this.policyRepo.findEnabled();
      const total = policies.length;
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 20;
      return {
        policies: policies.slice(offset, offset + limit),
        total,
      };
    }

    const result = await this.policyRepo.findAll({
      limit: options?.limit ?? 20,
      offset: options?.offset ?? 0,
    });
    return { policies: result.entities, total: result.total };
  }

  /**
   * Update policy
   */
  async updatePolicy(id: string, updates: UpdatePolicyInput): Promise<PolicyDefinitionEntity | null> {
    if (!this.policyRepo) {
      return null;
    }

    const updated = await this.policyRepo.updatePolicy(id, updates);
    if (updated) {
      logger.info({ policyId: id, updates }, '[PolicyService] Policy updated');
    }
    return updated ?? null;
  }

  /**
   * Delete policy
   */
  async deletePolicy(id: string): Promise<boolean> {
    if (!this.policyRepo) {
      return false;
    }

    const deleted = await this.policyRepo.deletePolicy(id);
    if (deleted) {
      logger.info({ policyId: id }, '[PolicyService] Policy deleted');
    }
    return deleted;
  }

  // ==================== Policy Evaluation ====================

  /**
   * Evaluate policies against a context
   */
  async evaluatePolicy(policyId: string, context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    const startTime = Date.now();

    // Get the policy
    const policy = await this.getPolicy(policyId);
    if (!policy) {
      return {
        allowed: true,
        violations: [],
        evaluationMs: Date.now() - startTime,
      };
    }

    // Get all enabled policies if no specific policy requested
    if (!policy.enabled) {
      return {
        allowed: true,
        violations: [],
        evaluationMs: Date.now() - startTime,
      };
    }

    // Simple evaluation logic (in real implementation, this would use OPA rego)
    const violations: PolicyEvaluationResult['violations'] = [];

    // Evaluate based on policy category and severity
    await this.evaluateAgainstContext(policy, context, violations);

    const evaluationMs = Date.now() - startTime;

    // Store evaluation result
    if (this.evaluationRepo) {
      try {
        const id = this.generateId();
        const now = new Date();
        await this.evaluationRepo.getDb().query(
          `INSERT INTO policy_evaluations (id, policy_id, run_id, input_context, result, evaluated_at, evaluation_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, policy.id, context.runId, JSON.stringify(context), JSON.stringify({ allowed: violations.length === 0, violations }), now, evaluationMs],
        );
      } catch (err) {
        logger.warn({ err }, '[PolicyService] Failed to store evaluation result');
      }
    }

    const blocked = violations.some(v => v.severity === 'block');
    return {
      allowed: !blocked,
      violations,
      evaluationMs,
    };
  }

  /**
   * Evaluate all enabled policies
   */
  async evaluateAllPolicies(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    const startTime = Date.now();

    if (!this.policyRepo) {
      return { allowed: true, violations: [], evaluationMs: Date.now() - startTime };
    }

    const enabledPolicies = await this.policyRepo.findEnabled();
    const allViolations: PolicyEvaluationResult['violations'] = [];

    for (const policy of enabledPolicies) {
      const violations: PolicyEvaluationResult['violations'] = [];
      await this.evaluateAgainstContext(policy, context, violations);
      allViolations.push(...violations);
    }

    const evaluationMs = Date.now() - startTime;
    const blocked = allViolations.some(v => v.severity === 'block');

    return {
      allowed: !blocked,
      violations: allViolations,
      evaluationMs,
    };
  }

  /**
   * Internal method to evaluate a single policy
   */
  private async evaluateAgainstContext(
    policy: PolicyDefinitionEntity,
    context: PolicyEvaluationContext,
    violations: PolicyEvaluationResult['violations'],
  ): Promise<void> {
    // Simple rule-based evaluation for demo
    // In production, this would execute OPA rego policies

    // Example: Block if pipeline name contains "test" and category is security
    if (policy.category === 'security' && policy.severity === 'block') {
      if (context.pipelineName?.toLowerCase().includes('security-scan')) {
        // This would be a real security policy violation
        violations.push({
          policyId: policy.id,
          policyName: policy.name,
          severity: policy.severity,
          message: `Security policy violated: ${policy.description || policy.name}`,
        });
      }
    }

    // Example: Check resource compliance
    if (context.resources && policy.category === 'governance') {
      for (const resource of context.resources) {
        // Simple check: would evaluate against governance rules
        if (resource.type === 'deployment' && !resource.metadata?.['compliant']) {
          violations.push({
            policyId: policy.id,
            policyName: policy.name,
            severity: policy.severity,
            message: `Resource ${resource.name} is not compliant with governance policy`,
            resource: { type: resource.type, id: resource.id },
          });
        }
      }
    }
  }

  // ==================== Policy Bundle ====================

  /**
   * Get active policy bundle
   */
  async getActiveBundle(): Promise<PolicyBundleEntity | null> {
    if (!this.bundleRepo) {
      return null;
    }

    const bundles = await this.bundleRepo.findActive();
    return bundles[0] ?? null;
  }

  /**
   * Get policy by gate ID
   */
  async getPoliciesByGate(gateId: string): Promise<PolicyDefinitionEntity[]> {
    if (!this.policyRepo) {
      return [];
    }

    return this.policyRepo.findByGateId(gateId);
  }

  /**
   * List all policy bundles
   */
  async listBundles(): Promise<PolicyBundleEntity[]> {
    if (!this.bundleRepo) {
      return [];
    }
    const result = await this.bundleRepo.findAll();
    return result.entities;
  }

  /**
   * Get a specific policy bundle by ID
   */
  async getBundle(id: string): Promise<PolicyBundleEntity | null> {
    if (!this.bundleRepo) {
      return null;
    }
    return (await this.bundleRepo.findById(id)) ?? null;
  }

  /**
   * Sync policy bundles from external source
   */
  async syncBundles(sourceUrl: string): Promise<PolicyBundleEntity[]> {
    if (!this.bundleRepo) {
      return [];
    }
    // Mock implementation - would fetch from external source
    logger.info({ sourceUrl }, 'Syncing policy bundles');
    const result = await this.bundleRepo.findAll();
    return result.entities;
  }

  /**
   * Test a policy against sample input
   */
  async testPolicy(policyId: string, context: PolicyEvaluationContext): Promise<PolicyEvaluationResult>;
  async testPolicy(rego: string, testCases: Array<Record<string, unknown>>): Promise<any>;
  async testPolicy(policyIdOrRego: string, contextOrTestCases: PolicyEvaluationContext | Array<Record<string, unknown>>): Promise<any> {
    // For rego + testCases mode, return mock results
    if (Array.isArray(contextOrTestCases)) {
      return {
        passed: true,
        results: contextOrTestCases.map(tc => ({ input: tc, result: 'pass' }))
      };
    }
    return this.evaluatePolicy(policyIdOrRego, contextOrTestCases);
  }

  /**
   * Toggle policy enabled/disabled
   */
  async toggle(id: string, enabled: boolean): Promise<PolicyDefinitionEntity | null> {
    return this.updatePolicy(id, { enabled } as UpdatePolicyInput);
  }

  // ==================== Evaluation History ====================

  /**
   * Get evaluation history for a run
   */
  async getEvaluationHistory(runId: string, limit?: number): Promise<PolicyEvaluationEntity[]> {
    if (!this.evaluationRepo) {
      return [];
    }

    const result = await this.evaluationRepo.findAll({ limit: limit || 100 });
    return result.entities.filter(e => e.runId === runId);
  }

  /**
   * Evaluate a policy against a resource (alias for evaluatePolicy)
   */
  async evaluate(tenantId: string, resourceType: string, resourceId: string, action: string, context: Record<string, any>): Promise<PolicyEvaluationResult> {
    return this.evaluatePolicy(tenantId as any, {
      runId: resourceId,
      resources: [{ type: resourceType, id: resourceId, name: resourceType }],
      input: context,
    });
  }

  // ==================== Utility Methods ====================

  private generateId(): string {
    return `policy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default PolicyService;