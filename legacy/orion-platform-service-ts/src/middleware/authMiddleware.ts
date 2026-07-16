/**
 * Authentication Hook — Backward Compatible with Unified Keys
 *
 * Fastify onRequest hook used by legacy routes (sso-routes.ts, etc.).
 * Now delegates to centralized JwtKeyManager and TokenBlacklistService.
 *
 * Phase 3.8.1: Uses JwtKeyManager instead of K8s env vars directly
 * Phase 3.8.2: Checks TokenBlacklistService for revoked tokens
 *
 * NOTE: New code should prefer jwtAuth from jwtAuth.ts middleware.
 *       This hook is kept for backward compatibility with existing route registrations.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { jwtKeyManager } from '../services/auth/JwtKeyManager';
import { createLogger } from '../utils/logger';

const logger = createLogger('auth-middleware');

/**
 * Reference to the shared TokenBlacklistService.
 * Set via initAuthMiddleware during bootstrap.
 */
let tokenBlacklist: any = null;

/**
 * Initialize the auth middleware with shared services.
 */
export function initAuthMiddleware(blacklistService: any): void {
  tokenBlacklist = blacklistService;
  logger.info('[AuthMiddleware] Initialized with TokenBlacklistService');
}

/**
 * Authentication hook - verifies JWT and attaches user to request.
 * Returns 401 if no token or invalid token is provided.
 */
export async function authenticateUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      code: 401,
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.split(' ')[1];

  // Phase 3.8.2: Check token blacklist
  if (tokenBlacklist) {
    try {
      const isBlacklisted = await tokenBlacklist.isRevoked(token);
      if (isBlacklisted) {
        return reply.code(401).send({
          code: 401,
          error: 'TOKEN_REVOKED',
          message: 'Token has been revoked',
        });
      }
    } catch (err) {
      // Fail-closed: if blacklist check fails, reject the request
      logger.error('[AuthMiddleware] Blacklist check failed, rejecting request:', err);
      return reply.code(503).send({
        code: 503,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Token validation service temporarily unavailable',
      });
    }
  }

  try {
    // Phase 3.8.1: Use centralized key manager with multi-key rotation support
    const decoded = jwtKeyManager.verifyWithAnyKey(token, (secret) => {
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
        userId: string;
        username: string;
        roles?: string[];
        role?: string;
      };
    });

    if (!decoded) {
      return reply.code(401).send({
        code: 401,
        error: 'INVALID_TOKEN',
        message: 'Token is invalid or expired',
      });
    }

    request.user = {
      userId: decoded.userId,
      username: decoded.username,
      roles: decoded.roles || (decoded.role ? [decoded.role] : []),
    };
  } catch (error) {
    return reply.code(401).send({
      code: 401,
      error: 'INVALID_TOKEN',
      message: 'Token is invalid or expired',
    });
  }
}
