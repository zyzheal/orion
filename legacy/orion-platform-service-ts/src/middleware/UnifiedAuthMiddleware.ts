/**
 * UnifiedAuthMiddleware — 统一权限中间件
 *
 * 将 8 个不同的权限中间件整合为一个一致的授权系统。
 *
 * 整合范围：
 *   - jwtAuth / authenticateUser  →  JWT 认证
 *   - requirePermission / aclGuard →  统一授权评估
 *   - roleGuard                    →  角色检查
 *   - requireCapability            →  能力检查
 *   - requireTenant                →  租户校验
 *   - authenticateApiKey           →  API Key 认证
 *   - verifyHrWebhookSignature     →  HR Webhook 签名
 *   - runnerAuthMiddleware         →  Runner API Token
 *
 * 核心设计：
 *   - 所有检查按顺序执行：auth → capability → permission → role → tenant
 *   - 未通过时返回 401 (未认证) 或 403 (未授权)
 *   - 每个检查阶段都有明确的错误码和错误消息
 *   - 支持灵活配置：只启用需要的检查
 *
 * Usage (per-route):
 *   app.get('/api/pipelines/:id', {
 *     onRequest: [unifiedAuth({
 *       requireCapability: ['pipeline.read'],
 *       requirePermission: { resource: 'pipeline', action: 'read' },
 *     })],
 *   }, handler);
 *
 * Usage (global):
 *   app.addHook('onRequest', unifiedAuth({ requireAuth: true }));
 *
 * Migration mapping:
 *   authenticateUser                              → unifiedAuth({ requireAuth: true })
 *   jwtAuth                                        → unifiedAuth({ requireAuth: true })
 *   requirePermission({ resource, action })        → unifiedAuth({ requirePermission: { resource, action } })
 *   roleGuard(['admin'])                           → unifiedAuth({ requireRole: ['admin'] })
 *   requireCapability({ capabilityId: 'x' })       → unifiedAuth({ requireCapability: ['x'] })
 *   requireTenant()                                → unifiedAuth({ tenantIsolation: true })
 *   authenticateApiKey                             → unifiedAuth({ apiKeyAuth: true })
 *   verifyHrWebhookSignature                       → unifiedAuth({ webhookAuth: 'hr' })
 *   runnerAuthMiddleware                           → unifiedAuth({ runnerAuth: true })
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtAuth, JwtPayload, initJwtAuth, optionalJwtAuth } from './jwtAuth';
import { authenticateUser, initAuthMiddleware } from './authMiddleware';
import {
  requirePermission,
  setAuthzEngine,
  RequirePermissionOptions,
  getAuthzEngine,
} from './requirePermission';
import { aclGuard, AclGuardOptions, setAuthzEngine as setAclAuthzEngine } from './aclMiddleware';
import { roleGuard } from './roleGuard';
import {
  requireCapability,
  requireCapabilityDynamic,
  requireCapabilityForAction,
  requireAnyCapability,
  setCapabilityService,
  getCapabilityService,
  CapabilityCheckUser,
  CapabilityCheckContext,
  RequireCapabilityDynamicOptions,
} from './requireCapability';
import { requireRoles, requireTenant, getTenantIdFromRequest, validateTenantAccess } from './tenantAuth';
import { authenticateApiKey, initApiKeyAuth } from './apiKeyAuth';
import { verifyHrWebhookSignature, generateHrWebhookSignature } from './hrWebhookAuth';
import { runnerAuthMiddleware } from './runnerAuthMiddleware';
import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode } from '../errors';

const logger = createLogger('unifiedAuth');

// ============================================================================
// Types
// ============================================================================

/**
 * Unified auth options — configurable authorization chain
 */
