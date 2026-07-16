/**
 * Tenant ID Extraction Utility
 *
 * 统一租户 ID 提取入口，消除路由文件中散落的硬编码 fallback ('default' / 1)。
 *
 * 提取优先级：
 *  1. request.user.tenantId (JWT claims, 由 authMiddleware 注入)
 *  2. X-Tenant-ID 请求头
 *  3. tenantContextStorage (AsyncLocalStorage) 中的 tenantId
 *
 * 绝不回退到硬编码值 — 如果三个来源都不可用，抛出 OrionError。
 */

import { FastifyRequest } from 'fastify';
import { tenantContextStorage } from '../db/tenant-context-storage';
import { OrionError, ErrorCode } from '../errors';

export function getTenantId(request: FastifyRequest): string {
  // 1. 优先从 authMiddleware/JWT 注入的 request.user.tenantId 获取
  const user = (request as any).user;
  if (user?.tenantId !== undefined && user?.tenantId !== null && user?.tenantId !== '') {
    return String(user.tenantId);
  }

  // 2. 其次从 X-Tenant-ID 请求头获取
  const headerTenantId = (request as any).headers?.['x-tenant-id'] || (request as any).headers?.['X-Tenant-ID'];
  if (headerTenantId !== undefined && headerTenantId !== null && headerTenantId !== '') {
    return String(headerTenantId);
  }

  // 3. 其次从 tenantContextStorage (AsyncLocalStorage) 获取
  const store = tenantContextStorage.getStore();
  if (store?.tenantId !== undefined && store?.tenantId !== null) {
    return String(store.tenantId);
  }

  // 4. 绝不回退到 'default' 或 1 — 如果都没有则抛出 OrionError
  throw new OrionError(
    '无法获取租户 ID: 请求上下文中未包含租户信息',
    ErrorCode.UNAUTHORIZED,
    false,
    { reason: 'missing_tenant_id' },
  );
}
