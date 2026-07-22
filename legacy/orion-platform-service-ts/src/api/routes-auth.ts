/**
 * 认证路由 - Fastify 版本
 * 处理用户登录、登出、Token 刷新等
 *
 * Phase 3.8 改造：
 * - T-3.8.1: 使用 JwtKeyManager 统一密钥管理
 * - T-3.8.2: 集成 TokenBlacklistService
 * - T-3.8.4: 单点登出（广播 OrionBus 事件）
 * - T-3.8.7: 登录时检查用户状态（禁止 terminated 用户登录）
 *
 * Phase 2.19 改造：
 * - 登录时提取 tenant_id（请求头 X-Tenant-ID / 用户绑定租户）
 * - JWT token 中包含 tenant_id 信息
 * - tenant_id 传递给后续业务服务
 *
 * Password hashing: delegated to PasswordService (bcrypt-based, with backward
 * compatibility for PBKDF2/scrypt/SHA-256 legacy formats).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { DatabasePool } from '../services/database';
import { TokenBlacklistService } from '../services/auth/TokenBlacklistService';
import { jwtKeyManager } from '../services/auth/JwtKeyManager';
import { EventBusService } from '../services/event-bus-service';
import { createLogger } from '../utils/logger';
import { PasswordService } from '../services/auth/PasswordService';
import { MfaService } from '../services/auth/MfaService';
import { LoginAttemptService, DEFAULT_LOGIN_ATTEMPT_CONFIG } from '../services/auth/LoginAttemptService';
import { UserRepository } from '../services/user/UserRepository';

const logger = createLogger('routes-auth');

const passwordService = new PasswordService();

function getJwtSecret(): string {
  return jwtKeyManager.getCurrentSecret();
}

export interface AuthRouteOptions {
  database?: DatabasePool;
  tokenBlacklist?: TokenBlacklistService;
  eventBus?: EventBusService;
}

const ACCESS_TOKEN_EXPIRES_IN = '5m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

/**
 * 从请求中提取租户 ID
 * 优先顺序：请求头 X-Tenant-ID > JWT payload > 无
 */
function extractTenantIdFromHeader(request: FastifyRequest): string | undefined {
  const tenantHeader = request.headers['x-tenant-id'];
  return tenantHeader ? (Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader) : undefined;
}

/**
 * 查询用户绑定的租户列表
 */
async function findUserTenants(
  dbQuery: (sql: string, params?: any[]) => Promise<any>,
  userId: string,
): Promise<string[]> {
  const result = await dbQuery(
    'SELECT tenant_id FROM tenant_users WHERE user_id = $1',
    [userId],
  );
  return result?.rows?.map((r: any) => r.tenant_id) || [];
}

