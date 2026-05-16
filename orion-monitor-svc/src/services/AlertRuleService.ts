/**
 * AlertRuleService — business logic for custom alert rules.
 *
 * Manages the lifecycle of alert rules and provides metric evaluation
 * to determine whether alerts should fire based on incoming samples.
 */

import crypto from 'crypto';
import {
  AlertRuleRepository,
  type AlertRule,
  type AlertCondition,
  type AlertSeverity,
} from '../repositories/AlertRuleRepository.js';

export interface MetricSample {
  metric: string;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
}

export interface AlertEvaluation {
  ruleId: string;
  triggered: boolean;
  currentValue: number;
  threshold: number;
  evaluatedAt: Date;
}

/**
 * Input for creating a new alert rule.
 */
export interface CreateRuleInput {
  tenantId: string;
  name: string;
  description?: string;
  metric: string;
  condition: AlertCondition;
  threshold: number;
  thresholdMax?: number;
  duration?: number;
  severity?: AlertSeverity;
  enabled?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export class AlertRuleService {
  private repo: AlertRuleRepository;

  constructor(repo?: AlertRuleRepository) {
    this.repo = repo ?? new AlertRuleRepository();
  }

  /**
   * Create a new alert rule.
   */
  async createRule(input: CreateRuleInput): Promise<AlertRule> {
    const id = `rule-${crypto.randomUUID()}`;
    return this.repo.create({
      id,
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? '',
      metric: input.metric,
      condition: input.condition,
      threshold: input.threshold,
      thresholdMax: input.thresholdMax,
      duration: input.duration ?? 60,
      severity: input.severity ?? 'warning',
      enabled: input.enabled ?? true,
      labels: input.labels ?? {},
      annotations: input.annotations ?? {},
    });
  }

  /**
   * List all rules for a tenant.
   */
  async listRules(tenantId: string, enabledOnly?: boolean): Promise<AlertRule[]> {
    return this.repo.findAll(tenantId, enabledOnly);
  }

  /**
   * Get a single rule by ID.
   */
  async getRule(id: string): Promise<AlertRule | null> {
    return this.repo.findById(id);
  }

  /**
   * Update an existing rule.
   */
  async updateRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    return this.repo.update(id, updates);
  }

  /**
   * Delete a rule by ID.
   */
  async deleteRule(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }

  /**
   * Evaluate a single metric sample against a rule.
   *
   * Returns an evaluation result indicating whether the rule's condition
   * is satisfied by the current metric value.
   */
  evaluate(sample: MetricSample, rule: AlertRule): AlertEvaluation {
    // Non-matching metric — never triggers
    if (sample.metric !== rule.metric) {
      return {
        ruleId: rule.id,
        triggered: false,
        currentValue: sample.value,
        threshold: rule.threshold,
        evaluatedAt: new Date(),
      };
    }

    let triggered = false;
    switch (rule.condition) {
      case 'gt':
        triggered = sample.value > rule.threshold;
        break;
      case 'lt':
        triggered = sample.value < rule.threshold;
        break;
      case 'eq':
        triggered = sample.value === rule.threshold;
        break;
      case 'gte':
        triggered = sample.value >= rule.threshold;
        break;
      case 'lte':
        triggered = sample.value <= rule.threshold;
        break;
      case 'between':
        triggered =
          sample.value >= rule.threshold &&
          (rule.thresholdMax === undefined || sample.value <= rule.thresholdMax);
        break;
      case 'anomaly':
        // Anomaly: value deviates more than 50% from the baseline (threshold)
        triggered = Math.abs(sample.value - rule.threshold) > rule.threshold * 0.5;
        break;
    }

    return {
      ruleId: rule.id,
      triggered,
      currentValue: sample.value,
      threshold: rule.threshold,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Evaluate multiple metric samples against all enabled rules for a tenant.
   */
  async evaluateAll(tenantId: string, samples: MetricSample[]): Promise<AlertEvaluation[]> {
    const rules = await this.repo.findAll(tenantId, true);
    const results: AlertEvaluation[] = [];

    for (const sample of samples) {
      for (const rule of rules) {
        results.push(this.evaluate(sample, rule));
      }
    }

    return results;
  }
}
