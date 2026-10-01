/**
 * API 治理 API 路由
 *
 * 提供 API 治理管理功能：
 * - GET /api/v1/governance - 获取治理策略列表
 * - POST /api/v1/governance - 创建治理策略
 * - GET /api/v1/governance/:id - 获取治理策略详情
 * - PUT /api/v1/governance/:id - 更新治理策略
 * - DELETE /api/v1/governance/:id - 删除治理策略
 * - POST /api/v1/governance/:id/enable - 启用策略
 * - POST /api/v1/governance/:id/disable - 禁用策略
 * - GET /api/v1/governance/:id/audit - 获取策略审计日志
 * - POST /api/v1/governance/check - 检查合规性
 * - GET /api/v1/governance/compliance - 获取合规报告
 * - POST /api/v1/governance/policies/:id/apply - 应用策略到资源
 * - GET /api/v1/governance/rules - 获取规则列表
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * 治理策略类型枚举
 */
export enum PolicyType {
  RATE_LIMIT = 'rate_limit',
  QUOTA = 'quota',
  SECURITY = 'security',
  RETENTION = 'retention',
  VERSIONING = 'versioning',
  ACCESS_CONTROL = 'access_control',
  DATA_PROTECTION = 'data_protection',
  AUDIT = 'audit',
  COMPLIANCE = 'compliance',
  CUSTOM = 'custom',
}

/**
 * 策略状态枚举
 */
export enum PolicyStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

/**
 * 严重程度枚举
 */
export enum SeverityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 合规状态枚举
 */
export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIAL = 'partial',
  UNKNOWN = 'unknown',
}

/**
 * 治理策略
 */
export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  type: PolicyType;
  status: PolicyStatus;
  severity: SeverityLevel;
  rules: PolicyRule[];
  scope: {
    include: string[];
    exclude: string[];
  };
  enforcement: 'strict' | 'soft' | 'audit_only';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  appliedCount: number;
  violationCount: number;
  metadata: Record<string, unknown>;
}

/**
 * 策略规则
 */
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'matches';
    value: unknown;
  };
  action: {
    type: 'allow' | 'deny' | 'warn' | 'transform' | 'log';
    config: Record<string, unknown>;
  };
  priority: number;
  enabled: boolean;
}

/**
 * 审计日志
 */
export interface GovernanceAuditLog {
  id: string;
  policyId: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'enable' | 'disable' | 'apply' | 'violation';
  resourceType: string;
  resourceId: string;
  userId: string;
  details: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'warning';
  severity: SeverityLevel;
}

/**
 * 合规检查结果
 */
export interface ComplianceCheckResult {
  id: string;
  timestamp: string;
  resourceId: string;
  resourceType: string;
  status: ComplianceStatus;
  violations: {
    policyId: string;
    policyName: string;
    ruleId: string;
    ruleName: string;
    severity: SeverityLevel;
    description: string;
    remediation: string;
  }[];
  score: number;
  recommendations: string[];
}

/**
 * 合规报告
 */
export interface ComplianceReport {
  id: string;
  timestamp: string;
  period: {
    start: string;
    end: string;
  };
  overallScore: number;
  overallStatus: ComplianceStatus;
  summary: {
    totalPolicies: number;
    activePolicies: number;
    totalResources: number;
    compliantResources: number;
    violationsCount: number;
  };
  byPolicyType: {
    type: PolicyType;
    compliantCount: number;
    violationCount: number;
    score: number;
  }[];
  topViolations: {
    policyName: string;
    count: number;
    severity: SeverityLevel;
  }[];
  recommendations: string[];
}

/**
 * 策略应用结果
 */
export interface PolicyApplyResult {
  policyId: string;
  resourceId: string;
  resourceType: string;
  applied: boolean;
  violations: PolicyRule[];
  timestamp: string;
}

/**
 * 创建策略请求
 */
export interface CreatePolicyRequest {
  name: string;
  description: string;
  type: PolicyType;
  severity?: SeverityLevel;
  rules: Omit<PolicyRule, 'id'>[];
  scope?: {
    include?: string[];
    exclude?: string[];
  };
  enforcement?: 'strict' | 'soft' | 'audit_only';
  metadata?: Record<string, unknown>;
}

/**
 * 更新策略请求
 */
export interface UpdatePolicyRequest {
  name?: string;
  description?: string;
  severity?: SeverityLevel;
  rules?: Omit<PolicyRule, 'id'>[];
  scope?: {
    include?: string[];
    exclude?: string[];
  };
  enforcement?: 'strict' | 'soft' | 'audit_only';
  metadata?: Record<string, unknown>;
}

/**
 * 合规检查请求
 */
export interface ComplianceCheckRequest {
  resourceId: string;
  resourceType: string;
  policyIds?: string[];
  deepAnalysis?: boolean;
}

