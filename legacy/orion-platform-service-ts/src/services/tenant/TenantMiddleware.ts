/**
 * TenantMiddleware - Fastify 租户解析中间件
 *
 * 功能：
 * - 从 JWT/Header 解析 tenant_id
 * - 设置 PostgreSQL session 变量
 * - 验证租户配额限制
 * - 四层隔离验证集成
 */

import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { DatabasePool } from '../database';
import { TenantInfo, tenantContext } from './TenantContext';
import { TenantIsolationService } from './TenantIsolationService';
import { RLSPolicyManager } from './RLSPolicyManager';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('TenantMiddleware');

export interface TenantMiddlewareOptions {
  enabled?: boolean;
  headerName?: string;
  required?: boolean;
  skipPaths?: string[];
}

const defaultOptions: TenantMiddlewareOptions = {
  enabled: true,
  headerName: 'x-tenant-id',
  required: true,
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
  // 支持 tenantId (camelCase) 和 tenant_id (snake_case)
  const user = (request as any).user as Record<string, unknown> | undefined;
  const tenantId = user?.tenantId || user?.tenant_id;

  if (tenantId !== undefined && tenantId !== null) {
    const tenantIdStr = String(tenantId);
    const parsedTenantId = parseInt(tenantIdStr, 10);
    return {
      tenantId: parsedTenantId,
      userId: user?.userId ? String(user.userId) : user?.sub ? String(user.sub) : undefined,
      roles: user?.roles ? (user.roles as string[]) : undefined,
      permissions: user?.permissions ? (user.permissions as string[]) : undefined,
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
 * 创建数据库 session 设置钩子（增强版）
 * 使用 RLSPolicyManager 设置 PostgreSQL session 变量
 */
export function createTenantDatabaseHook(database: unknown, rlsPolicyManager?: RLSPolicyManager) {
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
          const db = database as { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

          // 如果有 RLSPolicyManager，使用它设置 session 变量
          if (rlsPolicyManager) {
            await rlsPolicyManager.setTenantSessionVariable(tenant.tenantId);
          } else {
            // 否则使用 TenantContext 生成的 SQL
            await db.query(tenantContext.generateSessionSetSQL());
          }

          logger.debug(`[TenantMiddleware] Set RLS session for tenant ${tenant.tenantId}`);
        }
      } catch (error) {
        // Log error but don't fail request
        logger.error('[TenantMiddleware] Failed to set tenant session:', error);
      }
    }
  };
}

/**
 * 创建数据库 session 清理钩子（增强版）
 */
export function createTenantDatabaseCleanupHook(rlsPolicyManager?: RLSPolicyManager) {
  return async (_request: FastifyRequest, _reply: FastifyReply) => {
    if (!tenantContext.isEnabled()) {
      return;
    }

    try {
      // 如果有 RLSPolicyManager，使用它清除 session 变量
      if (rlsPolicyManager) {
        await rlsPolicyManager.clearTenantSessionVariable();
      }

      // Clear tenant context after response
      tenantContext.clearTenant();

      logger.debug('[TenantMiddleware] Cleared tenant session');
    } catch (error) {
      logger.error('[TenantMiddleware] Failed to clear tenant session:', error);
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