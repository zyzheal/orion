/**
 * Orion 全局错误类型系统
 *
 * ARCH-013: 统一全系统的错误处理策略
 *
 * 功能:
 * 1. 统一的错误代码枚举
 * 2. 统一的错误类层次结构
 * 3. 统一的 API 响应格式
 * 4. 统一的错误处理工具函数
 */

import { FastifyReply } from 'fastify';

/**
 * 错误代码枚举 - 全系统统一
 */
export enum ErrorCode {
  // 认证/授权错误 (401/403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // 资源错误 (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',

  // 输入验证错误 (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  PARAM_REQUIRED = 'PARAM_REQUIRED',
  PARAM_INVALID = 'PARAM_INVALID',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // 状态错误 (409)
  CONFLICT = 'CONFLICT',
  STATE_CONFLICT = 'STATE_CONFLICT',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // 业务逻辑错误 (422)
  BUSINESS_ERROR = 'BUSINESS_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',

  // 服务错误 (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // 可恢复错误
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  FALLBACK_MODE = 'FALLBACK_MODE',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
}

/**
 * HTTP 状态码映射
 */
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.ENTITY_NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.PARAM_REQUIRED]: 400,
  [ErrorCode.PARAM_INVALID]: 400,
  [ErrorCode.DUPLICATE_ENTRY]: 400,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.STATE_CONFLICT]: 409,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.BUSINESS_ERROR]: 422,
  [ErrorCode.OPERATION_FAILED]: 422,
  [ErrorCode.DEPENDENCY_FAILED]: 422,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.TIMEOUT]: 504,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.FALLBACK_MODE]: 200,  // Fallback 仍可服务，只是功能受限
  [ErrorCode.RETRY_EXHAUSTED]: 503,
};

/**
 * OrionError - 全系统统一错误基类
 */
export class OrionError extends Error {
  constructor(
    message: string,
    public code: ErrorCode | string,
    public recoverable: boolean = false,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OrionError';
  }

  /**
   * 获取 HTTP 状态码
   */
  getHttpStatus(): number {
    return ErrorCodeToHttpStatus[this.code as ErrorCode] || 500;
  }

  /**
   * 转换为 API 响应格式
   */
  toJSON(): ApiErrorResponse {
    return {
      success: false,
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * API 响应格式
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: ErrorCode | string;
  details?: Record<string, unknown>;
  total?: number;
  metadata?: Record<string, unknown>;
}

/**
 * API 错误响应格式
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: ErrorCode | string;
  details?: Record<string, unknown>;
}

/**
 * 具体错误类型
 */

/** 输入验证错误 */
export class ValidationError extends OrionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION_ERROR, false, details);
    this.name = 'ValidationError';
  }

  /** 从字段名创建验证错误 */
  static fromField(field: string, reason: string): ValidationError {
    return new ValidationError(`字段 ${field} 验证失败: ${reason}`, { field, reason });
  }

  /** 从必填字段创建验证错误 */
  static required(field: string): ValidationError {
    return new ValidationError(`字段 ${field} 必填`, { field, reason: 'required' });
  }
}

/** 资源不存在错误 */
export class NotFoundError extends OrionError {
  constructor(resourceType: string, resourceId?: string, message?: string) {
    super(
      message || (resourceId ? `${resourceType} 不存在: ${resourceId}` : `${resourceType} 不存在`),
      ErrorCode.NOT_FOUND,
      false,
      { resourceType, resourceId },
    );
    this.name = 'NotFoundError';
  }
}

/** 未授权错误 */
export class UnauthorizedError extends OrionError {
  constructor(message: string = '未授权访问，请先登录') {
    super(message, ErrorCode.UNAUTHORIZED, false);
    this.name = 'UnauthorizedError';
  }
}

/** 禁止访问错误 */
export class ForbiddenError extends OrionError {
  constructor(message: string, requiredRole?: string) {
    super(message, ErrorCode.FORBIDDEN, false, { requiredRole });
    this.name = 'ForbiddenError';
  }

  /** 从角色创建禁止访问错误 */
  static fromRole(requiredRoles: string[]): ForbiddenError {
    return new ForbiddenError(`需要角色: ${requiredRoles.join(', ')}`, requiredRoles.join(','));
  }
}

/** 冲突错误 */
export class ConflictError extends OrionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.CONFLICT, false, details);
    this.name = 'ConflictError';
  }
}

