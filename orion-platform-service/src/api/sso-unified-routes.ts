/**
 * Unified SSO Authentication Routes
 *
 * Provides unified SSO login endpoints that consolidate all authentication providers:
 *   - Local username/password (existing)
 *   - OIDC (SsoService)
 *   - LDAP (LdapService)
 *   - WeChat Work (WechatWorkService)
 *
 * Routes:
 *   GET    /api/v1/auth/sso/login/:provider    - Redirect to SSO provider
 *   GET    /api/v1/auth/sso/callback/:provider  - Handle SSO callback
 *   POST   /api/v1/auth/sso/ldap                - LDAP direct login
 *   GET    /api/v1/auth/sso/providers-enabled   - List enabled providers (public)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { DatabasePool } from '../services/database';
import { ldapService } from '../services/auth/LdapService';
import { wechatWorkService } from '../services/auth/WechatWorkService';
import { SsoService } from '../services/auth/SsoService';
import { RedisCache } from '../services/redis-cache';
import { jwtKeyManager } from '../services/auth/JwtKeyManager';
import { TokenBlacklistService } from '../services/auth/TokenBlacklistService';
import { OrionError, ValidationError, UnauthorizedError, ForbiddenError, ErrorCode, handleError } from '../errors';

const logger = createLogger('sso-unified');
const ACCESS_TOKEN_EXPIRES_IN = '5m';

export interface SsoRoutesOptions {
  database?: DatabasePool;
  redis?: RedisCache;
  tokenBlacklist?: TokenBlacklistService;
}

interface SsoProviderInfo {
  name: string;
  type: string;
  display_name: string;
  display_icon?: string;
}

export default async function ssoUnifiedRoutes(
  app: FastifyInstance,
  options: SsoRoutesOptions
): Promise<void> {
  const database = options.database;

  async function dbQuery(sql: string, params?: any[]): Promise<any> {
    if (!database) {
      logger.warn('[SsoUnifiedRoutes] Database not available');
      return null;
    }
    return database.query(sql, params);
  }

  /**
   * Issue JWT token for authenticated user
   */
  async function issueToken(user: { userId: string; username: string; email: string; name: string; roles: string[] }): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: typeof user;
  }> {
    const jwtSecret = jwtKeyManager.getCurrentSecret();
    const accessToken = jwt.sign(
      { sub: user.userId, username: user.username, email: user.email, roles: user.roles },
      jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Task 2.20: Resolve tenant_id for SSO refresh token
    let tenantId: string | null = null;
    const tenantResult = await dbQuery(
      'SELECT tenant_id FROM tenant_users WHERE user_id = $1 LIMIT 1',
      [user.userId]
    );
    if (tenantResult?.rows?.length > 0) {
      tenantId = tenantResult.rows[0].tenant_id;
    }

    dbQuery(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, tenant_id) VALUES ($1, $2, $3, $4)',
      [user.userId, refreshTokenHash, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), tenantId]
    ).catch((err) => logger.error('[SsoUnifiedRoutes] Failed to store refresh token:', err));

    return { accessToken, refreshToken, expiresAt, user };
  }

  /**
   * Find or create local user from SSO profile
   * Phase 3.8.7: Returns user status alongside other fields
   */
  async function findOrCreateUser(profile: {
    username: string;
    email: string;
    name: string;
    roles?: string[];
    source?: string;
  }): Promise<{ userId: string; username: string; email: string; name: string; roles: string[]; status: string }> {
    // Determine roles: for LDAP, fetch groups and map them to local roles
    let resolvedRoles = profile.roles;
    if (!resolvedRoles && profile.source === 'ldap') {
      const ldapGroups = await ldapService.getUserGroups(profile.username);
      if (ldapGroups.length > 0) {
        // Map LDAP group CNs to local role names
        resolvedRoles = ldapGroups.map((cn) => `ldap:${cn}`);
      } else {
        resolvedRoles = ['user'];
      }
    }

    // Check if user exists
    const existing = await dbQuery(
      'SELECT id, username, email, role, status FROM users WHERE username = $1 OR email = $2',
      [profile.username, profile.email]
    );

    if (existing?.rows?.length > 0) {
      const user = existing.rows[0];
      return {
        userId: user.id,
        username: user.username,
        email: user.email,
        name: profile.name,
        roles: resolvedRoles || [user.role || 'user'],
        status: user.status || 'active',
      };
    }

    // Create new user
    const userId = crypto.randomUUID();
    await dbQuery(
      'INSERT INTO users (id, username, email, role, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      [userId, profile.username, profile.email, resolvedRoles?.[0] || 'user', 'active']
    );

    return {
      userId,
      username: profile.username,
      email: profile.email,
      name: profile.name,
      roles: resolvedRoles || ['user'],
      status: 'active',
    };
  }

  /**
   * GET /api/v1/auth/sso/providers-enabled - List enabled SSO providers (public, no auth required)
   */
  app.get('/providers-enabled', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const providers: SsoProviderInfo[] = [];

      // Query database for configured providers
      const result = await dbQuery(
        'SELECT name, type, display_name, display_icon FROM sso_providers WHERE enabled = true ORDER BY name'
      );

      if (result?.rows) {
        providers.push(...result.rows);
      }

      // Also check environment-configured providers
      if (ldapService.isConnected()) {
        providers.push({
          name: 'ldap',
          type: 'ldap',
          display_name: 'LDAP 登录',
          display_icon: 'lock',
        });
      }

      if (wechatWorkService.isEnabled()) {
        providers.push({
          name: 'wechat',
          type: 'wechat',
          display_name: '企业微信登录',
          display_icon: 'wechat',
        });
      }

      return reply.send({
        success: true,
        data: providers,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return handleError(reply, new OrionError('LIST_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  /**
   * POST /api/v1/auth/sso/ldap - LDAP direct login
   */
  app.post('/ldap', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { username: string; password: string };
      const { username, password } = body;

      if (!username || !password) {
        return handleError(reply, new ValidationError('MISSING_CREDENTIALS'))
      }

      const profile = await ldapService.authenticate(username, password);
      if (!profile) {
        return handleError(reply, new UnauthorizedError('INVALID_CREDENTIALS'))
      }

      const localUser = await findOrCreateUser({
        username: profile.username,
        email: profile.email,
        name: profile.name,
        source: 'ldap',
        roles: profile.groups?.length ? profile.groups.map((g) => `ldap:${g}`) : undefined,
      });

      const tokens = await issueToken(localUser);
      return reply.send({ success: true, data: tokens });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'LDAP_LOGIN_ERROR';
      return handleError(reply, new OrionError('LDAP_LOGIN_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  /**
   * GET /api/v1/auth/sso/login/:provider - Redirect to SSO provider authorization
   */
  app.get('/login/:provider', async (request: FastifyRequest, reply: FastifyReply) => {
    const { provider } = request.params as { provider: string };

    try {
      switch (provider) {
        case 'wechat': {
          if (!wechatWorkService.isEnabled()) {
            return handleError(reply, new ValidationError('SSO_DISABLED'));
          }

          const state = wechatWorkService.generateState();
          const redirectUri = `${process.env.BASE_URL || 'http://localhost:3001'}/api/v1/auth/sso/callback/wechat`;
          const authUrl = wechatWorkService.getAuthorizationUrl(redirectUri, state);

          // Store state for callback validation
          await dbQuery(
            'INSERT INTO sso_states (state, provider, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'10 minutes\')',
            [state, 'wechat']
          );

          return reply.redirect(authUrl);
        }

        case 'oidc': {
          const ssoService = new SsoService();
          const ssoConfig = {
            issuerUrl: process.env.SSO_ISSUER_URL || '',
            clientId: process.env.SSO_CLIENT_ID || '',
            clientSecret: process.env.SSO_CLIENT_SECRET || '',
            redirectUri: process.env.SSO_REDIRECT_URI || '/api/v1/auth/sso/callback/oidc',
            scopes: process.env.SSO_SCOPES?.split(',') || ['openid', 'email', 'profile'],
            enabled: process.env.SSO_ENABLED === 'true',
          };

          if (!ssoConfig.enabled) {
            return handleError(reply, new ValidationError('SSO_DISABLED'));
          }

          await ssoService.initialize(ssoConfig);
          const { url, stateKey } = await ssoService.getAuthorizationUrl();

          return reply.redirect(url);
        }

        default:
        return handleError(reply, new ValidationError('UNSUPPORTED_PROVIDER'))
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'SSO_LOGIN_ERROR';
      return handleError(reply, new OrionError('SSO_LOGIN_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  /**
   * GET /api/v1/auth/sso/callback/:provider - Handle SSO callback
   */
  app.get('/callback/:provider', async (request: FastifyRequest, reply: FastifyReply) => {
    const { provider } = request.params as { provider: string };
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      return handleError(reply, new ValidationError('SSO_CALLBACK_ERROR'))
    }

    if (!query.code || !query.state) {
      return handleError(reply, new ValidationError('MISSING_PARAMS'))
    }

    try {
      // Validate state
      const stateResult = await dbQuery(
        'SELECT id FROM sso_states WHERE state = $1 AND provider = $2 AND expires_at > NOW()',
        [query.state, provider]
      );

      if (!stateResult?.rows?.length) {
        return handleError(reply, new ValidationError('INVALID_STATE'))
      }

      // Clean up state
      await dbQuery('DELETE FROM sso_states WHERE state = $1', [query.state]);

      switch (provider) {
        case 'wechat': {
          const localUser = await wechatWorkService.handleCallback(query.code);

          // Phase 3.8.7: Check user status before issuing token
          if (localUser.userId.startsWith('wechat_')) {
            const statusCheck = await dbQuery(
              'SELECT status FROM users WHERE id = $1 OR username = $2',
              [localUser.userId, localUser.username]
            );
            if (statusCheck?.rows?.[0]?.status === 'terminated' || statusCheck?.rows?.[0]?.status === 'deleted') {
              return handleError(reply, new ForbiddenError('ACCOUNT_DISABLED'))
            }
            if (statusCheck?.rows?.[0]?.status === 'suspended') {
              return handleError(reply, new ForbiddenError('ACCOUNT_SUSPENDED'))
            }
          }

          const tokens = await issueToken(localUser);

          // Redirect to frontend with token
          const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${tokens.accessToken}`;
          return reply.redirect(frontendUrl);
        }

        case 'oidc': {
          const ssoService = new SsoService();
          const ssoConfig = {
            issuerUrl: process.env.SSO_ISSUER_URL || '',
            clientId: process.env.SSO_CLIENT_ID || '',
            clientSecret: process.env.SSO_CLIENT_SECRET || '',
            redirectUri: process.env.SSO_REDIRECT_URI || '/api/v1/auth/sso/callback/oidc',
            scopes: process.env.SSO_SCOPES?.split(',') || ['openid', 'email', 'profile'],
            enabled: process.env.SSO_ENABLED === 'true',
          };

          await ssoService.initialize(ssoConfig);
          const currentUrl = new URL(`${request.protocol}://${request.hostname}${request.url}`);
          const profile = await ssoService.handleCallback(currentUrl, query.state);

          const localUser = await findOrCreateUser({
            username: profile.sub,
            email: profile.email,
            name: profile.name,
          });

          // Phase 3.8.7: 检查用户状态
          if (localUser.status === 'terminated' || localUser.status === 'deleted') {
            return handleError(reply, new ForbiddenError('ACCOUNT_DISABLED'))
          }
          if (localUser.status === 'suspended') {
            return handleError(reply, new ForbiddenError('ACCOUNT_SUSPENDED'))
          }

          const tokens = await issueToken(localUser);
          const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${tokens.accessToken}`;
          return reply.redirect(frontendUrl);
        }

        default:
        return handleError(reply, new ValidationError('UNSUPPORTED_PROVIDER'))
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'SSO_CALLBACK_ERROR';
      logger.error('[SsoUnifiedRoutes] SSO callback error:', error);
      return handleError(reply, new OrionError('SSO_CALLBACK_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });
}
