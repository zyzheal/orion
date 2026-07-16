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
  ApiGovernanceRepository,
  GovernanceRuleEntity,
} from '../../repositories/ApiGovernanceRepository';

export class ApiGovernanceService {
  private repo: ApiGovernanceRepository | null = null;
  // In-memory fallback cache when no DB available
  private apiInventoryCache: Map<string, Record<string, unknown>> = new Map();

  constructor(
    private db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    if (db) {
      this.repo = new ApiGovernanceRepository(db);
    }
  }

  private async getTenantApis(tenantId: string): Promise<Array<{ id: string } & Record<string, unknown>>> {
    if (this.repo) {
      const entities = await this.repo.findAllContracts(tenantId);
      return entities.map((entity) => {
        const { api_name, path, method, ...rest } = entity;
        return {
          ...rest,
          id: entity.id,
          apiName: entity.api_name,
          path,
          method,
          tenantId,
        };
      });
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

    if (this.repo) {
      const entity = await this.repo.createRule({
        name: input.name,
        description: input.description ?? '',
        type: input.ruleType,
        enabled: true,
        tenantId,
      });

      return {
        id: entity.id,
        tenantId: entity.tenant_id,
        name: entity.name,
        description: entity.description || undefined,
        ruleType: (entity as unknown as Record<string, unknown>).type as GovernanceRule['ruleType'],
        config: {},
        enabled: entity.enabled,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.created_at.toISOString(),
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

    if (this.repo) {
      tenantRules = await this.repo.findAllRules(tenantId);
    }

    const apis = await this.getTenantApis(tenantId);

    const results: GovernanceEvaluationResult[] = [];

    for (const rule of tenantRules) {
      switch (rule.type) {
        case 'rate_limit': {
          const apisWithoutRateLimit = apis.filter(
            (api) => !(api as any).rateLimit,
          );
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
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
            ruleType: rule.type,
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
            ruleType: rule.type,
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
            ruleType: rule.type,
            passed: apisWithoutDocs.length === 0,
            message: apisWithoutDocs.length === 0
              ? 'All APIs are documented'
              : `${apisWithoutDocs.length} APIs lack documentation`,
            details: { apisWithoutDocs: apisWithoutDocs.length },
          });
          break;
        }
        case 'naming': {
          const prefix = ('/api/v' as string);
          const apisWithBadNaming = apis.filter(
            (api) => !((api as any).path as string)?.startsWith(prefix),
          );
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
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
            ruleType: rule.type,
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
            ruleType: rule.type,
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

  async getRule(ruleId: string, tenantId?: string): Promise<GovernanceRule | null> {
    if (!this.repo) return null;

    const entity = await this.repo.findById(ruleId, tenantId);
    if (!entity) return null;

    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      name: entity.name,
      description: entity.description || undefined,
      ruleType: entity.type as GovernanceRule['ruleType'],
      config: {},
      enabled: entity.enabled,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.created_at.toISOString(),
    };
  }

  async listRules(tenantId: string): Promise<GovernanceRule[]> {
    if (!this.repo) return [];

    const entities = await this.repo.findAllRules(tenantId);
    return entities.map((entity: GovernanceRuleEntity) => ({
      id: entity.id,
      tenantId: entity.tenant_id,
      name: entity.name,
      description: entity.description || undefined,
      ruleType: entity.type as GovernanceRule['ruleType'],
      config: {},
      enabled: entity.enabled,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.created_at.toISOString(),
    }));
  }

  async updateRule(
    ruleId: string,
    input: Partial<CreateGovernanceRuleInput> & { enabled?: boolean },
    tenantId?: string,
  ): Promise<GovernanceRule | null> {
    if (!this.repo) return null;

    const existing = await this.repo.findById(ruleId, tenantId);
    if (!existing) return null;

    const updateData = {
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      type: input.ruleType ?? existing.type,
      enabled: input.enabled ?? existing.enabled,
    };

    const updated = await this.repo.updateRule(ruleId, updateData, tenantId);

    return {
      id: updated!.id,
      tenantId: updated!.tenant_id,
      name: updated!.name,
      description: updated!.description || undefined,
      ruleType: updated!.type as GovernanceRule['ruleType'],
      config: {},
      enabled: updated!.enabled,
      createdAt: updated!.created_at.toISOString(),
      updatedAt: updated!.created_at.toISOString(),
    };
  }

  async deleteRule(ruleId: string, tenantId?: string): Promise<boolean> {
    if (!this.repo) return false;

    const existing = await this.repo.findById(ruleId, tenantId);
    if (!existing) return false;

    await this.repo.deleteRule(ruleId, tenantId);
    return true;
  }

  async registerApiForGovernance(
    tenantId: string,
    api: Record<string, unknown>,
  ): Promise<string> {
    if (this.repo) {
      const entity = await this.repo.createContract({
        apiName: (api.apiName as string) || 'unknown',
        version: (api.version as string) || 'v1',
        method: (api.method as string) || 'GET',
        path: (api.path as string) || '/',
        requestSchema: {},
        responseSchema: {},
        tenantId,
      });
      return entity.id;
    }

    // Fallback to in-memory if no DB
    const id = randomUUID();
    this.apiInventoryCache.set(id, { ...api, tenantId });
    return id;
  }
}