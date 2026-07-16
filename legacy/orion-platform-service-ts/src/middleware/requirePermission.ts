/**
 * requirePermission - 基于 AuthorizationEngine 的权限中间件
 *
 * 在路由处理前进行统一授权评估（RBAC + ABAC + 关系检查）。
 *
 * Usage:
 *   app.get('/api/resources/:id', { onRequest: [requirePermission({ ... })] }, handler);
 *
 * Or register globally:
 *   app.addHook('onRequest', requirePermission({ resourceType: 'pipeline', action: 'read' }));
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthZRequest } from '../services/authz/AuthorizationEngine';
import { OrionError, ErrorCode } from '../errors';

export interface RequirePermissionOptions {
  resource: string;
  action: string;
  extractResourceId?: (req: FastifyRequest) => string | undefined;
  extractProjectId?: (req: FastifyRequest) => string | undefined;
  extractOwnerId?: (req: FastifyRequest) => string | undefined;
  requiredImpact?: 'low' | 'medium' | 'high' | 'critical';
}

// Global engine instance, set during app initialization
let authzEngine: any = null;

export function setAuthzEngine(engine: any) {
  authzEngine = engine;
}

export function getAuthzEngine() {
  return authzEngine;
}

/**
 * 创建权限校验中间件工厂函数
 */
export function requirePermission(options: RequirePermissionOptions) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!authzEngine) {
      throw new OrionError('AuthZ engine not initialized', ErrorCode.OPERATION_FAILED);
    }

    const user = (request as any).user;

    // Fail-closed: authentication is required before authorization.
    // Reject requests without a validated user identity instead of
    // fabricating an anonymous user and delegating the decision to the
    // authorization engine.
    if (!user || (!user.id && !user.userId)) {
      return reply.code(401).send({
        code: 401,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const resourceId = options.extractResourceId?.(request);
    const projectId = options.extractProjectId?.(request);
    const ownerId = options.extractOwnerId?.(request);

    const authzReq: AuthZRequest = {
      user: {
        id: user?.id || user?.userId || '',
        username: user?.username || '',
        roles: user?.roles || [],
        tenantId: user?.tenantId || '',
        department: user?.department,
        level: user?.level,
        status: user?.status || 'active',
        teams: user?.teams || [],
      },
      resource: {
        type: options.resource,
        id: resourceId,
        tenantId: user?.tenantId || '',
        projectId,
        ownerId,
      },
      environment: {
        time: new Date(),
        sourceIp: request.ip,
        network: ((request.headers['x-network'] as string) || 'internal') as 'internal' | 'external' | 'vpn',
        requestOrigin: 'web',
      },
      action: {
        type: options.action,
        impact: options.requiredImpact,
      },
    };

    const decision = await authzEngine.evaluate(authzReq);

    if (!decision.allowed) {
      return reply.code(403).send({
        code: 403,
        error: 'FORBIDDEN',
        message: decision.reason,
        source: decision.source,
      });
    }
  };
}
