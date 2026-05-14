import { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * 全局错误处理中间件
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = ((error as unknown) as Record<string, unknown>).statusCode as number || 500;
    const message = error.message || 'Internal Server Error';

    app.log.error({
      err: error,
      statusCode,
      message,
    }, 'Request error');

    reply.code(statusCode).send({
      error: {
        statusCode,
        message,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
      },
    });
  });

  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({
      error: {
        statusCode: 404,
        message: 'Route not found',
      },
    });
  });
}

export default registerErrorHandler;
