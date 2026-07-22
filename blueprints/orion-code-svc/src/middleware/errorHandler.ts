/**
 * Error Handler Middleware - Fastify 错误处理中间件
 */

import { FastifyInstance, FastifyError } from 'fastify';

export function errorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);

    const statusCode = (error as any).statusCode;
    if (statusCode) {
      return reply.status(statusCode).send({
        error: error.name,
        message: error.message,
      });
    }

    return reply.status(500).send({
      error: 'InternalError',
      message: 'An unexpected error occurred',
    });
  });
}
