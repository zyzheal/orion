/**
 * 错误码定义
 *
 * 采用 XYYZZ 格式：
 * - X: 系统分类（1=平台，2=认证，3=业务，4=外部）
 * - YY: 模块编号
 * - ZZ: 具体错误编号
 */

import { BaseError } from './base-error';

/**
 * 错误码枚举
 */
export enum ErrorCodes {
  // ==================== 平台错误 (1XXZZ) ====================
  // 网关模块 (01)
  GATEWAY_UNAVAILABLE = '10101',
  ROUTE_NOT_FOUND = '10102',
  METHOD_NOT_ALLOWED = '10103',

  // 限流模块 (02)
  GATEWAY_RATE_LIMIT_EXCEEDED = '10201',

  // 配置模块 (03)
  CONFIG_INVALID = '10301',

  // API 版本模块 (06)
  VERSION_RETIRED = '10601',
  VERSION_REQUIRED = '10602',
  VERSION_ERROR = '10603',
  VERSION_UNSUPPORTED = '10604',

  // ==================== 认证错误 (2XXZZ) ====================
  // JWT 模块 (01)
  TOKEN_EXPIRED = '20101',
  TOKEN_INVALID = '20102',
  TOKEN_MISSING = '20103',

  // OAuth 模块 (02)
  OAUTH_CALLBACK_ERROR = '20201',
  OAUTH_STATE_INVALID = '20202',

  // API Key 模块 (03)
  API_KEY_INVALID = '20301',
  API_KEY_EXPIRED = '20302',

  // 会话模块 (04)
  SESSION_EXPIRED = '20401',
  SESSION_INVALID = '20402',

  // 权限模块 (05)
  PERMISSION_DENIED = '20501',
  ROLE_NOT_FOUND = '20502',

  // ==================== 业务错误 (3XXZZ) ====================
  // 参数验证模块 (01)
  VALIDATION_ERROR = '30101',
  REQUIRED_FIELD_MISSING = '30102',
  INVALID_PARAMETER_FORMAT = '30103',
  PARAMETER_OUT_OF_RANGE = '30104',

  // 资源操作模块 (02)
  RESOURCE_NOT_FOUND = '30201',
  RESOURCE_EXISTS = '30202',
  RESOURCE_DELETED = '30203',
  RESOURCE_LOCKED = '30204',

  // 状态机模块 (03)
  INVALID_STATE = '30301',
  STATE_TRANSITION_FORBIDDEN = '30302',

  // 数据一致性模块 (04)
  DATA_INCONSISTENT = '30401',
  CONSTRAINT_VIOLATION = '30402',

  // 配额限制模块 (05)
  QUOTA_EXCEEDED = '30501',
  RATE_LIMIT_EXCEEDED = '30502',

  // ==================== 外部服务错误 (4XXZZ) ====================
  // HTTP 调用模块 (01)
  HTTP_REQUEST_FAILED = '40101',
  HTTP_TIMEOUT = '40102',
  HTTP_STATUS_ERROR = '40103',

  // 数据库模块 (02)
  DATABASE_ERROR = '40201',
  DATABASE_CONNECTION_LOST = '40202',
  DATABASE_QUERY_TIMEOUT = '40203',
  DATABASE_CONSTRAINT_VIOLATION = '40204',

  // 缓存模块 (03)
  CACHE_ERROR = '40301',
  CACHE_MISS = '40302',
  CACHE_CONNECTION_LOST = '40303',

  // 消息队列模块 (04)
  MQ_PUBLISH_FAILED = '40401',
  MQ_CONSUME_FAILED = '40402',
  MQ_CONNECTION_LOST = '40403',

  // 第三方 API 模块 (05)
  THIRD_PARTY_ERROR = '40501',
  THIRD_PARTY_TIMEOUT = '40502',
  THIRD_PARTY_RATE_LIMIT = '40503',
}

/**
 * 错误码到 HTTP 状态码的映射
 */
