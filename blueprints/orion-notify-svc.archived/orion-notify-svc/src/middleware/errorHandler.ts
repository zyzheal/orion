import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, _request: FastifyRequest, reply: FastifyReply) => {
    fastify.log.error(error);

    const err = error as Error & { code?: string };

    if (err.name === 'NotificationServiceError') {
      const statusCode = err.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: err.name,
        message: err.message,
        code: err.code,
      });
    }

    if (err.name === 'WebhookServiceError') {
      const statusCode = err.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: err.name,
        message: err.message,
        code: err.code,
      });
    }

    return reply.status(500).send({
      success: false,
      error: 'Internal Server Error',
      message: err.message,
    });
  });
}
