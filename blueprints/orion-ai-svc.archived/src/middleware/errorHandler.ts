/**
 * Global error handler middleware for Fastify
 */

import { FastifyInstance } from 'fastify';

export function errorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error, 'Unhandled error');
    const statusCode = (error as any).statusCode ?? 500;
    return reply.code(statusCode).send({
      error: (error as any).code ?? 'INTERNAL_ERROR',
      message: (error as any).message ?? 'Internal server error',
    });
  });
}
