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

import {
  GovernanceRuleRepository,
  ApiInventoryRepository,
  GovernanceRuleEntity,
} from '../../repositories/ApiGovernanceRepository';

export class ApiGovernanceService {
  private ruleRepository: GovernanceRuleRepository | null = null;
  private inventoryRepository: ApiInventoryRepository | null = null;
  // In-memory fallback cache when no DB available
  private apiInventoryCache: Map<string, Record<string, unknown>> = new Map();

  constructor(
    private db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    if (db) {
      this.ruleRepository = new GovernanceRuleRepository(db as any);
      this.inventoryRepository = new ApiInventoryRepository(db as any);
    }
  }

  private async getTenantApis(tenantId: string): Promise<Array<{ id: string } & Record<string, unknown>>> {
    if (this.inventoryRepository) {
      const entities = await this.inventoryRepository.findByTenant(tenantId);
      return entities.map(entity => ({
        id: entity.id,
        ...entity.apiData,
        tenantId: entity.tenantId,
      }));
    }

    // Fallback to in-memory cache
    return Array.from(this.apiInventoryCache.entries())
      .filter(([_, api]) => (api as any).tenantId === tenantId)
      .map(([id, api]) => ({ id, ...api }));
  }

  async createGovernanceRule(
    tenantId: string,
    input: CreateGovernanceRuleInput,
  ): Promise<GovernanceRule> {
    const now = new Date().toISOString();

    if (this.ruleRepository) {
      const entity = await this.ruleRepository.createRule({
        id: randomUUID(),
        tenantId,
        name: input.name,
        description: input.description,
        ruleType: input.ruleType,
        config: input.config,
        enabled: true,
      });

      return {
        id: entity.id,
        tenantId: entity.tenantId,
        name: entity.name,
        description: entity.description || undefined,
        ruleType: entity.ruleType as GovernanceRule['ruleType'],
        config: entity.config,
        enabled: entity.enabled,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
      };
    }

    // Fallback to in-memory if no DB
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
    return rule;
  }

  async evaluateGovernance(tenantId: string): Promise<GovernanceEvaluationResult[]> {
    let tenantRules: GovernanceRuleEntity[] = [];

    if (this.ruleRepository) {
      tenantRules = await this.ruleRepository.findByTenantAndEnabled(tenantId);
    }

    const apis = await this.getTenantApis(tenantId);

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
    if (!this.ruleRepository) return null;

    const entity = await this.ruleRepository.findById(ruleId);
    if (!entity) return null;

    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description || undefined,
      ruleType: entity.ruleType as GovernanceRule['ruleType'],
      config: entity.config,
      enabled: entity.enabled,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async listRules(tenantId: string): Promise<GovernanceRule[]> {
    if (!this.ruleRepository) return [];

    const entities = await this.ruleRepository.findByTenant(tenantId);
    return entities.map(entity => ({
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description || undefined,
      ruleType: entity.ruleType as GovernanceRule['ruleType'],
      config: entity.config,
      enabled: entity.enabled,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    }));
  }

  async updateRule(
    ruleId: string,
    input: Partial<CreateGovernanceRuleInput> & { enabled?: boolean },
  ): Promise<GovernanceRule | null> {
    if (!this.ruleRepository) return null;

    const entity = await this.ruleRepository.updateRule(ruleId, {
      name: input.name,
      description: input.description,
      ruleType: input.ruleType,
      config: input.config,
      enabled: input.enabled,
    });

    if (!entity) return null;

    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description || undefined,
      ruleType: entity.ruleType as GovernanceRule['ruleType'],
      config: entity.config,
      enabled: entity.enabled,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    if (!this.ruleRepository) return false;
    return this.ruleRepository.deleteRule(ruleId);
  }

  async registerApiForGovernance(
    tenantId: string,
    api: Record<string, unknown>,
  ): Promise<string> {
    if (this.inventoryRepository) {
      const entity = await this.inventoryRepository.registerApi(tenantId, { ...api, id: '' });
      return entity.id;
    }

    // Fallback to in-memory if no DB
    const id = randomUUID();
    this.apiInventoryCache.set(id, { ...api, tenantId });
    return id;
  }
}