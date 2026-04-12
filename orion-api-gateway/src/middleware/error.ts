/**
 * 错误处理中间件
 *
 * 统一错误处理，返回标准格式的错误响应
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { BaseError, ErrorCategory } from '../errors/base-error';
import { ErrorCodes, ERROR_STATUS_MAP, ERROR_MESSAGE_MAP, AppError } from '../errors/error-codes';

export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  details?: any;
  requestId?: string;
  timestamp: string;
  category?: ErrorCategory;
}

export { ErrorCodes, ERROR_STATUS_MAP, ERROR_MESSAGE_MAP, AppError };

export class ErrorMiddleware {
  /**
   * 创建错误响应体
   */
  createErrorResponse(
    error: string,
    message: string,
    code: string,
    details?: any,
    requestId?: string,
    category?: ErrorCategory
  ): ErrorResponse {
    return {
      error,
      message,
      code,
      details,
      requestId,
      timestamp: new Date().toISOString(),
      category,
    };
  }

  /**
   * 错误处理处理器
   */
  async handler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const requestId = request.headers['x-request-id'] as string | undefined;

    // 处理自定义应用错误（新的 BaseError）
    if (error instanceof BaseError) {
      reply.code(error.statusCode).send(
        this.createErrorResponse(
          error.name,
          error.message,
          error.code,
          error.details,
          requestId,
          error.category
        )
      );
      return;
    }

    // 处理旧的 AppError（兼容）
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(
        this.createErrorResponse(error.name, error.message, error.code, error.details, requestId)
      );
      return;
    }

    // 处理 Fastify 验证错误
    if (error.validation) {
      reply.code(400).send(
        this.createErrorResponse(
          'ValidationError',
          'Validation failed',
          ErrorCodes.VALIDATION_ERROR,
          error.validation,
          requestId,
          ErrorCategory.BUSINESS
        )
      );
      return;
    }

    // 处理 404
    if (reply.statusCode === 404) {
      reply.code(404).send(
        this.createErrorResponse(
          'NotFoundError',
          'Resource not found',
          ErrorCodes.RESOURCE_NOT_FOUND,
          undefined,
          requestId,
          ErrorCategory.BUSINESS
        )
      );
      return;
    }

    // 默认服务器错误
    const statusCode = (error as any).statusCode || 500;
    reply.code(statusCode).send(
      this.createErrorResponse(
        'InternalError',
        statusCode === 500 ? 'Internal server error' : error.message,
        '10301',
        process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
        requestId,
        ErrorCategory.PLATFORM
      )
    );
  }
}

export const errorMiddleware = new ErrorMiddleware();

// 快捷错误创建函数（兼容旧的 API）
export function createError(code: string, message: string, statusCode?: number, details?: any): AppError {
  return new AppError(code, message, statusCode || 500, details);
}

export function badRequest(message: string, details?: any): AppError {
  return new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details);
}

export function notFound(message: string = 'Resource not found'): AppError {
  return new AppError(ErrorCodes.RESOURCE_NOT_FOUND, message, 404);
}

export function unauthorized(message: string = 'Authentication required'): AppError {
  return new AppError(ErrorCodes.TOKEN_MISSING, message, 401);
}

export function forbidden(message: string = 'Insufficient permissions'): AppError {
  return new AppError(ErrorCodes.PERMISSION_DENIED, message, 403);
}

export function internalError(message: string = 'Internal server error'): AppError {
  return new AppError(ErrorCodes.DATABASE_ERROR, message, 500);
}
