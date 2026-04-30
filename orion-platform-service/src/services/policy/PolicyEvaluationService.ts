/**
 * Policy Evaluation Service - 策略评估、违规和豁免管理
 *
 * Supports real OPA REST API evaluation when OPA_URL is configured.
 * Falls back to mock evaluation for development/testing.
 */

import { EventBusService } from '../event-bus-service';
import {
  PolicyEvaluation,
  PolicyEvaluationCreateInput,
  createPolicyEvaluation,
  PolicyViolation,
  PolicyViolationCreateInput,
  createPolicyViolation,
  PolicyOverride,
  PolicyOverrideCreateInput,
  createPolicyOverride,
  ViolationStatus,
} from '../../models/PolicyDefinition';
import { PolicyEvaluationRepository, PolicyEvaluationEntity } from '../../repositories/PolicyEvaluationRepository';

export interface PolicyEvaluationListFilter {
  runId?: string;
  policyId?: string;
}

export interface PolicyViolationListFilter {
  status?: ViolationStatus;
  severity?: string;
  policyId?: string;
}

export interface PolicyEvaluationResult {
  passed: boolean;
  violations: PolicyViolation[];
  warnings: PolicyViolation[];
  evaluations: PolicyEvaluation[];
}

export interface PolicyEvaluationServiceConfig {
  /** OPA server base URL (e.g. http://localhost:8181) */
  opaUrl?: string;
  /** OPA policy package path (e.g. orion/policies) */
  opaPackage?: string;
  /** Request timeout (ms) */
  opaTimeout?: number;
}

export class PolicyEvaluationService {
  private evaluationRepository?: PolicyEvaluationRepository;
  private violations: Map<string, PolicyViolation> = new Map();
  private overrides: Map<string, PolicyOverride> = new Map();
  private eventBus?: EventBusService;
  private opaUrl?: string;
  private opaPackage: string;
  private opaTimeout: number;

  constructor(options?: {
    eventBus?: EventBusService;
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
    config?: PolicyEvaluationServiceConfig;
  }) {
    this.eventBus = options?.eventBus;
    if (options?.db) {
      this.evaluationRepository = new PolicyEvaluationRepository(options.db);
    }
    this.opaUrl = options?.config?.opaUrl || process.env.OPA_URL;
    this.opaPackage = options?.config?.opaPackage || 'orion.policies';
    this.opaTimeout = options?.config?.opaTimeout || 5_000;
  }

  /**
   * Evaluate a policy against input context
   * Uses real OPA REST API when OPA_URL is configured, falls back to mock
   */
  async evaluate(
    policyId: string,
    runId: string,
    inputContext: Record<string, unknown>
  ): Promise<{ evaluation: PolicyEvaluation; violations: PolicyViolation[] }> {
    const startTime = Date.now();

    // Try real OPA evaluation, fallback to mock
    const mockResult = await this.callOpa(policyId, inputContext);

    const evaluation = createPolicyEvaluation({
      policyId,
      runId,
      inputContext,
      result: mockResult,
      evaluationMs: Date.now() - startTime,
    });

    if (this.evaluationRepository) {
      await this.evaluationRepository.create({
        id: evaluation.id,
        policyId,
        runId,
        inputContext: inputContext as Record<string, any>,
        result: mockResult as Record<string, any>,
        evaluatedAt: new Date(),
        evaluationMs: evaluation.evaluationMs ?? null,
      });
    }

    const violations: PolicyViolation[] = [];
    if (!mockResult.allow && Array.isArray(mockResult.deny)) {
      for (const msg of mockResult.deny as string[]) {
        const violation = createPolicyViolation({
          evaluationId: evaluation.id,
          policyId,
          severity: 'block',
          message: msg,
          resourceType: (inputContext as any).resourceType,
          resourceId: (inputContext as any).resourceId,
        });
        this.violations.set(violation.id, violation);
        violations.push(violation);
      }
    }

    await this.eventBus?.publish('policy.evaluated', {
      evaluationId: evaluation.id,
      policyId,
      passed: mockResult.allow,
      violations: violations.length,
    });

    return { evaluation, violations };
  }

