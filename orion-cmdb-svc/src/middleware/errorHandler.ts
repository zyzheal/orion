/**
 * Error Handler - 全局错误处理
 * CMDB 服务统一错误处理中间件
 */

import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export function errorHandler(app: FastifyInstance): void {
  // 全局错误处理器
  app.setErrorHandler(
    (error: FastifyError & AppError, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode ?? 500;

      app.log.error({
        err: error,
        requestId: request.id,
        url: request.url,
        method: request.method,
      });

      reply.code(statusCode).send({
        success: false,
        error: {
          code: error.code ?? 'INTERNAL_ERROR',
          message: statusCode === 500 ? 'Internal server error' : error.message,
          details: error.details,
        },
        timestamp: new Date().toISOString(),
        requestId: request.id,
      });
    }
  );

  // 404 处理器
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
      timestamp: new Date().toISOString(),
      requestId: request.id,
    });
  });
}
