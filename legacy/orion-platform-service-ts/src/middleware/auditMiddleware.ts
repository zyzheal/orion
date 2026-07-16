/**
 * Audit Middleware — 自动审计日志记录
 *
 * 在 Fastify onResponse 钩子中自动记录关键操作（创建/更新/删除）到 audit_logs 表。
 * 审计日志独立于业务日志存储，包含 actor、action、resource、timestamp 等结构化字段。
 *
 * Usage:
 *   // 在 registerWithPermission 中自动启用
 *   registerWithPermission(app, routeModule, '/pipelines', { database }, 'pipeline', 'write');
 *
 *   // 或手动添加钩子
 *   app.addHook('onResponse', auditGuard({ resourceType: 'pipeline' }));
 *
 * Behavior:
 *   - POST → action: 'CREATE'
 *   - PUT/PATCH → action: 'UPDATE'
 *   - DELETE → action: 'DELETE'
 *   - GET/HEAD/OPTIONS → 跳过（不记录读取操作）
 *   - 审计日志写入失败不影响主请求响应（非阻塞）
 *
 * Architecture:
 *   - AuditService 通过全局单例模式初始化（在 app.ts 中 setAuditService）
 *   - 中间件通过 getAuditService() 获取实例
 *   - 写入使用 setImmediate 非阻塞，错误仅记录日志
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from '../services/audit/AuditService';
import { createLogger } from '../utils/logger';
import { getCurrentTenantId } from '../db/tenant-context-storage';

const logger = createLogger('audit-middleware');

const SENSITIVE_FIELDS = new Set([
  'password', 'password_hash', 'token', 'secret', 'apiKey', 'api_key',
  'privateKey', 'private_key', 'accessToken', 'access_token', 'refreshToken',
  'refresh_token', 'jwt', 'credential', 'credentials', 'authorization',
  'Authorization',
]);

/**
 * Strip sensitive fields from request body before audit logging.
 */
function sanitizeBody(body: unknown): Record<string, any> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(body as Record<string, any>)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface AuditGuardOptions {
  /** 资源类型标识（如 'pipeline', 'config', 'deploy'） */
  resourceType: string;
  /** 是否启用审计日志（默认 true） */
  enabled?: boolean;
  /** 跳过的 HTTP 方法列表（默认 ['GET', 'HEAD', 'OPTIONS']） */
  skipMethods?: string[];
}

/** HTTP 方法 → 审计动作映射 */
const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

// ==================== 全局单例（与 aclMiddleware 同模式） ====================

let auditService: AuditService | null = null;

export function setAuditService(service: AuditService | null): void {
  auditService = service;
}

export function getAuditService(): AuditService | null {
  return auditService;
}

/**
 * 创建审计日志记录中间件工厂函数
 *
 * 在 onResponse 钩子中执行（请求处理完成后），确保能捕获响应状态码。
 * 审计日志写入为同步操作，确保审计日志不丢失（任务 4.31）。
 */
export function auditGuard(options: AuditGuardOptions) {
  const { resourceType, enabled = true, skipMethods = ['GET', 'HEAD', 'OPTIONS'] } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // 审计日志关闭或 GET 请求 → 跳过
    if (!enabled) return;
    if (skipMethods.includes(request.method)) return;

    const service = getAuditService();
    if (!service) {
      logger.warn({ tenant_id: getCurrentTenantId() }, '[AuditGuard] AuditService not initialized, skipping audit log');
      return;
    }

    const user = (request as any).user as Record<string, any> | undefined;
    const tenantId = getCurrentTenantId();
    const userId = user?.userId || user?.id || null;
    const resourceId = (request.params as any)?.id as string | undefined;

    // 构建审计日志输入
    const input = {
      tenant_id: tenantId,
      user_id: userId,
      action: METHOD_ACTION_MAP[request.method] || request.method,
      resource_type: resourceType,
      resource_id: resourceId,
      request_method: request.method,
      request_path: request.url,
      request_body: sanitizeBody(request.body),
      response_code: reply.statusCode,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] || undefined,
    };

    // 同步写入审计日志（await），确保日志持久化到 PostgreSQL 后才结束当前请求
    try {
      await service.createAuditLog(input);
    } catch (error) {
      // 审计日志写入失败不影响主请求响应（非阻塞）
      logger.error({ err: error as Error, stack: (error as Error).stack, tenant_id: tenantId, action: input.action, resource_type: resourceType }, '[AuditMiddleware] Failed to write audit log');
    }
  };
}