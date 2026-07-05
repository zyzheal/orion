/**
 * Handler Registry SPI Types
 *
 * 定义 Handler 接口、注册条目、查询选项等类型。
 */

/** Handler 状态 */
export type HandlerStatus = 'active' | 'disabled' | 'error';

/** Handler 健康状态 */
export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

/** Handler 接口 - 所有 SPI Handler 必须实现 */
export interface Handler {
  /** 执行 Handler 逻辑 */
  execute(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** 验证 Handler 是否可用 */
  validate?(): boolean | Promise<boolean>;
  /** 健康检查 */
  healthCheck?(): Promise<{ status: HealthStatus; details?: Record<string, unknown> }>;
}

/** 内存注册条目 */
export interface HandlerEntry {
  handler: Handler;
  domain: string;
  name: string;
  displayName?: string;
  description?: string;
  version: string;
  status: HandlerStatus;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  registeredAt: Date;
  registeredBy: string;
  lastInvokedAt?: Date;
  invokeCount: number;
  errorCount: number;
  lastError?: string;
  lastHealthStatus: HealthStatus;
  lastHealthCheck?: Date;
}

/** 持久化实体 */
export interface HandlerRegistryEntity {
  id: string;
  tenantId: string;
  domain: string;
  name: string;
  displayName: string | null;
  description: string | null;
  version: string;
  status: HandlerStatus;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  healthCheck: Record<string, unknown>;
  lastHealthStatus: HealthStatus;
  lastHealthCheck: Date | null;
  lastError: string | null;
  errorCount: number;
  registeredBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 注册 Handler 的输入 */
export interface RegisterHandlerInput {
  displayName?: string;
  description?: string;
  version?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  registeredBy?: string;
}

/** 列表查询选项 */
export interface ListHandlersOptions {
  domain?: string;
  status?: HandlerStatus;
}

/** 健康检查结果 */
export interface HealthCheckResult {
  total: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
  handlers: Array<{
    domain: string;
    name: string;
    status: HandlerStatus;
    healthStatus: HealthStatus;
    lastHealthCheck?: string;
    lastError?: string;
    invokeCount: number;
    errorCount: number;
  }>;
}
