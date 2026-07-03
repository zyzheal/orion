/**
 * Tenant Auth Utilities - 统一权限和租户提取
 *
 * 提供统一的：
 * 1. 权限检查中间件 (基于 jwtAuth)
 * 2. 租户ID提取辅助函数
 *
 * 解决历史不一致问题：
 * - authenticateUser (旧) vs jwtAuth (新)
 * - tenant_id (snake_case) vs tenantId (camelCase)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtAuth, JwtPayload } from './jwtAuth';
import { requirePermission } from './requirePermission';
import { tenantContext } from '../services/tenant/TenantContext';

/**
 * 从请求中统一提取租户ID
 *
 * 处理以下情况：
 * 1. JWT payload 中的 tenantId (camelCase) - 新标准
 * 2. JWT payload 中的 tenant_id (snake_case) - 旧格式兼容
 * 3. request.user 中的 tenantId/tenant_id
 *
 * @returns 租户ID，如果未找到返回 0 (默认租户)
 */
export function getTenantIdFromRequest(request: FastifyRequest): number {
  const user = (request as any).user as Record<string, unknown> | undefined;

  if (!user) {
    return 0;
  }

  // 优先使用 camelCase (新标准)
  const tenantId = user.tenantId || user.tenant_id;

  if (tenantId !== undefined && tenantId !== null) {
    const parsed = typeof tenantId === 'string' ? parseInt(tenantId, 10) : tenantId;
    return parsed > 0 ? parsed : 0;
  }

  // 回退到 TenantContext (如果已设置)
  const contextTenantId = tenantContext.getCurrentTenantId();
  if (contextTenantId > 0) {
    return contextTenantId;
  }

  return 0;
}

/**
 * 从请求中统一提取用户信息
 */
export function getUserFromRequest(request: FastifyRequest): {
  userId: string;
  username: string;
  roles: string[];
  tenantId: number;
} | null {
  const user = (request as any).user as Record<string, unknown> | undefined;

  if (!user) {
    return null;
  }

  const tenantId = getTenantIdFromRequest(request);

  return {
    userId: (user.userId || user.id || '') as string,
    username: (user.username || '') as string,
    roles: (user.roles || []) as string[],
    tenantId,
  };
}

/**
 * 检查租户访问权限
 *
 * @param request Fastify请求
 * @param resourceTenantId 资源所属租户ID
 * @returns 是否有权限访问
 */
export function validateTenantAccess(request: FastifyRequest, resourceTenantId: number): boolean {
  const currentTenantId = getTenantIdFromRequest(request);

  // 系统租户 (0) 可以访问所有资源
  if (currentTenantId === 0) {
    return true;
  }

  return currentTenantId === resourceTenantId;
}

/**
 * 统一认证中间件 - 使用 jwtAuth (新标准)
 *
 * 这是 authenticateUser 的替代品，功能更完善：
 * -  centralized JWT key management
 * - Token blacklist checking
 * - User status validation
 * - Multi-tenant support
 *
 * 为了向后兼容，authenticateUser 仍然保留，
 * 但新代码应该使用这个中间件。
 */
export { jwtAuth as authenticate, jwtAuth as unifiedAuth };

/**
 * 便捷函数：创建带认证和权限检查的路由配置
 */
export function withAuthAndPermission(options: {
  resource: string;
  action: string;
}) {
  return {
    onRequest: [jwtAuth, requirePermission(options)],
  };
}

/**
 * 便捷函数：创建带认证和角色检查的路由配置
 */
export function withAuthAndRole(requiredRoles: string[]) {
  return {
    onRequest: [jwtAuth],
    preHandler: [requireRoles(requiredRoles)],
  };
}

/**
 * Role validation - 从 jwtAuth.ts 重新导出
 */
export { requireRoles } from './jwtAuth';

/**
 * Tenant validation - 从 jwtAuth.ts 重新导出
 */
export { requireTenant } from './jwtAuth';
