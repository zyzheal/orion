// ============================================================
// Orion API 错误分类 (Plan 01 — API Client 增强)
// 类型化错误: 统一错误模型，便于前端精准处理
// ============================================================

import type { AxiosError } from 'axios';

/** 错误分类枚举 */
export enum ErrorCode {
  // 认证
  UNAUTHORIZED = 'ERR_UNAUTHORIZED',       // 401 — token 过期/无效
  FORBIDDEN = 'ERR_FORBIDDEN',              // 403 — 权限不足
  // 资源
  NOT_FOUND = 'ERR_NOT_FOUND',              // 404 — 资源不存在
  CONFLICT = 'ERR_CONFLICT',               // 409 — 资源冲突
  VALIDATION = 'ERR_VALIDATION',            // 400/422 — 参数校验失败
  // 限流与重试
  RATE_LIMITED = 'ERR_RATE_LIMITED',        // 429 — 请求过多
  TIMEOUT = 'ERR_TIMEOUT',                  // 超时
  // 服务端
  BAD_GATEWAY = 'ERR_BAD_GATEWAY',          // 502
  UNAVAILABLE = 'ERR_UNAVAILABLE',          // 503
  INTERNAL = 'ERR_INTERNAL',                // 500
  // 网络
  NETWORK = 'ERR_NETWORK',                  // 网络中断
  ABORTED = 'ERR_ABORTED',                  // 请求取消
  UNKNOWN = 'ERR_UNKNOWN',                  // 未知错误
}

/** 错误严重级别 */
export enum ErrorSeverity {
  FATAL = 'fatal',        // 需要页面跳转或重新登录
  ERROR = 'error',        // 显示错误提示
  WARNING = 'warning',    // 显示警告提示
  INFO = 'info',          // 记录日志，无需提示
  SILENT = 'silent',      // 静默忽略
}

/** 后端错误详情结构 (兼容 ResponseEnvelope) */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, unknown> | Record<string, string[]>;
  requestId?: string;
}

/** Orion 类型化错误 */
export class OrionError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly status?: number;
  public readonly requestId?: string;
  public readonly details?: Record<string, unknown> | Record<string, string[]>;
  public readonly originalError?: AxiosError;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      status?: number;
      requestId?: string;
      details?: Record<string, unknown> | Record<string, string[]>;
      severity?: ErrorSeverity;
      originalError?: AxiosError;
    }
  ) {
    super(message);
    this.name = 'OrionError';
    this.code = code;
    this.severity = options?.severity ?? ErrorSeverity.ERROR;
    this.status = options?.status;
    this.requestId = options?.requestId;
    this.details = options?.details;
    this.originalError = options?.originalError;
  }

  /** 是否应该重试 */
  get isRetryable(): boolean {
    return [
      ErrorCode.TIMEOUT,
      ErrorCode.BAD_GATEWAY,
      ErrorCode.UNAVAILABLE,
      ErrorCode.RATE_LIMITED,
      ErrorCode.NETWORK,
    ].includes(this.code);
  }

  /** 是否应该提示用户 */
  get shouldNotify(): boolean {
    return [ErrorSeverity.FATAL, ErrorSeverity.ERROR, ErrorSeverity.WARNING].includes(this.severity);
  }

  /** 是否应该跳转登录 */
  get shouldRedirectLogin(): boolean {
    return this.severity === ErrorSeverity.FATAL;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      status: this.status,
      requestId: this.requestId,
      isRetryable: this.isRetryable,
    };
  }
}

/** HTTP 状态码 → 错误码映射 */
export function classifyError(status: number): ErrorCode {
  if (status === 401) return ErrorCode.UNAUTHORIZED;
  if (status === 403) return ErrorCode.FORBIDDEN;
  if (status === 404) return ErrorCode.NOT_FOUND;
  if (status === 409) return ErrorCode.CONFLICT;
  if (status === 400 || status === 422) return ErrorCode.VALIDATION;
  if (status === 429) return ErrorCode.RATE_LIMITED;
  if (status === 502) return ErrorCode.BAD_GATEWAY;
  if (status === 503) return ErrorCode.UNAVAILABLE;
  if (status >= 500) return ErrorCode.INTERNAL;
  return ErrorCode.UNKNOWN;
}

/** AxiosError → OrionError */
export function fromAxiosError(error: AxiosError<ErrorResponse>): OrionError {
  if (error.code === 'ECONNABORTED' || error.message === 'timeout') {
    return new OrionError(ErrorCode.TIMEOUT, '请求超时', {
      originalError: error,
      severity: ErrorSeverity.ERROR,
    });
  }
  if (error.code === 'ERR_CANCELED' || error.message === 'canceled') {
    return new OrionError(ErrorCode.ABORTED, '请求已取消', {
      originalError: error,
      severity: ErrorSeverity.SILENT,
    });
  }
  if (!error.response) {
    return new OrionError(ErrorCode.NETWORK, '网络连接失败', {
      originalError: error,
      severity: ErrorSeverity.ERROR,
    });
  }
  const { status, data } = error.response;
  const code = classifyError(status);
  const severity = status >= 500 ? ErrorSeverity.FATAL : ErrorSeverity.ERROR;
  return new OrionError(
    code,
    data?.error || error.message || '请求失败',
    {
      status,
      requestId: data?.requestId,
      details: data?.details,
      severity,
      originalError: error,
    }
  );
}
