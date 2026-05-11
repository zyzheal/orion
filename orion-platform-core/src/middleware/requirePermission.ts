import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { checkPermission } from '../services/RBACService.js';

export interface RequirePermissionOptions {
  /**
   * Permission string to check, e.g. 'projects:create'
   */
  permission: string;
}

/**
 * 权限检查中间件
 *
 * 检查当前用户是否拥有指定权限。必须在 jwtAuth 和 tenantIsolation 之后注册。
 *
 * 用法:
 *   app.register(requirePermission, { permission: 'projects:create' });
 *   // 或在路由级别:
 *   app.post('/projects', { preHandler: [app.requirePermission('projects:create')] }, handler);
 */
async function requirePermissionPlugin(fastify: FastifyInstance) {
  fastify.decorate(
    'requirePermission',
    function requirePermissionFactory(permission: string) {
      return async function requirePermissionHandler(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        if (!request.user || !request.user.userId) {
          return reply.code(401).send({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'User not authenticated. Register jwtAuth middleware first.',
            },
          });
        }

        const userId = request.user.userId;
        const scope = request.tenantId || 'global';

        try {
          const hasPermission = await checkPermission(userId, permission, scope);
          if (!hasPermission) {
            return reply.code(403).send({
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: `User does not have permission '${permission}'.`,
              },
            });
          }
        } catch (err) {
          fastify.log.error({ err, userId, permission, scope }, 'Permission check failed');
          return reply.code(500).send({
            success: false,
            error: {
              code: 'PERMISSION_CHECK_ERROR',
              message: 'Failed to verify user permissions.',
            },
          });
        }
      };
    },
  );
}

export default fp(requirePermissionPlugin, {
  name: 'requirePermission',
  fastify: '5.x',
});