export const ERROR_STATUS_MAP: Record<string, number> = {
  // 平台错误
  '10101': 503,
  '10102': 404,
  '10103': 405,
  '10201': 429,
  '10301': 500,
  '10601': 410,
  '10602': 400,
  '10603': 500,
  '10604': 400,

  // 认证错误
  '20101': 401,
  '20102': 401,
  '20103': 401,
  '20201': 400,
  '20202': 400,
  '20301': 401,
  '20302': 401,
  '20401': 401,
  '20402': 401,
  '20501': 403,
  '20502': 404,

  // 业务错误
  '30101': 400,
  '30102': 400,
  '30103': 400,
  '30104': 400,
  '30201': 404,
  '30202': 409,
  '30203': 410,
  '30204': 423,
  '30301': 400,
  '30302': 400,
  '30401': 500,
  '30402': 409,
  '30501': 429,
  '30502': 429,

  // 外部服务错误
  '40101': 502,
  '40102': 504,
  '40103': 502,
  '40201': 500,
  '40202': 503,
  '40203': 504,
  '40204': 409,
  '40301': 500,
  '40302': 404,
  '40303': 503,
  '40401': 500,
  '40402': 500,
  '40403': 503,
  '40501': 502,
  '40502': 504,
  '40503': 429,
};

/**
 * 错误码到消息的映射
 */
export const ERROR_MESSAGE_MAP: Record<string, string> = {
  // 平台错误
  '10101': 'Gateway service unavailable',
  '10102': 'Route not found',
  '10103': 'HTTP method not allowed',
  '10201': 'Rate limit exceeded',
  '10301': 'Invalid configuration',
  '10601': 'API version has been retired',
  '10602': 'API version is required',
  '10603': 'Failed to process API version',
  '10604': 'Unsupported API version',

  // 认证错误
  '20101': 'Token has expired',
  '20102': 'Token is invalid',
  '20103': 'Token is missing',
  '20201': 'OAuth callback error',
  '20202': 'OAuth state parameter invalid',
  '20301': 'API key is invalid',
  '20302': 'API key has expired',
  '20401': 'Session has expired',
  '20402': 'Session is invalid',
  '20501': 'Permission denied',
  '20502': 'Role not found',

  // 业务错误
  '30101': 'Validation failed',
  '30102': 'Required field is missing',
  '30103': 'Invalid parameter format',
  '30104': 'Parameter out of valid range',
  '30201': 'Resource not found',
  '30202': 'Resource already exists',
  '30203': 'Resource has been deleted',
  '30204': 'Resource is locked',
  '30301': 'Invalid resource state',
  '30302': 'State transition is forbidden',
  '30401': 'Data inconsistency detected',
  '30402': 'Constraint violation',
  '30501': 'Quota exceeded',
  '30502': 'Rate limit exceeded',

  // 外部服务错误
  '40101': 'HTTP request failed',
  '40102': 'HTTP request timeout',
  '40103': 'Unexpected HTTP status code',
  '40201': 'Database operation failed',
  '40202': 'Database connection lost',
  '40203': 'Database query timeout',
  '40204': 'Database constraint violation',
  '40301': 'Cache operation failed',
  '40302': 'Cache miss',
  '40303': 'Cache connection lost',
  '40401': 'Failed to publish message',
  '40402': 'Failed to consume message',
  '40403': 'Message queue connection lost',
  '40501': 'Third-party service error',
  '40502': 'Third-party service timeout',
  '40503': 'Third-party rate limit exceeded',
};

/**
 * 错误工厂类
 *
 * 用于创建各种类型的错误
 */
export class ErrorFactory {
  /**
   * 根据错误码创建错误实例
   */
  static create(code: ErrorCodes | string, details?: any): AppError {
    const errorCode = typeof code === 'string' ? code : ErrorCodes[code];
    const message = ERROR_MESSAGE_MAP[errorCode] || 'Unknown error';
    const statusCode = ERROR_STATUS_MAP[errorCode] || 500;

    return new AppError(errorCode, message, statusCode, details);
  }

