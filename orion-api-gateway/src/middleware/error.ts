/**
 * 错误处理中间件
 *
 * 统一错误处理，返回标准格式的错误响应
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
  requestId?: string;
  timestamp: string;
}

export enum ErrorCode {
  // 通用错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',

  // 业务错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INVALID_STATE = 'INVALID_STATE',

  // 外部服务错误
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ErrorMiddleware {
  /**
   * 创建错误响应体
   */
  createErrorResponse(
    error: string,
    message: string,
    code?: string,
    details?: any,
    requestId?: string
  ): ErrorResponse {
    return {
      error,
      message,
      code,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 错误处理处理器
   */
  async handler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const requestId = request.headers['x-request-id'] as string | undefined;

    // 处理自定义应用错误
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(
        this.createErrorResponse(error.code, error.message, error.code, error.details, requestId)
      );
      return;
    }

    // 处理 Fastify 验证错误
    if (error.validation) {
      reply.code(400).send(
        this.createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Validation failed',
          ErrorCode.VALIDATION_ERROR,
          error.validation,
          requestId
        )
      );
      return;
    }

    // 处理 404
    if (reply.statusCode === 404) {
      reply.code(404).send(
        this.createErrorResponse(
          ErrorCode.NOT_FOUND,
          'Resource not found',
          ErrorCode.NOT_FOUND,
          undefined,
          requestId
        )
      );
      return;
    }

    // 默认服务器错误
    const statusCode = (error as any).statusCode || 500;
    reply.code(statusCode).send(
      this.createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        statusCode === 500 ? 'Internal server error' : error.message,
        ErrorCode.INTERNAL_ERROR,
        process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
        requestId
      )
    );
  }
}

export const errorMiddleware = new ErrorMiddleware();

// 快捷错误创建函数
export function createError(code: ErrorCode, message: string, statusCode?: number, details?: any): AppError {
  return new AppError(code, message, statusCode, details);
}

export function badRequest(message: string, details?: any): AppError {
  return new AppError(ErrorCode.BAD_REQUEST, message, 400, details);
}

export function notFound(message: string = 'Resource not found'): AppError {
  return new AppError(ErrorCode.NOT_FOUND, message, 404);
}

export function unauthorized(message: string = 'Authentication required'): AppError {
  return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
}

export function forbidden(message: string = 'Insufficient permissions'): AppError {
  return new AppError(ErrorCode.FORBIDDEN, message, 403);
}

export function internalError(message: string = 'Internal server error'): AppError {
  return new AppError(ErrorCode.INTERNAL_ERROR, message, 500);
}
