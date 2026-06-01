/**
 * ABAC Policy API Routes
 * Prefix: /api/v1/abac-policies
 *
 * 提供 ABAC 策略的 CRUD 接口。
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { abacPolicyEngine, AbacPolicy, ConditionRule } from '../services/authz/AbacPolicyEngine';
import { OrionError, ErrorCode } from '../errors';
import { DatabasePool } from '../services/database';

interface PolicyParams {
  id: string;
}

interface CreatePolicyBody {
  name: string;
  description?: string;
  resourceType: string | string[];
  actionType: string | string[];
  conditions: ConditionRule;
  effect: 'allow' | 'deny';
  priority?: number;
  enabled?: boolean;
}

interface UpdatePolicyBody {
  name?: string;
  description?: string;
  resourceType?: string | string[];
  actionType?: string | string[];
  conditions?: ConditionRule;
  effect?: 'allow' | 'deny';
  priority?: number;
  enabled?: boolean;
}

/**
 * 系统策略白名单 — 不可被删除或修改
 */
const SYSTEM_POLICY_IDS = new Set<string>();

/**
 * 递归验证 ConditionRule 结构的合法性
 */
function validateConditionRule(rule: ConditionRule, path = 'root'): void {
  // 如果是叶子节点，必须有 condition
  if (!rule.and && !rule.or && !rule.not) {
    if (!rule.condition) {
      throw new OrionError(`Condition at ${path} must have a 'condition' property or be a combinator (and/or/not)`, 'OPERATION_FAILED')
    }
    const cond = rule.condition;
    if (!cond.attribute || typeof cond.attribute !== 'string') {
      throw new OrionError(`Condition at ${path}: attribute must be a non-empty string`, 'VALIDATION_ERROR')
    }
    const validOperators = ['equals', 'not_equals', 'in', 'not_in', 'contains', 'gt', 'lt', 'gte', 'lte', 'regex', 'match'];
    if (!cond.operator || !validOperators.includes(cond.operator)) {
      throw new OrionError(`Condition at ${path}: operator must be one of ${validOperators.join(', ')}`, 'VALIDATION_ERROR')
    }
    if (cond.value === undefined) {
      throw new OrionError(`Condition at ${path}: value is required`, 'VALIDATION_ERROR')
    }
  }

  // 递归验证组合规则
  if (rule.and) {
    if (!Array.isArray(rule.and) || rule.and.length === 0) {
      throw new OrionError(`'and' at ${path} must be a non-empty array`, 'VALIDATION_ERROR')
    }
    rule.and.forEach((sub, i) => validateConditionRule(sub, `${path}.and[${i}]`));
  }
  if (rule.or) {
    if (!Array.isArray(rule.or) || rule.or.length === 0) {
      throw new OrionError(`'or' at ${path} must be a non-empty array`, 'VALIDATION_ERROR')
    }
    rule.or.forEach((sub, i) => validateConditionRule(sub, `${path}.or[${i}]`));
  }
  if (rule.not) {
    validateConditionRule(rule.not, `${path}.not`);
  }
}

/**
 * 验证策略字段的合法性
 */
function validatePolicyBody(body: CreatePolicyBody): void {
  if (!body.name || typeof body.name !== 'string') {
    throw new OrionError('Policy name is required', ErrorCode.VALIDATION_ERROR);
  }
  if (!body.resourceType || (typeof body.resourceType !== 'string' && !Array.isArray(body.resourceType))) {
    throw new OrionError('resourceType is required and must be a string or array', ErrorCode.VALIDATION_ERROR);
  }
  if (!body.actionType || (typeof body.actionType !== 'string' && !Array.isArray(body.actionType))) {
    throw new OrionError('actionType is required and must be a string or array', ErrorCode.VALIDATION_ERROR);
  }
  if (!body.effect || !['allow', 'deny'].includes(body.effect)) {
    throw new OrionError('effect must be "allow" or "deny"', ErrorCode.OPERATION_FAILED);
  }
  // 验证条件结构
  validateConditionRule(body.conditions);
}

/**
 * 注册系统策略（在 AbacPolicyEngine 初始化后调用）
 */
export function registerSystemPolicyId(id: string): void {
  SYSTEM_POLICY_IDS.add(id);
}

interface AbacPolicyRoutesOptions {
  database?: DatabasePool;
}

