/**
 * PolicyEvaluationService - Policy Evaluation Orchestration
 *
 * Provides operations for evaluating policies, storing results,
 * and analyzing evaluation history.
 */

import { createLogger } from '../../utils/logger';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import {
  PolicyEvaluationRepository,
  PolicyEvaluationEntity,
} from '../../repositories/PolicyEvaluationRepository';
import { PolicyViolationRepository, PolicyViolationEntity } from '../../repositories/PolicyViolationRepository';
import { DatabasePool } from '../database';

const logger = createLogger('PolicyEvaluationService');

// ==================== Types ====================

export interface EvaluationInput {
  policyId?: string;
  tenantId: string;
  runId: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  context?: Record<string, any>;
}

export interface EvaluationResult {
  id: string;
  allowed: boolean;
  policyId: string | null;
  runId: string;
  result: Record<string, any>;
  evaluatedAt: Date;
  evaluationMs: number | null;
  violations?: PolicyViolationEntity[];
}

// ==================== PolicyEvaluationService ====================

export class PolicyEvaluationService {
  private evalRepo: PolicyEvaluationRepository | null = null;
  private violationRepo: PolicyViolationRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.setRepositories(
        new PolicyEvaluationRepository(db),
        new PolicyViolationRepository(db),
      );
    }
  }

  /**
   * Set repositories after construction (for lazy initialization)
   */
  setRepositories(evalRepo: PolicyEvaluationRepository, violationRepo: PolicyViolationRepository): void {
    this.evalRepo = evalRepo;
    this.violationRepo = violationRepo;
  }

  // ==================== Evaluation Operations ====================

  /**
   * Evaluate a single policy or multiple policies
   */
  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const evaluationId = this.generateId();
    const startTime = Date.now();

    // In production, this would:
    // 1. Retrieve the policy (or all policies for the tenant)
    // 2. Execute OPA evaluation with the input context
    // 3. Determine if the action is allowed

    const allowed = true; // Mock: always allow for now
    const policyId = input.policyId ?? 'default-policy';

    const result: EvaluationResult = {
      id: evaluationId,
      allowed,
      policyId,
      runId: input.runId,
      result: {
        allowed,
        reason: 'Evaluation completed',
        context: input.context || {},
      },
      evaluatedAt: new Date(),
      evaluationMs: Date.now() - startTime,
    };

    // Store evaluation result
    if (this.evalRepo) {
      await this.evalRepo.create({
        id: evaluationId,
        policyId: input.policyId ?? null,
        runId: input.runId,
        inputContext: {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          action: input.action,
          ...input.context,
        },
        result: result.result,
        evaluatedAt: result.evaluatedAt,
        evaluationMs: result.evaluationMs,
      });
    }

    logger.info({ evaluationId, policyId, runId: input.runId, allowed }, '[PolicyEvaluationService] Evaluation completed');
    return result;
  }

  /**
   * Evaluate a specific policy against a context
   */
  async evaluatePolicy(policyId: string, context: Record<string, any>): Promise<EvaluationResult> {
    const runId = context.runId || this.generateId();
    return this.evaluate({
      policyId,
      tenantId: context.tenantId || getCurrentTenantId(),
      runId,
      context,
    });
  }

  /**
   * Batch evaluate multiple policies
   */
  async evaluateBatch(inputs: EvaluationInput[]): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const input of inputs) {
      const result = await this.evaluate(input);
      results.push(result);
    }

    return results;
  }

  // ==================== Query Operations ====================

  /**
   * Get evaluation by ID
   */
  async getEvaluation(id: string): Promise<EvaluationResult | null> {
    if (!this.evalRepo) {
      return null;
    }

    const entity = await this.evalRepo.findById(id);
    if (!entity) {
      return null;
    }

    return this.entityToResult(entity);
  }

  /**
   * Get evaluations by run ID
   */
  async getByRunId(runId: string): Promise<EvaluationResult[]> {
    if (!this.evalRepo) {
      return [];
    }

    const entities = await this.evalRepo.findByRunId(runId);
    return entities.map(e => this.entityToResult(e));
  }

  /**
   * Get evaluations by policy ID
   */
  async getByPolicyId(policyId: string, options?: { limit?: number; offset?: number }): Promise<EvaluationResult[]> {
    if (!this.evalRepo) {
      return [];
    }

    const entities = await this.evalRepo.findByPolicyId(policyId, options);
    return entities.map(e => this.entityToResult(e));
  }

  /**
   * Get all evaluations with filtering
   */
  async listEvaluations(limit: number = 20, offset: number = 0): Promise<{ evaluations: EvaluationResult[]; total: number }> {
    if (!this.evalRepo) {
      return { evaluations: [], total: 0 };
    }

    const result = await this.evalRepo.findAll({ limit, offset });
    return {
      evaluations: result.entities.map(e => this.entityToResult(e)),
      total: result.total,
    };
  }

  // ==================== Violation Operations ====================

  /**
   * Get violations for an evaluation
   */
  async getViolations(evaluationId: string): Promise<PolicyViolationEntity[]> {
    if (!this.violationRepo) {
      return [];
    }

    const violations = await this.violationRepo.findAllWithOptions({
      limit: 100,
    });

    return violations.entities.filter(v => v.evaluation_id === evaluationId);
  }

  /**
   * Get violations by policy
   */
  async getViolationsByPolicy(policyId: string): Promise<PolicyViolationEntity[]> {
    if (!this.violationRepo) {
      return [];
    }

    return this.violationRepo.findByPolicyId(policyId);
  }

  /**
   * Get violations by status
   */
  async getOpenViolations(status: string = 'open'): Promise<PolicyViolationEntity[]> {
    if (!this.violationRepo) {
      return [];
    }

    return this.violationRepo.findByStatus(status);
  }

  /**
   * Update violation status
   */
  async updateViolationStatus(id: string, status: string): Promise<PolicyViolationEntity | null> {
    if (!this.violationRepo) {
      return null;
    }

    const result = await this.violationRepo.updateStatus(id, status);
    return result ?? null;
  }

  // ==================== Gate Evaluation (for Pipeline) ====================

  /**
   * Evaluate a policy gate (used by pipeline stages)
   */
  async evaluateGate(policyId: string, context: Record<string, any>): Promise<EvaluationResult> {
    return this.evaluatePolicy(policyId, context);
  }

  // ==================== Violation Management ====================

  /**
   * Get evaluation by run ID (alias for getByRunId)
   */
  async getEvaluations(runId: string): Promise<EvaluationResult[]> {
    return this.getByRunId(runId);
  }

  /**
   * Get violation by ID
   */
  async getViolationById(id: string): Promise<PolicyViolationEntity | null> {
    if (!this.violationRepo) {
      return null;
    }
    return (await this.violationRepo.findById(id)) ?? null;
  }

  /**
   * Waive a violation
   */
  async waiveViolation(id: string, reason: string): Promise<PolicyViolationEntity | null> {
    if (!this.violationRepo) {
      return null;
    }
    return (await this.violationRepo.updateStatus(id, 'waived')) ?? null;
  }

  /**
   * Resolve a violation
   */
  async resolveViolation(id: string, resolution: string): Promise<PolicyViolationEntity | null> {
    if (!this.violationRepo) {
      return null;
    }
    return (await this.violationRepo.updateStatus(id, 'resolved')) ?? null;
  }

  /**
   * List violation overrides
   */
  async listOverrides(policyId?: string): Promise<PolicyViolationEntity[]> {
    if (!this.violationRepo) {
      return [];
    }
    return this.violationRepo.findByStatus('waived');
  }

  /**
   * Create a violation override
   */
  async createOverride(policyId: string, violationId: string, reason: string): Promise<PolicyViolationEntity | null> {
    if (!this.violationRepo) {
      return null;
    }
    const violation = await this.violationRepo.findById(violationId);
    if (violation) {
      return (await this.violationRepo.updateStatus(violationId, 'waived')) ?? null;
    }
    return null;
  }

  // ==================== Utility Methods ====================

  private entityToResult(entity: PolicyEvaluationEntity): EvaluationResult {
    return {
      id: entity.id,
      allowed: entity.result?.allowed ?? true,
      policyId: entity.policyId,
      runId: entity.runId,
      result: entity.result,
      evaluatedAt: entity.evaluatedAt,
      evaluationMs: entity.evaluationMs,
    };
  }

  private generateId(): string {
    return `eval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get compliance status for a tenant or policy
   */
  async getComplianceStatus(options?: {
    tenantId?: string;
    policyId?: string;
    period?: 'day' | 'week' | 'month';
  }): Promise<{
    totalEvaluations: number;
    allowedCount: number;
    deniedCount: number;
    complianceRate: number;
    byPolicy: Array<{ policyId: string; allowed: number; denied: number; complianceRate: number }>;
    period: string;
  }> {
    const period = options?.period ?? 'week';
    const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    let evaluations: PolicyEvaluationEntity[] = [];

    if (!this.evalRepo) {
      return {
        totalEvaluations: 0,
        allowedCount: 0,
        deniedCount: 0,
        complianceRate: 1,
        byPolicy: [],
        period,
      };
    }

    if (options?.policyId) {
      evaluations = await this.evalRepo.findByPolicyId(options.policyId, { limit: 1000 });
    } else {
      const result = await this.evalRepo.findAll({ limit: 1000, offset: 0 });
      evaluations = result.entities;
    }

    // Filter by date
    const filtered = evaluations.filter((e) => e.evaluatedAt >= startDate);

    // Calculate stats
    const totalEvaluations = filtered.length;
    const allowedCount = filtered.filter((e) => e.result?.allowed === true).length;
    const deniedCount = filtered.filter((e) => e.result?.allowed === false).length;
    const complianceRate = totalEvaluations > 0 ? allowedCount / totalEvaluations : 1;

    // Group by policy
    const policyMap = new Map<string, { allowed: number; denied: number }>();
    for (const eval_ of filtered) {
      const pid = eval_.policyId ?? 'default';
      const current = policyMap.get(pid) ?? { allowed: 0, denied: 0 };
      if (eval_.result?.allowed === true) {
        current.allowed++;
      } else if (eval_.result?.allowed === false) {
        current.denied++;
      }
      policyMap.set(pid, current);
    }

    const byPolicy = Array.from(policyMap.entries()).map(([policyId, stats]) => ({
      policyId,
      allowed: stats.allowed,
      denied: stats.denied,
      complianceRate: (stats.allowed + stats.denied) > 0 ? stats.allowed / (stats.allowed + stats.denied) : 1,
    }));

    logger.info({
      totalEvaluations,
      complianceRate: complianceRate.toFixed(2),
      period
    }, '[PolicyEvaluationService] Compliance status computed');

    return {
      totalEvaluations,
      allowedCount,
      deniedCount,
      complianceRate,
      byPolicy,
      period,
    };
  }

  /**
   * Get policy enforcement summary
   */
  async getEnforcementSummary(tenantId?: string): Promise<{
    activeViolations: number;
    resolvedViolations: number;
    policies: Array<{ id: string; name: string; violationCount: number }>;
  }>{
    if (!this.violationRepo) {
      return { activeViolations: 0, resolvedViolations: 0, policies: [] };
    }

    const openViolations = await this.getOpenViolations('open');
    const allViolations = await this.getOpenViolations();

    // Group violations by policy
    const policyViolationMap = new Map<string, number>();
    for (const v of openViolations) {
      const pid = v.policy_id ?? 'default';
      policyViolationMap.set(pid, (policyViolationMap.get(pid) ?? 0) + 1);
    }

    const policies = Array.from(policyViolationMap.entries()).map(([id, violationCount]) => ({
      id,
      name: id,
      violationCount,
    }));

    return {
      activeViolations: openViolations.length,
      resolvedViolations: allViolations.length - openViolations.length,
      policies,
    };
  }
}

export default PolicyEvaluationService;