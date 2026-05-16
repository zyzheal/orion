/**
 * JWT Authentication Middleware
 *
 * 统一的 JWT 验证中间件，支持:
 * - Bearer token 验证
 * - 多租户 (tenantId) 支持
 * - 角色 (roles) 数组支持
 * - Token 生成功能
 *
 * Usage:
 *   // 作为全局中间件
 *   app.addHook('onRequest', jwtAuth);
 *
 *   // 作为 per-route 中间件
 *   app.get('/protected', { onRequest: [jwtAuth] }, handler);
 *
 *   // 生成 Token
 *   const token = generateToken({ userId, tenantId, roles });
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';

// JWT_SECRET 从环境变量读取
const JWT_SECRET = process.env.JWT_SECRET || 'orion-secret-key';

/**
 * JWT Payload 接口
 * 包含用户身份信息和权限信息
 */
export interface JwtPayload {
  userId: string;
  tenantId?: string;
  roles?: string[];
  username?: string;
  exp?: number;
  iat?: number;
}

/**
 * 扩展 FastifyRequest 类型
 * 添加 user 属性以存储解码后的 JWT 信息
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/**
 * JWT 认证中间件
 *
 * 验证 Authorization header 中的 Bearer token。
 * 验证成功后将解码的用户信息附加到 request.user。
 * 验证失败返回 401 错误。
 *
 * @param request - Fastify 请求对象
 * @param reply - Fastify 响应对象
 */
export async function jwtAuth(
  request: FastifyRequest,
  reply: FastifyReply
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

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
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
 * 生成 JWT Token
 *
 * @param payload - 要编码的用户信息 (不含 exp/iat)
 * @param options - 可选的 token 配置
 * @returns 生成的 JWT token 字符串
 *
 * @example
 * const token = generateToken({
 *   userId: '123',
 *   tenantId: 'tenant-456',
 *   roles: ['admin', 'user']
 * });
 */
export function generateToken(
  payload: Omit<JwtPayload, 'exp' | 'iat'>,
  options?: { expiresIn?: string }
): string {
  const expiresIn = options?.expiresIn || '24h';
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any) as string;
}

/**
 * 验证 JWT Token (不附加到 request)
 *
 * 适用于需要手动验证 token 的场景。
 *
 * @param token - JWT token 字符串
 * @returns 解码后的 payload 或 null (如果无效)
 *
 * @example
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log('User:', payload.userId);
 * }
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
}

/**
 * 可选的 JWT 认证中间件
 *
 * 如果请求包含有效的 JWT token，则附加用户信息；
 * 如果没有 token 或 token 无效，仍然允许请求通过。
 * 适用于需要区分认证用户和匿名用户的场景。
 *
 * @param request - Fastify 请求对象
 * @param reply - Fastify 响应对象
 */
export async function optionalJwtAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 没有 token，继续处理请求
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    request.user = decoded;
  } catch (error) {
    // token 无效，继续处理请求（作为匿名用户）
  }
}

/**
 * 角色验证装饰器
 *
 * 创建一个中间件函数，验证用户是否具有所需角色之一。
 * 需要在 jwtAuth 之后使用。
 *
 * @param requiredRoles - 必需的角色数组
 * @returns Fastify 中间件函数
 *
 * @example
 * app.get('/admin', {
 *   onRequest: [jwtAuth, requireRoles(['admin', 'platform_admin'])]
 * }, handler);
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
    const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

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
 * 租户验证装饰器
 *
 * 创建一个中间件函数，验证用户是否属于指定租户。
 * 需要在 jwtAuth 之后使用。
 *
 * @param paramName - 从请求参数中获取租户 ID 的参数名
 * @returns Fastify 中间件函数
 *
 * @example
 * app.get('/tenants/:tenantId/resources', {
 *   onRequest: [jwtAuth, requireTenant('tenantId')]
 * }, handler);
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

    // 如果请求中没有租户 ID，或者用户没有租户 ID，则检查失败
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