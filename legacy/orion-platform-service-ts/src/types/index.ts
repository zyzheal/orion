/**
 * Orion Platform Service - 类型定义导出
 *
 * API 响应类型定义
 * @see docs/superpowers/specs/2026-05-21-api-response-standard-design.md
 */

// API 响应类型
export {
  type OrionResponse,
  type ApiError,
  type ApiMeta,
  type PaginatedResponse,
  type SingleResponse,
} from './api-response';

// 错误码定义
export { ErrorCodes, type ErrorCode, isClientError, isSystemError, isBusinessError } from './error-codes';