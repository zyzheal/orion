/**
 * ABAC Policy API Routes
 * Prefix: /api/v1/abac-policies
 *
 * 提供 ABAC 策略的 CRUD 接口。
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { abacPolicyEngine, AbacPolicy } from '../services/authz/AbacPolicyEngine';

interface PolicyParams {
  id: string;
}

interface CreatePolicyBody {
  name: string;
  description?: string;
  resourceType: string | string[];
  actionType: string | string[];
  conditions: any;
  effect: 'allow' | 'deny';
  priority?: number;
  enabled?: boolean;
}

interface UpdatePolicyBody extends Partial<CreatePolicyBody> {}

export default async function abacPolicyRoutes(app: FastifyInstance): Promise<void> {
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
      const policy: AbacPolicy = {
        id: `custom-${Date.now()}`,
        ...request.body,
      };
      abacPolicyEngine.registerPolicy(policy);
      return reply.status(201).send({ data: policy, message: 'Policy created' });
    } catch (err) {
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
      abacPolicyEngine.updatePolicy(request.params.id, request.body);
      const updated = abacPolicyEngine.getPolicy(request.params.id);
      return reply.send({ data: updated, message: 'Policy updated' });
    } catch (err) {
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
      if (request.params.id.startsWith('custom-')) {
        abacPolicyEngine.unregisterPolicy(request.params.id);
        return reply.send({ message: 'Policy deleted' });
      }
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot delete system policy' });
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