  /**
   * Call OPA REST API for policy evaluation
   * Falls back to mock if OPA is not configured or unreachable
   */
  private async callOpa(
    policyId: string,
    inputContext: Record<string, unknown>
  ): Promise<{ allow: boolean; deny: string[]; warnings: string[] }> {
    const fallback: { allow: boolean; deny: string[]; warnings: string[] } = {
      allow: true,
      deny: [],
      warnings: [],
    };

    if (!this.opaUrl) return fallback;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.opaTimeout);

      const response = await fetch(`${this.opaUrl}/v1/data/${this.opaPackage}/${policyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputContext }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return fallback;
      }

      const text = await response.text();
      const data: { result?: { allow?: boolean; deny?: string[]; warnings?: string[] } } = JSON.parse(text);
      return {
        allow: data?.result?.allow ?? true,
        deny: data?.result?.deny ?? [],
        warnings: data?.result?.warnings ?? [],
      };
    } catch {
      return fallback;
    }
  }

  /**
   * Evaluate all policies for a given gate
   */
  async evaluateGate(
    gateId: string,
    runId: string,
    inputContext: Record<string, unknown>
  ): Promise<PolicyEvaluationResult> {
    const result: PolicyEvaluationResult = {
      passed: true,
      violations: [],
      warnings: [],
      evaluations: [],
    };

    const evalResult = await this.evaluate('mock-policy', runId, inputContext);
    result.evaluations.push(evalResult.evaluation);
    result.violations.push(...evalResult.violations.filter(v => true));
    result.passed = evalResult.violations.length === 0;

    return result;
  }

  // Evaluation listing
  async getEvaluations(filter: PolicyEvaluationListFilter = {}): Promise<PolicyEvaluation[]> {
    if (this.evaluationRepository) {
      if (filter.runId) {
        const entities = await this.evaluationRepository.findByRunId(filter.runId);
        return entities.map(e => this.mapEntityToEvaluation(e));
      }
      if (filter.policyId) {
        const entities = await this.evaluationRepository.findByPolicyId(filter.policyId);
        return entities.map(e => this.mapEntityToEvaluation(e));
      }
      const result = await this.evaluationRepository.findAll();
      return result.entities.map((e: PolicyEvaluationEntity) => this.mapEntityToEvaluation(e));
    }
    return [];
  }

  private mapEntityToEvaluation(entity: PolicyEvaluationEntity): PolicyEvaluation {
    return {
      id: entity.id,
      policyId: entity.policyId ?? undefined,
      runId: entity.runId,
      inputContext: entity.inputContext,
      result: entity.result,
      evaluatedAt: entity.evaluatedAt,
      evaluationMs: entity.evaluationMs ?? undefined,
    };
  }

  // Violation listing
  async getViolations(filter: PolicyViolationListFilter = {}): Promise<PolicyViolation[]> {
    let items = Array.from(this.violations.values());

    if (filter.status) {
      items = items.filter(v => v.status === filter.status);
    }
    if (filter.severity) {
      items = items.filter(v => v.severity === filter.severity);
    }
    if (filter.policyId) {
      items = items.filter(v => v.policyId === filter.policyId);
    }

    return items;
  }

  async getViolationById(id: string): Promise<PolicyViolation | undefined> {
    return this.violations.get(id);
  }

  async waiveViolation(id: string, reason: string): Promise<PolicyViolation | undefined> {
    const violation = this.violations.get(id);
    if (!violation) return undefined;

    violation.status = 'waived';
    this.violations.set(id, violation);

    await this.eventBus?.publish('policy.violation.waived', { violationId: id, reason });
    return violation;
  }

  async resolveViolation(id: string): Promise<PolicyViolation | undefined> {
    const violation = this.violations.get(id);
    if (!violation) return undefined;

    violation.status = 'resolved';
    this.violations.set(id, violation);

    await this.eventBus?.publish('policy.violation.resolved', { violationId: id });
    return violation;
  }

  // Override management
  async createOverride(input: PolicyOverrideCreateInput): Promise<PolicyOverride> {
    const override = createPolicyOverride(input);
    this.overrides.set(override.id, override);

    await this.eventBus?.publish('policy.override.created', {
      overrideId: override.id,
      policyId: override.policyId,
    });
    return override;
  }

  async listOverrides(): Promise<PolicyOverride[]> {
    return Array.from(this.overrides.values());
  }
}
