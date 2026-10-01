/**
 * 错误处理模块索引
 */

export { BaseError, ErrorCategory } from './base-error';
export type { ErrorDetails, ErrorMetadata, ErrorResponse } from './base-error';

export {
  ErrorCodes,
  ERROR_STATUS_MAP,
  ERROR_MESSAGE_MAP,
  ErrorFactory,
  AppError,
} from './error-codes';

// 快捷错误创建函数
export {
  gatewayUnavailable,
  routeNotFound,
  methodNotAllowed,
  rateLimitExceeded,
  tokenExpired,
  tokenInvalid,
  tokenMissing,
  permissionDenied,
  validationError,
  requiredFieldMissing,
  resourceNotFound,
  resourceExists,
  invalidState,
  databaseError,
  cacheError,
  httpTimeout,
  thirdPartyError,
} from './error-codes';
