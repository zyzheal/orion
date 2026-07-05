import { ErrorCode } from './error-codes';

/**
 * Orion 统一 API 响应格式
 * Level 1 标准：{ success, data, error?, meta }
 *
 * @see docs/superpowers/specs/2026-05-21-api-response-standard-design.md
 */
export interface OrionResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error?: ApiError;
  meta: ApiMeta;
  /**
   * 迁移期标记：true = 由 preSerialization hook 自动包装的旧格式响应
   * Phase 5 清除此字段及所有使用它的代码
   */
  _legacy?: true;
}

/**
 * API 错误详情
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  /**
   * hook 包装时保留原始错误码
   * 用于迁移期兼容
   */
  originalCode?: string;
}

/**
 * API 元信息
 */
export interface ApiMeta {
  requestId: string;
  timestamp: number;
  latency?: number;
  version?: string;
  // 分页字段（仅列表接口使用）
  page?: number;
  limit?: number;
  limitCapped?: boolean;
  total?: number;
  totalPages?: number;
  // Cursor 分页（Level 2 扩展点）
  cursor?: string;
  nextCursor?: string;
  hasMore?: boolean;
  // 允许扩展其他字段
  [key: string]: unknown;
}

// ========== 便捷类型别名 ==========

/**
 * 分页列表响应
 * data 永远是数组，即使是空数组
 */
export type PaginatedResponse<T> = OrionResponse<T[]>;

/**
 * 单个资源响应
 */
export type SingleResponse<T> = OrionResponse<T>;