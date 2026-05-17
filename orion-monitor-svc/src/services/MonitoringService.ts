import type { MonitoringRule, CreateRuleInput } from '../types/monitor.js';
import { MonitoringRuleRepository } from '../repositories/MonitoringRuleRepository.js';

export class MonitoringService {
  constructor(private repo: MonitoringRuleRepository) {}

  async createRule(
    tenantId: string,
    projectId: string,
    createdBy: string,
    input: CreateRuleInput,
  ): Promise<MonitoringRule> {
    return this.repo.create(tenantId, projectId, createdBy, {
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
    });
  }

  async listRules(tenantId: string, projectId?: string): Promise<MonitoringRule[]> {
    return this.repo.findByTenant(tenantId, projectId);
  }

  async getRule(tenantId: string, ruleId: string): Promise<MonitoringRule | undefined> {
    const rule = await this.repo.findById(ruleId);
    if (rule?.tenantId !== tenantId) return undefined;
    return rule ?? undefined;
  }

  async updateRule(
    tenantId: string,
    ruleId: string,
    input: Partial<CreateRuleInput>,
  ): Promise<MonitoringRule | undefined> {
    const existing = await this.repo.findById(ruleId);
    if (existing?.tenantId !== tenantId) return undefined;
    return (await this.repo.update(ruleId, { ...input })) ?? undefined;
  }

  async deleteRule(tenantId: string, ruleId: string): Promise<boolean> {
    const existing = await this.repo.findById(ruleId);
    if (existing?.tenantId !== tenantId) return false;
    return this.repo.delete(ruleId);
  }
}
