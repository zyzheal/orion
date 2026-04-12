/**
 * 认证路由 - Fastify 插件版本
 * 处理用户登录、登出、Token 刷新等
 */

import { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'orion-dev-secret-key-change-in-prod';
const JWT_EXPIRES_IN = '24h';

// 模拟用户数据库
const MOCK_USERS = [
  { id: '1', username: 'admin', password: 'admin123', email: 'admin@orion.com', role: 'admin' },
  { id: '2', username: 'user', password: 'user123', email: 'user@orion.com', role: 'user' },
];

const authRoutesPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
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

    // 查找用户
    const user = MOCK_USERS.find((u) => u.username === username && u.password === password);

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'INVALID_CREDENTIALS',
        code: '20102',
        message: '用户名或密码错误',
      });
    }

    // 生成 Token
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 小时

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresAt,
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
    // 在实际实现中，这里会将 token 加入黑名单
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

    // 在实际实现中，这里会验证 refreshToken 并生成新的 accessToken
    const accessToken = jwt.sign(
      { userId: '1', username: 'refreshed', role: 'user' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
    });
  });

  /**
   * GET /api/v1/auth/me - 获取当前用户信息
   */
  app.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    // 从 token 中解析用户信息
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
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };

      const user = MOCK_USERS.find((u) => u.id === payload.userId);
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
};

export const registerAuthRoutes = fp(authRoutesPlugin, {
  name: 'orion-auth-routes',
});