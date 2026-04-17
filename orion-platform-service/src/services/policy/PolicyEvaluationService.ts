/**
 * Policy Evaluation Service - 策略评估、违规和豁免管理
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

export class PolicyEvaluationService {
  private evaluations: Map<string, PolicyEvaluation> = new Map();
  private violations: Map<string, PolicyViolation> = new Map();
  private overrides: Map<string, PolicyOverride> = new Map();
  private eventBus?: EventBusService;

  constructor(options?: { eventBus?: EventBusService }) {
    this.eventBus = options?.eventBus;
  }

  /**
   * Evaluate a policy against input context
   * Mock OPA evaluation - in production this calls OPA REST API
   */
  async evaluate(
    policyId: string,
    runId: string,
    inputContext: Record<string, unknown>
  ): Promise<{ evaluation: PolicyEvaluation; violations: PolicyViolation[] }> {
    const startTime = Date.now();

    // Mock OPA evaluation result
    const mockResult: Record<string, unknown> = {
      allow: true,
      deny: [],
      warnings: [],
    };

    // Simulate some denial conditions for MVP demo
    if ((inputContext as any).resource?.privileged === true) {
      mockResult.allow = false;
      mockResult.deny = ['Containers must not run as privileged'];
    }

    const evaluation = createPolicyEvaluation({
      policyId,
      runId,
      inputContext,
      result: mockResult,
      evaluationMs: Date.now() - startTime,
    });
    this.evaluations.set(evaluation.id, evaluation);

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
   * Evaluate all policies for a given gate
   */
  async evaluateGate(
    gateId: string,
    runId: string,
    inputContext: Record<string, unknown>
  ): Promise<PolicyEvaluationResult> {
    // In production, load all enabled policies for this gate
    const result: PolicyEvaluationResult = {
      passed: true,
      violations: [],
      warnings: [],
      evaluations: [],
    };

    // Mock evaluation
    const evalResult = await this.evaluate('mock-policy', runId, inputContext);
    result.evaluations.push(evalResult.evaluation);
    result.violations.push(...evalResult.violations.filter(v => true));
    result.passed = evalResult.violations.length === 0;

    return result;
  }

  // Evaluation listing
  async getEvaluations(filter: PolicyEvaluationListFilter = {}): Promise<PolicyEvaluation[]> {
    let items = Array.from(this.evaluations.values());

    if (filter.runId) {
      items = items.filter(e => e.runId === filter.runId);
    }
    if (filter.policyId) {
      items = items.filter(e => e.policyId === filter.policyId);
    }

    return items;
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
