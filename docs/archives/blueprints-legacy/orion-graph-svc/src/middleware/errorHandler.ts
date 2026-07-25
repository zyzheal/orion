import type { FastifyInstance } from 'fastify';

export function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    const statusCode = error.statusCode || 500;
    return reply.code(statusCode).send({
      error: error.message || 'Internal Server Error',
      statusCode,
    });
  });
}
