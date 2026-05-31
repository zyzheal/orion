/**
 * ABAC (Attribute-Based Access Control) Policy Engine
 *
 * 实现基于属性的访问控制：
 * - 属性条件定义和评估
 * - 政策组合规则（AND, OR, NOT）
 * - 动态权限计算
 *
 * Persistence: Uses AbacPolicyRepository backed by abac_policies table (migration 050).
 * In-memory Map is used as a read-through cache; writes go to PostgreSQL.
 */

import pino from 'pino';
import { AbacPolicyRepository, AbacPolicyEntity } from '../../repositories/AbacPolicyRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * ABAC 属性上下文
 */
export interface AbacContext {
  // 用户属性
  user: {
    id: string;
    role: string;
    department?: string;
    level?: string; // 职级：junior, senior, manager, director
    teams?: string[];
    tenantId?: string; // 租户 ID
    createdAt?: Date;
    lastLoginAt?: Date;
    attributes?: Record<string, any>;
  };

  // 资源属性
  resource: {
    type: string; // pipeline, deployment, cmdb, tenant, user
    id?: string;
    owner?: string; // 资源所有者 ID
    ownerId?: string;
    department?: string;
    tenantId?: string; // 租户 ID
    sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
    status?: string;
    createdAt?: Date;
    attributes?: Record<string, any>;
  };

  // 环境属性
  environment: {
    time: Date;
    ip?: string;
    location?: string; // 地理位置代码
    device?: string; // 设备类型：mobile, desktop, tablet
    userAgent?: string;
    network?: 'internal' | 'external' | 'vpn';
    sessionId?: string;
  };

  // 操作属性
  action: {
    type: string; // create, read, update, delete, execute, approve
    impact?: 'low' | 'medium' | 'high' | 'critical';
    reason?: string;
  };
}

/**
 * 条件操作符
 */
export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'matches' // 正则匹配
  | 'exists'
  | 'notExists'
  | 'between'
  | 'timeInRange'; // 时间范围检查

/**
 * 条件定义
 */
export interface Condition {
  // 属性路径，如 'user.role', 'resource.sensitivity', 'environment.time'
  attribute: string;
  operator: ConditionOperator;
  // 比较值
  value?: any;
  // 可选的第二个值（用于 between 操作）
  value2?: any;
}

/**
 * 条件规则（支持组合）
 */
export interface ConditionRule {
  // 单一条件
  condition?: Condition;

  // 组合规则
  and?: ConditionRule[];
  or?: ConditionRule[];
  not?: ConditionRule; // NOT 只需要一个规则

  // 规则描述
  description?: string;
}

/**
 * ABAC 政策定义
 */
export interface AbacPolicy {
  id: string;
  name: string;
  description?: string;
  // 资源类型匹配
  resourceType: string | string[];
  // 操作类型匹配
  actionType: string | string[];
  // 条件规则
  conditions: ConditionRule;
  // 政策效果：allow 或 deny
  effect: 'allow' | 'deny';
  // 优先级（数值越大优先级越高）
  priority?: number;
  // 是否启用
  enabled?: boolean;
  // 创建时间
  createdAt?: Date;
  // 更新时间
  updatedAt?: Date;
}

/**
 * 政策评估结果
 */
export interface PolicyEvaluationResult {
  allowed: boolean;
  denied: boolean;
  // 匹配的政策
  matchedPolicies: AbacPolicy[];
  // 匹配的条件描述
  matchedConditions: string[];
  // 拒绝原因
  denialReason?: string;
  // 评估时间（毫秒）
  evaluationTime?: number;
}

/**
 * 预定义的系统 ABAC 政策
 */
