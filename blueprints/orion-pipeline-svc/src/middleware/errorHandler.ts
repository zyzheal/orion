import type { FastifyInstance, FastifyError } from 'fastify';

/**
 * Register global error handler for the Fastify application.
 */
export function errorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    fastify.log.error(error, 'Unhandled error');

    if (reply.statusCode >= 500) {
      return reply.send({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    return reply.send({
      error: error.message || 'An error occurred',
      code: error.code,
    });
  });
}
