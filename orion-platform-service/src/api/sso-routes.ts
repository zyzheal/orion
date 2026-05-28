/**
 * SSO/OIDC Routes
 *
 * Phase 3.8.3: SSO 认证中心完善
 * - 使用 JwtKeyManager 统一密钥管理
 * - SSO 回调中检查用户状态（terminated 拒绝登录）
 * - 集成 TokenBlacklistService
 *
 * Registers SSO authentication endpoints under /api/v1/auth/sso/*
 * - GET /auth/sso/login      — Redirect to SSO provider
 * - GET /auth/sso/callback   — Handle SSO callback, auto-provision user, issue JWT
 * - GET /auth/sso/status     — Check SSO configuration status
 * - GET /auth/sso/config     — Get SSO config details (for admin settings)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { SsoService, SsoStateStore } from '../services/auth/SsoService';
import { DatabasePool } from '../services/database';
import { RedisCache } from '../services/redis-cache';
import { jwtKeyManager } from '../services/auth/JwtKeyManager';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Redis-backed SSO state store — enables multi-instance SSO
 */
class RedisSsoStateStore implements SsoStateStore {
  constructor(private redis: RedisCache) {}
  async set(key: string, value: string, ttl: number): Promise<void> {
    await this.redis.set(key, value, ttl);
  }
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }
  async del(key: string): Promise<void> {
    await this.redis.delete(key);
  }
}

export interface SsoRouteOptions {
  database?: DatabasePool;
  redis?: RedisCache;
}

/**
 * Helper to execute DB queries safely
 */
async function dbQuery(
  database: DatabasePool | undefined,
  sql: string,
  params?: unknown[],
): Promise<any> {
  if (!database) {
    logger.warn('[SsoRoutes] Database not available:', sql.substring(0, 50));
    return null;
  }
  return database.query(sql, params);
}

