/**
 * JWT 认证中间件
 *
 * 验证请求中的 JWT token，支持多种传递方式：
 * - Authorization: Bearer <token>
 * - X-API-Key 头部
 * - Query 参数 ?token=
 *
 * 公开路径包含两类：
 * 1. 静态白名单（系统路径）
 * 2. 动态白名单（子应用路由，从平台服务动态获取）
 *
 * Phase 4.1/4.2: Integrated token blacklist checking via shared Redis
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getConfig } from '../config';
import { getSubAppRoutePrefixes } from '../services/gateway-route-sync';
import { tokenBlacklistChecker, TokenBlacklistChecker } from '../services/token-blacklist-checker';

export interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthContext {
  authenticated: boolean;
  user?: JwtPayload;
  token?: string;
}

// 声明 Fastify 请求扩展
declare module 'fastify' {
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}

export class AuthMiddleware {
  private staticPaths: string[] = [
    '/healthz',
    '/readyz',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/swagger',
    '/favicon.ico',
  ];
  private blacklistChecker: TokenBlacklistChecker;

  constructor(private app: FastifyInstance) {
    this.blacklistChecker = tokenBlacklistChecker;
  }

  /**
   * Set Redis client for token blacklist checking
   * Must be called during app initialization after Redis is connected
   */
  setRedisClient(redisClient: any): void {
    if (redisClient) {
      this.blacklistChecker.setRedisClient(redisClient);
    }
  }

  /**
   * 添加公开路径（不需要认证）
   */
  addPublicPath(path: string): void {
    this.staticPaths.push(path);
  }

  /**
   * 检查路径是否需要认证
   * 同时检查静态路径和动态注册的子应用路由
   */
  private isPublicPath(url: string): boolean {
    // 1. 检查静态白名单
    if (this.staticPaths.some((path) => url.startsWith(path))) {
      return true;
    }
    // 2. 检查动态子应用路由白名单（从平台服务获取）
    const subAppPrefixes = getSubAppRoutePrefixes();
    for (const prefix of subAppPrefixes) {
      if (url.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 提取 JWT token
   */
  private extractToken(request: FastifyRequest): string | null {
    // 1. 从 Authorization 头部提取
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 2. 从 X-API-Key 头部提取
    const apiKey = request.headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string') {
      return apiKey;
    }

    // 3. 从 Query 参数提取
    const queryToken = (request.query as any)?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  /**
   * 验证 JWT token
   */
  private async verifyToken(token: string): Promise<JwtPayload> {
    const config = getConfig();

    try {
      // 使用 @fastify/jwt 进行验证
      const decoded = await this.app.jwt.verify(token);
      return decoded as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * 认证中间件处理器
   */
  async handler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const url = request.raw.url || '';

    // 公开路径（静态+动态子应用路由）跳过认证
    if (this.isPublicPath(url)) {
      request.authContext = { authenticated: false };
      return;
    }

    // 提取 token
    const token = this.extractToken(request);
    if (!token) {
      reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Phase 4.2: Check token blacklist before JWT verification
    // This rejects revoked tokens early, before expensive crypto verification
    try {
      const isRevoked = await this.blacklistChecker.isRevoked(token);
      if (isRevoked) {
        reply.code(401).send({
          error: 'TOKEN_REVOKED',
          message: 'Token has been revoked',
        });
        return;
      }
    } catch {
      // Blacklist check failure should not block authentication
      // Fail-open: continue with JWT verification
    }

    // 验证 token
    try {
      const payload = await this.verifyToken(token);
      request.authContext = {
        authenticated: true,
        user: payload,
        token,
      };
    } catch (error) {
      reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: error instanceof Error ? error.message : 'Token verification failed',
      });
    }
  }

  /**
   * 角色授权检查
   */
  requireRoles(...roles: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const authContext = request.authContext;

      if (!authContext?.authenticated) {
        reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const userRoles = authContext.user?.roles || [];
      const hasRequiredRole = roles.some((role) => userRoles.includes(role));

      if (!hasRequiredRole) {
        reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Insufficient permissions',
        });
      }
    };
  }

  /**
   * 权限检查
   */
  requirePermissions(...permissions: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const authContext = request.authContext;

      if (!authContext?.authenticated) {
        reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const userPermissions = authContext.user?.permissions || [];
      const hasRequiredPermission = permissions.some((p) => userPermissions.includes(p));

      if (!hasRequiredPermission) {
        reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Insufficient permissions',
        });
      }
    };
  }
}