export default async function authRoutes(app: FastifyInstance, options: AuthRouteOptions = {}): Promise<void> {
  const database = options.database;
  const tokenBlacklist = options.tokenBlacklist;
  const eventBus = options.eventBus;

  async function dbQuery(sql: string, params?: any[]): Promise<any> {
    if (!database) {
      logger.warn('[AuthRoutes] Database not available:', sql.substring(0, 50));
      return null;
    }
    return database.query(sql, params);
  }

  /**
   * POST /api/v1/auth/register - 用户注册
   */
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any || {};
    const { username, password, email } = body;

    if (!username || !password) {
      return reply.status(400).send({
        success: false,
        error: 'USERNAME_OR_PASSWORD_REQUIRED',
        code: '30102',
        message: '用户名或密码不能为空',
      });
    }

    if (password.length < 8) {
      return reply.status(400).send({
        success: false,
        error: 'PASSWORD_TOO_SHORT',
        code: '30103',
        message: '密码长度至少为 8 位',
      });
    }

    const hashedPassword = await passwordService.hash(password);

    const existing = await dbQuery('SELECT id FROM users WHERE username = $1', [username]);
    if (existing && existing.rows?.length > 0) {
      return reply.status(409).send({
        success: false,
        error: 'USERNAME_EXISTS',
        code: '30104',
        message: '用户名已存在',
      });
    }

    const userId = crypto.randomUUID();

    await dbQuery(
      'INSERT INTO users (id, username, password_hash, email, role, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      [userId, username, hashedPassword, email || null, 'user'],
    );

    const tenantId = extractTenantIdFromHeader(request);
    if (tenantId) {
      const tenantCheck = await dbQuery('SELECT id FROM tenants WHERE id = $1', [tenantId]);
      if (tenantCheck?.rows?.length) {
        await dbQuery(
          'INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, $3)',
          [tenantId, userId, 'member'],
        );
        logger.info(`[AuthRoutes] User ${userId} auto-assigned to tenant ${tenantId}`);
      } else {
        logger.warn(`[AuthRoutes] Tenant ${tenantId} not found for auto-assignment`);
      }
    }

    return reply.status(201).send({
      success: true,
      message: '注册成功',
    });
  });

  /**
   * POST /api/v1/auth/login - 用户登录
   *
   * Task 5.3: 集成 LoginAttemptService（登录失败锁定）和 MfaService（MFA/2FA）
   */
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any || {};
    const { username, password } = body;

    if (!username || !password) {
      return reply.status(400).send({
        success: false,
        error: 'USERNAME_OR_PASSWORD_REQUIRED',
        code: '30102',
        message: '用户名或密码不能为空',
      });
    }

    const dbResult = await dbQuery(
      'SELECT id, username, password_hash, email, role, status FROM users WHERE username = $1',
      [username],
    );
    const user = dbResult?.rows?.[0];

    if (!user) {
      // Record failure for non-existent user (using a pseudo-userId)
      return reply.status(401).send({
        success: false,
        error: 'INVALID_CREDENTIALS',
        code: '20102',
        message: '用户名或密码错误',
      });
    }

    if (user.status === 'terminated' || user.status === 'deleted') {
      return reply.status(403).send({
        success: false,
        error: 'ACCOUNT_DISABLED',
        code: '20111',
        message: '账号已被禁用或注销，无法登录',
      });
    }

    if (user.status === 'suspended') {
      return reply.status(403).send({
        success: false,
        error: 'ACCOUNT_SUSPENDED',
        code: '20112',
        message: '账号暂时被冻结，请联系管理员',
      });
    }

    // Task 5.3: Check if account is locked before password verification
    const loginAttemptService = new LoginAttemptService(
      new UserRepository(database!),
      { ...DEFAULT_LOGIN_ATTEMPT_CONFIG },
    );
    const mfaService = new MfaService(new UserRepository(database!));

    if (await loginAttemptService.isLocked(user.id)) {
      const remainingMs = await loginAttemptService.getRemainingLockTime(user.id);
      const minutes = Math.ceil(remainingMs / 60000);
      return reply.status(403).send({
        success: false,
        error: 'ACCOUNT_LOCKED',
        code: '20115',
        message: `账户已锁定，请 ${minutes} 分钟后再试或联系管理员解锁`,
        data: { remainingLockTimeMs: remainingMs },
      });
    }

    const passwordValid = await passwordService.verifyPassword(user.password_hash, password);
    if (!passwordValid) {
      // Task 5.3: Record failed login attempt
      await loginAttemptService.recordFailure(user.id);

      const isNowLocked = await loginAttemptService.isLocked(user.id);
      if (isNowLocked) {
        return reply.status(403).send({
          success: false,
          error: 'ACCOUNT_LOCKED',
          code: '20115',
          message: '登录失败次数过多，账户已锁定，请 15 分钟后再试或联系管理员解锁',
        });
      }

      return reply.status(401).send({
        success: false,
        error: 'INVALID_CREDENTIALS',
        code: '20102',
        message: '用户名或密码错误',
      });
    }

    // Task 5.3: Record successful login attempt
    await loginAttemptService.recordSuccess(user.id);

    // Task 5.3: Check if MFA is enabled for this user
    const mfaRequired = await mfaService.isMfaEnabled(user.id);

    const requestedTenantId = extractTenantIdFromHeader(request);
    const userTenants = await findUserTenants(dbQuery, user.id);

    let effectiveTenantId: string | null = null;

    if (userTenants.length > 0) {
      if (requestedTenantId) {
        if (!userTenants.includes(requestedTenantId)) {
          return reply.status(403).send({
            success: false,
            error: 'TENANT_ACCESS_DENIED',
            code: '20113',
            message: '用户无权访问指定的租户',
          });
        }
        effectiveTenantId = requestedTenantId;
      } else if (userTenants.length === 1) {
        effectiveTenantId = userTenants[0];
      } else {
        return reply.status(400).send({
          success: false,
          error: 'MULTIPLE_TENANTS_REQUIRED',
          code: '20114',
          message: '用户属于多个租户，请通过 X-Tenant-ID 请求头指定',
          data: { tenants: userTenants },
        });
      }
    }

    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return reply.status(500).send({ error: 'JWT_NOT_CONFIGURED', message: 'JWT_SECRET not configured' });
    }

    // Task 5.3: If MFA is required, return MFA challenge instead of full tokens
    if (mfaRequired) {
      const mfaTokenPayload: Record<string, unknown> = {
        sub: user.id,
        username: user.username,
        role: user.role,
        roles: [user.role],
        mfa: true, // Mark as MFA challenge token
      };
      if (effectiveTenantId) {
        mfaTokenPayload.tenant_id = effectiveTenantId;
      }

      const mfaToken = jwt.sign(mfaTokenPayload, jwtSecret, { expiresIn: '5m' });

      return reply.send({
        success: true,
        data: {
          mfaRequired: true,
          mfaToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          },
        },
        message: 'MFA verification required',
      });
    }

    const accessTokenPayload: Record<string, unknown> = {
      sub: user.id,
      username: user.username,
      role: user.role,
      roles: [user.role],
    };
    if (effectiveTenantId) {
      accessTokenPayload.tenant_id = effectiveTenantId;
    }

    const accessToken = jwt.sign(
      accessTokenPayload,
      jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await dbQuery(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, tenant_id) VALUES ($1, $2, $3, $4)',
      [user.id, refreshTokenHash, expiresAt, effectiveTenantId],
    );

    await dbQuery(
      'INSERT INTO user_status_history (user_id, old_status, new_status, reason, operator_id, changed_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      [user.id, user.status, 'active', 'login', user.id],
    );

    logger.info(`[AuthRoutes] User login: ${user.username} (${user.id}) tenant=${effectiveTenantId || 'none'}`);

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + 5 * 60 * 1000,
        tenantId: effectiveTenantId,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=1890ff&color=fff`,
        },
      },
    });
  });

  /**
   * POST /api/v1/auth/logout - 用户登出
   */
  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any || {};
    const { refreshToken, accessToken, userId } = body;

    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await dbQuery('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
    }

    if (accessToken && tokenBlacklist) {
      try {
        const decoded = jwt.decode(accessToken) as { sub?: string; exp?: number; tenant_id?: string | number } | null;
        const revokeUserId = decoded?.sub || userId;
        const tenantId = decoded?.tenant_id || 0;
        if (revokeUserId && decoded?.exp) {
          const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
          await tokenBlacklist.revokeToken(
            accessToken,
            revokeUserId,
            tenantId as unknown as number,
            'logout',
          );
          logger.info(`[AuthRoutes] Access token blacklisted: user=${revokeUserId} tenant=${tenantId} TTL=${ttl}s`);
        }
      } catch (error: unknown) {
        logger.warn('[AuthRoutes] Failed to blacklist access token:', error);
      }
    }

    if (eventBus) {
      try {
        const decoded = jwt.decode(accessToken || '') as { sub?: string; tenant_id?: string } | null;
        await eventBus.publish('auth:user:logout', {
          user_id: userId || decoded?.sub,
          tenant_id: decoded?.tenant_id || null,
          timestamp: new Date().toISOString(),
          reason: 'user_logout',
        });
        logger.info('[AuthRoutes] Logout event broadcast via OrionBus');
      } catch (err) {
        logger.warn('[AuthRoutes] Failed to broadcast logout event:', err);
      }
    }

    return reply.send({
      success: true,
      message: '登出成功',
    });
  });

  /**
   * POST /api/v1/auth/refresh - 刷新 Token
   */
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any || {};
    const { refreshToken } = body;

    if (!refreshToken) {
      return reply.status(400).send({
        success: false,
        error: 'REFRESH_TOKEN_REQUIRED',
        code: '30102',
        message: '刷新 Token 不能为空',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const result = await dbQuery(
      'SELECT rt.user_id, rt.tenant_id, u.username, u.role, u.status FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1 AND rt.expires_at > NOW()',
      [tokenHash],
    );

    const row = result?.rows?.[0];
    if (!row) {
      return reply.status(401).send({
        success: false,
        error: 'INVALID_OR_EXPIRED_REFRESH_TOKEN',
        code: '20105',
        message: '刷新 Token 无效或已过期',
      });
    }

    if (row.status === 'terminated' || row.status === 'deleted') {
      await dbQuery('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
      return reply.status(403).send({
        success: false,
        error: 'ACCOUNT_DISABLED',
        code: '20111',
        message: '账号已被禁用，无法刷新 Token',
      });
    }

    if (row.status === 'suspended') {
      await dbQuery('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
      return reply.status(403).send({
        success: false,
        error: 'ACCOUNT_SUSPENDED',
        code: '20112',
        message: '账号暂时被冻结，无法刷新 Token',
      });
    }

    await dbQuery('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);

    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return reply.status(500).send({ error: 'JWT_NOT_CONFIGURED', message: 'JWT_SECRET not configured' });
    }

    const newAccessTokenPayload: Record<string, unknown> = {
      sub: row.user_id,
      username: row.username,
      role: row.role,
      roles: [row.role],
    };
    if (row.tenant_id) {
      newAccessTokenPayload.tenant_id = row.tenant_id;
    }

    const newAccessToken = jwt.sign(
      newAccessTokenPayload,
      jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
    );

    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await dbQuery(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, tenant_id) VALUES ($1, $2, $3, $4)',
      [row.user_id, newTokenHash, newExpiresAt, row.tenant_id],
    );

    return reply.send({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Date.now() + 5 * 60 * 1000,
        tenantId: row.tenant_id || null,
      },
    });
  });

  /**
   * GET /api/v1/auth/me - 获取当前用户信息
   */
  app.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        code: '20103',
        message: '未授权',
      });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return reply.status(500).send({ error: 'JWT_NOT_CONFIGURED', message: 'JWT_SECRET not configured' });
    }

    try {
      // Use centralized multi-key verification to support key rotation
      // (tokens signed with previous keys remain valid during overlap period)
      const decoded = jwtKeyManager.verifyWithAnyKey<{ sub: string; tenant_id?: string }>(token, (secret) => {
        return jwt.verify(token, secret, { algorithms: ['HS256'] }) as { sub: string; tenant_id?: string };
      });

      if (!decoded) {
        return reply.status(401).send({
          success: false,
          error: 'INVALID_TOKEN',
          code: '20102',
          message: 'Token 无效',
        });
      }

      const result = await dbQuery(
        'SELECT id, username, email, role, status FROM users WHERE id = $1',
        [decoded.sub],
      );
      const user = result?.rows?.[0];

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'USER_NOT_FOUND',
          code: '30201',
          message: '用户不存在',
        });
      }

      const userTenants = await findUserTenants(dbQuery, user.id);

      return reply.send({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status || 'active',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=1890ff&color=fff`,
          tenants: userTenants,
          currentTenantId: (decoded as any).tenant_id || null,
        },
      });
    } catch (error) {
      return reply.status(401).send({
        success: false,
        error: 'INVALID_TOKEN',
        code: '20102',
        message: 'Token 无效',
      });
    }
  });

  app.addHook('onClose', async () => {
    if (tokenBlacklist) {
      await tokenBlacklist.disconnect();
    }
  });
}