  /**
   * 创建平台错误
   */
  static platform(code: ErrorCodes, details?: any): AppError {
    return this.create(code, details);
  }

  /**
   * 创建认证错误
   */
  static auth(code: ErrorCodes, details?: any): AppError {
    return this.create(code, details);
  }

  /**
   * 创建业务错误
   */
  static business(code: ErrorCodes, details?: any): AppError {
    return this.create(code, details);
  }

  /**
   * 创建外部服务错误
   */
  static external(code: ErrorCodes, details?: any): AppError {
    return this.create(code, details);
  }
}

/**
 * 应用错误类
 *
 * 继承自 BaseError，用于所有应用层面的错误
 */
export class AppError extends BaseError {
  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: any
  ) {
    super(code, message, statusCode, details);
  }
}

// ==================== 快捷错误创建函数 ====================

/**
 * 平台错误快捷创建
 */
export function gatewayUnavailable(): AppError {
  return ErrorFactory.create(ErrorCodes.GATEWAY_UNAVAILABLE);
}

export function routeNotFound(path?: string): AppError {
  return ErrorFactory.create(ErrorCodes.ROUTE_NOT_FOUND, { path });
}

export function methodNotAllowed(allowedMethods?: string[]): AppError {
  return ErrorFactory.create(ErrorCodes.METHOD_NOT_ALLOWED, { allowedMethods });
}

export function rateLimitExceeded(limit?: number, resetAt?: string): AppError {
  return ErrorFactory.create(ErrorCodes.GATEWAY_RATE_LIMIT_EXCEEDED, { limit, resetAt });
}

/**
 * 认证错误快捷创建
 */
export function tokenExpired(expiredAt?: string): AppError {
  return ErrorFactory.create(ErrorCodes.TOKEN_EXPIRED, { expiredAt });
}

export function tokenInvalid(reason?: string): AppError {
  return ErrorFactory.create(ErrorCodes.TOKEN_INVALID, { reason });
}

export function tokenMissing(): AppError {
  return ErrorFactory.create(ErrorCodes.TOKEN_MISSING);
}

export function permissionDenied(resource?: string, action?: string): AppError {
  return ErrorFactory.create(ErrorCodes.PERMISSION_DENIED, { resource, action });
}

/**
 * 业务错误快捷创建
 */
export function validationError(field: string, reason: string): AppError {
  return ErrorFactory.create(ErrorCodes.VALIDATION_ERROR, { field, reason });
}

export function requiredFieldMissing(field: string): AppError {
  return ErrorFactory.create(ErrorCodes.REQUIRED_FIELD_MISSING, { field });
}

export function resourceNotFound(resourceType: string, id: string | number): AppError {
  return ErrorFactory.create(ErrorCodes.RESOURCE_NOT_FOUND, { resourceType, id });
}

export function resourceExists(resourceType: string, identifier: string): AppError {
  return ErrorFactory.create(ErrorCodes.RESOURCE_EXISTS, { resourceType, identifier });
}

export function invalidState(currentState: string, expectedStates?: string[]): AppError {
  return ErrorFactory.create(ErrorCodes.INVALID_STATE, { currentState, expectedStates });
}

/**
 * 外部服务错误快捷创建
 */
export function databaseError(message: string, query?: string): AppError {
  return ErrorFactory.create(ErrorCodes.DATABASE_ERROR, { message, query });
}

export function cacheError(message: string, key?: string): AppError {
  return ErrorFactory.create(ErrorCodes.CACHE_ERROR, { message, key });
}

export function httpTimeout(url: string, timeout: number): AppError {
  return ErrorFactory.create(ErrorCodes.HTTP_TIMEOUT, { url, timeout });
}

export function thirdPartyError(service: string, message: string): AppError {
  return ErrorFactory.create(ErrorCodes.THIRD_PARTY_ERROR, { service, message });
}
