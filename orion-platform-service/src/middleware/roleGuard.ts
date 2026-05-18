/**
 * Role Guard Middleware
 *
 * Enforces role-based access control on API endpoints.
 * Checks that the authenticated user (set by authMiddleware) has one of
 * the required roles. Returns 403 if the user lacks sufficient permissions.
 *
 * Usage:
 *   app.addHook('onRequest', roleGuard(['admin', 'platform_admin']));
 *
 * Or combined with auth:
 *   app.get('/admin/users', {
 *     onRequest: [authenticateUser, roleGuard(['admin', 'platform_admin'])]
 *   }, handler);
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Creates a role-checking hook that ensures the authenticated user
 * has one of the required roles.
 *
 * @param requiredRoles - Array of roles that are allowed to access the route.
 *                        User must have at least one of these roles.
 * @returns Fastify onRequest hook function
 */
export function roleGuard(requiredRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userRoles = request.user?.roles || [];

    if (userRoles.length === 0) {
      // User not authenticated - auth middleware should have caught this,
      // but we double-check here for safety.
      return reply.code(401).send({
        code: 401,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const hasRole = userRoles.some(r => requiredRoles.includes(r));
    if (!hasRole) {
      return reply.code(403).send({
        code: 403,
        error: 'FORBIDDEN',
        message: `权限不足，需要角色: ${requiredRoles.join(' / ')}`,
      });
    }
  };
}
