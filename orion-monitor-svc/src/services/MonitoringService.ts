import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { MonitoringRule, CreateRuleInput } from '../types/monitor.js';

/**
 * In-memory store (stub — replace with database in production).
 */
const rules: Map<string, MonitoringRule> = new Map();

export class MonitoringService {
  /**
   * Create a new monitoring rule.
   */
  async createRule(
    tenantId: string,
    projectId: string,
    createdBy: string,
    input: CreateRuleInput,
  ): Promise<MonitoringRule> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const rule: MonitoringRule = {
      id,
      tenantId,
      projectId,
      name: input.name,
      description: input.description ?? '',
      ruleType: input.ruleType,
      metricName: input.metricName,
      metricType: input.metricType ?? 'gauge',
      aggregation: input.aggregation ?? 'avg',
      threshold: input.threshold,
      comparison: input.comparison,
      duration: input.duration ?? 60,
      labels: input.labels ?? {},
      enabled: true,
      alertPolicyId: input.alertPolicyId,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    rules.set(id, rule);
    return rule;
  }

  /**
   * List monitoring rules with optional filtering.
   */
  async listRules(
    tenantId: string,
    projectId?: string,
  ): Promise<MonitoringRule[]> {
    const result = Array.from(rules.values()).filter(
      (r) =>
        r.tenantId === tenantId &&
        (projectId === undefined || r.projectId === projectId),
    );
    return result;
  }

  /**
   * Get a single rule by ID.
   */
  async getRule(
    tenantId: string,
    ruleId: string,
  ): Promise<MonitoringRule | undefined> {
    const rule = rules.get(ruleId);
    if (rule?.tenantId !== tenantId) return undefined;
    return rule;
  }

  /**
   * Update a monitoring rule.
   */
  async updateRule(
    tenantId: string,
    ruleId: string,
    input: Partial<CreateRuleInput>,
  ): Promise<MonitoringRule | undefined> {
    const existing = rules.get(ruleId);
    if (existing?.tenantId !== tenantId) return undefined;

    const updated: MonitoringRule = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    rules.set(ruleId, updated);
    return updated;
  }

  /**
   * Delete a monitoring rule.
   */
  async deleteRule(
    tenantId: string,
    ruleId: string,
  ): Promise<boolean> {
    const existing = rules.get(ruleId);
    if (existing?.tenantId !== tenantId) return false;
    rules.delete(ruleId);
    return true;
  }
}