export interface UnifiedAuthOptions {
  /** Require JWT authentication (default: true if no other auth specified) */
  requireAuth?: boolean;
  /** Require specific capabilities (CapabilityService check) */
  requireCapability?: string[] | string;
  /** Dynamic capability check function */
  requireCapabilityDynamic?: RequireCapabilityDynamicOptions;
  /** Require specific permission (AuthorizationEngine) */
  requirePermission?: RequirePermissionOptions | string;
  /** Require at least one of these roles */
  requireRole?: string[];
  /** Enforce tenant isolation (user tenantId must match resource) */
  tenantIsolation?: boolean;
  /** Tenant isolation param name (default: 'tenantId') */
  tenantParamName?: string;
  /** Require API Key authentication */
  apiKeyAuth?: boolean;
  /** HR Webhook signature verification */
  webhookAuth?: 'hr';
  /** Runner API Token authentication */
  runnerAuth?: boolean;
  /** Use optional JWT auth (allow anonymous) */
  optionalAuth?: boolean;
  /** Custom error messages */
  errorMessages?: {
    unauthorized?: string;
    forbidden?: string;
    invalidApiKey?: string;
    webhookSignature?: string;
  };
  /** Whether to attach capability check result to request */
  attachCapabilityResult?: boolean;
}

/**
 * Extended request with all possible auth properties
 */
export interface UnifiedAuthRequest extends FastifyRequest {
  user?: JwtPayload;
  apiKey?: { key: { tenant_id: number; [key: string]: unknown }; [key: string]: unknown };
  apiKeyTenantId?: number;
  capabilityCheck?: Record<string, unknown>;
  authMethod?: 'jwt' | 'api-key' | 'webhook' | 'runner';
}

// ============================================================================
// Initialization helpers
// ============================================================================

/**
 * Initialize JWT auth (backward compatible with jwtAuth.ts)
 */
export function initJwtAuthMiddleware(
  blacklist: Parameters<typeof initJwtAuth>[0],
  database: Parameters<typeof initJwtAuth>[1],
): void {
  initJwtAuth(blacklist, database);
}

/**
 * Initialize legacy auth middleware (backward compatible)
 */
export function initLegacyAuthMiddleware(blacklistService: Parameters<typeof initAuthMiddleware>[0]): void {
  initAuthMiddleware(blacklistService);
}

/**
 * Initialize API Key auth
 */
export function initApiKeyAuthMiddleware(
  db: Parameters<typeof initApiKeyAuth>[0],
): void {
  initApiKeyAuth(db);
}

/**
 * Set AuthorizationEngine (for requirePermission / aclGuard)
 */
export function setUnifiedAuthzEngine(engine: Parameters<typeof setAuthzEngine>[0]): void {
  setAuthzEngine(engine);
  setAclAuthzEngine(engine);
}

/**
 * Set CapabilityService (for requireCapability)
 */
export function setUnifiedCapabilityService(service: Parameters<typeof setCapabilityService>[0]): void {
  setCapabilityService(service);
}

// ============================================================================
// Core: unifiedAuth factory
// ============================================================================

/**
 * Create unified authentication + authorization middleware
 *
 * All checks run in order:
 *   1. Authentication (JWT / API Key / Webhook / Runner)
 *   2. Capability check (CapabilityService)
 *   3. Permission check (AuthorizationEngine)
 *   4. Role check
 *   5. Tenant isolation
 *
 * @param options - Configuration for which checks to run
 * @returns Fastify onRequest/preHandler hook
 */
