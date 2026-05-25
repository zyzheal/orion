/**
 * Sub-App Authentication Adapter
 *
 * Bridges Gateway JWT authentication to sub-application header-based auth.
 * When a request passes through the Gateway with a valid JWT token,
 * this middleware injects user information into request headers
 * before forwarding to sub-applications.
 *
 * Injected Headers:
 *   X-User-Id         - User ID from JWT
 *   X-Username        - Username/email from JWT
 *   X-User-Roles      - Comma-separated roles
 *   X-User-Permissions - Comma-separated permissions
 *   X-Tenant-Id       - Tenant ID if present
 *   X-Auth-Context    - JSON string of full auth context
 *
 * This allows sub-applications to:
 *   - Skip JWT verification (no need to parse/verify tokens)
 *   - Read user info from X-* headers
 *   - Focus on authorization (RBAC/ABAC) not authentication
 *
 * Usage in Gateway route handlers:
 *   fastify.addHook('onSend', injectSubAppAuthHeaders);
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { AuthMiddleware, JwtPayload } from './auth';

export interface SubAppAuthConfig {
  /** Sub-app path prefixes to apply header injection (default: all authenticated) */
  prefixes?: string[];
  /** Whether to include full auth context JSON (default: false) */
  includeFullContext?: boolean;
}

const DEFAULT_CONFIG: SubAppAuthConfig = {
  includeFullContext: false,
};

/**
 * Create sub-app auth header injection hook
 *
 * Call this after the JWT auth middleware has verified the token.
 * The injected headers allow sub-apps to read user info without JWT parsing.
 */
export function createSubAppAuthHook(
  app: FastifyInstance,
  config: SubAppAuthConfig = DEFAULT_CONFIG
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authContext = (request as any).authContext;
    if (!authContext?.authenticated || !authContext.user) {
      return; // Not authenticated - let auth middleware handle 401
    }

    const user = authContext.user as JwtPayload;

    // Inject user info headers for sub-applications
    if (user.sub) {
      request.headers['x-user-id'] = user.sub;
    }
    if (user.email) {
      request.headers['x-username'] = user.email;
    }
    if (user.roles && user.roles.length > 0) {
      request.headers['x-user-roles'] = user.roles.join(',');
    }
    if (user.permissions && user.permissions.length > 0) {
      request.headers['x-user-permissions'] = user.permissions.join(',');
    }

    // Optional: include full auth context for debugging
    if (config.includeFullContext) {
      request.headers['x-auth-context'] = JSON.stringify({
        userId: user.sub,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        iat: user.iat,
        exp: user.exp,
      });
    }
  };
}

/**
 * Sub-app auth verification helper for sub-application backends.
 *
 * Instead of verifying JWT tokens, sub-apps should read user info
 * from the injected headers. This helper validates that the headers
 * are present and returns the user context.
 *
 * Usage in sub-application:
 *   const user = verifySubAppUser(request);
 *   if (!user) return reply.code(401).send({ error: 'UNAUTHORIZED' });
 */
export function verifySubAppUser(request: any): {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
} | null {
  const userId = request.headers['x-user-id'];
  if (!userId) {
    return null; // No sub-app auth headers present
  }

  return {
    userId,
    username: request.headers['x-username'] || userId,
    roles: request.headers['x-user-roles']
      ? (request.headers['x-user-roles'] as string).split(',')
      : [],
    permissions: request.headers['x-user-permissions']
      ? (request.headers['x-user-permissions'] as string).split(',')
      : [],
    tenantId: request.headers['x-tenant-id'] as string | undefined,
  };
}

/**
 * Require authenticated sub-app user middleware
 *
 * For sub-applications that have migrated to header-based auth.
 * Returns 401 if no sub-app auth headers are present.
 */
export function requireSubAppAuth() {
  return async (request: any, reply: any) => {
    const user = verifySubAppUser(request);
    if (!user) {
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Missing sub-app authentication headers. Ensure request passes through Gateway.',
      });
    }

    // Attach user to request for downstream handlers
    request.user = user;
  };
}

/**
 * Role check helper for sub-applications using header-based auth
 */
export function requireSubAppRole(...roles: string[]) {
  return async (request: any, reply: any) => {
    const user = verifySubAppUser(request);
    if (!user) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const hasRole = roles.some((r) => user.roles.includes(r));
    if (!hasRole) {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: `Required roles: ${roles.join(', ')}`,
      });
    }
  };
}

/**
 * Permission check helper for sub-applications using header-based auth
 */
export function requireSubAppPermission(...permissions: string[]) {
  return async (request: any, reply: any) => {
    const user = verifySubAppUser(request);
    if (!user) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const hasPermission = permissions.some((p) => user.permissions.includes(p));
    if (!hasPermission) {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: `Required permissions: ${permissions.join(', ')}`,
      });
    }
  };
}
