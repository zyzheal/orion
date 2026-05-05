/**
 * Tenant Services - 租户隔离服务模块
 *
 * 导出所有租户相关服务：
 * - TenantContext - 租户上下文管理
 * - TenantMiddleware - Fastify 租户中间件
 * - TenantIsolationService - 四层租户隔离验证服务
 * - TenantValidatorMiddleware - API层租户验证中间件
 * - TenantQuotaService - 租户配额服务
 * - NamespacePoolService - Namespace 池服务
 * - TenantRepository - 数据库访问层 (with PostgreSQL)
 * - TenantService - 业务逻辑层
 */

export {
  TenantContext, TenantInfo, TenantContextConfig, tenantContext
} from './TenantContext';
export {
  createTenantMiddleware,
  createTenantDatabaseHook,
  createTenantDatabaseCleanupHook,
  createTenantCleanupHook,
  requireTenantMatch,
  TenantMiddlewareOptions,
} from './TenantMiddleware';
export {
  TenantIsolationService,
  TenantIsolationContext,
  FourLayerValidationResult,
} from './TenantIsolationService';
export {
  TenantValidatorMiddleware,
  createTenantValidatorMiddleware,
  TenantValidatorOptions,
} from './TenantValidatorMiddleware';
export {
  RLSPolicyManager,
  RLSPolicyConfig,
  RLSStatusResult,
  SessionVariableResult,
  createRLSPolicyManager,
} from './RLSPolicyManager';
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

// Database-backed services
export {
  TenantRepository,
  Tenant,
  CreateTenantInput,
  UpdateTenantInput,
} from './TenantRepository';
export {
  TenantService,
  TenantServiceError,
  ListTenantsOptions,
  PaginatedResult,
} from './TenantService';