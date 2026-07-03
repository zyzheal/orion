/**
 * JWT Authentication Middleware — Unified Version
 *
 * Unified JWT verification middleware that integrates:
 * - Centralized JWT key management via JwtKeyManager
 * - Token blacklist checking via TokenBlacklistService
 * - User status validation (blocks terminated/suspended users)
 * - Multi-tenant support
 *
 * This is the SINGLE authoritative JWT middleware.
 * The older authMiddleware.ts (authenticateUser) is kept for backward compatibility
 * but all new code should use this middleware.
 *
 * Usage:
 *   // As global middleware
 *   app.addHook('onRequest', jwtAuth);
 *
 *   // As per-route middleware
 *   app.get('/protected', { onRequest: [jwtAuth] }, handler);
 *
 *   // Generate token
 *   const token = generateToken({ userId, tenantId, roles });
 *
 * Phase 3.8.1: Unified key management
 * Phase 3.8.2: Token blacklist integration
 * Phase 3.8.7: User status validation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { jwtKeyManager } from '../services/auth/JwtKeyManager';
import { TokenBlacklistService } from '../services/auth/TokenBlacklistService';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';

const logger = createLogger('jwt-auth');

/**
 * JWT Payload interface
 */
export interface JwtPayload {
  userId: string;
  tenantId?: string;
  roles?: string[];
  username?: string;
  email?: string;
  exp?: number;
  iat?: number;
}

/**
 * Extended FastifyRequest with user property
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

// Singleton instances (initialized once during bootstrap)
let tokenBlacklist: TokenBlacklistService | null = null;
let dbPool: DatabasePool | null = null;

/**
 * Initialize the middleware with shared services.
 * Called once during application bootstrap.
 */
export function initJwtAuth(
  blacklist: TokenBlacklistService | null,
  database: DatabasePool | null,
): void {
  tokenBlacklist = blacklist;
  dbPool = database;
  logger.info('[JwtAuth] Middleware initialized with shared services');
}

/**
 * Unified JWT authentication middleware.
 *
 * Validates Authorization header, verifies JWT signature using
 * centralized key management, checks token blacklist, and validates
 * user status.
 *
 * Also normalizes tenant_id/tenantId field names for backward compatibility.
 */
export async function jwtAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      success: false,
      error: 'UNAUTHORIZED',
      code: '20103',
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.slice(7);

  // Phase 3.8.2: Check token blacklist before verification
  if (tokenBlacklist) {
    try {
      const isBlacklisted = await tokenBlacklist.isRevoked(token);
      if (isBlacklisted) {
        return reply.code(401).send({
          success: false,
          error: 'TOKEN_REVOKED',
          code: '20110',
          message: 'Token has been revoked (logged out or admin revoked)',
        });
      }
    } catch (err) {
      // Fail-closed: if blacklist check fails, reject the request
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('[JwtAuth] Blacklist check failed, rejecting request:', errMsg);
      return reply.code(503).send({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        code: '20150',
        message: 'Token validation service temporarily unavailable',
      });
    }
  }

  try {
    // Phase 3.8.1: Verify using centralized key manager with multi-key rotation support
    // Tries current key first, then expiring keys during overlap period
    const decoded = jwtKeyManager.verifyWithAnyKey<JwtPayload>(token, (secret) => {
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
    });

    if (!decoded) {
      return reply.code(401).send({
        success: false,
        error: 'INVALID_TOKEN',
        code: '20102',
        message: 'Invalid or expired token',
      });
    }

    // Phase 3.8.7: Validate user status on first request
    if (dbPool) {
      try {
        const statusCheck = await dbPool.query(
          'SELECT status FROM users WHERE id = $1',
          [decoded.userId],
        );
        if (statusCheck?.rows?.[0]) {
          const userStatus = statusCheck.rows[0].status;
          if (userStatus === 'terminated' || userStatus === 'deleted') {
            return reply.code(403).send({
              success: false,
              error: 'ACCOUNT_DISABLED',
              code: '20111',
              message: 'Account has been disabled or terminated',
            });
          }
          if (userStatus === 'suspended') {
            return reply.code(403).send({
              success: false,
              error: 'ACCOUNT_SUSPENDED',
              code: '20112',
              message: 'Account is temporarily suspended',
            });
          }
        }
      } catch (statusErr) {
        // Fail-closed: if DB is unavailable, reject request
        const errMsg = statusErr instanceof Error ? statusErr.message : String(statusErr);
        logger.error('[JwtAuth] User status check failed, rejecting request:', errMsg);
        return reply.code(503).send({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          code: '20150',
          message: 'User status validation service temporarily unavailable',
        });
      }
    }

    // Normalize field names for backward compatibility
    // Support both tenantId (camelCase) and tenant_id (snake_case)
    if (decoded.tenant_id && !decoded.tenantId) {
      (decoded as any).tenantId = decoded.tenant_id;
    }
    if (decoded.tenantId && !decoded.tenant_id) {
      (decoded as any).tenant_id = decoded.tenantId;
    }

    request.user = decoded;
  } catch (error) {
    return reply.code(401).send({
      success: false,
      error: 'INVALID_TOKEN',
      code: '20102',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Generate JWT Token using centralized key management
 */
export function generateToken(
  payload: Omit<JwtPayload, 'exp' | 'iat'>,
  options?: { expiresIn?: string },
): string {
  const expiresIn = options?.expiresIn || '24h';
  const secret = jwtKeyManager.getCurrentSecret();
  return jwt.sign(payload, secret, { expiresIn, algorithms: ['HS256'] } as jwt.SignOptions);
}

/**
 * Verify JWT Token without attaching to request (for manual use)
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwtKeyManager.verifyWithAnyKey<JwtPayload>(token, (secret) => {
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
    });
  } catch {
    return null;
  }
}

/**
 * Optional JWT auth — if valid token present, attach user;
 * if not, proceed as anonymous.
 */
export async function optionalJwtAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwtKeyManager.verifyWithAnyKey<JwtPayload>(token, (secret) => {
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
    });
    if (decoded) {
      request.user = decoded;
    }
  } catch {
    // Invalid token — continue as anonymous
  }
}

/**
 * Role validation decorator — must be used after jwtAuth
 */
export function requireRoles(requiredRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        code: '20103',
        message: 'Authentication required',
      });
    }

    const userRoles = user.roles || [];
    const hasRequiredRole = requiredRoles.some(r => userRoles.includes(r));

    if (!hasRequiredRole) {
      return reply.code(403).send({
        success: false,
        error: 'FORBIDDEN',
        code: '20104',
        message: `权限不足，需要角色: ${requiredRoles.join(' / ')}`,
      });
    }
  };
}

/**
 * Tenant validation decorator — must be used after jwtAuth
 */
export function requireTenant(paramName: string = 'tenantId') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        code: '20103',
        message: 'Authentication required',
      });
    }

    const requestTenantId = (request.params as Record<string, string>)?.[paramName];
    if (!requestTenantId) {
      return reply.code(400).send({
        success: false,
        error: 'TENANT_ID_REQUIRED',
        code: '20105',
        message: `请求中缺少租户 ID 参数: ${paramName}`,
      });
    }

    if (!user.tenantId || user.tenantId !== requestTenantId) {
      return reply.code(403).send({
        success: false,
        error: 'TENANT_MISMATCH',
        code: '20106',
        message: '无权访问其他租户的资源',
      });
    }
  };
}

export default jwtAuth;
