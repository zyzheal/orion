/**
 * TenantContext - 租户上下文管理服务
 *
 * 功能：
 * - 从 JWT 解析 tenant_id
 * - 设置 PostgreSQL session 变量 (app.current_tenant)
 * - 验证租户配额限制
 * - 提供租户隔离上下文
 */

import { EventEmitter } from 'events';

export interface TenantInfo {
  tenantId: number;
  userId?: string;
  roles?: string[];
  permissions?: string[];
}

export interface TenantContextConfig {
  enabled: boolean;
  defaultTenantId: number;
  headerName: string;
  jwtTenantClaim: string;
}

const defaultConfig: TenantContextConfig = {
  enabled: true,
  defaultTenantId: 0,
  headerName: 'x-tenant-id',
  jwtTenantClaim: 'tenant_id',
};

/**
 * TenantContext - 租户上下文管理
 */
export class TenantContext extends EventEmitter {
  private config: TenantContextConfig;
  private currentTenant: TenantInfo | null = null;

  constructor(config: Partial<TenantContextConfig> = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 从请求中提取租户信息
   */
  extractTenantFromRequest(request: {
    headers: Record<string, string | undefined>;
    user?: {
      tenant_id?: number;
      userId?: string;
      roles?: string[];
      permissions?: string[];
    };
  }): TenantInfo | null {
    // 优先从 JWT 解析的 user 对象获取
    if (request.user?.tenant_id) {
      return {
        tenantId: request.user.tenant_id,
        userId: request.user.userId,
        roles: request.user.roles,
        permissions: request.user.permissions,
      };
    }

    // 从 header 获取
    const tenantIdHeader = request.headers[this.config.headerName];
    if (tenantIdHeader) {
      const tenantId = parseInt(tenantIdHeader, 10);
      if (tenantId > 0) {
        return {
          tenantId,
          userId: request.headers['x-user-id'],
        };
      }
    }

    // 使用默认租户
    if (this.config.defaultTenantId >= 0) {
      return {
        tenantId: this.config.defaultTenantId,
      };
    }

    return null;
  }

  /**
   * 设置当前租户上下文
   */
  setTenant(tenant: TenantInfo): void {
    this.currentTenant = tenant;
    this.emit('tenant:set', tenant);
  }

  /**
   * 清除当前租户上下文
   */
  clearTenant(): void {
    const previousTenant = this.currentTenant;
    this.currentTenant = null;
    this.emit('tenant:clear', previousTenant);
  }

  /**
   * 获取当前租户信息
   */
  getCurrentTenant(): TenantInfo | null {
    return this.currentTenant;
  }

  /**
   * 获取当前租户 ID
   */
  getCurrentTenantId(): number {
    return this.currentTenant?.tenantId ?? this.config.defaultTenantId;
  }

  /**
   * 检查租户是否匹配
   */
  isTenantMatch(tenantId: number): boolean {
    return this.getCurrentTenantId() === tenantId;
  }

  /**
   * 验证租户访问权限
   */
  validateTenantAccess(resourceTenantId: number): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const currentTenantId = this.getCurrentTenantId();

    // 系统租户可以访问所有资源
    if (currentTenantId === 0) {
      return true;
    }

    return currentTenantId === resourceTenantId;
  }

  /**
   * @deprecated SQL injection risk via string interpolation.
   * This method returns raw SQL with embedded tenantId via template literals.
   * tenantId comes from parsed JWT/headers (validated as integer), so risk is mitigated
   * at the call site, but this pattern should NOT be used for user-controlled input.
   * For production use, prefer the database connection's parameterized query methods
   * (e.g., set_config($1, $2, false) via query() with parameters).
   * Only safe for embedding in larger SQL batches where tenantId is already validated.
   */
  generateSessionSetSQL(): string {
    const tenantId = this.getCurrentTenantId();
    return `SELECT set_config('app.current_tenant', '${tenantId}', false), set_config('app.tenant_isolation', '${this.config.enabled}', false)`;
  }

  /**
   * @deprecated SQL injection risk via string interpolation.
   * This method returns raw SQL with embedded string literals. While currently containing
   * no user-controlled values (hardcoded empty string and 'false'), the pattern of returning
   * raw SQL for direct execution is discouraged.
   * For production use, prefer the parameterized clearTenantSessionVariable() method in
   * RLSPolicyManager instead.
   */
  generateSessionClearSQL(): string {
    return `SELECT set_config('app.current_tenant', '', false), set_config('app.tenant_isolation', 'false', false)`;
  }

