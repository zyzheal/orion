/**
 * TenantMiddleware - Fastify 租户解析中间件
 *
 * 功能：
 * - 从 JWT/Header 解析 tenant_id
 * - 设置 PostgreSQL session 变量
 * - 验证租户配额限制
 */

import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { TenantInfo, tenantContext } from './TenantContext';

export interface TenantMiddlewareOptions {
  enabled?: boolean;
  headerName?: string;
  required?: boolean;
  skipPaths?: string[];
}

const defaultOptions: TenantMiddlewareOptions = {
  enabled: true,
  headerName: 'x-tenant-id',
  required: false,
  skipPaths: ['/healthz', '/readyz', '/version', '/api/v1/info'],
};

/**
 * 创建租户中间件
 */
export function createTenantMiddleware(options: Partial<TenantMiddlewareOptions> = {}) {
  const config = { ...defaultOptions, ...options };

  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) => {
    // Skip tenant middleware for certain paths
    if (config.skipPaths?.some(path => request.url.startsWith(path))) {
      done();
      return;
    }

    if (!config.enabled) {
      done();
      return;
    }

    try {
      // Extract tenant from request
      const tenantInfo = extractTenantInfo(request, config);

      if (!tenantInfo && config.required) {
        reply.code(401).send({
          error: 'MISSING_TENANT',
          code: '40001',
          message: 'Tenant ID is required but not provided',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Set tenant context
      if (tenantInfo) {
        tenantContext.setTenant(tenantInfo);

        // Attach tenant info to request
        request.tenant = tenantInfo;
      }

      done();
    } catch (error) {
      reply.code(500).send({
        error: 'TENANT_CONTEXT_ERROR',
        code: '50001',
        message: 'Failed to process tenant context',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  };
}

/**
 * 从请求中提取租户信息
 */
function extractTenantInfo(
  request: FastifyRequest,
  config: TenantMiddlewareOptions
): TenantInfo | null {
  // 优先从 JWT user 对象获取（如果已验证）
  const user = request.user as Record<string, unknown> | undefined;
  if (user?.tenant_id) {
    return {
      tenantId: user.tenant_id as number,
      userId: user.userId as string | undefined || user.sub as string | undefined,
      roles: user.roles as string[] | undefined,
      permissions: user.permissions as string[] | undefined,
    };
  }

  // 从 header 获取
  const tenantIdHeader = request.headers[config.headerName || 'x-tenant-id'];
  if (tenantIdHeader) {
    const tenantId = parseInt(tenantIdHeader as string, 10);
    if (tenantId > 0) {
      return {
        tenantId,
        userId: request.headers['x-user-id'] as string | undefined,
      };
    }
  }

  return null;
}

/**
 * 创建数据库 session 设置钩子
 */
export function createTenantDatabaseHook(database: unknown) {
  return async (_request: FastifyRequest, _reply: FastifyReply) => {
    if (!database || !tenantContext.isEnabled()) {
      return;
    }

    const tenant = tenantContext.getCurrentTenant();
    if (tenant) {
      try {
        // Set PostgreSQL session variables for RLS
        // This requires a real database connection
        if (typeof database === 'object' && database !== null && 'query' in database) {
          const db = database as { query: (sql: string) => Promise<void> };
          await db.query(tenantContext.generateSessionSetSQL());
        }
      } catch (error) {
        // Log error but don't fail request
        console.error('[TenantMiddleware] Failed to set tenant session:', error);
      }
    }
  };
}

/**
 * 创建租户响应清理钩子
 */
export function createTenantCleanupHook() {
  return async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Clear tenant context after response
    tenantContext.clearTenant();
  };
}

/**
 * 验证租户访问权限的装饰器函数
 */
export function requireTenantMatch(resourceTenantId: number): boolean {
  return tenantContext.validateTenantAccess(resourceTenantId);
}

/**
 * 扩展 Fastify 类型定义
 */
declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantInfo;
  }
}