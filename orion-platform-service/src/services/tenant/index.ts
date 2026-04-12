/**
 * Tenant Services - 租户隔离服务模块
 *
 * 导出所有租户相关服务：
 * - TenantContext - 租户上下文管理
 * - TenantMiddleware - Fastify 租户中间件
 * - TenantQuotaService - 租户配额服务
 * - NamespacePoolService - Namespace 池服务
 */

export { TenantContext, TenantInfo, TenantContextConfig, tenantContext } from './TenantContext';
export {
  createTenantMiddleware,
  createTenantDatabaseHook,
  createTenantCleanupHook,
  requireTenantMatch,
  TenantMiddlewareOptions,
} from './TenantMiddleware';
export {
  TenantQuotaService,
  TenantQuota,
  TenantUsage,
  QuotaCheckResult,
  QuotaAlert,
  tenantQuotaService,
} from './TenantQuotaService';
export {
  NamespacePoolService,
  NamespacePoolEntry,
  NamespaceAllocationResult,
  NamespacePoolConfig,
  namespacePoolService,
} from './NamespacePoolService';