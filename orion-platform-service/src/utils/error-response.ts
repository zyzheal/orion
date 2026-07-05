/**
 * Unified Error Response Format
 *
 * Standardizes all error responses across the platform to a single structure:
 * {
 *   success: false,
 *   error: {
 *     code: string,       // Machine-readable error code
 *     message: string,    // Human-readable message
 *     details?: unknown   // Optional debug details (dev only)
 *   },
 *   requestId?: string    // Optional request correlation ID
 * }
 *
 * Success responses follow:
 * {
 *   success: true,
 *   data: <payload>
 * }
 */

export enum ErrorCode {
  // Client errors (4xx)
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  DUPLICATE = 'DUPLICATE',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Business logic errors
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  STATE_TRANSITION_ERROR = 'STATE_TRANSITION_ERROR',
  DEPLOYMENT_BLOCKED = 'DEPLOYMENT_BLOCKED',
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  requestId?: string;
  timestamp: string;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  timestamp: string;
}

/**
 * Create a standardized error response.
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
  requestId?: string,
): ErrorResponse {
  return {
    success: false,
    error: { code, message, details },
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a standardized success response.
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a paginated response.
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Map an Error instance to an ErrorCode.
 */
export function errorToCode(error: Error): ErrorCode {
  const msg = error.message.toLowerCase();
  if (msg.includes('not found') || msg.includes('does not exist')) return ErrorCode.NOT_FOUND;
  if (msg.includes('unauthorized') || msg.includes('invalid token') || msg.includes('expired')) return ErrorCode.UNAUTHORIZED;
  if (msg.includes('forbidden') || msg.includes('permission') || msg.includes('role')) return ErrorCode.FORBIDDEN;
  if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) return ErrorCode.DUPLICATE;
  if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required')) return ErrorCode.VALIDATION_ERROR;
  if (msg.includes('timeout')) return ErrorCode.TIMEOUT;
  if (msg.includes('database') || msg.includes('postgres') || msg.includes('sql')) return ErrorCode.DATABASE_ERROR;
  return ErrorCode.INTERNAL_ERROR;
}
