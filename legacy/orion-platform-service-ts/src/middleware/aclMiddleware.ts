/**
 * ACL Middleware — 路由级访问控制
 *
 * 基于 AuthorizationEngine 的资源类型级访问控制中间件。
 * 在 authenticateUser 之后运行，使用 request.user 进行授权评估。
 *
 * Usage:
 *   app.get('/api/pipelines', { onRequest: [authenticateUser, aclGuard({ resourceType: 'pipeline', defaultAction: 'deny' })] }, handler);
 *
 * Or via registerWithPermission:
 *   registerWithPermission(app, pipelineRoutes, '/pipelines', { database }, 'pipeline', 'read');
 *
 * Behavior:
 *   - 已配置 resourceType → 调用 AuthZEngine.evaluate() 评估访问权限
 *   - 未配置 resourceType → 根据 defaultAction 决定（默认 deny）
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthorizationEngine, AuthZRequest } from '../services/authz/AuthorizationEngine';
import { OrionError, ErrorCode } from '../errors';

export interface AclGuardOptions {
  resourceType: string;
  defaultAction?: 'allow' | 'deny';
  action?: string;
  requiredImpact?: 'low' | 'medium' | 'high' | 'critical';
}

// Global engine instance, set during app initialization
let authzEngine: AuthorizationEngine | null = null;

export function setAuthzEngine(engine: AuthorizationEngine | null): void {
  authzEngine = engine;
}

export function getAuthzEngine(): AuthorizationEngine | null {
  return authzEngine;
}

/**
 * 创建 ACL 检查中间件工厂函数
 */
export function aclGuard(options: AclGuardOptions) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!authzEngine) {
      throw new OrionError('AuthZ engine not initialized', ErrorCode.OPERATION_FAILED);
    }

    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({
        code: 401,
        error: 'UNAUTHORIZED',
        message: 'Missing authenticated user',
      });
    }

    const resourceType = options.resourceType;
    const defaultAction = options.defaultAction || 'deny';

    // 未配置 ACL 的路由根据 defaultAction 决定
    if (!resourceType) {
      if (defaultAction === 'deny') {
        return reply.code(403).send({
          code: 403,
          error: 'FORBIDDEN',
          message: 'Route not configured for access control',
          source: 'acl',
        });
      }
      return; // defaultAction === 'allow', 放行
    }

    const resourceId = (request.params as any)?.id as string | undefined;
    const projectId = (request.params as any)?.projectId as string | undefined;

    const authzReq: AuthZRequest = {
      user: {
        id: user.userId || user.id || '',
        username: user.username || '',
        roles: user.roles || [],
        tenantId: user.tenantId || '',
        department: user.department,
        level: user.level,
        status: user.status || 'active',
        teams: user.teams || [],
      },
      resource: {
        type: resourceType,
        id: resourceId,
        tenantId: user.tenantId || '',
        projectId,
        ownerId: user.userId || user.id || '',
      },
      environment: {
        time: new Date(),
        sourceIp: request.ip,
        network: ((request.headers['x-network'] as string) || 'internal') as 'internal' | 'external' | 'vpn',
        requestOrigin: 'web',
      },
      action: {
        type: options.action || 'read',
        impact: options.requiredImpact || 'low',
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