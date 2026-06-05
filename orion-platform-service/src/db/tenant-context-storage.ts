/**
 * Tenant Context Storage — AsyncLocalStorage
 *
 * 提供请求级别的租户上下文传播机制，确保在整个 async 调用链中
 * 所有数据库操作都使用同一个带 RLS session variable 的连接。
 *
 * 使用场景：
 * 1. HTTP 请求：onRequest 钩子中 acquire client + set_config，后续所有查询自动使用该连接
 * 2. 后台任务：通过 system tenant mode 绕过 RLS
 *
 * 替代原有的全局 singleton TenantContext，解决并发请求互相覆盖 tenantId 的问题 (CWE-362)。
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { PoolClient } from 'pg';

export interface TenantContextStore {
  /** 请求级数据库连接（已设置 RLS session variable） */
  dbClient: PoolClient;
  /** 当前租户 ID */
  tenantId: number;
  /** 是否为系统租户模式（绕过 RLS） */
  isSystemTenant?: boolean;
  /** 当前请求的 traceId（W3C Trace Context） */
  traceId?: string;
  /** 当前请求的 spanId */
  spanId?: string;
}

/**
 * AsyncLocalStorage 实例，用于在整个 async 调用链中传播租户上下文。
 *
 * 使用方式：
 * ```typescript
 * // 在 onRequest 钩子中：
 * tenantContextStorage.enterWith({ dbClient: client, tenantId: 123 });
 *
 * // 在任何 Repository/Service 中：
 * const store = tenantContextStorage.getStore();
 * if (store) {
 *   // 使用 store.dbClient 执行查询
 * }
 * ```
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContextStore>();

/**
 * 获取当前请求的 traceId。
 * 在任何 Service/Repository 中调用，无需传递参数。
 * 如果不在请求上下文中（如后台任务），返回空字符串。
 */
export function getCurrentTraceId(): string {
  const store = tenantContextStorage.getStore();
  return store?.traceId || '';
}

/**
 * 获取当前请求的 spanId。
 */
export function getCurrentSpanId(): string {
  const store = tenantContextStorage.getStore();
  return store?.spanId || '';
}

/**
 * 系统租户 ID 常量
 * 后台任务（Cron/EventBus/Saga）使用此 ID 绕过 RLS 策略
 */
export const SYSTEM_TENANT_ID = '__system__' as unknown as number;