export const SYSTEM_ABAC_POLICIES: AbacPolicy[] = [
  // 1. 资源所有者完全控制
  {
    id: 'resource-owner-full-control',
    name: 'Resource Owner Full Control',
    description: '资源所有者对其拥有的资源拥有完全控制权限',
    resourceType: ['pipeline', 'deployment', 'cmdb', 'artifact'],
    actionType: ['read', 'update', 'delete'],
    conditions: {
      condition: {
        attribute: 'resource.owner',
        operator: 'equals',
        value: '${user.id}', // 支持变量引用
      },
      description: '用户是资源所有者',
    },
    effect: 'allow',
    priority: 100,
    enabled: true,
  },

  // 2. 敏感资源访问限制
  {
    id: 'restricted-resource-access',
    name: 'Restricted Resource Access',
    description: '限制级别资源只有特定角色可以访问',
    resourceType: '*', // 所有资源
    actionType: ['read', 'update', 'delete'],
    conditions: {
      and: [
        {
          condition: {
            attribute: 'resource.sensitivity',
            operator: 'equals',
            value: 'restricted',
          },
          description: '资源敏感级别为 restricted',
        },
        {
          or: [
            {
              condition: {
                attribute: 'user.role',
                operator: 'in',
                value: ['admin', 'security'],
              },
            },
            {
              condition: {
                attribute: 'user.department',
                operator: 'equals',
                value: '${resource.department}',
              },
            },
          ],
        },
      ],
    },
    effect: 'allow',
    priority: 90,
    enabled: true,
  },

  // 3. 外部网络访问限制
  {
    id: 'external-network-restriction',
    name: 'External Network Restriction',
    description: '外部网络只能进行读取操作',
    resourceType: '*',
    actionType: ['create', 'update', 'delete', 'execute'],
    conditions: {
      condition: {
        attribute: 'environment.network',
        operator: 'equals',
        value: 'external',
      },
      description: '来自外部网络',
    },
    effect: 'deny',
    priority: 80,
    enabled: true,
  },

  // 4. 工作时间操作限制
  {
    id: 'working-hours-restriction',
    name: 'Working Hours Restriction',
    description: '关键操作只能在工作时间进行',
    resourceType: ['deployment', 'pipeline'],
    actionType: ['execute', 'approve'],
    conditions: {
      and: [
        {
          condition: {
            attribute: 'action.impact',
            operator: 'in',
            value: ['high', 'critical'],
          },
          description: '高影响操作',
        },
        {
          not: {
            condition: {
              attribute: 'environment.time',
              operator: 'timeInRange',
              value: { startHour: 9, endHour: 18 },
            },
            description: '不在工作时间范围内',
          },
        },
        {
          condition: {
            attribute: 'user.role',
            operator: 'notEquals',
            value: 'admin',
          },
          description: '非管理员用户',
        },
      ],
    },
    effect: 'deny',
    priority: 70,
    enabled: true,
  },

  // 5. 跨部门访问限制
  {
    id: 'cross-department-restriction',
    name: 'Cross Department Restriction',
    description: '非管理员不能访问其他部门的资源',
    resourceType: ['pipeline', 'deployment', 'cmdb'],
    actionType: ['read', 'update', 'delete'],
    conditions: {
      and: [
        {
          condition: {
            attribute: 'resource.department',
            operator: 'exists',
          },
          description: '资源有部门属性',
        },
        {
          condition: {
            attribute: 'resource.department',
            operator: 'notEquals',
            value: '${user.department}',
          },
          description: '资源不属于用户所在部门',
        },
        {
          condition: {
            attribute: 'user.role',
            operator: 'notEquals',
            value: 'admin',
          },
          description: '用户不是管理员',
        },
      ],
    },
    effect: 'deny',
    priority: 60,
    enabled: true,
  },

  // 6. 租户隔离政策
  {
    id: 'tenant-isolation',
    name: 'Tenant Isolation',
    description: '用户只能访问自己租户的资源',
    resourceType: '*',
    actionType: '*',
    conditions: {
      and: [
        {
          condition: {
            attribute: 'resource.tenantId',
            operator: 'exists',
          },
        },
        {
          condition: {
            attribute: 'resource.tenantId',
            operator: 'notEquals',
            value: '${user.tenantId}',
          },
        },
      ],
    },
    effect: 'deny',
    priority: 99,
    enabled: true,
  },
];

