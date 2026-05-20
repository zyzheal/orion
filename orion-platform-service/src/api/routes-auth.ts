/**
 * 认证路由 - Fastify 版本（不使用 fp 以支持 prefix）
 * 处理用户登录、登出、Token 刷新等
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { DatabasePool } from '../services/database';

const scryptAsync = promisify(scrypt);

// JWT_SECRET from environment variable, with dev fallback
const JWT_SECRET: string = process.env.JWT_SECRET || 'orion-dev-secret-key-change-in-prod';

function getJwtSecret(): string | null {
  return JWT_SECRET || null;
}

export interface AuthRouteOptions {
  database?: DatabasePool;
}

const ACCESS_TOKEN_EXPIRES_IN = '5m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Password hashing utility
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(storedPassword: string, suppliedPassword: string): Promise<boolean> {
  const [salt, key] = storedPassword.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const suppliedHash = (await scryptAsync(suppliedPassword, salt, 64)) as Buffer;
  return timingSafeEqual(keyBuffer, suppliedHash);
}

export default async function authRoutes(app: FastifyInstance, options: AuthRouteOptions = {}): Promise<void> {
  const database = options.database;

  /**
   * Helper to execute DB queries safely
   */
  async function dbQuery(sql: string, params?: any[]): Promise<any> {
    if (!database) {
      console.warn('[AuthRoutes] Database not available:', sql.substring(0, 50));
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

    const hashedPassword = await hashPassword(password);

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
      [userId, username, hashedPassword, email || null, 'user']
    );

    return reply.status(201).send({
      success: true,
      message: '注册成功',
    });
  });

  /**
   * POST /api/v1/auth/login - 用户登录
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

    const dbResult = await dbQuery('SELECT id, username, password_hash, email, role FROM users WHERE username = $1', [username]);
    const user = dbResult?.rows?.[0];

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'INVALID_CREDENTIALS',
        code: '20102',
        message: '用户名或密码错误',
      });
    }

    const passwordValid = await verifyPassword(user.password_hash, password);
    if (!passwordValid) {
      return reply.status(401).send({
        success: false,
        error: 'INVALID_CREDENTIALS',
        code: '20102',
        message: '用户名或密码错误',
      });
    }

    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return reply.status(500).send({ error: 'JWT_NOT_CONFIGURED', message: 'JWT_SECRET not configured' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, roles: [user.role] },
      jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await dbQuery(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshTokenHash, expiresAt]
    );

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + 5 * 60 * 1000,
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
    const { refreshToken } = body;

    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await dbQuery('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
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
      'SELECT rt.user_id, u.username, u.role FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1 AND rt.expires_at > NOW()',
      [tokenHash]
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

    await dbQuery('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);

    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return reply.status(500).send({ error: 'JWT_NOT_CONFIGURED', message: 'JWT_SECRET not configured' });
    }

    const newAccessToken = jwt.sign(
      { userId: row.user_id, username: row.username, role: row.role, roles: [row.role] },
      jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await dbQuery(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [row.user_id, newTokenHash, newExpiresAt]
    );

    return reply.send({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Date.now() + 5 * 60 * 1000,
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
      const payload = jwt.verify(token, jwtSecret) as { userId: string; username: string; role: string };

      const result = await dbQuery('SELECT id, username, email, role FROM users WHERE id = $1', [payload.userId]);
      const user = result?.rows?.[0];

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'USER_NOT_FOUND',
          code: '30201',
          message: '用户不存在',
        });
      }

      return reply.send({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=1890ff&color=fff`,
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
}