/** 业务逻辑错误 */
export class BusinessError extends OrionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.BUSINESS_ERROR, false, details);
    this.name = 'BusinessError';
  }
}

/** 服务不可用错误（可恢复） */
export class ServiceUnavailableError extends OrionError {
  constructor(serviceName: string, reason?: string) {
    super(
      `服务 ${serviceName} 不可用: ${reason || '请稍后重试'}`,
      ErrorCode.SERVICE_UNAVAILABLE,
      true,  // 可恢复
      { serviceName, reason },
    );
    this.name = 'ServiceUnavailableError';
  }
}

/** Fallback 模式错误（可恢复，功能受限） */
export class FallbackModeError extends OrionError {
  constructor(message: string = '系统处于降级模式，功能受限') {
    super(message, ErrorCode.FALLBACK_MODE, true);
    this.name = 'FallbackModeError';
  }
}

/** 外部服务错误 */
export class ExternalServiceError extends OrionError {
  constructor(serviceName: string, originalError?: Error) {
    super(
      `外部服务 ${serviceName} 调用失败`,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      true,  // 可恢复，可能需要重试
      { serviceName, originalError: originalError?.message },
    );
    this.name = 'ExternalServiceError';
  }
}

/** 数据库错误 */
export class DatabaseError extends OrionError {
  constructor(operation: string, originalError?: Error) {
    super(
      `数据库操作失败: ${operation}`,
      ErrorCode.DATABASE_ERROR,
      true,  // 可恢复，可能需要重试
      { operation, originalError: originalError?.message },
    );
    this.name = 'DatabaseError';
  }
}

/**
 * 错误处理工具函数
 */

/**
 * 处理错误并发送响应
 * ARCH-013: 统一错误响应处理
 */
export function handleError(reply: FastifyReply, error: unknown): void {
  if (error instanceof OrionError) {
    reply.status(error.getHttpStatus()).send(error.toJSON());
  } else if (error instanceof Error) {
    // 尝试根据错误消息推断错误类型
    const message = error.message;
    const inferredCode = inferErrorCode(message);
    const status = ErrorCodeToHttpStatus[inferredCode] || 500;

    reply.status(status).send({
      success: false,
      error: message,
      code: inferredCode,
    });
  } else {
    reply.status(500).send({
      success: false,
      error: 'Internal server error',
      code: ErrorCode.INTERNAL_ERROR,
    });
  }
}

/**
 * 从错误消息推断错误代码
 */
function inferErrorCode(message: string): ErrorCode {
  if (message.includes('not found') || message.includes('不存在')) {
    return ErrorCode.NOT_FOUND;
  }
  if (message.includes('required') || message.includes('必填') || message.includes('missing')) {
    return ErrorCode.PARAM_REQUIRED;
  }
  if (message.includes('invalid') || message.includes('无效') || message.includes('invalid format')) {
    return ErrorCode.INVALID_INPUT;
  }
  if (message.includes('unauthorized') || message.includes('未授权') || message.includes('token expired')) {
    return ErrorCode.UNAUTHORIZED;
  }
  if (message.includes('forbidden') || message.includes('禁止') || message.includes('permission')) {
    return ErrorCode.FORBIDDEN;
  }
  if (message.includes('conflict') || message.includes('冲突') || message.includes('already exists')) {
    return ErrorCode.CONFLICT;
  }
  if (message.includes('timeout') || message.includes('超时')) {
    return ErrorCode.TIMEOUT;
  }
  if (message.includes('unavailable') || message.includes('不可用')) {
    return ErrorCode.SERVICE_UNAVAILABLE;
  }
  return ErrorCode.INTERNAL_ERROR;
}

/**
 * 判断是否为可恢复错误
 */
export function isRecoverable(error: unknown): boolean {
  if (error instanceof OrionError) {
    return error.recoverable;
  }
  return false;
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  total?: number,
  metadata?: Record<string, unknown>,
): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  if (total !== undefined) response.total = total;
  if (metadata) response.metadata = metadata;
  return response;
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  error: string,
  code: ErrorCode | string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  return {
    success: false,
    error,
    code,
    details,
  };
}

/**
 * Fastify 错误处理器插件
 */
export function createErrorHandler() {
  return async (error: unknown, request: any, reply: FastifyReply) => {
    // 如果响应已发送，不做处理
    if (reply.sent) return;

    handleError(reply, error);
  };
}