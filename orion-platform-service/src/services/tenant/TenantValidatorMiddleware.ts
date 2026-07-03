/**
 * TenantValidatorMiddleware - API层租户验证中间件
 *
 * 功能：
 * - 验证 Request Header 中的 tenant_id
 * - 检查 tenant_id 是否与认证用户匹配
 * - 设置 TenantContext 供下游层使用
 * - 提供四层隔离验证的入口点
 */

import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { TenantIsolationService } from './TenantIsolationService';
import { createTenantContext, TenantInfo } from './TenantContext';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 租户验证中间件配置选项
 */
export interface TenantValidatorOptions {
  /** 是否强制要求 tenant_id */
  required?: boolean;
  /** 需跳过验证的路径 */
  skipPaths?: string[];
  /** 是否验证所有四层 */
  validateAllLayers?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: TenantValidatorOptions = {
  required: true,
  skipPaths: ['/healthz', '/readyz', '/version', '/api/v1/info'],
  validateAllLayers: true,
};

/**
 * TenantValidatorMiddleware - 租户验证中间件类
 */
export class TenantValidatorMiddleware {
  private isolationService: TenantIsolationService;
  private options: TenantValidatorOptions;

  constructor(
    isolationService: TenantIsolationService,
    options: Partial<TenantValidatorOptions> = {}
  ) {
    this.isolationService = isolationService;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 获取中间件处理函数
   */
  getHandler() {
    return async (
      request: FastifyRequest,
      reply: FastifyReply,
      done: HookHandlerDoneFunction
    ) => {
      // 跳过特定路径
      if (this.options.skipPaths?.some(path => request.url.startsWith(path))) {
        done();
        return;
      }

      // 获取请求中的租户信息
      const requestTenant = (request as any).tenant as TenantInfo | undefined;
      const tenantId = requestTenant?.tenantId;

      // 从 header 获取 tenant_id
      const headerTenantId = parseInt(
        request.headers['x-tenant-id'] as string || '0',
        10
      );

      // 如果要求 tenant_id 但未提供，使用默认租户 ID（开发环境兼容）
      if (!tenantId && !headerTenantId && this.options.required) {
        const defaultTenantId = parseInt(process.env.DEFAULT_TENANT_ID || '1', 10);
        logger.debug(`[TenantValidator] No tenant provided, using default tenant ${defaultTenantId}`);
        const ctx = createTenantContext();
        ctx.setTenant({
          tenantId: defaultTenantId,
          userId: (request.headers['x-user-id'] as string) || undefined,
        });
        (request as any).tenantContext = ctx;
        done();
        return;
      }

      // 验证 header 中的 tenant_id 与 context 是否匹配
      if (tenantId && headerTenantId && tenantId !== headerTenantId) {
        logger.warn(
          `[TenantValidator] Tenant mismatch: header=${headerTenantId} context=${tenantId}`
        );
        reply.code(403).send({
          error: 'TENANT_MISMATCH',
          code: '40301',
          message: 'Tenant ID in header does not match authenticated tenant',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 设置请求级别的 TenantContext 供下游层使用
      if (tenantId || headerTenantId) {
        const ctx = createTenantContext();
        ctx.setTenant({
          tenantId: tenantId || headerTenantId,
          userId: requestTenant?.userId || request.headers['x-user-id'] as string,
          roles: requestTenant?.roles,
          permissions: requestTenant?.permissions,
        });
        (request as any).tenantContext = ctx;
      }

      done();
    };
  }

  /**
   * 获取配置选项
   */
  getOptions(): TenantValidatorOptions {
    return { ...this.options };
  }
}

/**
 * 创建租户验证中间件
 */
export function createTenantValidatorMiddleware(
  isolationService: TenantIsolationService,
  options: Partial<TenantValidatorOptions> = {}
) {
  const validator = new TenantValidatorMiddleware(isolationService, options);
  return validator.getHandler();
}