/** Convert a DB entity to the service-level AbacPolicy interface */
function entityToPolicy(entity: AbacPolicyEntity): AbacPolicy {
  // Parse resourceType from DB (stored as string; may be JSON array or '*' or single value)
  let resourceType: string | string[];
  try {
    const parsed = JSON.parse(entity.resourceType);
    resourceType = Array.isArray(parsed) ? parsed : entity.resourceType;
  } catch {
    resourceType = entity.resourceType;
  }

  // Parse actionType similarly
  let actionType: string | string[];
  try {
    const parsed = JSON.parse(entity.actionType);
    actionType = Array.isArray(parsed) ? parsed : entity.actionType;
  } catch {
    actionType = entity.actionType;
  }

  // Reconstruct conditions from the three JSONB columns
  // The full ConditionRule is stored in resourceConditions for custom policies
  // System policies use subject/resource/environment conditions separately
  let conditions: ConditionRule;
  const hasDetailedConditions =
    Object.keys(entity.subjectConditions).length > 0 ||
    Object.keys(entity.environmentConditions).length > 0;

  if (hasDetailedConditions) {
    // Reconstruct AND rule from the three condition groups
    const parts: ConditionRule[] = [];
    if (Object.keys(entity.subjectConditions).length > 0) {
      parts.push(entity.subjectConditions as unknown as ConditionRule);
    }
    if (Object.keys(entity.resourceConditions).length > 0) {
      parts.push(entity.resourceConditions as unknown as ConditionRule);
    }
    if (Object.keys(entity.environmentConditions).length > 0) {
      parts.push(entity.environmentConditions as unknown as ConditionRule);
    }
    conditions = parts.length === 1 ? parts[0] : { and: parts };
  } else {
    // Fallback: try to parse resourceConditions as the full ConditionRule
    conditions = (entity.resourceConditions as unknown as ConditionRule) || { condition: { attribute: 'user.id', operator: 'exists' } };
  }

  return {
    id: entity.id,
    name: entity.name,
    description: entity.description ?? undefined,
    resourceType,
    actionType,
    conditions,
    effect: entity.effect,
    priority: entity.priority,
    enabled: entity.enabled,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/**
 * ABAC Policy Engine
 */
export class AbacPolicyEngine {
  private policies: Map<string, AbacPolicy> = new Map();
  private policyCache: Map<string, PolicyEvaluationResult> = new Map();
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 60000; // 1 分钟
  private repository: AbacPolicyRepository | null;
  private initialized = false;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = db ? new AbacPolicyRepository(db) : null;
    this.initSystemPolicies();
  }

  /**
   * 初始化系统政策
   */
  private initSystemPolicies(): void {
    SYSTEM_ABAC_POLICIES.forEach((policy) => {
      this.policies.set(policy.id, {
        ...policy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  }

  /**
   * Load policies from PostgreSQL database.
   * Merges with system policies (system policies take precedence on ID conflicts).
   */
  async loadFromDatabase(): Promise<void> {
    if (!this.repository) {
      logger.warn('[AbacPolicyEngine] No database connection, using in-memory policies only');
      return;
    }

    try {
      const entities = await this.repository.findAll();
      const dbPolicies = entities.map(entityToPolicy);

      // Add DB policies that don't conflict with system policies
      for (const policy of dbPolicies) {
        if (!this.policies.has(policy.id)) {
          this.policies.set(policy.id, policy);
        }
      }

      this.initialized = true;
      logger.info(`[AbacPolicyEngine] Loaded ${dbPolicies.length} policies from database (${this.policies.size} total)`);
    } catch (error) {
      logger.error('[AbacPolicyEngine] Failed to load policies from database:', error);
    }
  }

  /**
   * 注册自定义政策
   */
  async registerPolicy(policy: AbacPolicy): Promise<void> {
    const now = new Date();
    const fullPolicy = {
      ...policy,
      createdAt: policy.createdAt || now,
      updatedAt: now,
    };

    // Persist to database
    if (this.repository) {
      try {
        const resourceType = Array.isArray(policy.resourceType) ? JSON.stringify(policy.resourceType) : policy.resourceType;
        const actionType = Array.isArray(policy.actionType) ? JSON.stringify(policy.actionType) : policy.actionType;

        await this.repository.create({
          name: policy.name,
          description: policy.description,
          effect: policy.effect,
          resourceType,
          actionType,
          resourceConditions: policy.conditions as unknown as Record<string, unknown>,
          priority: policy.priority ?? 0,
          enabled: policy.enabled ?? true,
        });
      } catch (error) {
        logger.error('[AbacPolicyEngine] Failed to persist policy to database:', error);
      }
    }

    this.policies.set(policy.id, fullPolicy);
    this.invalidateCache();
  }

  /**
   * 注销政策
   */
  async unregisterPolicy(policyId: string): Promise<void> {
    // Delete from database
    if (this.repository) {
      try {
        await this.repository.delete(policyId);
      } catch (error) {
        logger.error('[AbacPolicyEngine] Failed to delete policy from database:', error);
      }
    }

    this.policies.delete(policyId);
    this.invalidateCache();
  }

  /**
   * 更新政策
   */
  async updatePolicy(policyId: string, updates: Partial<AbacPolicy>): Promise<void> {
    const existing = this.policies.get(policyId);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      // Update in database
      if (this.repository) {
        try {
          const resourceType = updates.resourceType !== undefined
            ? (Array.isArray(updates.resourceType) ? JSON.stringify(updates.resourceType) : updates.resourceType)
            : undefined;
          const actionType = updates.actionType !== undefined
            ? (Array.isArray(updates.actionType) ? JSON.stringify(updates.actionType) : updates.actionType)
            : undefined;

          await this.repository.update(policyId, {
            name: updates.name,
            description: updates.description,
            effect: updates.effect,
            resourceType,
            actionType,
            resourceConditions: updates.conditions as unknown as Record<string, unknown>,
            priority: updates.priority,
            enabled: updates.enabled,
          });
        } catch (error) {
          logger.error('[AbacPolicyEngine] Failed to update policy in database:', error);
        }
      }

      this.policies.set(policyId, updated);
      this.invalidateCache();
    }
  }

  /**
   * 获取所有系统策略 ID
   */
  getSystemPolicyIds(): string[] {
    return SYSTEM_ABAC_POLICIES.map(p => p.id);
  }

  /**
   * 获取政策
   */
  getPolicy(policyId: string): AbacPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * 获取所有政策
   */
  getAllPolicies(): AbacPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * 获取指定资源类型的政策
   */
  getPoliciesForResourceType(resourceType: string): AbacPolicy[] {
    return this.getAllPolicies().filter((policy) => {
      if (!policy.enabled) return false;
      if (policy.resourceType === '*') return true;
      if (Array.isArray(policy.resourceType)) {
        return policy.resourceType.includes(resourceType);
      }
      return policy.resourceType === resourceType;
    });
  }

  /**
   * 清除缓存
   */
  invalidateCache(): void {
    this.policyCache.clear();
  }

  /**
   * 设置缓存配置
   */
  setCacheConfig(enabled: boolean, ttl?: number): void {
    this.cacheEnabled = enabled;
    if (ttl) this.cacheTTL = ttl;
    if (!enabled) this.policyCache.clear();
  }

  /**
   * 解析属性值（支持变量引用）
   */
  private resolveValue(value: any, context: AbacContext): any {
    if (typeof value !== 'string') return value;

    // 支持 ${user.id}, ${resource.department} 等变量
    if (value.startsWith('${') && value.endsWith('}')) {
      const path = value.slice(2, -1);
      return this.getAttributeValue(path, context);
    }

    return value;
  }

  /**
   * 从上下文获取属性值
   */
  private getAttributeValue(path: string, context: AbacContext): any {
    const parts = path.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }

    return value;
  }

  /**
   * 评估单个条件
   */
  private evaluateCondition(condition: Condition, context: AbacContext): boolean {
    const attributeValue = this.getAttributeValue(condition.attribute, context);
    const compareValue = this.resolveValue(condition.value, context);
    const compareValue2 = this.resolveValue(condition.value2, context);

    switch (condition.operator) {
      case 'equals':
        return attributeValue === compareValue;

      case 'notEquals':
        return attributeValue !== compareValue;

      case 'contains':
        if (Array.isArray(attributeValue)) {
          return attributeValue.includes(compareValue);
        }
        return typeof attributeValue === 'string' && attributeValue.includes(compareValue);

      case 'notContains':
        if (Array.isArray(attributeValue)) {
          return !attributeValue.includes(compareValue);
        }
        return typeof attributeValue !== 'string' || !attributeValue.includes(compareValue);

      case 'startsWith':
        return typeof attributeValue === 'string' && attributeValue.startsWith(compareValue);

      case 'endsWith':
        return typeof attributeValue === 'string' && attributeValue.endsWith(compareValue);

      case 'in':
        if (!Array.isArray(compareValue)) return false;
        return compareValue.includes(attributeValue);

      case 'notIn':
        if (!Array.isArray(compareValue)) return true;
        return !compareValue.includes(attributeValue);

      case 'greaterThan':
        return typeof attributeValue === 'number' && attributeValue > compareValue;

      case 'lessThan':
        return typeof attributeValue === 'number' && attributeValue < compareValue;

      case 'greaterThanOrEqual':
        return typeof attributeValue === 'number' && attributeValue >= compareValue;

      case 'lessThanOrEqual':
        return typeof attributeValue === 'number' && attributeValue <= compareValue;

      case 'matches':
        if (typeof attributeValue !== 'string') return false;
        try {
          const regex = new RegExp(compareValue);
          return regex.test(attributeValue);
        } catch {
          return false;
        }

      case 'exists':
        return attributeValue !== undefined && attributeValue !== null;

      case 'notExists':
        return attributeValue === undefined || attributeValue === null;

      case 'between':
        return (
          typeof attributeValue === 'number' &&
          attributeValue >= compareValue &&
          attributeValue <= compareValue2
        );

      case 'timeInRange':
        return this.evaluateTimeInRange(attributeValue, compareValue);

      default:
        return false;
    }
  }

  /**
   * 评估时间范围条件
   */
  private evaluateTimeInRange(timeValue: any, rangeConfig: any): boolean {
    const time = timeValue instanceof Date ? timeValue : new Date(timeValue);
    const startHour = rangeConfig.startHour || 9;
    const endHour = rangeConfig.endHour || 18;

    // 使用 UTC 小时数以保持跨时区一致性
    const hour = time.getUTCHours();
    return hour >= startHour && hour < endHour;
  }

  /**
   * 评估条件规则（递归）
   */
  private evaluateRule(rule: ConditionRule, context: AbacContext): { result: boolean; description?: string } {
    // 单一条件
    if (rule.condition) {
      const result = this.evaluateCondition(rule.condition, context);
      return {
        result,
        description: rule.description || `${rule.condition.attribute} ${rule.condition.operator}`,
      };
    }

    // AND 组合
    if (rule.and && rule.and.length > 0) {
      const results = rule.and.map((r) => this.evaluateRule(r, context));
      const allTrue = results.every((r) => r.result);
      return {
        result: allTrue,
        description: rule.description || `AND(${results.map((r) => r.description).join(', ')})`,
      };
    }

    // OR 组合
    if (rule.or && rule.or.length > 0) {
      const results = rule.or.map((r) => this.evaluateRule(r, context));
      const anyTrue = results.some((r) => r.result);
      return {
        result: anyTrue,
        description: rule.description || `OR(${results.map((r) => r.description).join(', ')})`,
      };
    }

    // NOT 组合
    if (rule.not) {
      const innerResult = this.evaluateRule(rule.not, context);
      return {
        result: !innerResult.result,
        description: rule.description || `NOT(${innerResult.description})`,
      };
    }

    // 空规则默认为 true
    return { result: true };
  }

  /**
   * 检查政策是否匹配资源和操作
   */
  private policyMatchesResourceAction(policy: AbacPolicy, context: AbacContext): boolean {
    const resourceType = context.resource.type;
    const actionTypeValue = context.action.type;

    // 检查资源类型
    if (policy.resourceType !== '*') {
      if (Array.isArray(policy.resourceType)) {
        if (!policy.resourceType.includes(resourceType)) return false;
      } else {
        if (policy.resourceType !== resourceType) return false;
      }
    }

    // 检查操作类型
    if (policy.actionType !== '*') {
      if (Array.isArray(policy.actionType)) {
        if (!policy.actionType.includes(actionTypeValue)) return false;
      } else {
        if (policy.actionType !== actionTypeValue) return false;
      }
    }

    return true;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(context: AbacContext): string {
    return `${context.user.id}:${context.resource.type}:${context.action.type}:${context.resource.id || '*'}`;
  }

  /**
   * 评估权限
   */
  evaluate(context: AbacContext): PolicyEvaluationResult {
    const startTime = Date.now();

    // 检查缓存
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(context);
      const cached = this.policyCache.get(cacheKey);
      if (cached && cached.evaluationTime) {
        const cacheAge = Date.now() - startTime + cached.evaluationTime;
        if (cacheAge < this.cacheTTL) {
          return cached;
        }
      }
    }

    // 获取匹配的政策
    const matchingPolicies = this.getAllPolicies()
      .filter((policy) => policy.enabled && this.policyMatchesResourceAction(policy, context))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0)); // 按优先级降序

    // 评估每个政策
    const matchedAllowPolicies: AbacPolicy[] = [];
    const matchedDenyPolicies: AbacPolicy[] = [];
    const matchedConditions: string[] = [];
    let denialReason: string | undefined;

    for (const policy of matchingPolicies) {
      const ruleResult = this.evaluateRule(policy.conditions, context);

      if (ruleResult.result) {
        if (policy.effect === 'deny') {
          matchedDenyPolicies.push(policy);
          denialReason = `${policy.name}: ${ruleResult.description}`;
          // Deny 政策优先，立即返回
          const result: PolicyEvaluationResult = {
            allowed: false,
            denied: true,
            matchedPolicies: [policy],
            matchedConditions: [ruleResult.description || ''],
            denialReason,
            evaluationTime: Date.now() - startTime,
          };

          // 缓存结果
          if (this.cacheEnabled) {
            const cacheKey = this.generateCacheKey(context);
            this.policyCache.set(cacheKey, result);
          }

          return result;
        } else {
          matchedAllowPolicies.push(policy);
          matchedConditions.push(ruleResult.description || '');
        }
      }
    }

    // 构建结果
    const result: PolicyEvaluationResult = {
      allowed: matchedAllowPolicies.length > 0,
      denied: false,
      matchedPolicies: matchedAllowPolicies,
      matchedConditions,
      denialReason: matchedAllowPolicies.length === 0 ? 'No matching policy allows this action' : undefined,
      evaluationTime: Date.now() - startTime,
    };

    // 缓存结果
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(context);
      this.policyCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * 快速检查是否有权限
   */
  isAllowed(context: AbacContext): boolean {
    return this.evaluate(context).allowed;
  }

  /**
   * 快速检查是否被拒绝
   */
  isDenied(context: AbacContext): boolean {
    return this.evaluate(context).denied;
  }

  /**
   * 批量评估多个操作
   */
  evaluateBatch(
    contexts: AbacContext[]
  ): Map<string, PolicyEvaluationResult> {
    const results = new Map<string, PolicyEvaluationResult>();
    contexts.forEach((context, index) => {
      results.set(String(index), this.evaluate(context));
    });
    return results;
  }

  /**
   * 获取用户可执行的操作列表
   */
  getAvailableActions(
    context: Partial<AbacContext>,
    actionTypes: string[]
  ): string[] {
    const allowedActions: string[] = [];

    for (const actionType of actionTypes) {
      const fullContext: AbacContext = {
        user: context.user || { id: '', role: '' },
        resource: context.resource || { type: '' },
        environment: context.environment || { time: new Date() },
        action: { type: actionType },
      };

      if (this.isAllowed(fullContext)) {
        allowedActions.push(actionType);
      }
    }

    return allowedActions;
  }

  /**
   * 导出政策配置（用于审计）
   */
  exportPolicies(): AbacPolicy[] {
    return this.getAllPolicies().map((policy) => ({
      ...policy,
      conditions: JSON.parse(JSON.stringify(policy.conditions)),
    }));
  }

  /**
   * 导入政策配置
   */
  async importPolicies(policies: AbacPolicy[]): Promise<void> {
    for (const policy of policies) {
      await this.registerPolicy(policy);
    }
  }
}

// 导出单例（不带数据库连接，使用纯内存模式）
export const abacPolicyEngine = new AbacPolicyEngine();
