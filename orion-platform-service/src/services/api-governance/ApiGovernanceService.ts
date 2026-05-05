import { randomUUID } from 'crypto';

export interface GovernanceRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  ruleType: 'rate_limit' | 'auth_required' | 'versioning' | 'documentation' | 'naming' | 'response_format';
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceEvaluationResult {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface GovernanceReport {
  tenantId: string;
  evaluatedAt: string;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  complianceScore: number;
  results: GovernanceEvaluationResult[];
}

export interface CreateGovernanceRuleInput {
  name: string;
  description?: string;
  ruleType: 'rate_limit' | 'auth_required' | 'versioning' | 'documentation' | 'naming' | 'response_format';
  config: Record<string, unknown>;
}

export class ApiGovernanceService {
  private rules = new Map<string, GovernanceRule>();
  private apiInventory = new Map<string, Record<string, unknown>>();

  async createGovernanceRule(
    tenantId: string,
    input: CreateGovernanceRuleInput,
  ): Promise<GovernanceRule> {
    const now = new Date().toISOString();
    const rule: GovernanceRule = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      description: input.description,
      ruleType: input.ruleType,
      config: input.config,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  async evaluateGovernance(tenantId: string): Promise<GovernanceEvaluationResult[]> {
    const tenantRules = Array.from(this.rules.values()).filter(
      (r) => r.tenantId === tenantId && r.enabled,
    );

    const apis = Array.from(this.apiInventory.entries())
      .filter(([_, api]) => (api as any).tenantId === tenantId)
      .map(([id, api]) => ({ id, ...api }));

    const results: GovernanceEvaluationResult[] = [];

    for (const rule of tenantRules) {
      switch (rule.ruleType) {
        case 'rate_limit': {
          const apisWithoutRateLimit = apis.filter(
            (api) => !(api as any).rateLimit,
          );
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            passed: apisWithoutRateLimit.length === 0,
            message: apisWithoutRateLimit.length === 0
              ? 'All APIs have rate limits configured'
              : `${apisWithoutRateLimit.length} APIs missing rate limits`,
            details: { apisWithoutRateLimit: apisWithoutRateLimit.length },
          });
          break;
        }
        case 'auth_required': {
          const apisWithoutAuth = apis.filter(
            (api) => !(api as any).authRequired,
          );
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            passed: apisWithoutAuth.length === 0,
            message: apisWithoutAuth.length === 0
              ? 'All APIs require authentication'
              : `${apisWithoutAuth.length} APIs don't require authentication`,
            details: { apisWithoutAuth: apisWithoutAuth.length },
          });
          break;
        }
        case 'versioning': {
          const apisWithoutVersion = apis.filter(
            (api) => !(api as any).version,
          );
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            passed: apisWithoutVersion.length === 0,
            message: apisWithoutVersion.length === 0
              ? 'All APIs have versioning'
              : `${apisWithoutVersion.length} APIs lack versioning`,
            details: { apisWithoutVersion: apisWithoutVersion.length },
          });
          break;
        }
        case 'documentation': {
          const apisWithoutDocs = apis.filter(
            (api) => !(api as any).documentation,
          );
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            passed: apisWithoutDocs.length === 0,
            message: apisWithoutDocs.length === 0
              ? 'All APIs are documented'
              : `${apisWithoutDocs.length} APIs lack documentation`,
            details: { apisWithoutDocs: apisWithoutDocs.length },
          });
          break;
        }
        case 'naming': {
          const prefix = (rule.config.prefix as string) || '/api/v';
          const apisWithBadNaming = apis.filter(
            (api) => !((api as any).path as string)?.startsWith(prefix),
          );
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            passed: apisWithBadNaming.length === 0,
            message: apisWithBadNaming.length === 0
              ? 'All APIs follow naming convention'
              : `${apisWithBadNaming.length} APIs don't follow naming convention`,
            details: { prefix, violations: apisWithBadNaming.length },
          });
          break;
        }
        case 'response_format': {
          const apisWithBadFormat = apis.filter(
            (api) => !(api as any).responseFormat,
          );
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            passed: apisWithBadFormat.length === 0,
            message: apisWithBadFormat.length === 0
              ? 'All APIs follow response format'
              : `${apisWithBadFormat.length} APIs don't follow response format`,
            details: { violations: apisWithBadFormat.length },
          });
          break;
        }
        default: {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            passed: true,
            message: 'Rule type not implemented',
          });
          break;
        }
      }
    }

    return results;
  }

  async getGovernanceReport(tenantId: string): Promise<GovernanceReport> {
    const results = await this.evaluateGovernance(tenantId);
    const passedRules = results.filter((r) => r.passed).length;
    const failedRules = results.length - passedRules;

    return {
      tenantId,
      evaluatedAt: new Date().toISOString(),
      totalRules: results.length,
      passedRules,
      failedRules,
      complianceScore: results.length > 0
        ? Math.round((passedRules / results.length) * 100)
        : 100,
      results,
    };
  }

  async getRule(ruleId: string): Promise<GovernanceRule | null> {
    return this.rules.get(ruleId) ?? null;
  }

  async listRules(tenantId: string): Promise<GovernanceRule[]> {
    return Array.from(this.rules.values()).filter((r) => r.tenantId === tenantId);
  }

  async updateRule(
    ruleId: string,
    input: Partial<CreateGovernanceRuleInput> & { enabled?: boolean },
  ): Promise<GovernanceRule | null> {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    if (input.name) rule.name = input.name;
    if (input.description !== undefined) rule.description = input.description;
    if (input.ruleType) rule.ruleType = input.ruleType;
    if (input.config) rule.config = input.config;
    if (input.enabled !== undefined) rule.enabled = input.enabled;
    rule.updatedAt = new Date().toISOString();

    return rule;
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    return this.rules.delete(ruleId);
  }

  async registerApiForGovernance(
    tenantId: string,
    api: Record<string, unknown>,
  ): Promise<string> {
    const id = randomUUID();
    this.apiInventory.set(id, { ...api, tenantId });
    return id;
  }
}