export default async function abacPolicyRoutes(
  app: FastifyInstance,
  options: AbacPolicyRoutesOptions = {}
): Promise<void> {
  void options.database;
  // Error handler
  function handleError(error: Error, reply: FastifyReply) {
    return reply.status(500).send({
      error: error.name,
      message: error.message,
    });
  }

  // GET /api/v1/abac-policies - 获取所有策略
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'abac', action: 'read' })],
  }, async (_request, reply) => {
    try {
      const policies = abacPolicyEngine.getAllPolicies();
      return reply.send({ data: policies, total: policies.length });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });

  // GET /api/v1/abac-policies/:id - 获取单个策略
  app.get<{ Params: PolicyParams }>('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'abac', action: 'read' })],
  }, async (request, reply) => {
    try {
      const policy = abacPolicyEngine.getPolicy(request.params.id);
      if (!policy) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Policy not found' });
      }
      return reply.send({ data: policy });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });

  // GET /api/v1/abac-policies/resource/:resourceType - 获取资源类型对应的策略
  app.get<{ Params: { resourceType: string } }>('/resource/:resourceType', {
    onRequest: [authenticateUser, requirePermission({ resource: 'abac', action: 'read' })],
  }, async (request, reply) => {
    try {
      const policies = abacPolicyEngine.getPoliciesForResourceType(request.params.resourceType);
      return reply.send({ data: policies, total: policies.length });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });

  // POST /api/v1/abac-policies - 创建策略
  app.post<{ Body: CreatePolicyBody }>('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'abac', action: 'write' })],
  }, async (request, reply) => {
    try {
      // 验证策略字段和条件结构
      validatePolicyBody(request.body);

      const policy: AbacPolicy = {
        id: `custom-${Date.now()}`,
        name: request.body.name,
        description: request.body.description,
        resourceType: request.body.resourceType,
        actionType: request.body.actionType,
        conditions: request.body.conditions,
        effect: request.body.effect,
        priority: request.body.priority ?? 0,
        enabled: request.body.enabled ?? true,
      };
      abacPolicyEngine.registerPolicy(policy);
      return reply.status(201).send({ data: policy, message: 'Policy created' });
    } catch (err) {
      if ((err as Error).message.includes('Condition at') ||
          (err as Error).message.includes('required') ||
          (err as Error).message.includes('must be')) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: (err as Error).message });
      }
      return handleError(err as Error, reply);
    }
  });

  // PUT /api/v1/abac-policies/:id - 更新策略
  app.put<{ Params: PolicyParams; Body: UpdatePolicyBody }>('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'abac', action: 'write' })],
  }, async (request, reply) => {
    try {
      const existing = abacPolicyEngine.getPolicy(request.params.id);
      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Policy not found' });
      }
      // 保护系统策略不被修改
      if (SYSTEM_POLICY_IDS.has(request.params.id)) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot modify system policy' });
      }
      // 如果更新了 conditions，验证其合法性
      if (request.body.conditions) {
        validateConditionRule(request.body.conditions);
      }
      abacPolicyEngine.updatePolicy(request.params.id, request.body);
      const updated = abacPolicyEngine.getPolicy(request.params.id);
      return reply.send({ data: updated, message: 'Policy updated' });
    } catch (err) {
      if ((err as Error).message.includes('Condition at')) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: (err as Error).message });
      }
      return handleError(err as Error, reply);
    }
  });

  // DELETE /api/v1/abac-policies/:id - 删除策略
  app.delete<{ Params: PolicyParams }>('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'abac', action: 'delete' })],
  }, async (request, reply) => {
    try {
      const existing = abacPolicyEngine.getPolicy(request.params.id);
      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Policy not found' });
      }
      // 保护系统策略不被删除
      if (SYSTEM_POLICY_IDS.has(request.params.id)) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot delete system policy' });
      }
      abacPolicyEngine.unregisterPolicy(request.params.id);
      return reply.send({ message: 'Policy deleted' });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });

  // POST /api/v1/abac-policies/:id/toggle - 启用/禁用策略
  app.post<{ Params: PolicyParams }>('/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'abac', action: 'write' })],
  }, async (request, reply) => {
    try {
      const existing = abacPolicyEngine.getPolicy(request.params.id);
      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Policy not found' });
      }
      abacPolicyEngine.updatePolicy(request.params.id, { enabled: !existing.enabled });
      const updated = abacPolicyEngine.getPolicy(request.params.id);
      return reply.send({ data: updated, message: `Policy ${updated?.enabled ? 'enabled' : 'disabled'}` });
    } catch (err) {
      return handleError(err as Error, reply);
    }
  });
}