  /**
   * 创建数据库查询参数
   */
  createQueryParams(params: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      ...params,
      tenant_id: this.getCurrentTenantId(),
    };
  }

  /**
   * @deprecated SQL injection risk via string interpolation of tenantId into WHERE clause.
   * This method embeds tenantId directly as `tenant_id = ${tenantId}` in the returned SQL string.
   * While tenantId comes from validated JWT/headers (integer), this pattern should NOT be used
   * with user-controlled input.
   * For production use, prefer `buildTenantWhereClause()` which uses parameterized queries
   * (e.g., `tenant_id = $1`) and is safe for all input sources.
   *
   * 添加租户条件到 WHERE 子句
   */
  addTenantCondition(whereClause: string): string {
    if (!this.config.enabled) {
      return whereClause;
    }

    const tenantId = this.getCurrentTenantId();
    const tenantCondition = `tenant_id = ${tenantId}`;

    if (whereClause) {
      return `${whereClause} AND ${tenantCondition}`;
    }

    return tenantCondition;
  }

  /**
   * Repository 层辅助方法：获取 tenant_id 查询参数
   * 用于构建带 tenant_id 过滤的 SQL 查询
   */
  getTenantQueryParam(): { tenantId: number; tenantParamIndex: number } | null {
    if (!this.config.enabled) {
      return null;
    }

    const tenantId = this.getCurrentTenantId();
    if (tenantId === undefined || tenantId === null) {
      return null;
    }

    return { tenantId, tenantParamIndex: 1 };
  }

  /**
   * Repository 层辅助方法：构建带 tenant_id 的查询条件
   * 返回完整的 WHERE 条件字符串和参数位置
   */
  buildTenantWhereClause(
    baseWhere: string,
    existingParamCount: number = 0
  ): { whereClause: string; tenantParamIndex: number; tenantId: number } | null {
    if (!this.config.enabled) {
      return null;
    }

    const tenantId = this.getCurrentTenantId();
    if (tenantId === undefined || tenantId === null) {
      return null;
    }

    const tenantParamIndex = existingParamCount + 1;
    const tenantCondition = `tenant_id = $${tenantParamIndex}`;

    const whereClause = baseWhere
      ? `${baseWhere} AND ${tenantCondition}`
      : `WHERE ${tenantCondition}`;

    return { whereClause, tenantParamIndex, tenantId };
  }

  /**
   * Repository 层辅助方法：验证资源 tenant_id 是否匹配当前租户
   */
  validateResourceTenant(resourceTenantId: number | string): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const currentTenantId = this.getCurrentTenantId();

    // 系统租户可以访问所有资源
    if (currentTenantId === 0) {
      return true;
    }

    const resourceTenantIdNum = typeof resourceTenantId === 'string'
      ? parseInt(resourceTenantId, 10)
      : resourceTenantId;

    return currentTenantId === resourceTenantIdNum;
  }

  /**
   * Repository 层辅助方法：为 INSERT 语句添加 tenant_id
   */
  addTenantToInsertColumns(
    columns: string[],
    values: unknown[]
  ): { columns: string[]; values: unknown[] } {
    if (!this.config.enabled) {
      return { columns, values };
    }

    const tenantId = this.getCurrentTenantId();
    return {
      columns: [...columns, 'tenant_id'],
      values: [...values, tenantId],
    };
  }

  /**
   * Repository 层辅助方法：为 UPDATE 语句添加 tenant_id 验证条件
   */
  addTenantToUpdateWhere(
    baseWhere: string,
    existingParamCount: number = 0
  ): { whereClause: string; tenantParamIndex: number; tenantId: number } | null {
    return this.buildTenantWhereClause(baseWhere, existingParamCount);
  }

  /**
   * Repository 层辅助方法：为 DELETE 语句添加 tenant_id 验证条件
   */
  addTenantToDeleteWhere(
    baseWhere: string,
    existingParamCount: number = 0
  ): { whereClause: string; tenantParamIndex: number; tenantId: number } | null {
    return this.buildTenantWhereClause(baseWhere, existingParamCount);
  }

  /**
   * 检查是否启用租户隔离
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 获取配置
   */
  getConfig(): TenantContextConfig {
    return { ...this.config };
  }

  /**
   * 从 JWT payload 解析租户信息
   */
  static parseFromJWT(payload: Record<string, unknown>): TenantInfo | null {
    const tenantId = payload['tenant_id'] as number | undefined;

    if (tenantId === undefined || tenantId === null) {
      return null;
    }

    return {
      tenantId,
      userId: payload['userId'] as string | undefined || payload['sub'] as string | undefined,
      roles: payload['roles'] as string[] | undefined,
      permissions: payload['permissions'] as string[] | undefined,
    };
  }
}

/**
 * Factory function to create request-scoped TenantContext instances.
 * Use this for per-request isolation to prevent concurrent request tenant leakage.
 */
export function createTenantContext(config?: Partial<TenantContextConfig>): TenantContext {
  return new TenantContext(config);
}

// Deprecated: use createTenantContext() for request-scoped instances.
// This singleton export is kept for backward compatibility but should NOT be used
// in production concurrent request handling (CWE-362: race condition).
export const tenantContext = new TenantContext();