/**
 * 应用策略请求
 */
export interface ApplyPolicyRequest {
  resourceId: string;
  resourceType: string;
}

/**
 * API 治理服务类
 */
export class GovernanceService {
  private policies: Map<string, GovernancePolicy> = new Map();
  private auditLogs: Map<string, GovernanceAuditLog[]> = new Map();
  private complianceChecks: ComplianceCheckResult[] = [];
  private policyCounter = 0;
  private ruleCounter = 0;
  private auditCounter = 0;

  /**
   * 生成策略 ID
   */
  private generatePolicyId(): string {
    this.policyCounter++;
    return `policy_${Date.now()}_${this.policyCounter}`;
  }

  /**
   * 生成规则 ID
   */
  private generateRuleId(): string {
    this.ruleCounter++;
    return `rule_${Date.now()}_${this.ruleCounter}`;
  }

  /**
   * 生成审计 ID
   */
  private generateAuditId(): string {
    this.auditCounter++;
    return `audit_${Date.now()}_${this.auditCounter}`;
  }

  /**
   * 创建治理策略
   */
  async createPolicy(data: CreatePolicyRequest, userId: string): Promise<GovernancePolicy> {
    const id = this.generatePolicyId();
    const now = new Date().toISOString();

    const rules: PolicyRule[] = data.rules.map(r => ({
      ...r,
      id: this.generateRuleId(),
    }));

    const policy: GovernancePolicy = {
      id,
      name: data.name,
      description: data.description,
      type: data.type,
      status: PolicyStatus.DRAFT,
      severity: data.severity || SeverityLevel.MEDIUM,
      rules,
      scope: data.scope || { include: [], exclude: [] },
      enforcement: data.enforcement || 'strict',
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      appliedCount: 0,
      violationCount: 0,
      metadata: data.metadata || {},
    };

    this.policies.set(id, policy);

    // 添加审计日志
    this.addAuditLog(id, {
      action: 'create',
      resourceType: 'policy',
      resourceId: id,
      userId,
      details: { name: data.name, type: data.type },
      outcome: 'success',
      severity: SeverityLevel.LOW,
    });

    return policy;
  }

  /**
   * 获取策略列表
   */
  async listPolicies(
    params: OffsetPaginationParams,
    filters?: {
      type?: PolicyType;
      status?: PolicyStatus;
      severity?: SeverityLevel;
    }
  ): Promise<{ data: GovernancePolicy[]; total: number }> {
    let policies = Array.from(this.policies.values());

    if (filters?.type) {
      policies = policies.filter(p => p.type === filters.type);
    }
    if (filters?.status) {
      policies = policies.filter(p => p.status === filters.status);
    }
    if (filters?.severity) {
      policies = policies.filter(p => p.severity === filters.severity);
    }

    const sortField = params.sort || 'createdAt';
    const sortOrder = params.order || 'desc';
    policies.sort((a, b) => {
      const aVal = a[sortField as keyof GovernancePolicy];
      const bVal = b[sortField as keyof GovernancePolicy];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = policies.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    policies = policies.slice(offset, offset + limit);

    return { data: policies, total };
  }

  /**
   * 获取策略详情
   */
  async getPolicy(id: string): Promise<GovernancePolicy | null> {
    return this.policies.get(id) || null;
  }

  /**
   * 更新策略
   */
  async updatePolicy(id: string, data: UpdatePolicyRequest, userId: string): Promise<GovernancePolicy> {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'policy',
        identifier: id,
      });
    }

    const rules = data.rules
      ? data.rules.map(r => ({ ...r, id: this.generateRuleId() }))
      : policy.rules;

    const updated: GovernancePolicy = {
      ...policy,
      ...data,
      rules,
      updatedAt: new Date().toISOString(),
    };

    this.policies.set(id, updated);

    this.addAuditLog(id, {
      action: 'update',
      resourceType: 'policy',
      resourceId: id,
      userId,
      details: { changes: data },
      outcome: 'success',
      severity: SeverityLevel.LOW,
    });

