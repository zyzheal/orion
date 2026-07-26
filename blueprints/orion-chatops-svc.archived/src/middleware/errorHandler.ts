/**
 * Error Handler Middleware
 *
 * Registers global error handler with Fastify.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrionError, ErrorCode } from '../errors';

export function errorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error: Error, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof OrionError) {
      reply.status(error.getHttpStatus()).send({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    } else if (error instanceof Error) {
      fastify.log.error(error, 'Unhandled error');
      reply.status(500).send({
        success: false,
        error: 'Internal server error',
        code: ErrorCode.INTERNAL_ERROR,
      });
    } else {
      reply.status(500).send({
        success: false,
        error: 'Unknown error',
        code: ErrorCode.INTERNAL_ERROR,
      });
    }
  });
}
