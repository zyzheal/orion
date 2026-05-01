/**
 * 认证路由 — 代理到 Platform Service
 *
 * 所有认证请求转发到 Platform Service 的 PostgreSQL-backed auth，
 * 不再使用本地 mock 用户数据库。
 *
 * - POST /api/v1/auth/login - 用户登录
 * - POST /api/v1/auth/refresh - 刷新 Token
 * - POST /api/v1/auth/logout - 用户登出
 * - GET /api/v1/auth/me - 获取当前用户信息
 * - POST /api/v1/auth/register - 用户注册
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const PLATFORM_SERVICE_URL = process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001';

export class AuthRoutes {
  constructor(private app: FastifyInstance) {
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.registerLoginRoute();
    this.registerRefreshRoute();
    this.registerLogoutRoute();
    this.registerMeRoute();
    this.registerRegisterRoute();
  }

  /**
   * POST /api/v1/auth/login — 代理到 Platform Service
   */
  private registerLoginRoute(): void {
    this.app.post('/api/v1/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: login failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }

  /**
   * POST /api/v1/auth/refresh — 代理到 Platform Service
   */
  private registerRefreshRoute(): void {
    this.app.post('/api/v1/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: refresh failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }

  /**
   * POST /api/v1/auth/logout — 代理到 Platform Service
   */
  private registerLogoutRoute(): void {
    this.app.post('/api/v1/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: logout failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }

  /**
   * GET /api/v1/auth/me — 代理到 Platform Service
   */
  private registerMeRoute(): void {
    this.app.get('/api/v1/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': request.headers.authorization as string,
          },
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: me failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }

  /**
   * POST /api/v1/auth/register — 代理到 Platform Service
   */
  private registerRegisterRoute(): void {
    this.app.post('/api/v1/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const response = await fetch(`${PLATFORM_SERVICE_URL}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

        const data = await response.json();
        return reply.code(response.status).send(data);
      } catch (error) {
        this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Auth proxy: register failed');
        return reply.code(502).send({
          error: 'UPSTREAM_ERROR',
          message: 'Authentication service unavailable',
        });
      }
    });
  }
}