    return updated;
  }

  /**
   * 删除策略
   */
  async deletePolicy(id: string, userId: string): Promise<void> {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'policy',
        identifier: id,
      });
    }

    this.addAuditLog(id, {
      action: 'delete',
      resourceType: 'policy',
      resourceId: id,
      userId,
      details: { name: policy.name },
      outcome: 'success',
      severity: SeverityLevel.MEDIUM,
    });

    this.policies.delete(id);
  }

  /**
   * 启用策略
   */
  async enablePolicy(id: string, userId: string): Promise<GovernancePolicy> {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'policy',
        identifier: id,
      });
    }

    policy.status = PolicyStatus.ACTIVE;
    policy.updatedAt = new Date().toISOString();
    this.policies.set(id, policy);

    this.addAuditLog(id, {
      action: 'enable',
      resourceType: 'policy',
      resourceId: id,
      userId,
      details: {},
      outcome: 'success',
      severity: SeverityLevel.LOW,
    });

    return policy;
  }

  /**
   * 禁用策略
   */
  async disablePolicy(id: string, userId: string): Promise<GovernancePolicy> {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'policy',
        identifier: id,
      });
    }

    policy.status = PolicyStatus.PAUSED;
    policy.updatedAt = new Date().toISOString();
    this.policies.set(id, policy);

    this.addAuditLog(id, {
      action: 'disable',
      resourceType: 'policy',
      resourceId: id,
      userId,
      details: {},
      outcome: 'success',
      severity: SeverityLevel.LOW,
    });

    return policy;
  }

  /**
   * 获取策略审计日志
   */
  async getAuditLogs(id: string, params: OffsetPaginationParams): Promise<{ data: GovernanceAuditLog[]; total: number }> {
    const logs = this.auditLogs.get(id) || [];
    const total = logs.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;

    return {
      data: logs.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 检查合规性
   */
  async checkCompliance(data: ComplianceCheckRequest): Promise<ComplianceCheckResult> {
    const policies = Array.from(this.policies.values())
      .filter(p => p.status === PolicyStatus.ACTIVE);

    const violations: ComplianceCheckResult['violations'] = [];

    // 模拟检查
    for (const policy of policies) {
      const hasViolation = Math.random() > 0.7;
      if (hasViolation) {
        const rule = policy.rules[Math.floor(Math.random() * policy.rules.length)];
        violations.push({
          policyId: policy.id,
          policyName: policy.name,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: policy.severity,
          description: `违反规则: ${rule.name}`,
          remediation: '请调整资源配置以符合策略要求',
        });
      }
    }

    const score = 100 - violations.length * 10;
    const status = violations.length === 0 ? ComplianceStatus.COMPLIANT :
                   violations.length > 3 ? ComplianceStatus.NON_COMPLIANT :
                   ComplianceStatus.PARTIAL;

    const result: ComplianceCheckResult = {
      id: `check_${Date.now()}`,
      timestamp: new Date().toISOString(),
      resourceId: data.resourceId,
      resourceType: data.resourceType,
      status,
      violations,
      score,
      recommendations: violations.length > 0
        ? ['请解决发现的合规性问题', '定期检查合规状态']
        : ['继续保持合规状态'],
    };

    this.complianceChecks.unshift(result);

    return result;
  }

  /**
   * 获取合规报告
   */
  async getComplianceReport(dateRange?: { start: string; end: string }): Promise<ComplianceReport> {
    const policies = Array.from(this.policies.values());
    const activePolicies = policies.filter(p => p.status === PolicyStatus.ACTIVE);

    // 模拟统计数据
    const totalResources = 50;
    const compliantResources = Math.floor(totalResources * 0.85);
    const violationsCount = Math.floor(totalResources * 0.15);

    const byPolicyType = Object.values(PolicyType).slice(0, 5).map(type => {
      const policiesOfType = policies.filter(p => p.type === type);
      return {
        type,
        compliantCount: Math.floor(Math.random() * 30 + 20),
        violationCount: Math.floor(Math.random() * 5),
        score: 85 + Math.random() * 15,
      };
    });

    const topViolations = activePolicies.slice(0, 5).map(p => ({
      policyName: p.name,
      count: p.violationCount,
      severity: p.severity,
    }));

    const overallScore = byPolicyType.reduce((sum, t) => sum + t.score, 0) / byPolicyType.length;

    return {
      id: `report_${Date.now()}`,
      timestamp: new Date().toISOString(),
      period: dateRange || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      overallScore: Math.round(overallScore),
      overallStatus: overallScore >= 90 ? ComplianceStatus.COMPLIANT :
                     overallScore >= 70 ? ComplianceStatus.PARTIAL :
                     ComplianceStatus.NON_COMPLIANT,
      summary: {
        totalPolicies: policies.length,
        activePolicies: activePolicies.length,
        totalResources,
        compliantResources,
        violationsCount,
      },
      byPolicyType,
      topViolations,
      recommendations: [
        '定期审查治理策略',
        '加强高风险策略的监控',
        '自动化合规检查流程',
      ],
    };
  }

  /**
   * 应用策略到资源
   */
  async applyPolicy(id: string, data: ApplyPolicyRequest, userId: string): Promise<PolicyApplyResult> {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'policy',
        identifier: id,
      });
    }

    if (policy.status !== PolicyStatus.ACTIVE) {
      throw new Error('POLICY_NOT_ACTIVE', 'Policy must be active to apply');
    }

    // 模拟应用检查
    const violations = policy.rules
      .filter(() => Math.random() > 0.8)
      .slice(0, 2);

    const applied = violations.length === 0;

    policy.appliedCount++;
    if (!applied) {
      policy.violationCount++;
    }
    policy.updatedAt = new Date().toISOString();
    this.policies.set(id, policy);

    this.addAuditLog(id, {
      action: applied ? 'apply' : 'violation',
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      userId,
      details: { violations: violations.map(v => v.name) },
      outcome: applied ? 'success' : 'warning',
      severity: applied ? SeverityLevel.LOW : policy.severity,
    });

    return {
      policyId: id,
      resourceId: data.resourceId,
      resourceType: data.resourceType,
      applied,
      violations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取规则列表
   */
  async getRules(params: OffsetPaginationParams): Promise<{ data: PolicyRule[]; total: number }> {
    const allRules: PolicyRule[] = [];

    for (const policy of this.policies.values()) {
      allRules.push(...policy.rules);
    }

    const total = allRules.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;

    return {
      data: allRules.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 添加审计日志
   */
  private addAuditLog(policyId: string, data: Omit<GovernanceAuditLog, 'id' | 'policyId' | 'timestamp'>): void {
    const logs = this.auditLogs.get(policyId) || [];
    logs.unshift({
      id: this.generateAuditId(),
      policyId,
      timestamp: new Date().toISOString(),
      ...data,
    });
    this.auditLogs.set(policyId, logs);
  }
}

// 单例服务实例
export const governanceService = new GovernanceService();

/**
 * API 治理路由类
 */
export class GovernanceRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/governance/rules - 获取规则列表
    this.app.get('/api/v1/governance/rules', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await governanceService.getRules(paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 50,
          total,
        })
      );
    });

    // GET /api/v1/governance/compliance - 获取合规报告
    this.app.get('/api/v1/governance/compliance', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { start?: string; end?: string };
      const dateRange = query.start && query.end
        ? { start: query.start, end: query.end }
        : undefined;

      const report = await governanceService.getComplianceReport(dateRange);
      return reply.send(report);
    });

    // POST /api/v1/governance/check - 检查合规性
    this.app.post('/api/v1/governance/check', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as ComplianceCheckRequest;
      const result = await governanceService.checkCompliance(body);
      return reply.send(result);
    });

    // GET /api/v1/governance - 获取治理策略列表
    this.app.get('/api/v1/governance', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & {
        type?: PolicyType;
        status?: PolicyStatus;
        severity?: SeverityLevel;
      };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await governanceService.listPolicies(
        paginationParams,
        {
          type: query.type,
          status: query.status,
          severity: query.severity,
        }
      );

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/governance - 创建治理策略
    this.app.post('/api/v1/governance', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as CreatePolicyRequest;
      const userId = (request as any).user?.id || 'system';

      const policy = await governanceService.createPolicy(body, userId);
      return reply.code(201).send(policy);
    });

    // GET /api/v1/governance/:id - 获取治理策略详情
    this.app.get('/api/v1/governance/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const policy = await governanceService.getPolicy(params.id);

      if (!policy) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'policy',
          identifier: params.id,
        });
      }

      return reply.send(policy);
    });

    // PUT /api/v1/governance/:id - 更新治理策略
    this.app.put('/api/v1/governance/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as UpdatePolicyRequest;
      const userId = (request as any).user?.id || 'system';

      const policy = await governanceService.updatePolicy(params.id, body, userId);
      return reply.send(policy);
    });

    // DELETE /api/v1/governance/:id - 删除治理策略
    this.app.delete('/api/v1/governance/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const userId = (request as any).user?.id || 'system';

      await governanceService.deletePolicy(params.id, userId);
      return reply.code(204).send();
    });

    // POST /api/v1/governance/:id/enable - 启用策略
    this.app.post('/api/v1/governance/:id/enable', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const userId = (request as any).user?.id || 'system';

      const policy = await governanceService.enablePolicy(params.id, userId);
      return reply.send(policy);
    });

    // POST /api/v1/governance/:id/disable - 禁用策略
    this.app.post('/api/v1/governance/:id/disable', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const userId = (request as any).user?.id || 'system';

      const policy = await governanceService.disablePolicy(params.id, userId);
      return reply.send(policy);
    });

    // GET /api/v1/governance/:id/audit - 获取策略审计日志
    this.app.get('/api/v1/governance/:id/audit', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await governanceService.getAuditLogs(params.id, paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 50,
          total,
        })
      );
    });

    // POST /api/v1/governance/:id/apply - 应用策略到资源
    this.app.post('/api/v1/governance/:id/apply', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as ApplyPolicyRequest;
      const userId = (request as any).user?.id || 'system';

      const result = await governanceService.applyPolicy(params.id, body, userId);
      return reply.send(result);
    });
  }
}