export function unifiedAuth(options: UnifiedAuthOptions = {}): (
  request: UnifiedAuthRequest,
  reply: FastifyReply,
) => Promise<void> {
  const {
    requireAuth = false,
    requireCapability,
    requireCapabilityDynamic,
    requirePermission,
    requireRole,
    tenantIsolation = false,
    tenantParamName = 'tenantId',
    apiKeyAuth = false,
    webhookAuth,
    runnerAuth = false,
    optionalAuth = false,
    errorMessages,
    attachCapabilityResult = true,
  } = options;

  // Normalize requireCapability to array
  const capabilityIds: string[] = (() => {
    if (!requireCapability) return [];
    if (Array.isArray(requireCapability)) return requireCapability;
    return [requireCapability];
  })();

  // Normalize requirePermission
  const permissionOpts: RequirePermissionOptions | undefined = (() => {
    if (!requirePermission) return undefined;
    if (typeof requirePermission === 'string') {
      return { resource: requirePermission, action: 'read' };
    }
    return requirePermission;
  })();

  // Determine auth method priority
  const authMethods = [];
  if (apiKeyAuth) authMethods.push('api-key');
  if (webhookAuth === 'hr') authMethods.push('webhook');
  if (runnerAuth) authMethods.push('runner');
  if (!optionalAuth) authMethods.push('jwt');

  return async (request: UnifiedAuthRequest, reply: FastifyReply): Promise<void> => {
    // ========================================================================
    // Phase 1: Authentication
    // ========================================================================

    // --- API Key Auth ---
    if (apiKeyAuth) {
      try {
        await authenticateApiKey(request, reply);
        if ((reply as any).statusCode === 401 || (reply as any).statusCode === 403) {
          return;
        }
        request.authMethod = 'api-key';
      } catch (err) {
        logger.error('[unifiedAuth] API key auth error:', err);
        return reply.code(500).send({
          code: 500,
          error: 'AUTH_ERROR',
          message: errorMessages?.invalidApiKey || 'API key verification failed',
        });
      }
    }

    // --- HR Webhook Auth ---
    if (webhookAuth === 'hr') {
      try {
        await verifyHrWebhookSignature(request, reply);
        if ((reply as any).statusCode === 401 || (reply as any).statusCode === 403) {
          return;
        }
        request.authMethod = 'webhook';
      } catch (err) {
        logger.error('[unifiedAuth] Webhook auth error:', err);
        return reply.code(401).send({
          code: 401,
          error: 'WEBHOOK_AUTH_FAILED',
          message: errorMessages?.webhookSignature || 'Webhook signature verification failed',
        });
      }
    }

    // --- Runner Auth ---
    if (runnerAuth) {
      try {
        await runnerAuthMiddleware(request, reply);
        if ((reply as any).statusCode === 401 || (reply as any).statusCode === 403) {
          return;
        }
        request.authMethod = 'runner';
      } catch (err) {
        logger.error('[unifiedAuth] Runner auth error:', err);
        return reply.code(500).send({
          code: 500,
          error: 'RUNNER_AUTH_ERROR',
          message: 'Runner authentication failed',
        });
      }
    }

    // --- JWT Auth (default) ---
    if (!optionalAuth && !apiKeyAuth && !webhookAuth && !runnerAuth) {
      // Default to JWT auth when no other method specified and not optional
      try {
        await jwtAuth(request, reply);
        if ((reply as any).statusCode && (reply as any).statusCode >= 400) {
          return;
        }
        request.authMethod = 'jwt';
      } catch (err) {
        logger.error('[unifiedAuth] JWT auth error:', err);
        return reply.code(500).send({
          code: 500,
          error: 'AUTH_ERROR',
          message: errorMessages?.unauthorized || 'Authentication failed',
        });
      }
    } else if (optionalAuth && !apiKeyAuth && !webhookAuth && !runnerAuth) {
      // Optional JWT: attach user if valid, continue if not
      try {
        await optionalJwtAuth(request, reply);
      } catch {
        // Ignore errors for optional auth
      }
      if (request.user) {
        request.authMethod = 'jwt';
      }
    }

    // ========================================================================
    // Phase 2: Post-auth checks (require authenticated user)
    // ========================================================================

    const user = request.user;
    if (!user && requireAuth && !optionalAuth) {
      return reply.code(401).send({
        code: 401,
        error: 'UNAUTHORIZED',
        message: errorMessages?.unauthorized || 'Authentication required',
      });
    }

    // ========================================================================
    // Phase 3: Capability Check (CapabilityService)
    // ========================================================================

    if (capabilityIds.length > 0 || requireCapabilityDynamic) {
      const capabilityService = getCapabilityService();
      if (!capabilityService) {
        logger.error('[unifiedAuth] CapabilityService not initialized');
        return reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Capability service not initialized',
        });
      }

      if (!user) {
        return reply.code(401).send({
          code: 401,
          error: 'UNAUTHORIZED',
          message: 'User information not found in request',
        });
      }

      // Dynamic check
      if (requireCapabilityDynamic) {
        try {
          const context: CapabilityCheckContext = {
            request,
            resource: {
              type: (request.params as any)?.resourceType,
              id: (request.params as any)?.id,
              tenantId: (user as any).tenantId,
              projectId: (request.params as any)?.projectId,
              ownerId: (user as any).userId || (user as any).id,
            },
            action: request.method,
            environmentSuffix: requireCapabilityDynamic.extractEnvironmentSuffix?.(request),
          };
          const allowed = await requireCapabilityDynamic.check(
            user as unknown as CapabilityCheckUser,
            context,
          );
          if (!allowed) {
            return reply.code(403).send({
              code: 403,
              error: 'FORBIDDEN',
              message: errorMessages?.forbidden || requireCapabilityDynamic.errorMessage || 'Insufficient capability (dynamic check)',
            });
          }
          if (attachCapabilityResult) {
            (request as any).capabilityCheck = { allowed: true, dynamic: true };
          }
        } catch (err) {
          logger.error('[unifiedAuth] Dynamic capability check error:', err);
          return reply.code(500).send({
            code: 500,
            error: 'INTERNAL_ERROR',
            message: 'Error checking capability permission',
          });
        }
      } else {
        // Static capability check (any one passes)
        let matched = false;
        for (const capId of capabilityIds) {
          try {
            const result = await capabilityService.checkPermission({
              userId: (user as any).userId || (user as any).id || '',
              userRoles: (user as any).roles || [],
              capabilityId: capId,
            });
            if (result.allowed) {
              matched = true;
              if (attachCapabilityResult) {
                (request as any).capabilityCheck = {
                  allowed: true,
                  capabilityId: capId,
                  requiresApproval: result.requiresApproval,
                  matchedCapability: capId,
                };
              }
              break;
            }
          } catch (err) {
            logger.error('[unifiedAuth] Capability check error:', err);
            return reply.code(500).send({
              code: 500,
              error: 'INTERNAL_ERROR',
              message: 'Error checking capability permission',
            });
          }
        }
        if (!matched) {
          return reply.code(403).send({
            code: 403,
            error: 'FORBIDDEN',
            message: errorMessages?.forbidden || `User does not have any of the required capabilities: ${capabilityIds.join(', ')}`,
            requiredCapabilities: capabilityIds,
          });
        }
      }
    }

    // ========================================================================
    // Phase 4: Permission Check (AuthorizationEngine)
    // ========================================================================

    if (permissionOpts) {
      const authzEngine = getAuthzEngine();
      if (!authzEngine) {
        logger.error('[unifiedAuth] AuthorizationEngine not initialized');
        return reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Authorization engine not initialized',
        });
      }

      if (!user) {
        return reply.code(401).send({
          code: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      try {
        const resourceId = permissionOpts.extractResourceId?.(request);
        const projectId = permissionOpts.extractProjectId?.(request);
        const ownerId = permissionOpts.extractOwnerId?.(request);

        const authzReq = {
          user: {
            id: (user as any).id || (user as any).userId || '',
            username: (user as any).username || '',
            roles: (user as any).roles || [],
            tenantId: (user as any).tenantId || '',
            department: (user as any).department,
            level: (user as any).level,
            status: (user as any).status || 'active',
            teams: (user as any).teams || [],
          },
          resource: {
            type: permissionOpts.resource,
            id: resourceId,
            tenantId: (user as any).tenantId || '',
            projectId,
            ownerId,
          },
          environment: {
            time: new Date(),
            sourceIp: (request as any).ip,
            network: ((request.headers['x-network'] as string) || 'internal') as 'internal' | 'external' | 'vpn',
            requestOrigin: 'web' as const,
          },
          action: {
            type: permissionOpts.action,
            impact: permissionOpts.requiredImpact || 'low',
          },
        };

        const decision = await authzEngine.evaluate(authzReq);
        if (!decision.allowed) {
          return reply.code(403).send({
            code: 403,
            error: 'FORBIDDEN',
            message: errorMessages?.forbidden || decision.reason,
            source: decision.source,
          });
        }
      } catch (err) {
        logger.error('[unifiedAuth] Permission check error:', err);
        return reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Error checking permission',
        });
      }
    }

    // ========================================================================
    // Phase 5: Role Check
    // ========================================================================

    if (requireRole && requireRole.length > 0) {
      if (!user) {
        return reply.code(401).send({
          code: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      const userRoles = (user as any).roles || [];
      const hasRole = requireRole.some((r) => userRoles.includes(r));
      if (!hasRole) {
        return reply.code(403).send({
          code: 403,
          error: 'FORBIDDEN',
          message: errorMessages?.forbidden || `权限不足，需要角色: ${requireRole.join(' / ')}`,
          requiredRoles: requireRole,
        });
      }
    }

    // ========================================================================
    // Phase 6: Tenant Isolation
    // ========================================================================

    if (tenantIsolation) {
      if (!user) {
        return reply.code(401).send({
          code: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required for tenant isolation',
        });
      }

      const requestTenantId = (request.params as Record<string, string>)?.[tenantParamName];
      if (!requestTenantId) {
        return reply.code(400).send({
          code: 400,
          error: 'TENANT_ID_REQUIRED',
          message: `请求中缺少租户 ID 参数: ${tenantParamName}`,
        });
      }

      const userTenantId = (user as any).tenantId;
      if (!userTenantId || userTenantId !== requestTenantId) {
        return reply.code(403).send({
          code: 403,
          error: 'TENANT_MISMATCH',
          message: '无权访问其他租户的资源',
        });
      }
    }
  };
}

// ============================================================================
// Backward-compatible aliases
// ============================================================================

/**
 * unifiedAuth with JWT only (backward compatible with jwtAuth)
 */
export const unifiedJwtAuth = unifiedAuth({ requireAuth: true });

/**
 * unifiedAuth with JWT + permission check (backward compatible with requirePermission)
 */
export function unifiedPermissionAuth(permissionOpts: RequirePermissionOptions | string) {
  return unifiedAuth({
    requireAuth: true,
    requirePermission: permissionOpts,
  });
}

/**
 * unifiedAuth with JWT + role check (backward compatible with roleGuard)
 *
 * NOTE: Use { requireAuth: true, requireRole: [...] } directly for new code.
 * This helper is kept for backward compatibility with roleGuard-style usage.
 */
export function unifiedRoleGuard(requiredRoles: string[]) {
  return unifiedAuth({
    requireAuth: true,
    requireRole: requiredRoles,
  });
}

export { aclGuard } from './aclMiddleware';
export { requirePermission } from './requirePermission';
export { roleGuard } from './roleGuard';
export { requireCapability, requireCapabilityDynamic, requireAnyCapability } from './requireCapability';
export { jwtAuth, optionalJwtAuth, requireRoles as requireRole, requireTenant } from './jwtAuth';
export { authenticateApiKey } from './apiKeyAuth';
export { verifyHrWebhookSignature } from './hrWebhookAuth';
export { runnerAuthMiddleware } from './runnerAuthMiddleware';
export { authenticateUser } from './authMiddleware';

/**
 * unifiedAuth with JWT + capability check (backward compatible with requireCapability)
 */
export function unifiedCapabilityCheck(capabilityId: string | string[]) {
  return unifiedAuth({
    requireAuth: true,
    requireCapability: capabilityId,
  });
}

/**
 * unifiedAuth with JWT + tenant check (backward compatible with requireTenant)
 */
export function unifiedTenantGuard(paramName?: string) {
  return unifiedAuth({
    requireAuth: true,
    tenantIsolation: true,
    tenantParamName: paramName || 'tenantId',
  });
}

export default unifiedAuth;
