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
import pino from 'pino';
import { DatabasePool } from '../services/database';
import { ldapService } from '../services/auth/LdapService';
import { wechatWorkService } from '../services/auth/WechatWorkService';
import { SsoService } from '../services/auth/SsoService';
import { RedisCache } from '../services/redis-cache';
import { TokenBlacklistService } from '../services/auth/TokenBlacklistService';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const JWT_SECRET = process.env.JWT_SECRET || 'orion-dev-secret-key-change-in-prod';
const ACCESS_TOKEN_EXPIRES_IN = '5m';

interface SsoRoutesOptions {
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
      console.warn('[SsoUnifiedRoutes] Database not available');
      return null;
    }
    return database.query(sql, params);
  }

  /**
   * Issue JWT token for authenticated user
   */
  function issueToken(user: { userId: string; username: string; email: string; name: string; roles: string[] }): {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: typeof user;
  } {
    const jwtSecret = JWT_SECRET;
    const accessToken = jwt.sign(
      { userId: user.userId, username: user.username, email: user.email, roles: user.roles },
      jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Store refresh token in database
    dbQuery(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.userId, refreshTokenHash, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    ).catch((err) => console.error('[SsoUnifiedRoutes] Failed to store refresh token:', err));

    return { accessToken, refreshToken, expiresAt, user };
  }

  /**
   * Find or create local user from SSO profile
   */
  async function findOrCreateUser(profile: {
    username: string;
    email: string;
    name: string;
    roles?: string[];
  }): Promise<{ userId: string; username: string; email: string; name: string; roles: string[] }> {
    // Check if user exists
    const existing = await dbQuery(
      'SELECT id, username, email, role FROM users WHERE username = $1 OR email = $2',
      [profile.username, profile.email]
    );

    if (existing?.rows?.length > 0) {
      const user = existing.rows[0];
      return {
        userId: user.id,
        username: user.username,
        email: user.email,
        name: profile.name,
        roles: [user.role || 'user'],
      };
    }

    // Create new user
    const userId = crypto.randomUUID();
    await dbQuery(
      'INSERT INTO users (id, username, email, role, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [userId, profile.username, profile.email, 'user']
    );

    return {
      userId,
      username: profile.username,
      email: profile.email,
      name: profile.name,
      roles: ['user'],
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
      return reply.status(500).send({ error: 'LIST_ERROR', message });
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
        return reply.status(400).send({
          error: 'MISSING_CREDENTIALS',
          message: '用户名和密码不能为空',
        });
      }

      const profile = await ldapService.authenticate(username, password);
      if (!profile) {
        return reply.status(401).send({
          error: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误',
        });
      }

      const localUser = await findOrCreateUser({
        username: profile.username,
        email: profile.email,
        name: profile.name,
      });

      const tokens = issueToken(localUser);
      return reply.send({ success: true, data: tokens });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'LDAP_LOGIN_ERROR';
      return reply.status(500).send({ error: 'LDAP_LOGIN_ERROR', message });
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
            return reply.status(400).send({ error: 'SSO_DISABLED', message: '企业微信 SSO 未启用' });
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
            return reply.status(400).send({ error: 'SSO_DISABLED', message: 'OIDC SSO 未启用' });
          }

          await ssoService.initialize(ssoConfig);
          const { url, stateKey } = await ssoService.getAuthorizationUrl();

          return reply.redirect(url);
        }

        default:
          return reply.status(400).send({
            error: 'UNSUPPORTED_PROVIDER',
            message: `不支持的 SSO 提供商: ${provider}`,
          });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'SSO_LOGIN_ERROR';
      return reply.status(500).send({ error: 'SSO_LOGIN_ERROR', message });
    }
  });

  /**
   * GET /api/v1/auth/sso/callback/:provider - Handle SSO callback
   */
  app.get('/callback/:provider', async (request: FastifyRequest, reply: FastifyReply) => {
    const { provider } = request.params as { provider: string };
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      return reply.status(400).send({
        error: 'SSO_CALLBACK_ERROR',
        message: `SSO 授权失败: ${query.error}`,
      });
    }

    if (!query.code || !query.state) {
      return reply.status(400).send({
        error: 'MISSING_PARAMS',
        message: '缺少 code 或 state 参数',
      });
    }

    try {
      // Validate state
      const stateResult = await dbQuery(
        'SELECT id FROM sso_states WHERE state = $1 AND provider = $2 AND expires_at > NOW()',
        [query.state, provider]
      );

      if (!stateResult?.rows?.length) {
        return reply.status(400).send({
          error: 'INVALID_STATE',
          message: '无效的 state 参数，可能已过期',
        });
      }

      // Clean up state
      await dbQuery('DELETE FROM sso_states WHERE state = $1', [query.state]);

      switch (provider) {
        case 'wechat': {
          const localUser = await wechatWorkService.handleCallback(query.code);
          const tokens = issueToken(localUser);

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

          const tokens = issueToken(localUser);
          const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${tokens.accessToken}`;
          return reply.redirect(frontendUrl);
        }

        default:
          return reply.status(400).send({
            error: 'UNSUPPORTED_PROVIDER',
            message: `不支持的 SSO 提供商: ${provider}`,
          });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'SSO_CALLBACK_ERROR';
      logger.error('[SsoUnifiedRoutes] SSO callback error:', error);
      return reply.status(500).send({ error: 'SSO_CALLBACK_ERROR', message });
    }
  });
}