export async function registerSsoRoutes(
  fastify: FastifyInstance,
  options: SsoRouteOptions = {},
): Promise<void> {
  const database = options.database;
  const stateStore = options.redis ? new RedisSsoStateStore(options.redis) : undefined;
  const ssoService = new SsoService(stateStore);

  // Initialize from environment variables
  const issuerUrl = process.env.SSO_ISSUER_URL;
  const ssoEnabled = (process.env.SSO_ENABLED || 'false').toLowerCase() === 'true';

  if (issuerUrl && ssoEnabled) {
    const scopes = process.env.SSO_SCOPES
      ? process.env.SSO_SCOPES.split(',').map((s) => s.trim())
      : undefined;

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const redirectUri =
      process.env.SSO_REDIRECT_URI || `${baseUrl}/api/v1/auth/sso/callback`;

    await ssoService.initialize({
      issuerUrl,
      clientId: process.env.SSO_CLIENT_ID || '',
      clientSecret: process.env.SSO_CLIENT_SECRET || '',
      redirectUri,
      scopes,
      enabled: true,
    });
  } else {
    fastify.log.info('[SsoRoutes] SSO not enabled (set SSO_ENABLED=true and SSO_ISSUER_URL)');
  }

  // ==================== Routes ====================

  /**
   * GET /api/v1/auth/sso/login
   * Redirect the browser to the SSO provider's authorization page.
   */
  fastify.get('/sso/login', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sso', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ssoService.isConfigured()) {
      return reply.status(400).send({
        success: false,
        error: 'SSO_NOT_CONFIGURED',
        message: 'SSO is not configured. Set SSO_ISSUER_URL, SSO_CLIENT_ID, and SSO_CLIENT_SECRET.',
      });
    }

    try {
      const loginUrl = await ssoService.getLoginUrl();
      return reply.redirect(loginUrl);
    } catch (error) {
      fastify.log.error(error, '[SsoRoutes] Failed to generate SSO login URL');
      return reply.status(500).send({
        success: false,
        error: 'SSO_LOGIN_ERROR',
        message: 'Failed to generate SSO login URL',
      });
    }
  });

  /**
   * GET /api/v1/auth/sso/callback
   * Handle the OAuth2 callback from the SSO provider.
   *
   * Phase 3.8.3: 检查用户状态，terminated 用户拒绝登录
   * Phase 3.8.1: 使用 JwtKeyManager 统一密钥
   */
  fastify.get('/sso/callback', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sso', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const query = request.query as Record<string, string> | undefined;
    const stateKey = query?.state;

    if (!stateKey) {
      fastify.log.warn('[SsoRoutes] SSO callback missing state parameter');
      return reply.redirect(`${frontendUrl}/login?error=sso_no_state`);
    }

    try {
      // Reconstruct the full URL for callback processing
      const fullUrl = new URL(
        `${request.protocol}://${request.hostname}${request.url}`,
      );

      const profile = await ssoService.handleCallback(fullUrl, stateKey);

      fastify.log.info(`[SsoRoutes] SSO login for user: ${profile.email} (${profile.sub})`);

      // Find or create user in local DB, including status check
      const result = await dbQuery(
        database,
        `SELECT id, email, name, role, sso_sub, status FROM users WHERE sso_sub = $1 OR email = $2`,
        [profile.sub, profile.email],
      );

      let user: { id: string; email: string; name: string; role: string; status: string; sso_sub?: string } | null = null;

      if (result && result.rows && result.rows.length > 0) {
        const foundUser = result.rows[0];
        if (foundUser) {
          user = foundUser;
          if (!foundUser.sso_sub) {
            await dbQuery(
              database,
              `UPDATE users SET sso_sub = $1 WHERE id = $2`,
              [profile.sub, foundUser.id],
            );
          }
        }
      }

      if (!user) {
        // Auto-provision a new user
        const userId = randomUUID();
        const platformRole =
          profile.roles && profile.roles.includes('admin') ? 'admin' : 'user';

        const insertResult = await dbQuery(
          database,
          `INSERT INTO users (id, email, name, sso_sub, role, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING id, email, name, role, status`,
          [userId, profile.email, profile.name, profile.sub, platformRole, 'active'],
        );

        if (insertResult && insertResult.rows && insertResult.rows.length > 0) {
          user = insertResult.rows[0];
        }

        if (!user) {
          throw new OrionError(ErrorCode.OPERATION_FAILED, 'Failed to auto-provision user');
        }

        fastify.log.info(`[SsoRoutes] Auto-provisioned user: ${user.email} (role: ${platformRole})`);
      }

      if (!user) {
        fastify.log.error('[SsoRoutes] User is null after lookup/provisioning');
        return reply.redirect(`${frontendUrl}/login?error=sso_user_error`);
      }

      // Phase 3.8.7: 检查用户状态，非 active 拒绝登录
      if (user.status === 'terminated' || user.status === 'deleted') {
        fastify.log.warn(`[SsoRoutes] Terminated user attempted SSO login: ${user.email}`);
        return reply.redirect(`${frontendUrl}/login?error=account_disabled`);
      }

      if (user.status === 'suspended') {
        fastify.log.warn(`[SsoRoutes] Suspended user attempted SSO login: ${user.email}`);
        return reply.redirect(`${frontendUrl}/login?error=account_suspended`);
      }

      // Phase 3.8.1: 使用 JwtKeyManager 获取密钥
      const jwtSecret = jwtKeyManager.getCurrentSecret();
      if (!jwtSecret) {
        fastify.log.error('[SsoRoutes] JWT_SECRET not set');
        return reply.redirect(`${frontendUrl}/login?error=jwt_not_configured`);
      }

      const accessToken = jwt.sign(
        { userId: user.id, username: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '5m' },
      );

      // Redirect to frontend with token in query param
      return reply.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
    } catch (error) {
      fastify.log.error(error, '[SsoRoutes] SSO callback error');
      return reply.redirect(`${frontendUrl}/login?error=sso_failed`);
    }
  });

  /**
   * GET /api/v1/auth/sso/status
   * Returns whether SSO is configured (for the login page to show/hide the SSO button).
   */
  fastify.get('/sso/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sso', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const configured = ssoService.isConfigured();
    const config = ssoService.getConfig();

    return reply.send({
      success: true,
      data: {
        ssoEnabled: configured,
        ssoIssuer: config?.issuerUrl || null,
        ssoScopes: config?.scopes || ['openid', 'email', 'profile'],
      },
    });
  });

  /**
   * GET /api/v1/auth/sso/config (admin-only)
   * Returns SSO configuration details for admin settings page.
   */
  fastify.get('/sso/config', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sso', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const config = ssoService.getConfig();

    if (!config) {
      return reply.send({
        success: true,
        data: { configured: false },
      });
    }

    return reply.send({
      success: true,
      data: {
        configured: true,
        issuerUrl: config.issuerUrl,
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scopes: config.scopes || ['openid', 'email', 'profile'],
        enabled: config.enabled,
      },
    });
  });
}
